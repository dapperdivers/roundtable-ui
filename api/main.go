package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/cors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// validKnightName matches alphanumeric knight names (prevents NATS injection)
var validKnightName = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9-]{0,62}$`)

var (
	nc        *nats.Conn
	js        jetstream.JetStream
	k8sClient *kubernetes.Clientset
	dynClient dynamic.Interface
	upgrader  = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				return true // non-browser clients
			}
			allowed := envOr("ALLOWED_ORIGINS", "")
			if allowed == "" {
				return true // no restriction configured (local install)
			}
			for _, o := range strings.Split(allowed, ",") {
				if strings.TrimSpace(o) == origin {
					return true
				}
			}
			return false
		},
	}
)

// KnightStatus represents a knight's current state
type KnightStatus struct {
	Name      string            `json:"name"`
	Domain    string            `json:"domain"`
	Status    string            `json:"status"` // online, offline, busy
	Ready     bool              `json:"ready"`
	Restarts  int32             `json:"restarts"`
	Age       string            `json:"age"`
	Image     string            `json:"image"`
	Skills    int               `json:"skills"`
	NixTools  int               `json:"nixTools"`
	Labels    map[string]string `json:"labels"`
}

// TaskEvent represents a NATS task/result/mission/chain event
type TaskEvent struct {
	Type      string          `json:"type"` // task, result, mission, chain
	Subject   string          `json:"subject"`
	Data      json.RawMessage `json:"data"`
	Timestamp time.Time       `json:"timestamp"`
}

// validK8sName validates Kubernetes resource names to prevent label selector injection.
var validK8sName = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

// validSessionTypes is the whitelist of allowed session type query parameters.
var validSessionTypes = map[string]bool{"stats": true, "recent": true, "tree": true}

// authMiddleware checks the DASHBOARD_API_KEY env var for API-key based auth (#68, #65)
func authMiddleware(next http.Handler) http.Handler {
	apiKey := os.Getenv("DASHBOARD_API_KEY")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If no API key is configured, auth is disabled (local dev)
		if apiKey == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Skip auth for health endpoint and static files
		if r.URL.Path == "/api/health" || !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		// Auth endpoint: POST /api/auth/login validates the key and returns success
		if r.URL.Path == "/api/auth/login" && r.Method == "POST" {
			var body struct {
				ApiKey string `json:"apiKey"`
			}
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				return
			}
			if body.ApiKey != apiKey {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "Invalid API key"})
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"authenticated": true,
				"message":       "Welcome to the Round Table",
			})
			return
		}

		// Check Authorization header
		auth := r.Header.Get("Authorization")
		if auth == "" {
			// Also check query param for WebSocket connections
			if qKey := r.URL.Query().Get("api_key"); qKey != "" {
				auth = "Bearer " + qKey
			}
		}

		if !strings.HasPrefix(auth, "Bearer ") || strings.TrimPrefix(auth, "Bearer ") != apiKey {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
			return
		}

		next.ServeHTTP(w, r)
	})
}

// rateLimiter is a simple sliding-window rate limiter (#12)
type rateLimiterT struct {
	mu       sync.Mutex
	tokens   int
	max      int
	interval time.Duration
	last     time.Time
}

func newRateLimiter(max int, interval time.Duration) *rateLimiterT {
	return &rateLimiterT{tokens: max, max: max, interval: interval, last: time.Now()}
}

func (rl *rateLimiterT) allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(rl.last)
	if elapsed >= rl.interval {
		rl.tokens = rl.max
		rl.last = now
	}
	if rl.tokens <= 0 {
		return false
	}
	rl.tokens--
	return true
}

func (rl *rateLimiterT) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rl.allow() {
			http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	natsURL := envOr("NATS_URL", "nats://nats.database.svc:4222")
	namespace := envOr("NAMESPACE", "roundtable")
	port := envOr("PORT", "8080")
	vaultPath := envOr("VAULT_PATH", "/vault")
	fleetPrefix := envOr("FLEET_PREFIX", "fleet-a")       // NATS subject prefix (#23)
	fleetStream := envOr("FLEET_STREAM", "fleet_a_results") // JetStream stream name

	// Connect to NATS
	var err error
	nc, err = nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("NATS connect failed: %v", err)
	}
	defer nc.Close()

	js, err = jetstream.New(nc)
	if err != nil {
		log.Fatalf("JetStream init failed: %v", err)
	}
	log.Printf("NATS connected: %s", natsURL)

	// Connect to Kubernetes (in-cluster)
	config, err := rest.InClusterConfig()
	if err != nil {
		log.Printf("WARNING: K8s in-cluster config failed (running outside cluster?): %v", err)
	} else {
		k8sClient, err = kubernetes.NewForConfig(config)
		if err != nil {
			log.Printf("WARNING: K8s client creation failed: %v", err)
		} else {
			log.Println("Kubernetes client connected")
		}
		dynClient, err = dynamic.NewForConfig(config)
		if err != nil {
			log.Printf("WARNING: Dynamic K8s client creation failed: %v", err)
		}
	}

	// Simple rate limiter (#12)
	rateLimiter := newRateLimiter(100, time.Second) // 100 req/s

	// Router
	r := mux.NewRouter()
	r.Use(authMiddleware)
	r.Use(rateLimiter.middleware)
	api := r.PathPrefix("/api").Subrouter()

	// Auth endpoint (handled in middleware, but register route for documentation)
	api.HandleFunc("/auth/login", func(w http.ResponseWriter, r *http.Request) {
		// Handled by authMiddleware
	}).Methods("POST")

	// Fleet endpoints
	api.HandleFunc("/fleet", fleetHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}", knightHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}/logs", knightLogsHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}/session", knightSessionHandler(fleetPrefix)).Methods("GET")

	// Task endpoints
	api.HandleFunc("/tasks", taskHistoryHandler(fleetPrefix, fleetStream)).Methods("GET")
	api.HandleFunc("/tasks/dispatch", taskDispatchHandler(fleetPrefix)).Methods("POST")

	// Chain endpoints
	api.HandleFunc("/chains", chainsHandler(namespace)).Methods("GET")
	api.HandleFunc("/chains/{name}", chainDetailHandler(namespace)).Methods("GET")

	// Mission endpoints
	api.HandleFunc("/missions", missionsHandler(namespace)).Methods("GET")
	api.HandleFunc("/missions/{name}", missionDetailHandler(namespace)).Methods("GET")
	api.HandleFunc("/missions", missionCreateHandler(namespace)).Methods("POST")
	api.HandleFunc("/missions/{name}", missionDeleteHandler(namespace)).Methods("DELETE")

	// KV endpoints (NATS KV store)
	api.HandleFunc("/missions/{name}/results", missionResultsHandler()).Methods("GET")
	api.HandleFunc("/chains/{name}/steps/{step}/output", chainStepOutputHandler()).Methods("GET")
	api.HandleFunc("/kv/{bucket}/keys", kvKeysHandler()).Methods("GET")
	api.HandleFunc("/kv/{bucket}/{key}", kvGetHandler()).Methods("GET")

	// RoundTable endpoints
	api.HandleFunc("/roundtables", roundTablesHandler(namespace)).Methods("GET")
	api.HandleFunc("/roundtables/{name}", roundTableDetailHandler(namespace)).Methods("GET")

	// Briefing endpoints
	api.HandleFunc("/briefings", briefingListHandler(vaultPath)).Methods("GET")
	api.HandleFunc("/briefings/{date}", briefingHandler(vaultPath)).Methods("GET")

	// WebSocket for real-time NATS events
	api.HandleFunc("/ws", wsHandler(fleetPrefix))

	// Config endpoint to expose fleet prefix to frontend (#60)
	api.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"fleetPrefix": fleetPrefix,
		})
	}).Methods("GET")

	// Health
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")

	// Serve static UI files with SPA fallback
	r.PathPrefix("/").HandlerFunc(spaHandler("./static"))

	// CORS — defaults to same-origin (no origins = same-origin only) (#57)
	corsOpts := cors.Options{
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
	}
	if origins := envOr("ALLOWED_ORIGINS", ""); origins != "" {
		corsOpts.AllowedOrigins = strings.Split(origins, ",")
	}
	handler := cors.New(corsOpts).Handler(r)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("Round Table Dashboard API starting on :%s", port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func buildKnightStatus(pod corev1.Pod) KnightStatus {
	labels := pod.Labels
	if labels == nil {
		labels = map[string]string{}
	}
	status := "offline"
	var restarts int32
	ready := false
	if len(pod.Status.ContainerStatuses) > 0 {
		cs := pod.Status.ContainerStatuses[0]
		restarts = cs.RestartCount
		ready = cs.Ready
		if ready {
			status = "online"
		} else if pod.Status.Phase == "Running" {
			status = "starting"
		}
	}
	ks := KnightStatus{
		Name:     labels["app.kubernetes.io/instance"],
		Domain:   labels["roundtable.io/domain"],
		Status:   status,
		Ready:    ready,
		Restarts: restarts,
		Age:      time.Since(pod.CreationTimestamp.Time).Round(time.Second).String(),
		Labels:   pod.Labels,
	}
	if len(pod.Spec.Containers) > 0 {
		ks.Image = pod.Spec.Containers[0].Image
	}
	return ks
}

func fleetHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if k8sClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		pods, err := k8sClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
			LabelSelector: "app.kubernetes.io/name=knight",
		})
		if err != nil {
			log.Printf("K8s fleet list error: %v", err)
			http.Error(w, "Failed to list fleet", http.StatusInternalServerError)
			return
		}

		knights := []KnightStatus{}
		for _, pod := range pods.Items {
			// Skip CronJob pods and pods with no containers
			if _, ok := pod.Labels["job-name"]; ok {
				continue
			}
			if len(pod.Spec.Containers) == 0 {
				continue
			}
			knights = append(knights, buildKnightStatus(pod))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(knights)
	}
}

// KnightDetail is a safe DTO — no raw K8s pod data exposed (#46)
type KnightDetail struct {
	KnightStatus
	Node       string            `json:"node"`
	PodName    string            `json:"podName"`
	Phase      string            `json:"phase"`
	StartTime  *time.Time        `json:"startTime"`
	Containers []ContainerDetail `json:"containers"`
	Conditions []PodCondition    `json:"conditions"`
}

type ContainerDetail struct {
	Name    string `json:"name"`
	Image   string `json:"image"`
	Ready   bool   `json:"ready"`
	State   string `json:"state"`
	Started *bool  `json:"started"`
}

type PodCondition struct {
	Type   string `json:"type"`
	Status string `json:"status"`
}

func knightHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]

		if !validK8sName.MatchString(name) {
			http.Error(w, "Invalid knight name", http.StatusBadRequest)
			return
		}

		if k8sClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		pods, err := k8sClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
			LabelSelector: fmt.Sprintf("app.kubernetes.io/name=knight,app.kubernetes.io/instance=%s", name),
		})
		if err != nil || len(pods.Items) == 0 {
			http.Error(w, "Knight not found", http.StatusNotFound)
			return
		}

		pod := pods.Items[0]

		// Build safe DTO (#46)
		detail := KnightDetail{
			KnightStatus: buildKnightStatus(pod),
			Node:         pod.Spec.NodeName,
			PodName:      pod.Name,
			Phase:        string(pod.Status.Phase),
		}
		if !pod.CreationTimestamp.IsZero() {
			t := pod.CreationTimestamp.Time
			detail.StartTime = &t
		}
		for _, c := range pod.Status.ContainerStatuses {
			state := "unknown"
			if c.State.Running != nil {
				state = "running"
			} else if c.State.Waiting != nil {
				state = "waiting:" + c.State.Waiting.Reason
			} else if c.State.Terminated != nil {
				state = "terminated:" + c.State.Terminated.Reason
			}
			detail.Containers = append(detail.Containers, ContainerDetail{
				Name: c.Name, Image: c.Image, Ready: c.Ready, State: state, Started: c.Started,
			})
		}
		for _, cond := range pod.Status.Conditions {
			detail.Conditions = append(detail.Conditions, PodCondition{
				Type: string(cond.Type), Status: string(cond.Status),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func knightLogsHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]
		lines := int64(100)

		if !validK8sName.MatchString(name) {
			http.Error(w, "Invalid knight name", http.StatusBadRequest)
			return
		}

		if k8sClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		pods, err := k8sClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
			LabelSelector: fmt.Sprintf("app.kubernetes.io/name=knight,app.kubernetes.io/instance=%s", name),
		})
		if err != nil || len(pods.Items) == 0 {
			http.Error(w, "Knight not found", http.StatusNotFound)
			return
		}

		// Timeout prevents indefinite streaming (#55)
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		req := k8sClient.CoreV1().Pods(namespace).GetLogs(pods.Items[0].Name, &corev1.PodLogOptions{
			TailLines: &lines,
		})
		stream, err := req.Stream(ctx)
		if err != nil {
			log.Printf("Log stream error for %s: %v", name, err)
			http.Error(w, "Failed to read logs", http.StatusInternalServerError)
			return
		}
		defer stream.Close()

		w.Header().Set("Content-Type", "text/plain")
		buf := make([]byte, 4096)
		for {
			n, readErr := stream.Read(buf)
			if n > 0 {
				if _, writeErr := w.Write(buf[:n]); writeErr != nil {
					break // client disconnected — stop reading (#53)
				}
			}
			if readErr != nil {
				break
			}
		}
	}
}

func knightSessionHandler(fleetPrefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]
		reqType := r.URL.Query().Get("type")
		if reqType == "" {
			reqType = "stats"
		}
		if !validSessionTypes[reqType] {
			http.Error(w, "Invalid session type (allowed: stats, recent, tree)", http.StatusBadRequest)
			return
		}

		if nc == nil {
			http.Error(w, "NATS not available", http.StatusServiceUnavailable)
			return
		}

		// Validate knight name (prevents NATS subject injection)
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid knight name", http.StatusBadRequest)
			return
		}

		// Knight names in NATS are capitalized (e.g., "Galahad")
		capitalName := capitalizeKnight(name)
		subject := fmt.Sprintf("%s.introspect.%s", fleetPrefix, capitalName)
		payload := fmt.Sprintf(`{"type":"%s"}`, reqType)
		msg, err := nc.Request(subject, []byte(payload), 5*time.Second)
		if err != nil {
			log.Printf("Knight introspect timeout for %s: %v", name, err)
			http.Error(w, "Knight introspection timeout", http.StatusGatewayTimeout)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(msg.Data)
	}
}

func taskHistoryHandler(fleetPrefix, streamName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Read recent results from NATS JetStream
		ctx := r.Context()
		stream, err := js.Stream(ctx, streamName)
		if err != nil {
			log.Printf("JetStream error: %v", err)
			http.Error(w, "Task history unavailable", http.StatusInternalServerError)
			return
		}

		info, _ := stream.Info(ctx)
		results := []TaskEvent{}

		// Get last N messages
		limit := 50
		// Use a named ephemeral consumer with InactiveThreshold for auto-cleanup (#54)
		cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
			DeliverPolicy:     jetstream.DeliverLastPerSubjectPolicy,
			FilterSubject:     fleetPrefix + ".results.>",
			AckPolicy:         jetstream.AckNonePolicy,
			InactiveThreshold: 30 * time.Second,
		})
		if err != nil {
			// Fall back to stream info
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"results":  results,
				"messages": info.State.Msgs,
			})
			return
		}

		msgs, _ := cons.Fetch(limit)
		if msgs != nil {
			for msg := range msgs.Messages() {
				results = append(results, TaskEvent{
					Type:      "result",
					Subject:   msg.Subject(),
					Data:      msg.Data(),
					Timestamp: time.Now(),
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results":  results,
			"messages": info.State.Msgs,
		})
	}
}

func taskDispatchHandler(fleetPrefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Knight  string `json:"knight"`
			Domain  string `json:"domain"`
			Task    string `json:"task"`
			Timeout int    `json:"timeout_ms,omitempty"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}

		// Validate inputs to prevent NATS subject injection
		if !validKnightName.MatchString(req.Knight) || !validKnightName.MatchString(req.Domain) {
			http.Error(w, "Invalid knight or domain name", http.StatusBadRequest)
			return
		}
		if len(req.Task) == 0 || len(req.Task) > 10000 {
			http.Error(w, "Task must be 1-10000 characters", http.StatusBadRequest)
			return
		}

		taskID := fmt.Sprintf("%s-ui-%d", req.Knight, time.Now().UnixMilli())
		subject := fmt.Sprintf("%s.tasks.%s.%s", fleetPrefix, req.Domain, taskID)

		payload, _ := json.Marshal(map[string]interface{}{
			"from":    "ui",
			"task_id": taskID,
			"domain":  req.Domain,
			"task":    req.Task,
			"metadata": map[string]interface{}{
				"type":       "manual",
				"source":     "dashboard",
				"timeout_ms": req.Timeout,
			},
		})

		if err := nc.Publish(subject, payload); err != nil {
			log.Printf("NATS publish error: %v", err)
			http.Error(w, "Failed to dispatch task", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"task_id": taskID,
			"subject": subject,
			"status":  "dispatched",
		})
	}
}

