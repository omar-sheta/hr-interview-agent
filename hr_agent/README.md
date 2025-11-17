# HR Interview Agent - Client-Server Architecture
### 🚀 Option 1: Recommended Start
```bash
cd hr_agent
./start_client_server.sh [start|stop|clean|help]
```
The script hosts the API on `0.0.0.0:8001` and the web UI on `0.0.0.0:8080`, so teammates on the same network can reach it using your machine's IP address.

### ⚙️ Option 2: Manual Start

## 🎯 Interview Experience Upgrades

### 🎤 Smart Auto-Stop Recording
- **Intelligent Timer**: Auto-stop timer only starts after user begins speaking (not immediately)
- **Audio Processing**: Auto-stopped recordings are processed instead of being discarded
- **Positive Feedback**: Shows "Processing your response..." instead of error messages
- **5-Second Detection**: Consistent 5-second duration for both silence and noise detection
- **No Wasted Audio**: System captures and uses whatever audio was recorded

### 🎵 Enhanced Audio Experience
- Question audio playback halts when recording or skipping
- Each question autoplays on arrival for seamless flow
- Candidates can redo questions before committing their response
- Upload audio files as an alternative to live recording

### 🌐 Network & Connectivity
- Automatic API host detection for network testing
- URL parameter support (`?api_host=SERVER_IP`) for cross-device access
- Clean, distraction-free interface without unnecessary troubleshooting panels
 - HTTPS support with self-signed certificates for microphone access across networks.

## v2 Platform Overview

The project now includes a lightweight data layer, role-based flows, and a modern React front end that sits alongside the existing interview experience.

### Backend (FastAPI)

- `server/main.py` exposes the original STT/TTS/LLM endpoints plus new `/api/*` routes for login, admin CRUD, and candidate flows.
- Persistent data is stored in JSON files under `server/data/`:
  - `users.json`: demo admin/candidate accounts (plain text passwords for local testing).
  - `interviews.json`: interview definitions with config metadata and allowed candidate ids.
  - `results.json`: completed interview summaries, feedback, and scores.
- The legacy `/interview/*` endpoints remain intact so the microphone UX still works without changes.

### Frontend (React + Vite)

- New app under `frontend/` with React Router, context-based auth, and Axios API client.
- Two dashboards:
  - **Admin** – manage interviews, assign candidates, and inspect results.
  - **Candidate** – view assigned interviews and launch the voice workflow.
- Candidate pages link back into the existing `client/index.html` experience for the actual voice-driven session so no microphone logic was lost.
- Admins now configure interviews with an AI-powered question designer that can:
  - Generate question sets via Gemma 3 27B (Ollama) using the job context.
  - Reorder, manually edit, or delete questions before saving.
  - Refine any question with additional AI editing instructions.

### Interview Workspace (client/)

- `client/` now represents the standalone “Interview Workspace” that powers the microphone/STT/TTS UX.
- File layout:
  - `client/index.html` – lightweight shell that loads the modules.
  - `client/css/styles.css` – extracted styling.
  - `client/js/api.js`, `audio.js`, `ui.js`, `workspace.js` – modular JS responsible for API calls, audio capture, UI state, and orchestration.
- The workspace reads query parameters for seamless hand-off from React:
  - `api_host`, `api_port`
  - `candidate_id`, `candidate_name`
  - `interview_id`, `interview_title`
  - `session_id`
- Example manual launch (after starting the static server on port 8080):
  ```
  http://localhost:8080/hr_agent/client/index.html?api_host=127.0.0.1&api_port=8001&candidate_id=candidate-1&candidate_name=Candace&interview_id=int-1&session_id=<existing-session-id>
  ```
- The React `InterviewPage` automatically builds this URL so candidates only have to click “Launch Interview Workspace.”
  - Override the default workspace origin by setting `VITE_WORKSPACE_BASE_URL` if you serve the static files from a different host/port.

### Quick Data Reference

```
server/data/users.json
[
  { "id": "admin-1", "username": "admin@example.com", "password": "admin123", "role": "admin" },
  { "id": "candidate-1", "username": "candace", "password": "candidate123", "role": "candidate" }
]

server/data/interviews.json
[
  {
    "id": "int-1",
    "title": "Backend Engineer Screen",
    "description": "30-minute HR + technical screening focusing on APIs and ownership.",
    "config": { "job_role": "Backend Engineer", "num_questions": 3 },
    "allowed_candidate_ids": ["candidate-1"],
    "active": true
  }
]
```

> Results are appended to `server/data/results.json` whenever `/interview/{session_id}/results` is generated or an admin fetches run data.

## Running the Full Stack

### Backend API

