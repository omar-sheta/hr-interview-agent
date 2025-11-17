# HR Interview Agent - Client-Server Architecture

🎯 **AI-Powered Interview Assistant with GPU Acceleration**

A comprehensive, privacy-focused HR interview system featuring real-time speech recognition, AI-powered question generation, intelligent scoring using Gemma model, and **high-quality natural text-to-speech** capabilities.

![HR Interview Agent](assets/HIVE-logo-4-color.png)

## 🌟 Features

- **🎙️ Real-time Speech Recognition** - GPU-accelerated MLX-Whisper for instant transcription
- **🧠 AI-Powered Scoring** - Gemma 3:27B model evaluates responses using structured HR rubrics
- **🔊 High-Quality Text-to-Speech** - Piper high-quality voice synthesis (Lessac, Ryan, Joe, Bryce voices)
- **📱 Modern Web Interface** - Responsive React frontend with real-time feedback
- **🔒 Privacy-First** - All processing runs locally, no data leaves your machine
- **⚡ GPU Acceleration** - Optimized for Apple Silicon and CUDA GPUs
- **📊 Comprehensive Analytics** - Detailed scoring with linguistic and behavioral competency analysis
- **🏗️ Client-Server Architecture** - Scalable FastAPI backend with persistent data storage

## 🏗️ Architecture

The client-server architecture separates concerns for better scalability and maintainability:

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

### Benefits

- **🔒 Privacy-First**: All AI processing runs locally, no data leaves your network
- **⚡ Performance**: Optimized with Apple Silicon MLX acceleration
- **🌐 Network-Ready**: HTTPS support for cross-device microphone access
- **🎯 User-Friendly**: Intelligent auto-stop recording and seamless audio experience
- **🔧 Flexible**: Multiple client types (web, Python) with RESTful API
- **📦 Self-Contained**: Minimal dependencies, easy deployment
- **🆓 Open Source**: Built entirely with open-source models and frameworks

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+**
- **Node.js 18+** (for development)
- **Ollama** with Gemma 3:27B model
- **Apple Silicon Mac** (recommended) or CUDA-capable GPU

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

> ⚠️ The HTTPS endpoint uses a self-signed certificate. On Safari/iOS, click "Show Details" → "visit this website" the first time to trust it; Chrome will prompt similarly. Once trusted, microphone access works across your network.

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
- HTTPS support with self-signed certificates for microphone access across networks

## 🌐 Access URLs

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

## 📁 Project Structure

```
hr_agent_final_attempt/
├── hr_agent/                  # Core FastAPI application
│   ├── api/                   # API route handlers
│   │   ├── interviews.py      # Interview session management
│   │   ├── questions.py       # Question generation
│   │   ├── scoring.py         # AI-powered scoring system
│   │   ├── tts.py            # High-quality TTS (Piper voices)
│   │   └── stt_mlx.py        # Speech-to-text (MLX-Whisper)
│   ├── data/                  # Session storage
│   │   └── sessions/          # Interview session files
│   ├── uploads/               # Audio response files
│   ├── config.py             # Configuration settings
│   ├── models.py             # ML model management
│   └── main.py               # FastAPI application entry point
├── client_server/            # Production client-server setup
│   ├── server/                # FastAPI server with data persistence
│   │   ├── main.py           # Server application
│   │   ├── data_manager.py   # Persistent data management
│   │   ├── piper_voices/     # High-quality TTS voice models
│   │   └── data/             # Persistent interview data
│   ├── client/                # Web client application
│   │   ├── index.html        # Interview interface
│   │   └── hr_client.py      # Python client (optional)
│   ├── start_client_server.sh # Production launcher
│   └── README.md             # Client-server documentation
├── frontend/                  # Development React frontend
│   ├── src/
│   │   ├── App.jsx           # Main application component
│   │   ├── main.jsx          # React entry point
│   │   └── index.css         # Tailwind CSS styles
│   ├── public/               # Static assets
│   └── package.json          # Node.js dependencies
├── piper_voices/             # TTS voice models (Lessac, Ryan, Joe, Bryce)
├── assets/                   # Static assets and logos
├── docs/                     # Documentation
├── requirements.txt          # Python dependencies
├── start_dev.sh             # Development server launcher
└── README.md                # This documentation
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

### Text-to-Speech (TTS)
**Piper TTS**
- **Model**: Lessac (High Quality)
- **File Size**: ~63MB (en_US-lessac-high.onnx)
- **Memory Usage**: ~100-200MB during synthesis
- **License**: MIT License
- **Format**: ONNX optimized neural voice
- **Repository**: [rhasspy/piper](https://github.com/rhasspy/piper)
- **Voice Quality**: Professional, natural, human-like speech synthesis

### Language Model (LLM)
**Gemma 3:27B**
- **Model**: Google Gemma 3 (27B parameters)
- **Memory**: ~16GB VRAM required
- **License**: Apache 2.0 License
- **Integration**: Ollama for local inference
- **Repository**: [google/gemma](https://github.com/google/gemma)

### System Requirements by Model

| Component | Memory Usage | Disk Space | License |
|-----------|-------------|------------|---------|
| MLX-Whisper (base) | ~1GB | ~150MB | MIT |
| Piper TTS (Lessac High) | ~200MB | ~63MB | MIT |
| Gemma 27B (optional) | ~16GB | ~16GB | Apache 2.0 |
| **Total Minimum** | **~1.2GB** | **~213MB** | **Mixed** |
| **With LLM** | **~17.2GB** | **~16.2GB** | **Mixed** |

## API Endpoints

The server exposes RESTful endpoints:

- `POST /transcribe` - Speech to text (MLX-Whisper)
- `POST /synthesize` - Text to speech (Piper TTS)
- `POST /generate` - LLM text generation (Ollama integration)
- `POST /interview/start` - Start interview session
- `POST /interview/submit` - Submit response
- `GET /health` - Server health check
- `GET /models/status` - Model loading status

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **MLX** team for Apple Silicon optimization
- **Piper TTS** for high-quality voice synthesis
- **Ollama** for local LLM inference
- **Meta** for the Gemma language model
- **FastAPI** and **React** communities

---