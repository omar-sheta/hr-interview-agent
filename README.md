Here’s your complete `README.md` (ready to paste).
Key factual references I relied on are listed right after the file.

```markdown
# HR Interview Agent — Client–Server Architecture

🎯 **AI-Powered Interview Assistant with GPU Acceleration (Self-Hosted)**

A comprehensive, privacy-first HR interview system featuring real-time speech recognition, AI-powered question generation, intelligent scoring with **Gemma 3 (27B)**, and **high-quality local text-to-speech** — all running on your own machine or server.

![HR Interview Agent](assets/HIVE-logo-4-color.png)

---

## 🌟 Features

- **🎙️ Real-time Speech Recognition** — GPU-accelerated **MLX-Whisper** for fast, local transcription  
- **🧠 AI-Powered Scoring** — **Gemma 3 (27B)** evaluates responses using structured HR rubrics (runs locally via Ollama; quantized variants supported)  
- **🔊 Natural Text-to-Speech** — **Piper** voices (e.g., Lessac, Ryan, Joe, Bryce) for clear, human-like audio  
- **📱 Modern Web UI** — Responsive React frontend with real-time feedback  
- **🔒 Privacy-First** — All processing runs on your machine/network (no external data egress)  
- **⚡ GPU Acceleration** — Optimized for Apple Silicon (MLX) and CUDA GPUs  
- **📊 Analytics** — Detailed scoring with linguistic & behavioral competency breakdowns  
- **🏗️ Clean Separation** — FastAPI backend + web/Python clients via REST API

---

## 🏗️ Architecture

The client–server split improves scalability and maintainability:

```

┌─────────────────┐       HTTP API        ┌─────────────────┐
│     Client      │ ◄──────────────────► │     Server      │
│  (Web/Python)   │                       │    (FastAPI)    │
│                 │                       │                 │
│  - UI/UX        │                       │  - STT (MLX)    │
│  - Audio        │                       │  - TTS (Piper)  │
│  - Recording    │                       │  - LLM (Gemma)  │
└─────────────────┘                       └─────────────────┘

````

### Benefits

- **Privacy-first**: on-prem/local inference; no interview data leaves your network  
- **Performance**: Apple-Silicon acceleration via MLX; CUDA on Linux/Windows  
- **Network-ready**: HTTPS for cross-device microphone access (required by browsers)  
- **Flexible**: supports both web and Python clients via REST  
- **Self-contained**: minimal deps; easy to deploy and run

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+**  
- **Node.js 18+** (for frontend/dev)  
- **Ollama** with **`gemma3:27b`** (use a quantized tag if VRAM-constrained)  
- **Apple Silicon Mac** (recommended) or a CUDA-capable GPU machine

### Option 1 — Quick Start (Recommended)

```bash
cd client_server
./quick_start.sh
````

This will:

* Start the FastAPI server on **:8001**
* Host the web client at **[http://localhost:8080/client_server/client/index.html](http://localhost:8080/client_server/client/index.html)**
* Generate a self-signed certificate (if needed) and also serve **[https://localhost:8443/client_server/client/index.html](https://localhost:8443/client_server/client/index.html)** so mobile/iOS browsers allow mic access
* Open the hosted web client automatically and print both local and LAN URLs

> **Note on HTTPS**: Browsers require a secure context for mic access. The first time, trust the self-signed cert in Safari/Chrome; after that, the mic works across your network.

### Option 2 — Advanced Script

```bash
cd client_server
./start_client_server.sh [start|stop|clean|help]
```

Hosts the API on `0.0.0.0:8001` and the web UI on `0.0.0.0:8080` so others on your LAN can connect via your machine’s IP.

### Option 3 — Manual Start

```bash
# Start server
cd client_server/server
python3 main.py

# Serve the web client (new terminal)
cd ../..
python3 -m http.server 8080 --bind 0.0.0.0

# Open the hosted UI
open http://localhost:8080/client_server/client/index.html
```

---

## 🎯 Interview Experience Upgrades

### 🎤 Smart Auto-Stop Recording

* Timer starts only **after** the candidate begins speaking
* Auto-stopped recordings are **processed** (never discarded)
* Clear UX: “Processing your response…” while analysis runs
* Consistent 5-second silence/noise detection
* **No wasted audio** — whatever was captured is analyzed

### 🎵 Enhanced Audio UX

* Question audio stops when recording or skipping
* Each question autoplays on arrival
* Candidate can **redo** a question before submitting
* **File upload** supported as a live-recording alternative

### 🌐 Connectivity

* Automatic API host detection for LAN testing
* `?api_host=SERVER_IP` param for cross-device use
* HTTPS with self-signed certs for mic on iOS/mobile

---

## 🌐 Access URLs

* Web Client (local): `http://localhost:8080/client_server/client/index.html`
* Web Client (LAN): `http://<your-ip>:8080/client_server/client/index.html`
* API (local): `http://localhost:8001`
* API (LAN): `http://<your-ip>:8001`
* OpenAPI Docs: `http://localhost:8001/docs`
* Health: `http://localhost:8001/health`

