# Human-Agent Collaborative Writing — Research Prototype

A research prototype for studying how users collaborate with AI writing agents. The system guides users through a multi-step article writing process, enabling real-time intervention, content editing, and transparent agent control at every stage.

**Stack:** React · Tailwind CSS · Node.js/Express · Python/FastAPI · Playwright · OpenAI GPT 5.4mini 

---

## Research Context

This prototype investigates human-AI collaborative writing, focusing on:

- How users intervene in AI writing (pause, edit, skip, approve)
- The effect of transparency (visible agent personas, step status) on trust and control
- Differences between **single-agent** and **multi-agent** writing modes
- The role of **synchronous** (step-by-step approval) vs **asynchronous** (auto-run) execution on user control perception

---

## Architecture

```
research prototype/
├── backend/
│   ├── server.js          Node.js/Express — agent orchestration, SSE, API
│   ├── scraper/
│   │   └── main.py        Python/FastAPI — Playwright web scraper
│   └── .env               OPENAI_API_KEY
└── frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── SetupScreen.jsx
            ├── ControlBar.jsx
            ├── AgentTimeline.jsx      Left panel — agent personas + content plan
            ├── WorkspacePanel.jsx     Middle panel — workspace, search, browser view
            ├── DocumentPanel.jsx      Right panel — live document output
            ├── AnalyticsReport.jsx    Session report modal
            ├── EditSidebar.jsx        Instruction injection drawer
            └── StopDialog.jsx
```

### Backend — Node.js / Express (`server.js`)

Manages the full agent execution lifecycle:

- **ExecutionController** class — tracks current step, handles pause/resume/skip/inject via Promise resolvers
- **SSE (Server-Sent Events)** — streams events to the frontend in real time (tokens, step status, screenshots, images)
- **OpenAI Streaming** — GPT-4o with `stream: true`; tokens forwarded token-by-token to the client
- **In-memory state** — all session state lives in memory; a single active SSE client is supported per server instance
- **Analytics log** — append-only event log for session behaviour analysis

### Scraper — Python / FastAPI (`scraper/main.py`)

A Playwright-based headless browser service that:

- Takes a page URL, scrolls to trigger lazy-loaded images, captures a full JPEG screenshot
- Extracts and filters images (skips tracking pixels, tiny images, SVGs)
- Downloads the top 6 images in parallel via Playwright's request context (preserves cookies/referer, avoids 403 hotlink blocks)
- Returns base64-encoded data URLs for both the screenshot and images so they render immediately in the browser without CORS or hotlink issues

Auto-started by `server.js` on port `3002` (bound to `127.0.0.1`); health-checked before use.

### Frontend — React + Tailwind

Three-panel layout with a persistent control bar:

```
┌──────────────────────────────────────────────────────────────────┐
│  Control Bar  (status · Pause · Skip · Next · Auto · Reset)      │
├──────────────────┬───────────────────────┬───────────────────────┤
│  Left Panel      │  Middle Panel         │  Right Panel          │
│  Agent Personas  │  Workspace            │  Document Output      │
│  + Content Plan  │  (outline / search /  │  (streamed article +  │
│                  │   browser view)       │   tab for review)     │
└──────────────────┴───────────────────────┴───────────────────────┘
```

State is managed with React `useState`/`useEffect`; the SSE stream drives all real-time updates.

---

## Writing Pipeline

The agent executes 6 sequential steps:

| Step | Name | Description |
|------|------|-------------|
| 0 | Planning | GPT-5.4 generates a structured content outline (topic, sections, key points, style, audience) |
| 1 | Web Search | Searches for real sources; scrapes confirmed pages with Playwright; streams live screenshots |
| 2 | Introduction | Writes the introduction section |
| 3 | Body | Writes the main body sections |
| 4 | Conclusion | Writes the conclusion |
| 5 | Review | A reviewer agent critiques the draft and rewrites each section inline |

In **synchronous mode**, the agent pauses after each step and waits for the user to click **Next**. In **asynchronous mode**, it runs continuously unless the user intervenes.

