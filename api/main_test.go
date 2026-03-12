package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

// Global variable to hold fake client for tests
var fakeK8sClient *k8sfake.Clientset

// setupTestRouter creates a test router with mocked dependencies
func setupTestRouter() *mux.Router {
	// Initialize mock K8s client
	fakeK8sClient = k8sfake.NewSimpleClientset()
	// The handlers will use fakeK8sClient instead of k8sClient
	
	// Initialize mock dynamic client with proper scheme
	scheme := runtime.NewScheme()
	
	// Register our custom resource types with the scheme
	missionList := &unstructured.UnstructuredList{}
	missionList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "ai.roundtable.io",
		Version: "v1alpha1",
		Kind:    "MissionList",
	})
	
	chainList := &unstructured.UnstructuredList{}
	chainList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "ai.roundtable.io",
		Version: "v1alpha1",
		Kind:    "ChainList",
	})
	
	roundTableList := &unstructured.UnstructuredList{}
	roundTableList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "ai.roundtable.io",
		Version: "v1alpha1",
		Kind:    "RoundTableList",
	})
	
	knightList := &unstructured.UnstructuredList{}
	knightList.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "ai.roundtable.io",
		Version: "v1alpha1",
		Kind:    "KnightList",
	})
	
	dynClient = fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			missionGVR:    "MissionList",
			chainGVR:      "ChainList",
			roundTableGVR: "RoundTableList",
			knightGVR:     "KnightList",
		})
	
	// Create router with test handlers
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	
	namespace := "test-namespace"
	fleetPrefix := "fleet-a"
	
	// Register handlers (without auth middleware for testing)
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")
	
	api.HandleFunc("/fleet", testFleetHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}", testKnightHandler(namespace)).Methods("GET")
	api.HandleFunc("/fleet/{knight}/session", knightSessionHandler(fleetPrefix)).Methods("GET")
	
	api.HandleFunc("/chains", chainsHandler(namespace)).Methods("GET")
	api.HandleFunc("/chains/{name}", chainDetailHandler(namespace)).Methods("GET")
	
	api.HandleFunc("/missions", missionsHandler(namespace)).Methods("GET")
	api.HandleFunc("/missions/{name}", missionDetailHandler(namespace)).Methods("GET")
	api.HandleFunc("/missions", missionCreateHandler(namespace)).Methods("POST")
	api.HandleFunc("/missions/{name}", missionDeleteHandler(namespace)).Methods("DELETE")
	
	api.HandleFunc("/roundtables", roundTablesHandler(namespace)).Methods("GET")
	api.HandleFunc("/roundtables/{name}", roundTableDetailHandler(namespace)).Methods("GET")
	
	api.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"fleetPrefix": fleetPrefix,
		})
	}).Methods("GET")
	
	return r
}

// Test wrapper handlers that use the fake K8s client
func testFleetHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if fakeK8sClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		pods, err := fakeK8sClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
			LabelSelector: "app.kubernetes.io/name=knight",
		})
		if err != nil {
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

func testKnightHandler(namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		name := vars["knight"]

		if fakeK8sClient == nil {
			http.Error(w, "Kubernetes not available", http.StatusServiceUnavailable)
			return
		}

		pods, err := fakeK8sClient.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
			LabelSelector: fmt.Sprintf("app.kubernetes.io/name=knight,app.kubernetes.io/instance=%s", name),
		})
		if err != nil || len(pods.Items) == 0 {
			http.Error(w, "Knight not found", http.StatusNotFound)
			return
		}

		pod := pods.Items[0]

		// Build safe DTO
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

// TestHealthEndpoint tests the /api/health endpoint
func TestHealthEndpoint(t *testing.T) {
	router := setupTestRouter()
	
	tests := []struct {
		name           string
		method         string
		expectedStatus int
		expectedBody   map[string]string
	}{
		{
			name:           "GET /api/health returns 200",
			method:         "GET",
			expectedStatus: http.StatusOK,
			expectedBody:   map[string]string{"status": "ok"},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/health", nil)
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			var response map[string]string
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}
			
			if response["status"] != tt.expectedBody["status"] {
				t.Errorf("expected status %s, got %s", tt.expectedBody["status"], response["status"])
			}
		})
	}
}