func briefingListHandler(vaultPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dir := fmt.Sprintf("%s/Briefings/Daily", vaultPath)
		entries, err := os.ReadDir(dir)
		if err != nil {
			http.Error(w, "Briefings directory not found", http.StatusNotFound)
			return
		}

		briefings := []string{}
		for _, e := range entries {
			if !e.IsDir() {
				briefings = append(briefings, e.Name())
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(briefings)
	}
}

func briefingHandler(vaultPath string) http.HandlerFunc {
	allowedDir := filepath.Clean(fmt.Sprintf("%s/Briefings/Daily", vaultPath))
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		date := vars["date"]

		// Sanitize: only allow YYYY-MM-DD format to prevent path traversal
		if !regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`).MatchString(date) {
			http.Error(w, "Invalid date format", http.StatusBadRequest)
			return
		}

		path := filepath.Clean(fmt.Sprintf("%s/%s.md", allowedDir, date))
		if !strings.HasPrefix(path, allowedDir) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		content, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, "Briefing not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "text/markdown")
		w.Write(content)
	}
}

func wsHandler(fleetPrefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		// Write mutex + closed flag — gorilla websocket is not concurrent-write safe (#42)
		var writeMu sync.Mutex
		var closed bool
		safeWrite := func(data []byte) {
			writeMu.Lock()
			defer writeMu.Unlock()
			if closed {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				closed = true
			}
		}

		// Done channel to clean up NATS subscriptions when WS closes
		done := make(chan struct{})

		// Subscribe to all task and result events (#19: check NATS connection health)
		if !nc.IsConnected() {
			log.Printf("NATS not connected, rejecting WS")
			conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "NATS unavailable"))
			conn.Close()
			return
		}

		taskSub, err := nc.Subscribe(fleetPrefix+".tasks.>", func(msg *nats.Msg) {
			select {
			case <-done:
				return
			default:
			}
			event := TaskEvent{
				Type:      "task",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			safeWrite(data)
		})
		if err != nil {
			log.Printf("NATS task sub error: %v", err)
			conn.Close()
			return
		}

		resultSub, err := nc.Subscribe(fleetPrefix+".results.>", func(msg *nats.Msg) {
			select {
			case <-done:
				return
			default:
			}
			event := TaskEvent{
				Type:      "result",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			safeWrite(data)
		})
		if err != nil {
			log.Printf("NATS result sub error: %v", err)
			taskSub.Unsubscribe()
			conn.Close()
			return
		}

		// Subscribe to mission status events (#75)
		missionSub, err := nc.Subscribe(fleetPrefix+".missions.>", func(msg *nats.Msg) {
			select {
			case <-done:
				return
			default:
			}
			event := TaskEvent{
				Type:      "mission",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			safeWrite(data)
		})
		if err != nil {
			log.Printf("NATS mission sub error: %v", err)
			// Non-fatal: missions subject may not exist yet
			missionSub = nil
		}

		// Subscribe to chain progress events (#75)
		chainSub, err := nc.Subscribe(fleetPrefix+".chains.>", func(msg *nats.Msg) {
			select {
			case <-done:
				return
			default:
			}
			event := TaskEvent{
				Type:      "chain",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			safeWrite(data)
		})
		if err != nil {
			log.Printf("NATS chain sub error: %v", err)
			// Non-fatal
			chainSub = nil
		}

		// Cleanup on exit
		defer func() {
			close(done)
			taskSub.Unsubscribe()
			resultSub.Unsubscribe()
			if missionSub != nil {
				missionSub.Unsubscribe()
			}
			if chainSub != nil {
				chainSub.Unsubscribe()
			}
			writeMu.Lock()
			closed = true
			writeMu.Unlock()
			conn.Close()
		}()

		// Keep connection alive, read client messages (for dispatch)
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		// Ping ticker to detect dead connections
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		go func() {
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					writeMu.Lock()
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					err := conn.WriteMessage(websocket.PingMessage, nil)
					writeMu.Unlock()
					if err != nil {
						return
					}
				}
			}
		}()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))

			// Client can dispatch tasks via WebSocket too
			var cmd struct {
				Action string `json:"action"`
				Knight string `json:"knight"`
				Domain string `json:"domain"`
				Task   string `json:"task"`
			}
			if json.Unmarshal(msg, &cmd) == nil && cmd.Action == "dispatch" {
				// Validate inputs
				if !validKnightName.MatchString(cmd.Knight) || !validKnightName.MatchString(cmd.Domain) {
					continue
				}
				if len(cmd.Task) == 0 || len(cmd.Task) > 10000 {
					continue
				}
				taskID := fmt.Sprintf("%s-ws-%d", cmd.Knight, time.Now().UnixMilli())
				subject := fmt.Sprintf("%s.tasks.%s.%s", fleetPrefix, cmd.Domain, taskID)
				payload, _ := json.Marshal(map[string]interface{}{
					"from":    "dashboard-ws",
					"task_id": taskID,
					"domain":  cmd.Domain,
					"task":    cmd.Task,
				})
				nc.Publish(subject, payload)
			}
		}
	}
}

var (
	chainGVR = schema.GroupVersionResource{
		Group:    "ai.roundtable.io",
		Version:  "v1alpha1",
		Resource: "chains",
	}
	missionGVR = schema.GroupVersionResource{
		Group:    "ai.roundtable.io",
		Version:  "v1alpha1",
		Resource: "missions",
	}
	roundTableGVR = schema.GroupVersionResource{
		Group:    "ai.roundtable.io",
		Version:  "v1alpha1",
		Resource: "roundtables",
	}
	knightGVR = schema.GroupVersionResource{
		Group:    "ai.roundtable.io",
		Version:  "v1alpha1",
		Resource: "knights",
	}
)

// getKnightDomainMap builds a name→domain lookup from Knight CRs.
func getKnightDomainMap(ctx context.Context, namespace string) map[string]string {
	m := map[string]string{}
	if dynClient == nil {
		return m
	}
	list, err := dynClient.Resource(knightGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return m
	}
	for _, item := range list.Items {
		spec, _ := item.Object["spec"].(map[string]interface{})
		if spec != nil {
			m[item.GetName()] = getStr(spec, "domain")
		}
	}
	return m
}

// ChainSummary is the API response for chain list
type ChainSummary struct {
	Name           string        `json:"name"`
	Namespace      string        `json:"namespace"`
	Phase          string        `json:"phase"`
	CurrentStep    string        `json:"currentStep"`
	StartTime      *string       `json:"startTime"`
	CompletionTime *string       `json:"completionTime"`
	Steps          []StepSummary `json:"steps"`
	Schedule       string        `json:"schedule,omitempty"`
}

type StepSummary struct {
	Name           string   `json:"name"`
	Knight         string   `json:"knight"`
	Domain         string   `json:"domain"`
	Phase          string   `json:"phase"`
	StartTime      *string  `json:"startTime"`
	CompletionTime *string  `json:"completionTime"`
	Result         *string  `json:"result"`
	DependsOn      []string `json:"dependsOn"`
	RetryCount     int      `json:"retryCount"`
}

func chainsHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		list, err := dynClient.Resource(chainGVR).Namespace(namespace).List(r.Context(), metav1.ListOptions{})
		if err != nil {
			log.Printf("Chain list error: %v", err)
			http.Error(w, "Failed to list chains", http.StatusInternalServerError)
			return
		}

		knightDomains := getKnightDomainMap(r.Context(), namespace)
		chains := []ChainSummary{}
		for _, item := range list.Items {
			chains = append(chains, parseChainResource(item.Object, knightDomains))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(chains)
	}
}

func chainDetailHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		name := vars["name"]
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid chain name", http.StatusBadRequest)
			return
		}

		obj, err := dynClient.Resource(chainGVR).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
		if err != nil {
			http.Error(w, "Chain not found", http.StatusNotFound)
			return
		}

		knightDomains := getKnightDomainMap(r.Context(), namespace)
		chain := parseChainResource(obj.Object, knightDomains)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(chain)
	}
}

func parseChainResource(obj map[string]interface{}, knightDomains map[string]string) ChainSummary {
	spec := getNestedMap(obj, "spec")
	status := getNestedMap(obj, "status")
	metadata := getNestedMap(obj, "metadata")

	chain := ChainSummary{
		Name:      getStr(metadata, "name"),
		Namespace: getStr(metadata, "namespace"),
		Phase:     getStr(status, "phase"),
	}

	// Schedule from spec (plain cron string in CRD)
	chain.Schedule = getStr(spec, "schedule")

	// Timing (CRD fields: startedAt, completedAt)
	if t := getStr(status, "startedAt"); t != "" {
		chain.StartTime = &t
	}
	if t := getStr(status, "completedAt"); t != "" {
		chain.CompletionTime = &t
	}

	// Current step
	// Derive currentStep from stepStatuses (no CRD field for this)
	for _, s := range getSlice(status, "stepStatuses") {
		if sm, ok := s.(map[string]interface{}); ok {
			if getStr(sm, "phase") == "Running" {
				chain.CurrentStep = getStr(sm, "name")
				break
			}
		}
	}

	// Parse spec steps for structure (dependsOn, knight, domain)
	specSteps := getSlice(spec, "steps")
	specStepMap := map[string]map[string]interface{}{}
	for _, s := range specSteps {
		if sm, ok := s.(map[string]interface{}); ok {
			specStepMap[getStr(sm, "name")] = sm
		}
	}

	// Parse status steps (CRD field is "stepStatuses")
	statusSteps := getSlice(status, "stepStatuses")
	for _, s := range statusSteps {
		sm, ok := s.(map[string]interface{})
		if !ok {
			continue
		}
		stepName := getStr(sm, "name")
		step := StepSummary{
			Name:       stepName,
			Phase:      getStr(sm, "phase"),
			RetryCount: getInt(sm, "retries"),
		}

		if t := getStr(sm, "startedAt"); t != "" {
			step.StartTime = &t
		}
		if t := getStr(sm, "completedAt"); t != "" {
			step.CompletionTime = &t
		}
		if r := getStr(sm, "output"); r != "" {
			// Truncate output for list view
			if len(r) > 500 {
				truncated := r[:500] + "..."
				step.Result = &truncated
			} else {
				step.Result = &r
			}
		}

		// Merge spec info
		if ss, exists := specStepMap[stepName]; exists {
			step.Knight = getStr(ss, "knightRef")
			if d := getStr(ss, "domain"); d != "" {
				step.Domain = d
			} else if step.Knight != "" {
				step.Domain = knightDomains[step.Knight]
			}
			if deps := getSlice(ss, "dependsOn"); deps != nil {
				for _, d := range deps {
					if ds, ok := d.(string); ok {
						step.DependsOn = append(step.DependsOn, ds)
					}
				}
			}
		}

		chain.Steps = append(chain.Steps, step)
	}

	// If no status steps yet, populate from spec
	if len(chain.Steps) == 0 {
		for _, s := range specSteps {
			sm, ok := s.(map[string]interface{})
			if !ok {
				continue
			}
			knightName := getStr(sm, "knightRef")
			domain := getStr(sm, "domain")
			if domain == "" && knightName != "" {
				domain = knightDomains[knightName]
			}
			step := StepSummary{
				Name:   getStr(sm, "name"),
				Knight: knightName,
				Domain: domain,
				Phase:  "Pending",
			}
			if deps := getSlice(sm, "dependsOn"); deps != nil {
				for _, d := range deps {
					if ds, ok := d.(string); ok {
						step.DependsOn = append(step.DependsOn, ds)
					}
				}
			}
			chain.Steps = append(chain.Steps, step)
		}
	}

	return chain
}

// MissionSummary is the API response for mission list
type MissionSummary struct {
	Name           string   `json:"name"`
	Namespace      string   `json:"namespace"`
	Phase          string   `json:"phase"`
	Objective      string   `json:"objective"`
	StartedAt      *string  `json:"startedAt"`
	ExpiresAt      *string  `json:"expiresAt"`
	Knights        []string `json:"knights"`
	Chains         []string `json:"chains"`
	CostBudgetUSD  string   `json:"costBudgetUSD"`
	TotalCost      string   `json:"totalCost"`
	TTL            int      `json:"ttl"`
	Timeout        int      `json:"timeout"`
	RoundTableRef  string   `json:"roundTableRef"`
}

func missionsHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		list, err := dynClient.Resource(missionGVR).Namespace(namespace).List(r.Context(), metav1.ListOptions{})
		if err != nil {
			log.Printf("Mission list error: %v", err)
			http.Error(w, "Failed to list missions", http.StatusInternalServerError)
			return
		}

		missions := []MissionSummary{}
		for _, item := range list.Items {
			missions = append(missions, parseMissionResource(item.Object))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(missions)
	}
}

func missionDetailHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		name := vars["name"]
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid mission name", http.StatusBadRequest)
			return
		}

		obj, err := dynClient.Resource(missionGVR).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
		if err != nil {
			http.Error(w, "Mission not found", http.StatusNotFound)
			return
		}

		mission := parseMissionResource(obj.Object)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mission)
	}
}

func missionCreateHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		// Parse request body
		var reqBody map[string]interface{}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Validate required fields
		name, ok := reqBody["name"].(string)
		if !ok || !validKnightName.MatchString(name) {
			http.Error(w, "Invalid mission name", http.StatusBadRequest)
			return
		}

		// Build mission object
		mission := map[string]interface{}{
			"apiVersion": "ai.roundtable.io/v1alpha1",
			"kind":       "Mission",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": reqBody,
		}

		// Create via dynamic client
		obj, err := dynClient.Resource(missionGVR).Namespace(namespace).Create(
			r.Context(),
			&unstructured.Unstructured{Object: mission},
			metav1.CreateOptions{},
		)
		if err != nil {
			log.Printf("Mission create error: %v", err)
			http.Error(w, fmt.Sprintf("Failed to create mission: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"name":      obj.GetName(),
			"namespace": obj.GetNamespace(),
			"created":   true,
			"uid":       obj.GetUID(),
		})
	}
}

func missionDeleteHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		name := vars["name"]
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid mission name", http.StatusBadRequest)
			return
		}

		err := dynClient.Resource(missionGVR).Namespace(namespace).Delete(r.Context(), name, metav1.DeleteOptions{})
		if err != nil {
			log.Printf("Mission delete error: %v", err)
			http.Error(w, "Failed to delete mission", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"name":    name,
			"deleted": true,
		})
	}
}

func parseMissionResource(obj map[string]interface{}) MissionSummary {
	spec := getNestedMap(obj, "spec")
	status := getNestedMap(obj, "status")
	metadata := getNestedMap(obj, "metadata")

	mission := MissionSummary{
		Name:          getStr(metadata, "name"),
		Namespace:     getStr(metadata, "namespace"),
		Phase:         getStr(status, "phase"),
		Objective:     getStr(spec, "objective"),
		CostBudgetUSD: getStr(spec, "costBudgetUSD"),
		TotalCost:     getStr(status, "totalCost"),
		TTL:           getInt(spec, "ttl"),
		Timeout:       getInt(spec, "timeout"),
		RoundTableRef: getStr(spec, "roundTableRef"),
	}

	// Parse timing
	if t := getStr(status, "startedAt"); t != "" {
		mission.StartedAt = &t
	}
	if t := getStr(status, "expiresAt"); t != "" {
		mission.ExpiresAt = &t
	}

	// Parse knights array
	if knights := getSlice(spec, "knights"); knights != nil {
		for _, k := range knights {
			if km, ok := k.(map[string]interface{}); ok {
				if name := getStr(km, "name"); name != "" {
					mission.Knights = append(mission.Knights, name)
				}
			}
		}
	}

	// Parse chains array
	if chains := getSlice(spec, "chains"); chains != nil {
		for _, c := range chains {
			if cm, ok := c.(map[string]interface{}); ok {
				if name := getStr(cm, "name"); name != "" {
					mission.Chains = append(mission.Chains, name)
				}
			}
		}
	}

	return mission
}

// RoundTableSummary is the API response for roundtable list
type RoundTableSummary struct {
	Name          string `json:"name"`
	Namespace     string `json:"namespace"`
	Phase         string `json:"phase"`
	KnightsReady  int    `json:"knightsReady"`
	KnightsTotal  int    `json:"knightsTotal"`
	NATSPrefix    string `json:"natsPrefix"`
	CostBudgetUSD string `json:"costBudgetUSD"`
	TotalCost     string `json:"totalCost"`
}

func roundTablesHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		list, err := dynClient.Resource(roundTableGVR).Namespace(namespace).List(r.Context(), metav1.ListOptions{})
		if err != nil {
			log.Printf("RoundTable list error: %v", err)
			http.Error(w, "Failed to list roundtables", http.StatusInternalServerError)
			return
		}

		roundTables := []RoundTableSummary{}
		for _, item := range list.Items {
			roundTables = append(roundTables, parseRoundTableResource(item.Object))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(roundTables)
	}
}

func roundTableDetailHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if dynClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		name := vars["name"]
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid roundtable name", http.StatusBadRequest)
			return
		}

		obj, err := dynClient.Resource(roundTableGVR).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
		if err != nil {
			http.Error(w, "RoundTable not found", http.StatusNotFound)
			return
		}

		roundTable := parseRoundTableResource(obj.Object)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(roundTable)
	}
}

func parseRoundTableResource(obj map[string]interface{}) RoundTableSummary {
	spec := getNestedMap(obj, "spec")
	status := getNestedMap(obj, "status")
	metadata := getNestedMap(obj, "metadata")

	rt := RoundTableSummary{
		Name:         getStr(metadata, "name"),
		Namespace:    getStr(metadata, "namespace"),
		Phase:        getStr(status, "phase"),
		KnightsReady: getInt(status, "knightsReady"),
		KnightsTotal: getInt(status, "knightsTotal"),
		TotalCost:    getStr(status, "totalCost"),
	}

	// Parse NATS config
	if nats := getNestedMap(spec, "nats"); nats != nil {
		rt.NATSPrefix = getStr(nats, "subjectPrefix")
	}

	// Parse policies
	if policies := getNestedMap(spec, "policies"); policies != nil {
		rt.CostBudgetUSD = getStr(policies, "costBudgetUSD")
	}

	return rt
}

// --- NATS KV helpers and handlers ---

// getOrCreateKVBucket returns a NATS KV bucket handle, creating it if needed.
func getOrCreateKVBucket(ctx context.Context, bucket string) (jetstream.KeyValue, error) {
	kv, err := js.KeyValue(ctx, bucket)
	if err != nil {
		// Try to create it
		kv, err = js.CreateKeyValue(ctx, jetstream.KeyValueConfig{
			Bucket:      bucket,
			Description: fmt.Sprintf("Round Table %s store", bucket),
			History:     3,
			TTL:         30 * 24 * time.Hour,
		})
		if err != nil {
			return nil, fmt.Errorf("KV bucket %s: %w", bucket, err)
		}
	}
	return kv, nil
}

// validBucketName matches safe KV bucket names
var validBucketName = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_-]{0,62}$`)

func missionResultsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := mux.Vars(r)["name"]
		if !validKnightName.MatchString(name) {
			http.Error(w, "Invalid mission name", http.StatusBadRequest)
			return
		}
		kv, err := getOrCreateKVBucket(r.Context(), "mission-results")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entry, err := kv.Get(r.Context(), name)
		if err != nil {
			http.Error(w, "Results not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(entry.Value())
	}
}

func chainStepOutputHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["name"]
		step := vars["step"]
		if !validKnightName.MatchString(name) || !validKnightName.MatchString(step) {
			http.Error(w, "Invalid name", http.StatusBadRequest)
			return
		}
		kv, err := getOrCreateKVBucket(r.Context(), "chain-outputs")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		key := name + "." + step
		entry, err := kv.Get(r.Context(), key)
		if err != nil {
			http.Error(w, "Output not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(entry.Value())
	}
}

func kvKeysHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bucket := mux.Vars(r)["bucket"]
		if !validBucketName.MatchString(bucket) {
			http.Error(w, "Invalid bucket name", http.StatusBadRequest)
			return
		}
		kv, err := getOrCreateKVBucket(r.Context(), bucket)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		keys, err := kv.Keys(r.Context())
		if err != nil {
			// No keys found
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]string{})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(keys)
	}
}

func kvGetHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		bucket := vars["bucket"]
		key := vars["key"]
		if !validBucketName.MatchString(bucket) {
			http.Error(w, "Invalid bucket name", http.StatusBadRequest)
			return
		}
		kv, err := getOrCreateKVBucket(r.Context(), bucket)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entry, err := kv.Get(r.Context(), key)
		if err != nil {
			http.Error(w, "Key not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(entry.Value())
	}
}

// Helper functions for unstructured K8s objects
func getNestedMap(obj map[string]interface{}, key string) map[string]interface{} {
	if v, ok := obj[key]; ok {
		if m, ok := v.(map[string]interface{}); ok {
			return m
		}
	}
	return nil
}

func getStr(obj map[string]interface{}, key string) string {
	if obj == nil {
		return ""
	}
	if v, ok := obj[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getInt(obj map[string]interface{}, key string) int {
	if obj == nil {
		return 0
	}
	if v, ok := obj[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int64:
			return int(n)
		}
	}
	return 0
}

func getSlice(obj map[string]interface{}, key string) []interface{} {
	if obj == nil {
		return nil
	}
	if v, ok := obj[key]; ok {
		if s, ok := v.([]interface{}); ok {
			return s
		}
	}
	return nil
}

func spaHandler(staticDir string) http.HandlerFunc {
	fs := http.Dir(staticDir)
	fileServer := http.FileServer(fs)
	return func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		// If the path has an extension (asset file), serve it directly
		if strings.Contains(filepath.Base(p), ".") {
			fileServer.ServeHTTP(w, r)
			return
		}
		// For all other paths, serve index.html (SPA routing)
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	}
}

// capitalizeKnight safely capitalizes a knight name for NATS subjects
func capitalizeKnight(name string) string {
	if len(name) == 0 {
		return name
	}
	return string(unicode.ToUpper(rune(name[0]))) + name[1:]
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
