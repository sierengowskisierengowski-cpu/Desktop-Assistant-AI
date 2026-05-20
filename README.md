# AXIOM — Desktop AI Assistant

> A premium personal AI command center. Lives in your system tray. Runs on your GPU. Knows your system.

AXIOM is a native desktop AI assistant built with Electron + React. It pops up instantly via a global hotkey, lets you command your computer in plain English, and runs powerful automations — file organization, cleanup, scheduling, and more — using either a local AI model on your GPU (via Ollama) or a cloud provider like OpenAI.

---

## Features

### AI Chat
Talk to AXIOM in plain language. Ask it to clean your Downloads, organize files by type, find duplicates, or just answer questions about your system. The AI confirms what it's going to do before any destructive operation, and every action is logged with a one-click undo.

### Local GPU Mode (Ollama)
Run AI entirely on your own machine — no API costs, no data leaving your computer. AXIOM auto-detects a running Ollama instance, lists your installed models, and lets you pull new ones (Llama 3, Mistral, Phi-3, Gemma, and more) directly from the Settings panel.

### Cloud Mode
Connect your OpenAI API key (or any OpenAI-compatible endpoint) to use GPT-4o, GPT-4, or other cloud models. Switch between local and cloud anytime from Settings.

### Task Scheduler
Set up recurring automated tasks with plain-language descriptions and a cron schedule. Tasks run silently in the background even when the window is closed. Toggle them on/off, run them on demand, and inspect run logs.

### Knowledge Base
Store notes about your system, preferences, and context — naming conventions, folder structures, things to never touch. The AI reads your entire knowledge base on every request, so it always knows your setup without you repeating yourself.

### Activity Log
Every action the AI has ever taken is logged with full detail. File operations show which files were affected. Undo restores files to their original location.

### Quick Actions
One-click buttons for your most-used commands. Fully configurable — add, edit, reorder, and delete. Clicking a button instantly fires that command through the AI pipeline.

### System Status
Live CPU, RAM, and disk usage — updated every 3 seconds. Always visible inside the app.

### Glassmorphism UI
Every surface is a frosted blur panel. The UI feels like a premium macOS utility: translucent, layered, sharp. Smooth animations throughout. Light, dark, and system theme modes.

---

## Quick Start

### Web Preview (Replit)
The app runs as a full web application in Replit for development and preview:

```bash
# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the frontend
pnpm --filter @workspace/desktop run dev
```

### Running Locally with Ollama (GPU Mode)
1. Install [Ollama](https://ollama.ai) on your machine
2. Pull a model: `ollama pull llama3` or `ollama pull mistral`
3. Ollama runs automatically at `http://localhost:11434`
4. Open AXIOM, go to Settings, set AI Mode to **Local (GPU)**, and select your model

### Cloud Mode Setup
1. Go to **Settings > AI Mode**
2. Select **Cloud**
3. Enter your OpenAI API key (or a compatible endpoint URL)
4. Select your preferred model (GPT-4o recommended)

---

## Architecture

```
axiom/
├── artifacts/
│   ├── api-server/          # Express 5 API backend
│   │   └── src/routes/      # Route handlers (chat, scheduler, knowledge, files, stats, ai, etc.)
│   └── desktop/             # React + Vite frontend
│       └── src/
│           ├── pages/       # App pages (chat, scheduler, knowledge, activity, etc.)
│           └── components/  # Shared UI components
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   └── db/                  # Drizzle ORM schema + PostgreSQL
```

### Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion |
| Backend | Express 5, Node.js 24, TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| AI (Cloud) | OpenAI SDK (OpenAI-compatible) |
| AI (Local) | Ollama REST API |
| Scheduling | node-cron |
| System Stats | systeminformation |
| API Contract | OpenAPI 3.1 → Orval codegen |

---

## API Reference

The full API is defined in `lib/api-spec/openapi.yaml`. After any spec changes, regenerate types:

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/sessions/:id/messages` | Send a message and get AI response |
| `GET` | `/api/chat/recent` | Recent chat sessions with previews |
| `POST` | `/api/scheduler/tasks/:id/run` | Run a scheduled task immediately |
| `GET` | `/api/scheduler/status` | Upcoming tasks with countdowns |
| `GET` | `/api/knowledge/notes` | List all knowledge base notes |
| `GET` | `/api/ai/status` | AI provider status + Ollama connectivity |
| `GET` | `/api/ai/models` | All available models (local + cloud) |
| `POST` | `/api/ai/models/pull` | Pull a new Ollama model |
| `POST` | `/api/files/preview` | Preview affected files before operation |
| `POST` | `/api/files/execute` | Execute a confirmed file operation |
| `GET` | `/api/stats/system` | Live CPU, RAM, disk stats |
| `GET` | `/api/activity/summary` | Activity log summary counts |
| `POST` | `/api/activity/:id/undo` | Undo a file operation |

---

## File Operations

AXIOM can perform the following operations on approved paths:

| Operation | Description |
|-----------|-------------|
| `delete` | Delete files matching criteria (age, extension, size) |
| `organize` | Sort files into subfolders by type (Images, Videos, Documents, etc.) |
| `move` | Move files to a destination directory |
| `dedup` | Identify and remove potential duplicate files |

**Safety:** Every file operation requires:
1. The target path to be in your **Allowed Paths** list (set in Settings)
2. An explicit confirmation step showing exactly which files will be affected
3. Destructive operations move files to a temp location first, enabling undo

---

## Scheduled Task Cron Syntax

AXIOM uses standard cron syntax:

```
┌──────── minute (0-59)
│ ┌────── hour (0-23)
│ │ ┌──── day of month (1-31)
│ │ │ ┌── month (1-12)
│ │ │ │ ┌ day of week (0-6, Sun=0)
│ │ │ │ │
* * * * *
```

**Common schedules:**
- `0 9 * * 1` — Every Monday at 9am
- `0 8 1 * *` — 1st of every month at 8am
- `*/30 * * * *` — Every 30 minutes
- `0 */2 * * *` — Every 2 hours

---

## Development

```bash
# Install dependencies
pnpm install

# Run full typecheck
pnpm run typecheck

# Build all packages
pnpm run build

# Push DB schema changes
pnpm --filter @workspace/db run push

# Regenerate API client after spec changes
pnpm --filter @workspace/api-spec run codegen
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `OPENAI_API_KEY` | Fallback OpenAI key (optional — set per-user in Settings) |
| `PORT` | Server port (auto-set by Replit) |

---

## Security

- File operations are sandboxed to user-approved paths only
- No file operations execute without user confirmation
- Undo is available for all destructive operations
- Local GPU mode keeps all data on-device — nothing sent to external servers
- API keys are stored in the database (not in environment variables) for per-user configuration

---

## License

MIT