```bash
cd hr_agent/server
python3 -m venv .venv && source .venv/bin/activate  # optional but recommended
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### React Frontend

```bash
cd hr_agent/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

The Vite dev server proxies directly to the FastAPI API via absolute URLs, so no extra configure step is required. Visit `http://localhost:5173` to see the dashboards.

### Demo Flow for Stakeholders

1. **Admin login** – use `admin@example.com / admin123`, create or edit an interview, assign candidate ids via the multi-select text field, and keep it active.
2. **Candidate login** – use `candace / candidate123`, choose an active interview, and click “Start Interview” to open the full microphone workspace in a new tab.
3. **View results** – log back in as admin, open the Results view, filter, and inspect AI feedback/scores that were saved to `results.json`.

When running the legacy `start_client_server.sh` script the old static site still works. For the new UX, start the FastAPI server plus the Vite app as shown above.

### Python CLI (client/hr_client.py)

For quick debugging or scripted demos you can interact with the API directly:

```bash
python client/hr_client.py --help
python client/hr_client.py assignments --candidate-id candidate-1
python client/hr_client.py start --candidate-id candidate-1 --interview-id int-1
python client/hr_client.py submit --session-id <session> --question-index 0 --audio answer.wav
```

The CLI mirrors the same `/api/*` + `/interview/*` flows used by the React frontend and the Interview Workspace.

This directory structure contains a simple hr_agent architecture for the HR Interview Agent where:

- **Server**: Centralized FastAPI server that handles all AI processing (STT, TTS, LLM)
- **Client**: Lightweight clients that communicate with the server via HTTP API

## Architecture

```
┌─────────────────┐       HTTP API        ┌─────────────────┐
│     Client      │ ◄──────────────────► │     Server      │
│  (Web/Python)   │                       │   (FastAPI)     │
│                 │                       │                 │
│  - UI/UX        │                       │  - STT (MLX)    │
│  - Audio        │                       │  - TTS (Piper)  │  
│  - Recording    │                       │  - LLM (Gemma)  │
└─────────────────┘                       └─────────────────┘
```

## Benefits

- **🔒 Privacy-First**: All AI processing runs locally, no data leaves your network
- **⚡ Performance**: Optimized with Apple Silicon MLX acceleration
- **🌐 Network-Ready**: HTTPS support for cross-device microphone access
- **🎯 User-Friendly**: Intelligent auto-stop recording and seamless audio experience
- **🔧 Flexible**: Multiple client types (web, Python) with RESTful API
- **📦 Self-Contained**: Minimal dependencies, easy deployment
- **🆓 Open Source**: Built entirely with open-source models and frameworks

## Quick Start

### 🚀 Option 1: Quick Start (Recommended)
```bash
cd hr_agent
./quick_start.sh
```
**This will:**
- Start the FastAPI server on port 8001
- Host the web client at `http://localhost:8080/hr_agent/client/index.html`
- Generate a self-signed certificate (if needed) and also serve `https://localhost:8443/hr_agent/client/index.html` so browsers allow microphone access on other devices
- Automatically open the hosted web client in your browser
- Display both local and LAN URLs for easy access

> ⚠️ The HTTPS endpoint uses a self-signed certificate. On Safari/iOS, click “Show Details” → “visit this website” the first time to trust it; Chrome will prompt similarly. Once trusted, microphone access works across your network.

### ⚙️ Option 2: Advanced Script with Options
```bash
cd hr_agent
./start_client_server.sh [start|stop|clean|help]
```
The script hosts the API on `0.0.0.0:8001` and the web UI on `0.0.0.0:8080`, so teammates on the same network can reach it using your machine's IP address.

### 🔧 Option 3: Manual Start
```bash
# Start server
cd hr_agent/server
python3 main.py

# Serve the web client (terminal 2)
cd ../..
python3 -m http.server 8080 --bind 0.0.0.0

# Open the hosted UI
open http://localhost:8080/hr_agent/client/index.html
```

## �️ Interview Experience Upgrades

- Automatic silence/noise detection pauses recording when the candidate stops speaking or background noise overwhelms the signal.
- Question audio playback halts when recording or skipping, and each question autoplays on arrival.
- Candidates can redo a question before committing their response, ensuring the best take is captured.

## �🌐 Access URLs

After starting with any method above:

- **🎯 Web Client (local)**: `http://localhost:8080/hr_agent/client/index.html`
- **🎯 Web Client (LAN)**: `http://<your-ip>:8080/hr_agent/client/index.html`
- **🔧 API Server (local)**: `http://localhost:8001`
- **🔧 API Server (LAN)**: `http://<your-ip>:8001`
- **📚 API Documentation**: `http://localhost:8001/docs`
- **❤️ Health Check**: `http://localhost:8001/health`

