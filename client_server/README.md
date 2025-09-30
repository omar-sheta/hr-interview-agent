# HR Interview Agent - Client-Server Architecture

## Overview

Th## 🎯 Interview Experience Upgrades

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
- HTTPS support with self-signed certificates for microphone access across networksrectory contains a simple client-server architecture for the HR Interview Agent where:

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

- **Simple**: Easy to understand and maintain
- **Centralized**: All AI processing on server
- **Flexible**: Multiple client types (web, desktop, mobile)
- **Efficient**: Clients are lightweight, server handles heavy lifting

## Quick Start

### 🚀 Option 1: Quick Start (Recommended)
```bash
cd client_server
./quick_start.sh
```
**This will:**
- Start the FastAPI server on port 8001
- Host the web client at `http://localhost:8080/client_server/client/index.html`
- Generate a self-signed certificate (if needed) and also serve `https://localhost:8443/client_server/client/index.html` so browsers allow microphone access on other devices
- Automatically open the hosted web client in your browser
- Display both local and LAN URLs for easy access

> ⚠️ The HTTPS endpoint uses a self-signed certificate. On Safari/iOS, click “Show Details” → “visit this website” the first time to trust it; Chrome will prompt similarly. Once trusted, microphone access works across your network.

### ⚙️ Option 2: Advanced Script with Options
```bash
cd client_server
./start_client_server.sh [start|stop|clean|help]
```
The script hosts the API on `0.0.0.0:8001` and the web UI on `0.0.0.0:8080`, so teammates on the same network can reach it using your machine's IP address.

### 🔧 Option 3: Manual Start
```bash
# Start server
cd client_server/server
python3 main.py

# Serve the web client (terminal 2)
cd ../..
python3 -m http.server 8080 --bind 0.0.0.0

# Open the hosted UI
open http://localhost:8080/client_server/client/index.html
```

## �️ Interview Experience Upgrades

- Automatic silence/noise detection pauses recording when the candidate stops speaking or background noise overwhelms the signal.
- Question audio playback halts when recording or skipping, and each question autoplays on arrival.
- Candidates can redo a question before committing their response, ensuring the best take is captured.

## �🌐 Access URLs

After starting with any method above:

- **🎯 Web Client (local)**: `http://localhost:8080/client_server/client/index.html`
- **🎯 Web Client (LAN)**: `http://<your-ip>:8080/client_server/client/index.html`
- **🔧 API Server (local)**: `http://localhost:8001`
- **🔧 API Server (LAN)**: `http://<your-ip>:8001`
- **📚 API Documentation**: `http://localhost:8001/docs`
- **❤️ Health Check**: `http://localhost:8001/health`

> Tip: Run `./start_client_server.sh` to have all URLs printed (including your LAN IP) automatically.

### Use Python Client
```bash
cd client_server/client
python3 hr_client.py
```

## Directory Structure

```
client_server/
├── server/              # FastAPI server
│   ├── main.py         # Server entry point
│   ├── api/            # API endpoints
│   ├── models/         # Data models
│   └── requirements.txt
├── client/             # Client implementations
│   ├── hr_client.py    # Python client library
│   ├── index.html      # Web client
│   └── js/             # JavaScript client code
└── README.md           # This file
```

## API Endpoints

The server exposes RESTful endpoints:

- `POST /transcribe` - Speech to text
- `POST /synthesize` - Text to speech  
- `POST /generate` - LLM text generation
- `POST /interview/start` - Start interview session
- `POST /interview/submit` - Submit response
- `GET /health` - Server health check