// TestConfigEndpoint tests the /api/config endpoint
func TestConfigEndpoint(t *testing.T) {
	router := setupTestRouter()
	
	req := httptest.NewRequest("GET", "/api/config", nil)
	w := httptest.NewRecorder()
	
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	
	if response["fleetPrefix"] != "fleet-a" {
		t.Errorf("expected fleetPrefix 'fleet-a', got '%s'", response["fleetPrefix"])
	}
}

// TestFleetHandler tests the /api/fleet endpoint
func TestFleetHandler(t *testing.T) {
	router := setupTestRouter()
	
	// Create test pods
	namespace := "test-namespace"
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "galahad-abc123",
			Namespace: namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name":     "knight",
				"app.kubernetes.io/instance": "galahad",
				"roundtable.io/domain":       "security",
			},
			CreationTimestamp: metav1.Time{Time: time.Now().Add(-1 * time.Hour)},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:  "knight",
					Image: "ghcr.io/dapperdivers/knight:latest",
				},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name:         "knight",
					Image:        "ghcr.io/dapperdivers/knight:latest",
					Ready:        true,
					RestartCount: 0,
				},
			},
		},
	}
	
	_, err := fakeK8sClient.CoreV1().Pods(namespace).Create(nil, pod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create test pod: %v", err)
	}
	
	req := httptest.NewRequest("GET", "/api/fleet", nil)
	w := httptest.NewRecorder()
	
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var knights []KnightStatus
	if err := json.Unmarshal(w.Body.Bytes(), &knights); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	
	if len(knights) != 1 {
		t.Errorf("expected 1 knight, got %d", len(knights))
	}
	
	if knights[0].Name != "galahad" {
		t.Errorf("expected knight name 'galahad', got '%s'", knights[0].Name)
	}
	
	if knights[0].Domain != "security" {
		t.Errorf("expected domain 'security', got '%s'", knights[0].Domain)
	}
	
	if knights[0].Status != "online" {
		t.Errorf("expected status 'online', got '%s'", knights[0].Status)
	}
}

// TestFleetHandlerFiltersOutCronJobs tests that CronJob pods are excluded
func TestFleetHandlerFiltersOutCronJobs(t *testing.T) {
	router := setupTestRouter()
	namespace := "test-namespace"
	
	// Create a CronJob pod (should be filtered out)
	cronPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "scheduled-task-12345",
			Namespace: namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name": "knight",
				"job-name":               "scheduled-task",
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{{Name: "knight"}},
		},
	}
	
	_, err := fakeK8sClient.CoreV1().Pods(namespace).Create(nil, cronPod, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create test pod: %v", err)
	}
	
	req := httptest.NewRequest("GET", "/api/fleet", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	var knights []KnightStatus
	json.Unmarshal(w.Body.Bytes(), &knights)
	
	// Should be empty because CronJob pods are filtered
	if len(knights) != 0 {
		t.Errorf("expected 0 knights (CronJob filtered), got %d", len(knights))
	}
}

// TestKnightHandler tests the /api/fleet/{knight} endpoint
func TestKnightHandler(t *testing.T) {
	router := setupTestRouter()
	namespace := "test-namespace"
	
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "tristan-xyz789",
			Namespace: namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name":     "knight",
				"app.kubernetes.io/instance": "tristan",
				"roundtable.io/domain":       "infrastructure",
			},
			CreationTimestamp: metav1.Time{Time: time.Now()},
		},
		Spec: corev1.PodSpec{
			NodeName: "node-1",
			Containers: []corev1.Container{
				{Name: "knight", Image: "knight:v1"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Name:    "knight",
					Image:   "knight:v1",
					Ready:   true,
					Started: boolPtr(true),
					State: corev1.ContainerState{
						Running: &corev1.ContainerStateRunning{},
					},
				},
			},
			Conditions: []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionTrue},
			},
		},
	}
	
	fakeK8sClient.CoreV1().Pods(namespace).Create(nil, pod, metav1.CreateOptions{})
	
	tests := []struct {
		name           string
		knightName     string
		expectedStatus int
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "valid knight returns 200 with details",
			knightName:     "tristan",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var detail KnightDetail
				if err := json.Unmarshal(body, &detail); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if detail.Name != "tristan" {
					t.Errorf("expected name 'tristan', got '%s'", detail.Name)
				}
				if detail.Node != "node-1" {
					t.Errorf("expected node 'node-1', got '%s'", detail.Node)
				}
				if detail.Phase != "Running" {
					t.Errorf("expected phase 'Running', got '%s'", detail.Phase)
				}
			},
		},
		{
			name:           "non-existent knight returns 404",
			knightName:     "nonexistent",
			expectedStatus: http.StatusNotFound,
			checkResponse:  func(t *testing.T, body []byte) {},
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/fleet/"+tt.knightName, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			tt.checkResponse(t, w.Body.Bytes())
		})
	}
}