**Tip**: `./start_client_server.sh` prints all URLs (including your LAN IP).

### Python Client

```bash
cd client_server/client
python3 hr_client.py
```

---

## 🧮 Why Self-Hosting? Cost & Control

**API costs can add up quickly** at scale for voice agents:

* **Speech-to-Text (STT)** — Google Cloud lists **$0.016 per minute** for standard v2 recognition (volume-tiered). A 30-minute interview ≈ **$0.48** per candidate just for STT.
* **Text-to-Speech (TTS)** — Amazon Polly Neural voices are **$16–$19.20 per 1M characters** (≈ **$0.016–$0.0192 per 1K chars**). At ~2,000 chars of prompts/feedback per interview, TTS alone is ≈ **$0.03–$0.04**.
* **Full voice stacks** from general LLM providers often bill **audio I/O tokens** (e.g., realtime audio models). Even at seemingly low *per-minute* equivalents, multi-turn interviews compound costs.

By contrast, this system runs **Whisper-style ASR, Piper TTS, and Gemma 3 locally**:

* **Predictable costs** (compute you already own, no per-minute fees)
* **Privacy & compliance** (no third-party processing of candidate audio/text)
* **Latency** (no round-trip to external APIs)
* **Vendor independence** (no lock-in; swap or fine-tune models as needed)

> **Rule of thumb:** At moderate volume (e.g., 1,000 interviews/month × 30 minutes), cloud STT alone can reach **$480/month**; TTS adds more; LLM tokens add more. Self-hosting avoids recurring, usage-linked bills and keeps data in-house.

*(See References for current, official pricing pages.)*

---

## 🚀 Performance & Compatibility

### Recommended System Specs

* **RAM**: 8 GB minimum; **16 GB+** recommended when running a local LLM
* **Storage**: ~5 GB free (more if caching multiple models)
* **CPU/GPU**: Multi-core CPU; Apple Silicon (MLX) or NVIDIA CUDA GPU
* **Network**: Stable connection for initial model downloads

### Platform Support

* **macOS**: MLX acceleration on Apple Silicon
* **Linux**: CUDA accel or CPU fallback
* **Windows**: CUDA accel (if available) or CPU fallback
* **Browsers**: Chrome, Safari, Firefox, Edge (mic requires HTTPS/secure context)

### Indicative Latency (Apple Silicon)

* **ASR**: <2 s to transcribe ~30 s audio (MLX-Whisper)
* **TTS**: <1 s for typical sentences (Piper)
* **Startup**: ~10 s with models preloaded

---

## 📁 Project Structure

```
hr_agent_final_attempt/
├── hr_agent/                  # Core FastAPI app
│   ├── api/
│   │   ├── interviews.py      # Session management
│   │   ├── questions.py       # Question generation
│   │   ├── scoring.py         # AI scoring
│   │   ├── tts.py             # Piper integration
│   │   └── stt_mlx.py         # MLX-Whisper
│   ├── data/
│   │   └── sessions/          # Session files
│   ├── uploads/               # Audio uploads
│   ├── config.py              # Settings
│   ├── models.py              # Model mgmt
│   └── main.py                # FastAPI entrypoint
├── client_server/
│   ├── server/                # FastAPI server (persistent storage)
│   │   ├── main.py
│   │   ├── data_manager.py
│   │   ├── piper_voices/      # Voice models
│   │   └── data/              # Interview data
│   ├── client/                # Web client
│   │   ├── index.html
│   │   └── hr_client.py
│   ├── start_client_server.sh
│   └── README.md
├── frontend/                  # Dev React app
│   ├── src/ (App.jsx, main.jsx, index.css)
│   ├── public/
│   └── package.json
├── piper_voices/              # (Lessac, Ryan, Joe, Bryce)
├── assets/
├── docs/
├── requirements.txt
├── start_dev.sh
└── README.md                  # This file
```

---

## 🤖 Models & Tech

### Speech-to-Text (STT): **MLX-Whisper**

* OpenAI Whisper models (tiny → large-v3) with Apple-Silicon MLX acceleration
* Typical memory: ~39 MB (tiny) → ~3.1 GB (large-v3)
* **License**: MIT
* Repo: `ml-explore/mlx-whisper`

### Text-to-Speech (TTS): **Piper**

