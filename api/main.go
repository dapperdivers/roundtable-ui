package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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

var (
	nc       *nats.Conn
	js       jetstream.JetStream
	k8sClient *kubernetes.Clientset
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
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

	// Serve static UI files
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	// CORS
	handler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
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
			LabelSelector: "roundtable.io/knight",
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("K8s error: %v", err), http.StatusInternalServerError)
			return
		}

		knights := []KnightStatus{}
		for _, pod := range pods.Items {
			// Skip CronJob pods
			if _, ok := pod.Labels["job-name"]; ok {
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
				Name:     pod.Labels["roundtable.io/knight"],
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
			LabelSelector: fmt.Sprintf("roundtable.io/knight=%s", name),
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
			LabelSelector: fmt.Sprintf("roundtable.io/knight=%s", name),
		})
		if err != nil || len(pods.Items) == 0 {
			http.Error(w, "Knight not found", http.StatusNotFound)
			return
		}

		req := k8sClient.CoreV1().Pods(namespace).GetLogs(pods.Items[0].Name, &corev1.PodLogOptions{
			TailLines: &lines,
		})
		stream, err := req.Stream(r.Context())
		if err != nil {
			http.Error(w, fmt.Sprintf("Log stream error: %v", err), http.StatusInternalServerError)
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

func taskHistoryHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Read recent results from NATS JetStream
		ctx := r.Context()
		stream, err := js.Stream(ctx, "fleet_a_results")
		if err != nil {
			http.Error(w, fmt.Sprintf("Stream error: %v", err), http.StatusInternalServerError)
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
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
			http.Error(w, fmt.Sprintf("NATS publish error: %v", err), http.StatusInternalServerError)
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
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		date := vars["date"]
		path := fmt.Sprintf("%s/Briefings/Daily/%s.md", vaultPath, date)

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
		defer conn.Close()

		// Subscribe to all task and result events
		taskSub, err := nc.Subscribe("fleet-a.tasks.>", func(msg *nats.Msg) {
			event := TaskEvent{
				Type:      "task",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			conn.WriteMessage(websocket.TextMessage, data)
		})
		if err != nil {
			log.Printf("NATS task sub error: %v", err)
			return
		}
		defer taskSub.Unsubscribe()

		resultSub, err := nc.Subscribe("fleet-a.results.>", func(msg *nats.Msg) {
			event := TaskEvent{
				Type:      "result",
				Subject:   msg.Subject,
				Data:      msg.Data,
				Timestamp: time.Now(),
			}
			data, _ := json.Marshal(event)
			conn.WriteMessage(websocket.TextMessage, data)
		})
		if err != nil {
			log.Printf("NATS result sub error: %v", err)
			return
		}
		defer resultSub.Unsubscribe()

		// Keep connection alive, read client messages (for dispatch)
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}

			// Client can dispatch tasks via WebSocket too
			var cmd struct {
				Action string `json:"action"`
				Knight string `json:"knight"`
				Domain string `json:"domain"`
				Task   string `json:"task"`
			}
			if json.Unmarshal(msg, &cmd) == nil && cmd.Action == "dispatch" {
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

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