// TestAuthMiddleware tests the authentication middleware
func TestAuthMiddleware(t *testing.T) {
	tests := []struct {
		name           string
		apiKey         string
		setEnv         bool
		authHeader     string
		path           string
		expectedStatus int
	}{
		{
			name:           "no API key configured - allows all requests",
			apiKey:         "",
			setEnv:         false,
			authHeader:     "",
			path:           "/api/fleet",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "API key configured - valid key succeeds",
			apiKey:         "secret123",
			setEnv:         true,
			authHeader:     "Bearer secret123",
			path:           "/api/fleet",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "API key configured - invalid key fails",
			apiKey:         "secret123",
			setEnv:         true,
			authHeader:     "Bearer wrongkey",
			path:           "/api/fleet",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "API key configured - missing auth header fails",
			apiKey:         "secret123",
			setEnv:         true,
			authHeader:     "",
			path:           "/api/fleet",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "health endpoint bypasses auth",
			apiKey:         "secret123",
			setEnv:         true,
			authHeader:     "",
			path:           "/api/health",
			expectedStatus: http.StatusOK,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup environment
			if tt.setEnv {
				os.Setenv("DASHBOARD_API_KEY", tt.apiKey)
				defer os.Unsetenv("DASHBOARD_API_KEY")
			}
			
			// Create router with auth middleware
			router := setupTestRouter()
			r := mux.NewRouter()
			r.Use(authMiddleware)
			r.PathPrefix("/api").Handler(router)
			
			req := httptest.NewRequest("GET", tt.path, nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			w := httptest.NewRecorder()
			
			r.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

// TestAuthLoginEndpoint tests the /api/auth/login endpoint
func TestAuthLoginEndpoint(t *testing.T) {
	tests := []struct {
		name           string
		envAPIKey      string
		requestBody    map[string]string
		expectedStatus int
		expectSuccess  bool
	}{
		{
			name:           "valid API key",
			envAPIKey:      "mykey123",
			requestBody:    map[string]string{"apiKey": "mykey123"},
			expectedStatus: http.StatusOK,
			expectSuccess:  true,
		},
		{
			name:           "invalid API key",
			envAPIKey:      "mykey123",
			requestBody:    map[string]string{"apiKey": "wrongkey"},
			expectedStatus: http.StatusUnauthorized,
			expectSuccess:  false,
		},
		{
			name:           "no API key configured - allows any key",
			envAPIKey:      "",
			requestBody:    map[string]string{"apiKey": "anykey"},
			expectedStatus: http.StatusOK,
			expectSuccess:  false, // No auth required, so no "authenticated" field expected
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envAPIKey != "" {
				os.Setenv("DASHBOARD_API_KEY", tt.envAPIKey)
				defer os.Unsetenv("DASHBOARD_API_KEY")
			}
			
			router := mux.NewRouter()
			router.Use(authMiddleware)
			api := router.PathPrefix("/api").Subrouter()
			api.HandleFunc("/auth/login", func(w http.ResponseWriter, r *http.Request) {
				// Handled by middleware
			}).Methods("POST")
			
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			var response map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &response)
			
			if tt.expectSuccess {
				if auth, ok := response["authenticated"].(bool); !ok || !auth {
					t.Error("expected authenticated=true in response")
				}
			}
		})
	}
}

// TestValidKnightName tests the knight name validation regex
func TestValidKnightName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"valid lowercase", "galahad", true},
		{"valid with hyphen", "galahad-dev", true},
		{"valid with numbers", "knight1", true},
		{"valid mixed", "Knight-01", true},
		{"invalid starts with number", "1knight", false},
		{"invalid special chars", "knight@test", false},
		{"invalid path traversal", "../galahad", false},
		{"invalid NATS wildcard", "fleet-a.>", false},
		{"invalid too long", strings.Repeat("a", 64), false},
		{"empty string", "", false},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validKnightName.MatchString(tt.input)
			if result != tt.expected {
				t.Errorf("validKnightName(%s) = %v, expected %v", tt.input, result, tt.expected)
			}
		})
	}
}