In **multi-agent mode**, each writing step (2–4) spawns a Writer sub-agent followed by a Reviewer sub-agent (Kai), who critiques and rewrites before the step is marked complete.

---

## Key Features

### Agent Persona Panel (Left)

- Four persona cards: **Planner**, **Researcher**, **Writer**, **Reviewer** — only the active agent is highlighted
- Each card is fully editable: name, role, writing style, audience, and the full system prompt
- Agents can be restarted from any step via a **Restart from here** button
- **Content Plan** section shows the live outline once planning completes:
  - Drag sections to reorder
  - Inline rename sections
  - Edit descriptions and key points
  - Add / delete sections and bullet points
  - "Re-write with this plan" triggers a restart from the writing step

### Workspace Panel (Middle)

- Streams the planning outline as it generates (partial JSON parsed live)
- During web search: shows the **live browser view** (Playwright screenshot) as each page is visited, with a progress bar (`Visited 2 / 5 sources`)
- **Search Sources** panel: select/deselect individual sources and images before confirming; images are fully draggable into document paragraphs
- After planning: shows a reminder banner directing the user to review the content plan

### Document Panel (Right)

- Streams article content token-by-token with a blinking cursor
- **Tab switcher** (Article / Review Suggestions) appears once the review step begins; auto-switches to "Review" when feedback starts streaming, back to "Article" when rewriting begins
- **Paragraph editing**: click any paragraph to select it, then edit inline, request an AI rewrite with custom instructions, remove, or replace
- **Image insertion**: paste screenshots with ⌘V, or drag images from the search panel directly onto any paragraph
- Skeleton loading placeholders while sections are being cleared/rewritten
- **Completion banner** (sticky top) with a direct **Session Report** button when the article is done

### Control Bar

| Control | Behaviour |
|---------|-----------|
| **Pause** | Stops the agent mid-step; shows inline resume/restart banner |
| **Skip step** | Skips the current running step |
| **Next** | Approves the current step and proceeds (synchronous mode) |
| **Apply suggestions / Skip** | Accept or reject the reviewer's suggestions (review step) |
| **Auto** | Toggle auto-approve mode — the agent proceeds through all steps without waiting for user clicks |
| **Session Report** | Opens the analytics modal |
| **Reset** | Clears all session state and returns to the setup screen |

### Auto Mode

When **Auto** is enabled, every `waiting_approval` pause is automatically confirmed after 600 ms, and `search_review` is auto-confirmed with all available sources. The `SearchSection` UI reflects the confirmed state regardless of whether confirmation came from the button or auto mode. Auto mode usage (ever enabled, toggle count) is recorded in the session report.

### Session Report (Analytics)

Opened via the **Session Report** button in the control bar or the completion banner. Tracks:

- Session duration
- Per-step review times (approved / skipped / wait time)
- Pause/resume/skip counts
- Manual paragraph edits and AI rewrite requests (broken down by section)
- Content plan modifications and fields changed
- Persona edits
- Web search: sources selected, **pages visited** (with title + URL list), external links opened, images selected, time reviewing
- Review step: applied or skipped
- Images pasted/dropped
- Auto mode: whether it was ever enabled, how many times toggled

---

## Flexibility & System Affordances

A central design goal of this prototype is to give users meaningful control at multiple levels of granularity — from high-level configuration before writing starts, to sentence-level editing after content is generated. The sections below map out each control point and what it makes possible.

### 1. Pre-task Configuration

Before any agent runs, users configure the writing context in the setup screen:

| Setting | Options | Effect |
|---------|---------|--------|
| **Prompt** | Free text | Defines the article topic, scope, and any special requirements |
| **Writing style** | Free text (e.g. *casual*, *journalistic*) | Injected into every agent's system prompt |
| **Target audience** | Free text (e.g. *tourists*, *food lovers*) | Shapes vocabulary, depth, and assumed knowledge |
| **Agent mode** | Single / Multi-agent | Single: one model handles all writing; Multi: Writer + Reviewer sub-agents per section |
| **Execution mode** | Synchronous / Asynchronous | Synchronous pauses after every step for approval; Asynchronous runs continuously |