> Tip: Run `./start_client_server.sh` to have all URLs printed (including your LAN IP) automatically.

### Use Python Client
```bash
cd hr_agent/client
python3 hr_client.py
```

## 🚀 Performance & Compatibility

### Recommended System Specifications
- **RAM**: 8GB minimum, 16GB recommended (with local LLM)
- **Storage**: 5GB free space
- **CPU**: Multi-core processor (Apple Silicon preferred for MLX)
- **Network**: Stable connection for initial model downloads

### Platform Support
- **macOS**: Full MLX acceleration (Apple Silicon)
- **Linux**: CPU fallback with good performance
- **Windows**: CPU fallback supported
- **Web Browsers**: Chrome, Safari, Firefox, Edge (microphone required)

### Model Performance (Apple Silicon)
- **Transcription**: <2 seconds for 30-second audio
- **TTS Generation**: <1 second for typical questions
- **Memory Footprint**: Optimized for efficiency
- **Startup Time**: ~10 seconds (models preloaded)

## Directory Structure

```
hr_agent/
├── server/                    # FastAPI server
│   ├── main.py               # Server entry point
│   ├── data_manager.py       # Session and data management
│   ├── requirements.txt      # Python dependencies
│   ├── data/                 # Data storage
│   │   ├── sessions/         # Interview session files
│   │   └── transcripts/      # Audio transcription results
│   └── piper_voices/         # TTS voice models
│       ├── en_US-amy-medium.onnx
│       └── en_US-amy-medium.onnx.json
├── client/                   # Legacy web + Python clients
│   ├── index.html           # Original microphone-first experience
│   └── hr_client.py         # Python client library
├── frontend/                # New React dashboard (Vite)
│   ├── src/                 # Auth context, pages, components
│   ├── package.json
│   └── vite.config.js
├── cert.pem                 # HTTPS certificate
├── key.pem                  # HTTPS private key
├── serve_https.py           # HTTPS server script
├── start_client_server.sh   # Main startup script
└── README.md                # This file
```

## 🤖 Open-Source Models & Technologies

### Speech-to-Text (STT)
**MLX-Whisper**
- **Model**: OpenAI Whisper (various sizes: tiny, base, small, medium, large)
- **Memory**: 39MB (tiny) to 3.09GB (large-v3)
- **License**: MIT License
- **Optimization**: Apple Silicon (MLX) acceleration
- **Fallback**: OpenAI Whisper (CPU) for non-Apple Silicon systems
- **Repository**: [ml-explore/mlx-whisper](https://github.com/ml-explore/mlx-whisper)
- **Auth Tip**: If Hugging Face returns 401 errors, set a valid token via `export HF_TOKEN=hf_xxx` or point the server to a manually downloaded model with `export MLX_WHISPER_MODEL_PATH=/absolute/path/to/whisper-base`.

### Text-to-Speech (TTS)
**Piper TTS**
- **Model**: Amy (Medium Quality)
- **File Size**: ~15MB (en_US-amy-medium.onnx)
- **Memory Usage**: ~50-100MB during synthesis
- **License**: MIT License
- **Format**: ONNX optimized neural voice
- **Repository**: [rhasspy/piper](https://github.com/rhasspy/piper)
- **Voice Quality**: Natural, human-like speech synthesis

### Language Model (LLM)
**Integration Ready**
- **Default**: Ollama integration for local LLM inference
- **Supported Models**: Gemma, Llama, Mistral, etc.
- **Memory**: Varies by model (7B: ~4GB, 13B: ~8GB, 27B: ~16GB)
- **License**: Model-dependent (Apache 2.0, MIT, etc.)
- **Fallback**: OpenAI API or other cloud providers

### System Requirements by Model

| Component | Memory Usage | Disk Space | License |
|-----------|-------------|------------|---------|
| MLX-Whisper (base) | ~1GB | ~150MB | MIT |
| Piper TTS (Amy) | ~100MB | ~15MB | MIT |
| Gemma 7B (optional) | ~4GB | ~4GB | Apache 2.0 |
| **Total Minimum** | **~1.1GB** | **~165MB** | **Mixed** |
| **With LLM** | **~5.1GB** | **~4.2GB** | **Mixed** |

## API Endpoints

The server exposes RESTful endpoints:

- `POST /transcribe` - Speech to text (MLX-Whisper)
- `POST /synthesize` - Text to speech (Piper TTS)
- `POST /generate` - LLM text generation (Ollama integration)
- `POST /interview/start` - Start interview session
- `POST /interview/submit` - Submit response
- `GET /health` - Server health check
- `GET /models/status` - Model loading status