// TestBriefingHandler tests the /api/briefings/{date} endpoint
func TestBriefingHandler(t *testing.T) {
	// Create temporary vault directory
	tmpDir := t.TempDir()
	briefingsDir := fmt.Sprintf("%s/Briefings/Daily", tmpDir)
	os.MkdirAll(briefingsDir, 0755)
	
	// Create a test briefing file
	testContent := "# Daily Briefing 2024-01-01\n\nTest content"
	os.WriteFile(fmt.Sprintf("%s/2024-01-01.md", briefingsDir), []byte(testContent), 0644)
	
	vaultPath := tmpDir
	
	router := mux.NewRouter()
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/briefings/{date}", briefingHandler(vaultPath)).Methods("GET")
	
	tests := []struct {
		name           string
		date           string
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "valid date returns briefing",
			date:           "2024-01-01",
			expectedStatus: http.StatusOK,
			expectedBody:   testContent,
		},
		{
			name:           "non-existent date returns 404",
			date:           "2024-12-31",
			expectedStatus: http.StatusNotFound,
			expectedBody:   "",
		},
		{
			name:           "invalid date format returns 400",
			date:           "invalid",
			expectedStatus: http.StatusBadRequest,
			expectedBody:   "",
		},
		{
			name:           "date with special chars returns 400",
			date:           "2024-01@01", // Special chars - invalid format
			expectedStatus: http.StatusBadRequest,
			expectedBody:   "",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/briefings/"+tt.date, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
			
			if tt.expectedBody != "" && w.Body.String() != tt.expectedBody {
				t.Errorf("expected body '%s', got '%s'", tt.expectedBody, w.Body.String())
			}
		})
	}
}

// TestMissionsHandler tests the /api/missions endpoint
func TestMissionsHandler(t *testing.T) {
	router := setupTestRouter()
	
	// Create test mission CRD
	mission := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "ai.roundtable.io/v1alpha1",
			"kind":       "Mission",
			"metadata": map[string]interface{}{
				"name":      "test-mission",
				"namespace": "test-namespace",
			},
			"spec": map[string]interface{}{
				"objective":      "Test objective",
				"costBudgetUSD":  "10.00",
				"roundTableRef":  "table-a",
			},
			"status": map[string]interface{}{
				"phase":     "Running",
				"totalCost": "5.00",
			},
		},
	}
	
	_, err := dynClient.Resource(missionGVR).Namespace("test-namespace").Create(nil, mission, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("failed to create test mission: %v", err)
	}
	
	req := httptest.NewRequest("GET", "/api/missions", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var missions []MissionSummary
	if err := json.Unmarshal(w.Body.Bytes(), &missions); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	
	if len(missions) != 1 {
		t.Fatalf("expected 1 mission, got %d", len(missions))
	}
	
	if missions[0].Name != "test-mission" {
		t.Errorf("expected name 'test-mission', got '%s'", missions[0].Name)
	}
	
	if missions[0].Phase != "Running" {
		t.Errorf("expected phase 'Running', got '%s'", missions[0].Phase)
	}
}