These settings persist for the session and can be changed by restarting from the Planning step.

---

### 2. Intervention During Execution

Users are never locked out of the pipeline while it runs. Five intervention mechanisms are available at any point:

#### Pause & Resume
The **Pause** button halts the agent between LLM calls (not mid-token). Once paused, the user can:
- **Resume** — continue from exactly where it stopped
- **Restart from this agent** — re-run the current step with any persona edits applied
- **Reset** — start the entire session over

#### Skip Step
While any step is running, **Skip step** ends it immediately and advances the pipeline. Useful for bypassing a step whose output is already acceptable, or one the user wants to handle manually.

#### Inject Instructions
At any point during execution, users can open the **Edit** sidebar and type freeform instructions (e.g. *"make the tone more formal"*, *"include a price comparison"*). These are appended as a system message to the next LLM call in the pipeline, without restarting anything already done.

#### Approve / Next (Synchronous Mode)
In synchronous mode, each step pauses and waits. The **Next** button signals explicit approval before the agent proceeds — creating a human checkpoint at every pipeline stage.

#### Auto Mode
The **Auto** toggle removes all manual checkpoints — the agent advances through every approval gate automatically after 600 ms. This is useful for baseline comparisons or when the user wants to observe the full pipeline before intervening. Auto mode can be toggled on or off at any point mid-run; turning it off re-enables manual checkpoints from the next pause forward.

---

### 3. Content Plan as a Shared Artifact

After the Planning step, the generated outline is not read-only — it becomes a **negotiable artifact** between the user and the agent:

- **Add sections** — insert new body sections the agent didn't plan
- **Delete sections or bullet points** — remove planned content before writing begins
- **Rename sections** — change the framing of a section inline
- **Reorder sections** — drag to rearrange the writing order
- **Edit descriptions and key points** — refine what the agent will cover within each section
- **Re-write with this plan** — once edits are made, trigger a full rewrite of all writing steps using the revised outline

This gives users authority over the article's structure before any prose is generated, without needing to restart the entire session.

---

### 4. Source and Image Curation

The Web Search step surfaces real scraped results and gives users curatorial control before writing begins:

- **Source selection** — each search result can be individually included or excluded; the agent only uses confirmed sources as context
- **External link inspection** — each result has a direct link to the source page for manual verification
- **Image selection** — scraped images from each confirmed page are displayed and individually selectable; deselected images are excluded from the agent's writing context
- **Image placement** — selected images can be dragged directly onto any paragraph in the document to insert them at a specific location

All source and image selections are recorded in the session analytics, including which URLs were opened for inspection.

---

### 5. Document-Level Editing

Once content is generated, users can refine it at the paragraph level without restarting any step:

| Action | How |
|--------|-----|
| **Inline edit** | Click a paragraph → Edit → type changes → Save |
| **AI rewrite** | Click a paragraph → Rewrite → enter instruction (e.g. *"shorten this"*) → confirm |
| **Remove paragraph** | Click → Remove |
| **Insert image** | Drag from search panel onto a paragraph, or ⌘V to paste a screenshot |
| **Replace image** | Select an image paragraph → Replace (⌘V) |

Edits are applied immediately to the in-memory document state. The agent can reference edited content if a later step is restarted.

---

### 6. Agent Persona Customisation

Each of the four agents (Planner, Researcher, Writer, Reviewer) has an editable persona card:

- **Name and role** — relabelled to reflect different study conditions
- **Writing style / audience** — per-agent overrides of the session-level settings
- **System prompt** — the full prompt the agent receives; can be replaced entirely
- **Restart from here** — re-runs this agent's step with the updated persona, without touching earlier steps

This allows researchers to test how different agent framings (e.g. expert vs. novice persona) affect output quality and user trust.

---

### 7. Review Step Control

The Review step (Step 5) is the only step with a binary outcome gate:

- **Apply suggestions** — the reviewer's critique is used to rewrite each section inline; the document panel auto-switches to the article view as rewriting streams in
- **Skip** — the review is discarded and the article stays as-is

This models the real-world decision of whether to incorporate editorial feedback, and is tracked separately in the session report.

