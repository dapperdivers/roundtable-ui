# ⚔️ Round Table Dashboard

Fleet visualization, task management, and chain orchestration UI for the [Round Table](https://github.com/dapperdivers/roundtable) multi-agent system.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (React SPA)             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Fleet   │ │ Task     │ │ Chain        │  │
│  │ Status  │ │ Manager  │ │ Visualizer   │  │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       └───────────┼──────────────┘           │
│                   │ REST + WebSocket          │
└───────────────────┼──────────────────────────┘
                    │
┌───────────────────┼──────────────────────────┐
│           API Server (Go)                     │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Fleet   │ │ Task     │ │ NATS         │  │
│  │ Handler │ │ Handler  │ │ WebSocket    │  │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       │           │              │            │
│  ┌────┴───────────┴──────────────┴────────┐  │
│  │         NATS Client (JetStream)        │  │
│  └────────────────┬───────────────────────┘  │
│                   │                           │
│  ┌────────────────┴───────────────────────┐  │
│  │      Kubernetes Client (in-cluster)    │  │
│  └────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
        │                    │
   ┌────┴────┐         ┌────┴────┐
   │  NATS   │         │   K8s   │
   │ JetStream│        │   API   │
   └─────────┘         └─────────┘
```

## Features

### Fleet Status
- Real-time knight health (online/offline/busy)
- Pod status, resource usage, restart counts
- Nix tool inventory per knight
- Skill listing per knight
- Cost tracking (per-task and cumulative)

### Task Management
- Dispatch tasks to any knight from the UI
- View task history with full results
- Real-time task progress via NATS WebSocket
- Cost and duration metrics

### Chain Orchestration
- Visual chain builder (drag-and-drop knight pipeline)
- Chain execution with live progress
- Result aggregation visualization
- Chain templates (morning briefing, security scan, etc.)

### Daily Briefings
- View historical briefings from vault
- Trigger on-demand briefings
- Compare briefings across days

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Go API server (shared module with roundtable operator)
- **Real-time**: NATS WebSocket bridge
- **Data**: NATS JetStream (tasks/results), Kubernetes API (fleet status), Vault files (briefings)
- **Deployment**: Helm chart (integrated into roundtable operator chart)

## Development

```bash
# Backend
cd api && go run .

# Frontend
cd ui && npm install && npm run dev
```

## Deployment

Deployed as part of the `roundtable` Helm chart in the `roundtable` namespace.

## License

MIT