// TestMissionCreateHandler tests the POST /api/missions endpoint
func TestMissionCreateHandler(t *testing.T) {
	router := setupTestRouter()
	
	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
	}{
		{
			name: "valid mission creation",
			requestBody: map[string]interface{}{
				"name":      "new-mission",
				"objective": "Test objective",
				"knights": []map[string]string{
					{"name": "galahad"},
				},
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "invalid mission name",
			requestBody: map[string]interface{}{
				"name":      "../../malicious",
				"objective": "Bad objective",
			},
			expectedStatus: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/missions", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

// TestMissionDeleteHandler tests the DELETE /api/missions/{name} endpoint
func TestMissionDeleteHandler(t *testing.T) {
	router := setupTestRouter()
	
	// Create a mission to delete
	mission := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "ai.roundtable.io/v1alpha1",
			"kind":       "Mission",
			"metadata": map[string]interface{}{
				"name":      "delete-me",
				"namespace": "test-namespace",
			},
			"spec": map[string]interface{}{},
		},
	}
	dynClient.Resource(missionGVR).Namespace("test-namespace").Create(nil, mission, metav1.CreateOptions{})
	
	req := httptest.NewRequest("DELETE", "/api/missions/delete-me", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)
	
	if deleted, ok := response["deleted"].(bool); !ok || !deleted {
		t.Error("expected deleted=true in response")
	}
}

// TestChainsHandler tests the /api/chains endpoint
func TestChainsHandler(t *testing.T) {
	router := setupTestRouter()
	
	chain := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "ai.roundtable.io/v1alpha1",
			"kind":       "Chain",
			"metadata": map[string]interface{}{
				"name":      "test-chain",
				"namespace": "test-namespace",
			},
			"spec": map[string]interface{}{
				"steps": []interface{}{
					map[string]interface{}{
						"name":      "step-1",
						"knightRef": "galahad",
						"domain":    "security",
					},
				},
			},
			"status": map[string]interface{}{
				"phase": "Running",
			},
		},
	}
	
	dynClient.Resource(chainGVR).Namespace("test-namespace").Create(nil, chain, metav1.CreateOptions{})
	
	req := httptest.NewRequest("GET", "/api/chains", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var chains []ChainSummary
	json.Unmarshal(w.Body.Bytes(), &chains)
	
	if len(chains) != 1 {
		t.Fatalf("expected 1 chain, got %d", len(chains))
	}
	
	if chains[0].Name != "test-chain" {
		t.Errorf("expected name 'test-chain', got '%s'", chains[0].Name)
	}
}

// TestRoundTablesHandler tests the /api/roundtables endpoint
func TestRoundTablesHandler(t *testing.T) {
	router := setupTestRouter()
	
	roundtable := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "ai.roundtable.io/v1alpha1",
			"kind":       "RoundTable",
			"metadata": map[string]interface{}{
				"name":      "table-a",
				"namespace": "test-namespace",
			},
			"spec": map[string]interface{}{
				"nats": map[string]interface{}{
					"subjectPrefix": "fleet-a",
				},
			},
			"status": map[string]interface{}{
				"phase":        "Ready",
				"knightsReady": int64(3),
				"knightsTotal": int64(5),
			},
		},
	}
	
	dynClient.Resource(roundTableGVR).Namespace("test-namespace").Create(nil, roundtable, metav1.CreateOptions{})
	
	req := httptest.NewRequest("GET", "/api/roundtables", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	
	var tables []RoundTableSummary
	json.Unmarshal(w.Body.Bytes(), &tables)
	
	if len(tables) != 1 {
		t.Fatalf("expected 1 roundtable, got %d", len(tables))
	}
	
	if tables[0].Name != "table-a" {
		t.Errorf("expected name 'table-a', got '%s'", tables[0].Name)
	}
	
	if tables[0].KnightsReady != 3 {
		t.Errorf("expected 3 ready knights, got %d", tables[0].KnightsReady)
	}
}

// TestRateLimiter tests the rate limiter
func TestRateLimiter(t *testing.T) {
	rl := newRateLimiter(2, 1*time.Second)
	
	// First two requests should succeed
	if !rl.allow() {
		t.Error("first request should be allowed")
	}
	if !rl.allow() {
		t.Error("second request should be allowed")
	}
	
	// Third request should be blocked
	if rl.allow() {
		t.Error("third request should be blocked")
	}
	
	// Wait for window to reset
	time.Sleep(1 * time.Second)
	
	// Should allow again
	if !rl.allow() {
		t.Error("request after reset should be allowed")
	}
}