---

### 8. Transparency and Observability

The system surfaces agent activity at multiple levels:

- **Step status bar** — current step highlighted with a pulsing indicator and a live status message (e.g. *"Visiting page 3 of 5: nytimes.com…"*)
- **Live browser view** — during web search, a real Playwright screenshot of each page appears as it is visited, with a source-visit progress bar
- **Streaming tokens** — article content appears word-by-word as the model generates it; a blinking cursor marks the live position
- **Review tab** — reviewer feedback streams into a separate tab in the document panel so the user can read the critique before it is applied
- **Content plan live-build** — the planning outline renders incrementally as the JSON is streamed, before the step completes
- **Session Report** — a complete post-session summary of every user action, timing, and agent behaviour, exportable as JSON

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream` | SSE event stream |
| POST | `/api/start` | Start the agent (config payload) |
| POST | `/api/stop` | Pause execution |
| POST | `/api/resume` | Resume from pause |
| POST | `/api/skip` | Skip current step |
| POST | `/api/approve` | Approve current step |
| POST | `/api/search/confirm` | Confirm selected sources and images |
| POST | `/api/document/edit` | Edit a paragraph |
| POST | `/api/document/remove` | Remove a paragraph |
| POST | `/api/document/rewrite` | AI-rewrite a paragraph with instructions |
| POST | `/api/inject` | Inject freeform instructions mid-run |
| POST | `/api/personas` | Update agent persona configuration |
| POST | `/api/plan/update` | Update content plan (outline) fields |
| POST | `/api/restart` | Restart from the current step |
| POST | `/api/restart-from` | Restart from a specific step index |
| POST | `/api/reset` | Full session reset |
| GET | `/api/state` | Current state snapshot |
| GET | `/api/analytics` | Session analytics summary + event log |
| POST | `/api/analytics/event` | Log a frontend analytics event |
| GET | `/api/screenshot/:id` | Serve a stored screenshot by ID |

---

## Cloud Deployment

This section covers deploying the full stack to a single cloud server (e.g. AWS EC2, DigitalOcean Droplet, Aliyun ECS). The recommended setup uses **nginx** as a reverse proxy in front of the Node.js backend, so both the static frontend and API are served on port 80/443 from the same domain.

```
Internet
   │
   ▼