* Local neural TTS; ONNX voice models (e.g., `en_US-lessac-high.onnx`)
* Typical memory during synthesis: ~100–200 MB
* **License**: MIT
* Repo: `rhasspy/piper`

### Language Model (LLM): **Gemma 3 (27B)**

* **Publisher**: Google / Google DeepMind
* **Parameters**: 27B, multimodal (text+image), **128K** context window
* **VRAM (indicative)**:

  * **BF16/FP16**: ~40 GB+ recommended
  * **Quantized (e.g., Q4/Q5)**: can run in ~16–24 GB depending on loader/settings
* **Integration**: **Ollama** (`gemma3:27b` and quantized variants) for local inference
* Refs: official model page + Ollama tags

---

## 🔐 Browser Mic Access (HTTPS)

For security reasons, modern browsers expose camera/microphone **only on secure origins** (HTTPS, `localhost`, or `file://`). This repo provides a self-signed TLS option so mic access works across devices on your LAN.

---

## API Endpoints

* `POST /transcribe` — Speech to text (MLX-Whisper)
* `POST /synthesize` — Text to speech (Piper)
* `POST /generate` — LLM text generation (Ollama integration)
* `POST /interview/start` — Start interview session
* `POST /interview/submit` — Submit response
* `GET /health` — Server health check
* `GET /models/status` — Model loading status

---

## 📄 License

Project code is licensed under **MIT** (see `LICENSE`).
**Note**: **Gemma** model weights are provided under Google’s **Gemma Terms** (open-weights license). Piper and MLX-Whisper are MIT-licensed.

---

## 🙏 Acknowledgments

* **Google / Google DeepMind** for **Gemma** open-weights models
* **MLX** team for Apple Silicon optimization
* **Piper TTS** for high-quality local voice synthesis
* **Ollama** for local LLM inference
* **FastAPI** and **React** communities

---

## 📚 References

* **Gemma 3 (official)** — Model sizes & 128K context: Google/DeepMind

  * [https://deepmind.google/models/gemma/gemma-3](https://deepmind.google/models/gemma/gemma-3)
* **Gemma 3 on Ollama** — Tags & `gemma3:27b` availability

  * [https://ollama.com/library/gemma3/tags](https://ollama.com/library/gemma3/tags)
  * [https://ollama.com/library/gemma3%3A27b](https://ollama.com/library/gemma3%3A27b)
* **MLX-Whisper** — Apple Silicon-optimized Whisper

  * [https://github.com/ml-explore/mlx-whisper](https://github.com/ml-explore/mlx-whisper)
* **Piper TTS** — Local neural TTS (MIT), voice samples

  * [https://github.com/rhasspy/piper](https://github.com/rhasspy/piper)
  * [https://rhasspy.github.io/piper-samples/](https://rhasspy.github.io/piper-samples/)
* **Mic requires HTTPS (secure context)**

  * MDN: [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
  * Mozilla: [https://blog.mozilla.org/webrtc/camera-microphone-require-https-in-firefox-68/](https://blog.mozilla.org/webrtc/camera-microphone-require-https-in-firefox-68/)
* **Pricing (indicative; subject to change)**

  * Google Cloud Speech-to-Text: [https://cloud.google.com/speech-to-text/pricing](https://cloud.google.com/speech-to-text/pricing)
  * Amazon Polly TTS: [https://aws.amazon.com/polly/pricing/](https://aws.amazon.com/polly/pricing/)
  * OpenAI Realtime/audio pricing posts:

    * [https://openai.com/index/introducing-the-realtime-api/](https://openai.com/index/introducing-the-realtime-api/)
    * [https://openai.com/index/introducing-gpt-realtime/](https://openai.com/index/introducing-gpt-realtime/)

```

---

### Notes on sources (for you)
- Gemma 3 sizes & context: DeepMind page confirms **1B/4B/12B/27B** and **128K** context. :contentReference[oaicite:0]{index=0}  
- Ollama shows `gemma3` tags including **27B**. :contentReference[oaicite:1]{index=1}  
- MLX-Whisper / Piper are MIT and actively maintained. :contentReference[oaicite:2]{index=2}  
- Mic over HTTPS requirement: MDN + Mozilla blog. :contentReference[oaicite:3]{index=3}  
- Concrete cloud prices to motivate self-hosting: Google STT **$0.016/min** (v2), Amazon Polly neural TTS **$16–$19.20 per 1M chars**; OpenAI’s realtime/audio pricing posts give ballpark per-minute equivalents. :contentReference[oaicite:4]{index=4}

If you want, I can also generate a **lighter-GPU variant** of the README (e.g., targeting `gemma3:12b`), or weld in your exact `hr_client.py` endpoints and example curl commands.
::contentReference[oaicite:5]{index=5}
```