// TestCapitalizeKnight tests the knight name capitalization
func TestCapitalizeKnight(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"galahad", "Galahad"},
		{"Galahad", "Galahad"},
		{"GALAHAD", "GALAHAD"},
		{"", ""},
	}
	
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := capitalizeKnight(tt.input)
			if result != tt.expected {
				t.Errorf("capitalizeKnight(%s) = %s, expected %s", tt.input, result, tt.expected)
			}
		})
	}
}

// TestEnvOr tests the environment variable helper
func TestEnvOr(t *testing.T) {
	os.Setenv("TEST_VAR", "value")
	defer os.Unsetenv("TEST_VAR")
	
	tests := []struct {
		name     string
		key      string
		def      string
		expected string
	}{
		{"existing var", "TEST_VAR", "default", "value"},
		{"missing var", "MISSING_VAR", "default", "default"},
		{"empty default", "MISSING_VAR", "", ""},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := envOr(tt.key, tt.def)
			if result != tt.expected {
				t.Errorf("envOr(%s, %s) = %s, expected %s", tt.key, tt.def, result, tt.expected)
			}
		})
	}
}

// TestBuildKnightStatus tests the knight status builder
func TestBuildKnightStatus(t *testing.T) {
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Labels: map[string]string{
				"app.kubernetes.io/instance": "lancelot",
				"roundtable.io/domain":       "finance",
			},
			CreationTimestamp: metav1.Time{Time: time.Now().Add(-2 * time.Hour)},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{Image: "knight:latest"},
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{
					Ready:        true,
					RestartCount: 2,
				},
			},
		},
	}
	
	status := buildKnightStatus(pod)
	
	if status.Name != "lancelot" {
		t.Errorf("expected name 'lancelot', got '%s'", status.Name)
	}
	
	if status.Domain != "finance" {
		t.Errorf("expected domain 'finance', got '%s'", status.Domain)
	}
	
	if status.Status != "online" {
		t.Errorf("expected status 'online', got '%s'", status.Status)
	}
	
	if status.Restarts != 2 {
		t.Errorf("expected 2 restarts, got %d", status.Restarts)
	}
	
	if !status.Ready {
		t.Error("expected ready=true")
	}
}

// Helper functions
func boolPtr(b bool) *bool {
	return &b
}

// TestGetNestedMap tests the nested map helper
func TestGetNestedMap(t *testing.T) {
	obj := map[string]interface{}{
		"spec": map[string]interface{}{
			"key": "value",
		},
	}
	
	result := getNestedMap(obj, "spec")
	if result == nil {
		t.Error("expected non-nil map")
	}
	
	if result["key"] != "value" {
		t.Errorf("expected key='value', got '%v'", result["key"])
	}
	
	// Test missing key
	result = getNestedMap(obj, "missing")
	if result != nil {
		t.Error("expected nil for missing key")
	}
}

// TestGetStr tests the string getter helper
func TestGetStr(t *testing.T) {
	obj := map[string]interface{}{
		"name": "test",
		"num":  123,
	}
	
	if getStr(obj, "name") != "test" {
		t.Error("expected 'test'")
	}
	
	if getStr(obj, "num") != "" {
		t.Error("expected empty string for non-string value")
	}
	
	if getStr(obj, "missing") != "" {
		t.Error("expected empty string for missing key")
	}
	
	if getStr(nil, "any") != "" {
		t.Error("expected empty string for nil map")
	}
}

// TestGetInt tests the int getter helper
func TestGetInt(t *testing.T) {
	obj := map[string]interface{}{
		"count":   float64(42),
		"count64": int64(100),
		"str":     "not a number",
	}
	
	if getInt(obj, "count") != 42 {
		t.Error("expected 42")
	}
	
	if getInt(obj, "count64") != 100 {
		t.Error("expected 100")
	}
	
	if getInt(obj, "str") != 0 {
		t.Error("expected 0 for non-number")
	}
	
	if getInt(obj, "missing") != 0 {
		t.Error("expected 0 for missing key")
	}
}