nginx :80 / :443
   ├── /          → serve static frontend build files
   └── /api/*     → proxy to Node.js :3001
                         │
                         └── spawns Python scraper internally on 127.0.0.1:3002
```

### Recommended Server Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 40 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

Playwright's Chromium binary adds ~300 MB to disk usage and needs ~500 MB RAM per scraper process.

---

### Step 1 — Provision the Server

Open the following ports in your cloud provider's security group / firewall:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS (optional) |

Ports 3001 and 3002 should remain **closed** to the public — they are accessed only from localhost.

---

### Step 2 — Install System Dependencies

SSH into the server and run:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3 + pip
sudo apt install -y python3 python3-pip python3-venv

# nginx
sudo apt install -y nginx

# PM2 process manager (keeps Node.js running after logout)
sudo npm install -g pm2

# Playwright system dependencies (fonts, graphics libs for headless Chromium)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libasound2 libpangocairo-1.0-0 libgtk-3-0
```

---

### Step 3 — Upload the Project

From your local machine:

```bash
# Option A: git clone (if the project is in a repository)
ssh user@your-server-ip "git clone https://github.com/your-repo/project.git ~/app"

# Option B: rsync from local
rsync -avz --exclude node_modules --exclude __pycache__ \
  "research prototype/" user@your-server-ip:~/app/
```

---

### Step 4 — Configure Environment Variables

```bash
# On the server
echo "OPENAI_API_KEY=sk-your-key-here" > ~/app/backend/.env
# Optional: override the default port (3001)
echo "PORT=3001" >> ~/app/backend/.env
```

---

### Step 5 — Install Dependencies & Build

```bash
# Backend
cd ~/app/backend
npm install --production

# Python scraper
cd ~/app/backend/scraper
pip3 install fastapi uvicorn playwright

# Install Playwright's Chromium binary
python3 -m playwright install chromium

# Frontend — build static files
cd ~/app/frontend
npm install
npm run build
# Output: ~/app/frontend/dist/
```

---

### Step 6 — Start the Backend with PM2

```bash
cd ~/app/backend
pm2 start server.js --name writing-agent

# Auto-restart PM2 on server reboot
pm2 startup          # follow the printed instruction to enable autostart
pm2 save
```

Verify the backend is running and the scraper started:

```bash
pm2 logs writing-agent --lines 30
# Should see: [scraper] ready on port 3002
```

---

### Step 7 — Configure nginx

Create a site config:

```bash
sudo nano /etc/nginx/sites-available/writing-agent
```

Paste the following (replace `your-domain.com` with your domain or server IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve built frontend static files
    root /home/your-user/app/frontend/dist;
    index index.html;

    # API reverse proxy → Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Required for SSE (Server-Sent Events) — disable buffering
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 3600s;   # keep SSE connections alive for up to 1 hour
    }

    # SPA fallback — serve index.html for all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/writing-agent /etc/nginx/sites-enabled/
sudo nginx -t          # verify config syntax
sudo systemctl reload nginx
```

Your app is now accessible at `http://your-domain.com`.

---

### Step 8 — HTTPS with Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts — certbot auto-edits the nginx config for SSL
sudo systemctl reload nginx
```

Certificates renew automatically via a cron job installed by certbot.

---

### Updating the App

To deploy a new version:

```bash
# Pull latest code (or re-upload changed files)
cd ~/app
git pull   # or rsync again

# Rebuild frontend
cd ~/app/frontend && npm install && npm run build

# Restart backend (picks up backend/server.js changes)
cd ~/app/backend && npm install --production
pm2 restart writing-agent
```

---

### Troubleshooting

**SSE stream disconnects immediately**
Check that `proxy_buffering off` is set in the nginx `/api/` block. Some cloud providers (e.g. AWS ALB) also require a `Connection: keep-alive` header at the load balancer level.

**Scraper fails to start (`[scraper] failed to start`)**
Run `python3 -m playwright install chromium` again on the server, then `pm2 restart writing-agent`. If Chromium still fails to launch, the system graphics libraries may be missing — re-run the `apt install` commands in Step 2.

**`OPENAI_API_KEY` not found**
Confirm `~/app/backend/.env` exists and contains the key. PM2 loads `.env` via `dotenv` when `server.js` starts — no additional configuration needed.

**Port 3001 / 3002 connection refused**
Both ports are intentionally bound to `127.0.0.1` only. Only nginx (on the same machine) can reach port 3001. Never open these ports in the cloud firewall.

**Out of memory during scraping**
Playwright + Chromium uses ~400–500 MB RAM per session. If the server has only 1 GB RAM, increase the swap space or upgrade to a 2 GB instance.

---

## Quick Start

### Requirements

- Node.js >= 18
- Python >= 3.9
- npm >= 9
- OpenAI API key (GPT-4o access)

### Install & Run

```bash
# 1. Configure API key
echo "OPENAI_API_KEY=sk-your-key-here" > backend/.env

# 2. Install Python scraper dependencies
cd backend/scraper
pip install fastapi uvicorn playwright
playwright install chromium

# 3. Install and start the backend (also auto-starts the scraper)
cd backend
npm install
npm start
# Runs on http://localhost:3001
# Scraper runs on http://localhost:8765

# 4. Install and start the frontend (new terminal)
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in a desktop browser.

> **Note:** Only a single user session is supported at a time. All state is in-memory and lost on server restart. Mobile layout is not supported.

---

## Study Protocol Notes

Before each participant session:

1. Click **Reset** to clear any previous session state
2. Guide the participant through the setup screen (prompt, style, audience, agent mode, execution mode)
3. Brief them on the four intervention controls (Pause, Skip, Next, Edit)
4. Remind them they can click the **Session Report** button after completion to review session analytics

After each session, export the analytics JSON (via "Copy JSON" in the report) before clicking Reset.

---

*Developed at the University of Melbourne for human-agent collaborative writing research.*
