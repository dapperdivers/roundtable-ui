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
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// validKnightName matches alphanumeric knight names (prevents NATS injection)
var validKnightName = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9-]{0,62}$`)

var (
	nc        *nats.Conn
	js        jetstream.JetStream
	k8sClient *kubernetes.Clientset
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

// TaskEvent represents a NATS task/result event
type TaskEvent struct {
	Type      string          `json:"type"` // task, result
	Subject   string          `json:"subject"`
	Data      json.RawMessage `json:"data"`
	Timestamp time.Time       `json:"timestamp"`
}

func main() {
	natsURL := envOr("NATS_URL", "nats://nats.database.svc:4222")
	namespace := envOr("NAMESPACE", "roundtable")
	port := envOr("PORT", "8080")
	vaultPath := envOr("VAULT_PATH", "/vault")

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
	}

	// Router
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()

	// Fleet endpoints
	api.HandleFunc("/fleet", fleetHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}", knightHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}/logs", knightLogsHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}/session", knightSessionHandler()).Methods("GET")

	// Task endpoints
	api.HandleFunc("/tasks", taskHistoryHandler()).Methods("GET")
	api.HandleFunc("/tasks/dispatch", taskDispatchHandler()).Methods("POST")

	// Briefing endpoints
	api.HandleFunc("/briefings", briefingListHandler(vaultPath)).Methods("GET")
	api.HandleFunc("/briefings/{date}", briefingHandler(vaultPath)).Methods("GET")

	// WebSocket for real-time NATS events
	api.HandleFunc("/ws", wsHandler())

	// Health
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")

	// Serve static UI files with SPA fallback
	r.PathPrefix("/").HandlerFunc(spaHandler("./static"))

	// CORS — local install: allow same-origin; configurable via ALLOWED_ORIGINS
	allowedOrigins := []string{}
	if origins := envOr("ALLOWED_ORIGINS", ""); origins != "" {
		allowedOrigins = strings.Split(origins, ",")
	}
	handler := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
	}).Handler(r)

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

			knight := KnightStatus{
				Name:     pod.Labels["app.kubernetes.io/instance"],
				Domain:   pod.Labels["roundtable.io/domain"],
				Status:   status,
				Ready:    ready,
				Restarts: restarts,
				Age:      time.Since(pod.CreationTimestamp.Time).Round(time.Second).String(),
				Labels:   pod.Labels,
			}

			// Get image from first container
			if len(pod.Spec.Containers) > 0 {
				knight.Image = pod.Spec.Containers[0].Image
			}

			knights = append(knights, knight)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(knights)
	}
}

func knightHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]

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
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pod)
	}
}

func knightLogsHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]
		lines := int64(100)

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

		// Add timeout to prevent indefinite streaming
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
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
			n, err := stream.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
			}
			if err != nil {
				break
			}
		}
	}
}

func knightSessionHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]
		reqType := r.URL.Query().Get("type")
		if reqType == "" {
			reqType = "stats"
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
		subject := fmt.Sprintf("fleet-a.introspect.%s", capitalName)
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

func taskHistoryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Read recent results from NATS JetStream
		ctx := r.Context()
		stream, err := js.Stream(ctx, "fleet_a_results")
		if err != nil {
			log.Printf("JetStream error: %v", err)
			http.Error(w, "Task history unavailable", http.StatusInternalServerError)
			return
		}

		info, _ := stream.Info(ctx)
		results := []TaskEvent{}

		// Get last N messages
		limit := 50
		cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
			DeliverPolicy: jetstream.DeliverLastPerSubjectPolicy,
			FilterSubject: "fleet-a.results.>",
			AckPolicy:     jetstream.AckNonePolicy,
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

func taskDispatchHandler() http.HandlerFunc {
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
		subject := fmt.Sprintf("fleet-a.tasks.%s.%s", req.Domain, taskID)

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

func wsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		// Write mutex — gorilla websocket is not concurrent-write safe
		var writeMu sync.Mutex
		safeWrite := func(data []byte) {
			writeMu.Lock()
			defer writeMu.Unlock()
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			conn.WriteMessage(websocket.TextMessage, data)
		}

		// Done channel to clean up NATS subscriptions when WS closes
		done := make(chan struct{})

		// Subscribe to all task and result events
		taskSub, err := nc.Subscribe("fleet-a.tasks.>", func(msg *nats.Msg) {
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

		resultSub, err := nc.Subscribe("fleet-a.results.>", func(msg *nats.Msg) {
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

		// Cleanup on exit
		defer func() {
			close(done)
			taskSub.Unsubscribe()
			resultSub.Unsubscribe()
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
				subject := fmt.Sprintf("fleet-a.tasks.%s.%s", cmd.Domain, taskID)
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
