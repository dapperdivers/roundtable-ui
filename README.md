# ⚔️ Round Table Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)

Comprehensive observability and control dashboard for the [Round Table](https://github.com/dapperdivers/roundtable) Kubernetes-native multi-agent orchestration system.

<!-- screenshot -->

The Round Table Dashboard provides real-time visibility into your AI agent fleet, mission execution, chain orchestration, and system architecture. Built for production deployments, it offers deep introspection, interactive debugging, and comprehensive cost tracking across your entire Round Table deployment.

## Features

### 🎯 Command Center (Dashboard)
The main control hub providing at-a-glance overview of your Round Table deployment:
- **Fleet health summary** — active knights, phase distribution, ready/suspended counts
- **Cost tracking dashboard** — real-time budget utilization across all missions and knights
- **Active missions panel** — current mission statuses with progress indicators
- **Chain execution monitor** — running chains with step-by-step progress
- **Activity feed** — live event stream showing task dispatches, completions, and system events
- **Quick actions** — dispatch new missions, navigate to critical resources

### 🛡️ Fleet Management
Complete knight lifecycle management and monitoring:
- **Knight status cards** — visual health indicators (online/offline/starting)
- **Phase tracking** — Running, Ready, Suspended, Failed states with color coding
- **Model information** — AI model configurations (GPT-4, Claude, Llama, etc.)
- **Runtime details** — pi-agent version, container status, uptime
- **Performance metrics** — tasks completed/failed, total cost, concurrency settings
- **Skill inventory** — installed skills and Nix packages per knight
- **Pod introspection** — container states, restart counts, node placement
- **Live logs** — streaming pod logs with auto-refresh
- **Session debugging** — knight session introspection (stats, recent tasks, session tree)

### 🎯 Missions
Mission lifecycle management from creation to completion:
- **Mission wizard** — step-by-step mission creation with validation
  - Basic configuration (name, objective, round table reference)
  - Knight assignment with roles
  - Advanced options (success criteria, briefing, cleanup policy)
  - Planner configuration for meta-missions
  - Budget and timeout controls
- **Mission list** — all active and completed missions with status badges
- **Mission details** — deep dive into mission execution:
  - Knight statuses (ready/ephemeral/tasks completed)
  - Chain execution progress with phase indicators
  - Planning results for meta-missions (generated chains/knights/skills)
  - Cost tracking against budget
  - Results ConfigMap references
- **Mission deletion** — cleanup of completed or failed missions

### 👑 Round Tables
Fleet-level configuration and warm pool management:
- **Round table list** — all configured fleets with health indicators
- **NATS prefix configuration** — subject routing setup
- **Warm pool status** — available/provisioning/claimed knight counts
- **Policy enforcement** — max concurrent tasks, cost budgets, capacity limits
- **Cost aggregation** — total spending across all knights in the table
- **Mission tracking** — active mission counts per round table
- **Suspension controls** — fleet-wide suspend/resume capabilities
- **Ephemeral mode** — temporary round table lifecycle management

### 📜 Dispatch (Tasks)
Direct task execution and history:
- **Quick dispatch interface** — send tasks to any knight instantly
- **Knight/domain selection** — dropdown selectors with validation
- **Task history viewer** — recent task executions with results
- **NATS subject monitoring** — raw subject paths for debugging
- **Response streaming** — real-time result display
- **Timeout configuration** — per-task timeout overrides
- **Dispatch confirmation** — task ID and subject tracking

### 📊 Message Flow (Live)
Real-time NATS event visualization:
- **Animated message graph** — visual representation of NATS message flow
- **Subject-based routing** — tasks, results, missions, chains tracked separately
- **Live event stream** — WebSocket-based real-time updates
- **Color-coded events** — task (blue), result (green), mission (purple), chain (orange)
- **Event details** — click events to inspect full payload
- **Throughput monitoring** — messages per second, total counts
- **Graph auto-layout** — force-directed graph with drag-and-drop nodes

### 🔗 Chains
Declarative pipeline execution with DAG visualization:
- **Chain list** — all defined chains with execution status
- **Phase indicators** — Pending, Running, Succeeded, Failed, Paused
- **Step-by-step progress** — individual step statuses with timing
- **DAG visualization** — interactive directed acyclic graph of chain dependencies
- **Step details** — knight assignments, domain routing, retry counts
- **Output inspection** — step results with NATS KV integration
- **Schedule display** — cron-based recurring chains
- **Dependency tracking** — dependsOn relationships visualized

### 🌲 Sessions
Knight session introspection and debugging:
- **Session statistics** — active sessions, total tasks, memory usage
- **Recent tasks** — last N tasks executed with timing
- **Session tree** — hierarchical view of session state
- **State inspection** — variables, context, execution history
- **Performance metrics** — task duration, success/failure rates
- **Real-time updates** — live session data via NATS introspection API

### 🏛️ Architecture
Live system topology visualization:
- **Component graph** — visual representation of Round Table architecture
- **Node types** — Knights, Round Tables, NATS, Kubernetes, Missions, Chains
- **Relationship mapping** — connections between components
- **Interactive exploration** — zoom, pan, drag nodes
- **Health indicators** — component status reflected in graph
- **Export capabilities** — save topology diagrams

### 📖 Chronicles (Briefings)
Daily briefing viewer and historical record:
- **Briefing list** — all available daily briefings by date
- **Markdown rendering** — rich formatting with syntax highlighting
- **Date navigation** — jump to specific dates or browse chronologically
- **Full-text display** — complete briefing content with proper formatting
- **Vault integration** — reads from mounted Obsidian vault

### 💰 Cost Details
Expanded cost breakdown and budget tracking:
- **Per-knight costs** — detailed spending by individual knight
- **Mission budget tracking** — cost vs. budget for active missions
- **Model cost breakdown** — spending by AI model (GPT-4, Claude, etc.)
- **Time-series graphs** — cost trends over time
- **Budget alerts** — warnings when approaching limits
- **Export capabilities** — cost reports for accounting

## CRD Integration

The dashboard provides full CRUD operations for Round Table Custom Resource Definitions:

### Knight CRD (`knights.ai.roundtable.io/v1alpha1`)
- View knight specifications (model, domain, runtime, skills)
- Monitor knight status (phase, tasks completed/failed, total cost)
- Inspect pod lifecycle (container states, restart counts)
- Access knight logs and session data

### Chain CRD (`chains.ai.roundtable.io/v1alpha1`)
- List all chains with execution status
- View chain specifications (steps, dependencies, schedule)
- Monitor step execution (phase, timing, output)
- Visualize DAG structure

### Mission CRD (`missions.ai.roundtable.io/v1alpha1`)
- Create missions via wizard (all spec fields supported)
- List missions with status and cost tracking
- View mission details (knights, chains, planning results)
- Delete completed missions

### RoundTable CRD (`roundtables.ai.roundtable.io/v1alpha1`)
- List all round tables with health metrics
- View warm pool status (available/provisioning/claimed)
- Monitor policies (max tasks, cost budgets, capacity limits)
- Track aggregate metrics (total cost, active missions)

## Tech Stack

### Frontend
- **React 18** — UI framework with hooks and concurrent rendering
- **TypeScript 5.9** — type-safe JavaScript with strict mode
- **Vite 6** — lightning-fast build tool and dev server
- **Tailwind CSS 3** — utility-first styling framework
- **React Router 7** — client-side routing with SPA navigation
- **@xyflow/react** — interactive graph visualization for chains and architecture
- **react-markdown** — markdown rendering for briefings
- **lucide-react** — icon library (450+ icons)
- **date-fns** — date formatting and manipulation
- **Vitest** — unit testing framework
- **Storybook 8** — component development and documentation

### Backend
- **Go 1.23** — API server and orchestration logic
- **gorilla/mux** — HTTP routing and middleware
- **gorilla/websocket** — WebSocket support for real-time events
- **NATS Go Client** — NATS/JetStream integration
- **Kubernetes Client-Go** — in-cluster API access
- **rs/cors** — CORS middleware for cross-origin requests

### Infrastructure
- **NATS JetStream** — event streaming, task queue, result storage
- **Kubernetes API** — pod status, CRD management, resource watching
- **NATS KV Store** — chain step outputs, mission results
- **Obsidian Vault** — daily briefing storage (optional)

## Prerequisites

- **Kubernetes cluster** (1.27+) with Round Table operator installed
- **NATS JetStream** deployed and accessible
- **Round Table operator** (installs Knight, Chain, Mission, RoundTable CRDs)
- **Namespace**: `roundtable` (or custom via `NAMESPACE` env var)

## Quick Start

### Development Mode

```bash
# Clone repository
git clone https://github.com/dapperdivers/roundtable-ui.git
cd roundtable-ui

# Terminal 1: Start backend API server
cd api
go run . &

# Terminal 2: Start frontend dev server
cd ui
npm install
npm run dev

# Open browser to http://localhost:5173
```

### Production Deployment

The dashboard is deployed as part of the Round Table Helm chart:

```bash
# Install/upgrade Round Table with dashboard enabled
helm repo add roundtable https://dapperdivers.github.io/roundtable
helm upgrade --install roundtable roundtable/roundtable \
  --namespace roundtable \
  --create-namespace \
  --set dashboard.enabled=true \
  --set dashboard.ingress.enabled=true \
  --set dashboard.ingress.host=roundtable.example.com

# Port-forward for local access
kubectl port-forward -n roundtable svc/roundtable-dashboard 8080:8080

# Open browser to http://localhost:8080
```

## Configuration

### Environment Variables

The dashboard API server is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NATS_URL` | NATS server URL | `nats://nats.database.svc:4222` |
| `NAMESPACE` | Kubernetes namespace for Round Table resources | `roundtable` |
| `PORT` | HTTP server port | `8080` |
| `FLEET_PREFIX` | NATS subject prefix (e.g., `fleet-a`) | `fleet-a` |
| `FLEET_STREAM` | JetStream stream name for results | `fleet_a_results` |
| `VAULT_PATH` | Path to mounted Obsidian vault | `/vault` |
| `DASHBOARD_API_KEY` | Optional API key for authentication | _(none)_ |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | _(same-origin only)_ |

### Authentication

API key authentication is optional:

```bash
# Enable authentication
export DASHBOARD_API_KEY=your-secret-key-here

# Frontend will prompt for API key on first access
# Key is stored in localStorage as 'roundtable_api_key'
```

When `DASHBOARD_API_KEY` is not set, the dashboard operates in open mode (suitable for internal/dev deployments).

### CORS Configuration

For production deployments with separate frontend hosting:

```bash
export ALLOWED_ORIGINS="https://dashboard.example.com,https://admin.example.com"
```

## API Endpoints

The dashboard exposes a comprehensive REST API:

### Authentication
- `POST /api/auth/login` — Validate API key

### Fleet Management
- `GET /api/fleet` — List all knights
- `GET /api/fleet/{knight}` — Get knight details
- `GET /api/fleet/{knight}/logs` — Stream knight pod logs
- `GET /api/fleet/{knight}/session?type={stats|recent|tree}` — Knight session introspection

### Task Dispatch
- `GET /api/tasks` — List recent tasks from JetStream
- `POST /api/tasks/dispatch` — Dispatch task to knight

### Chain Orchestration
- `GET /api/chains` — List all chains
- `GET /api/chains/{name}` — Get chain details
- `GET /api/chains/{name}/steps/{step}/output` — Get step output from NATS KV

### Mission Management
- `GET /api/missions` — List all missions
- `GET /api/missions/{name}` — Get mission details
- `POST /api/missions` — Create new mission
- `DELETE /api/missions/{name}` — Delete mission
- `GET /api/missions/{name}/results` — Get mission results from NATS KV

### Round Table Management
- `GET /api/roundtables` — List all round tables
- `GET /api/roundtables/{name}` — Get round table details

### NATS KV Store
- `GET /api/kv/{bucket}/keys` — List keys in KV bucket
- `GET /api/kv/{bucket}/{key}` — Get value from KV store

### Briefings
- `GET /api/briefings` — List available briefings
- `GET /api/briefings/{date}` — Get briefing for specific date (YYYY-MM-DD)

### Real-time Events
- `GET /api/ws` — WebSocket connection for live NATS events

### System
- `GET /api/config` — Get dashboard configuration (fleet prefix)
- `GET /api/health` — Health check endpoint

## Security

### Input Validation
- All knight/domain names validated with regex to prevent NATS subject injection
- Kubernetes resource names validated against K8s naming rules
- Request body size limits enforced (1MB max)
- Path traversal protection for briefing file access

### Rate Limiting
- Simple sliding-window rate limiter (100 req/s default)
- Applied to all API endpoints

### Authentication
- Optional API key authentication via `DASHBOARD_API_KEY`
- Bearer token in `Authorization` header or `api_key` query param (WebSocket)
- Health endpoint always accessible

### CORS
- Same-origin policy by default
- Explicit origin whitelist via `ALLOWED_ORIGINS`

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup instructions
- Code style guidelines
- Testing requirements
- Pull request process
- Issue reporting

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                     │
│  ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐  │
│  │Dashboard │ │ Fleet   │ │Missions │ │  Message Flow  │  │
│  │  (Home)  │ │ Status  │ │ Wizard  │ │  (Live Graph)  │  │
│  └────┬─────┘ └────┬────┘ └────┬────┘ └───────┬────────┘  │
│       │            │           │               │            │
│  ┌────┴────────────┴───────────┴───────────────┴────────┐  │
│  │          React Router + REST API Client              │  │
│  │      (fetch + WebSocket for real-time events)        │  │
│  └────────────────────────┬─────────────────────────────┘  │
└───────────────────────────┼────────────────────────────────┘
                            │ HTTP/WebSocket
┌───────────────────────────┼────────────────────────────────┐
│                  API Server (Go)                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │ Fleet Handler│ │Task Dispatcher│ │  NATS WS Bridge │   │
│  │ (K8s CRDs)   │ │ (NATS Pub)    │ │ (Sub streaming) │   │
│  └──────┬───────┘ └──────┬────────┘ └────────┬─────────┘   │
│         │                │                   │              │
│  ┌──────┴────────────────┴───────────────────┴──────────┐  │
│  │         Middleware (Auth, CORS, Rate Limit)          │  │
│  └──────┬────────────────────────────────────────┬──────┘  │
│         │                                        │          │
│  ┌──────┴──────────┐                    ┌───────┴───────┐  │
│  │ Kubernetes      │                    │ NATS Client   │  │
│  │ Client (CRDs)   │                    │ (JetStream)   │  │
│  └─────────────────┘                    └───────────────┘  │
└───────────────┬────────────────────────────────┬───────────┘
                │                                │
         ┌──────┴─────────┐             ┌───────┴────────┐
         │  Kubernetes    │             │  NATS Server   │
         │  API Server    │             │  (JetStream)   │
         │                │             │                │
         │ - Knight CRDs  │             │ - Task Queue   │
         │ - Chain CRDs   │             │ - Results KV   │
         │ - Mission CRDs │             │ - Event Stream │
         │ - RoundTable   │             │                │
         └────────────────┘             └────────────────┘
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ⚔️ by the Round Table team**
