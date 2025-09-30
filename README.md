# HR Interview Agent

🎯 **AI-Powered Interview Assistant with GPU Acceleration**

A comprehensive, privacy-focused HR interview system featuring real-time speech recognition, AI-powered question generation, intelligent scoring using Gemma model, and **high-quality natural text-to-speech** capabilities.

![HR Interview Agent](assets/HIVE-logo-4-color.png)

## 🌟 Features

- **🎙️ Real-time Speech Recognition** - GPU-accelerated MLX-Whisper for instant transcription
- **🧠 AI-Powered Scoring** - Gemma 3:27B model evaluates responses using structured HR rubrics
- **🔊 High-Quality Text-to-Speech** - Piper high-quality voice synthesis (Lessac, Ryan, Joe, Bryce voices)
- **📱 Modern Web Interface** - Responsive React frontend with real-time feedback
- **🔒 Privacy-First** - Voice models are automatically downloaded and cached locally.

### Voice Quality

The system uses **high-quality Piper TTS voices** for natural-sounding speech synthesis:

- **Primary Voice**: `en_US-lessac-high` (professional female voice)
- **Alternative Voices**: `en_US-ryan-high`, `en_US-joe-high`, `en_US-bryce-high`
- **Quality**: High-quality models (63MB) vs medium-quality (15MB)
- **Features**: Better prosody, clearer articulation, more natural intonation

Voice models are automatically downloaded and cached locally.
- **⚡ GPU Acceleration** - Optimized for Apple Silicon and CUDA GPUs
- **📊 Comprehensive Analytics** - Detailed scoring with linguistic and behavioral competency analysis
- **🏗️ Client-Server Architecture** - Scalable FastAPI backend with persistent data storage

## 🏗️ Architecture

### Backend (FastAPI)
- **Speech-to-Text**: MLX-Whisper for GPU-accelerated transcription
- **Text-to-Speech**: Piper high-quality voice synthesis (Lessac, Ryan, Joe, Bryce voices)
- **AI Scoring**: Ollama integration with Gemma 3:27B model
- **Question Generation**: AI-powered interview question creation
- **Session Management**: Persistent interview state and audio storage
- **Data Persistence**: JSON-based storage for interviews and transcripts

### Frontend (React + Vite)
- **Interactive UI**: Modern, responsive interview interface
- **Real-time Audio**: MediaRecorder API for seamless recording
- **Progress Tracking**: Visual progress indicators and question navigation
- **Score Visualization**: Comprehensive scoring dashboard

### Client-Server Setup
- **Centralized API**: FastAPI server handling all AI processing
- **HTTPS Support**: Secure communication with self-signed certificates
- **Multi-Client Support**: Multiple users can connect simultaneously
- **Persistent Storage**: Interview data survives server restarts

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+**
- **Node.js 18+**
- **Ollama** with Gemma 3:27B model
- **Apple Silicon Mac** (recommended) or CUDA-capable GPU

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hr_agent_final_attempt
   ```

2. **Set up Python environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install Ollama and Gemma model**
   ```bash
   # Install Ollama (macOS)
   brew install ollama
   
   # Start Ollama service
   ollama serve
   
   # Pull Gemma model (in a new terminal)
   ollama pull gemma3:27b
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Start the client-server system**
   ```bash
   # Start both client and server with HTTPS
   cd client_server
   ./start_client_server.sh
   ```

6. **Open your browser**
   - **Web Client**: https://localhost:8443 (HTTPS with self-signed cert)
   - **API Server**: https://localhost:8002 (HTTPS API)
   - **API Docs**: https://localhost:8002/docs

### Alternative: Development Mode

For development with hot-reloading:
```bash
./start_dev.sh  # Starts development servers on HTTP
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📋 Usage Guide

### Starting an Interview

1. **Launch the Application**
   - Navigate to http://localhost:5173
   - Grant microphone permissions when prompted

2. **Create Interview Questions**
   - Enter a job description (e.g., "mechanic", "software engineer")
   - System generates relevant interview questions using AI

3. **Begin Interview Process**
   - Questions are presented one at a time
   - Each question is read aloud using natural TTS
   - Record your responses using the built-in recorder

4. **Review Results**
   - Automatic transcription of all responses
   - Comprehensive AI-powered scoring
   - Detailed feedback on linguistic and behavioral competencies

### Scoring System

The AI scoring system evaluates responses across two main competencies:

**Linguistic Competence (50%)**
- Clarity & Structure (20%)
- Grammar & Vocabulary (15%)
- Conciseness & Relevance (15%)

**Behavioral Competence (50%)**
- Professionalism (20%)
- Confidence & Delivery (15%)
- Engagement & Adaptability (15%)

Each response receives a detailed score out of 10 with specific feedback.

## 🛠️ Development

### Project Structure

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

## 📊 Technical Specifications

### System Requirements

**Minimum:**
- 8GB RAM
- 10GB free disk space
- Modern web browser with microphone support

**Recommended:**
- 16GB+ RAM (for Gemma model)
- Apple Silicon Mac (for MLX acceleration)
- High-quality microphone
- Stable internet connection (for initial model downloads)

### Dependencies

**Backend (Python):**
- FastAPI 0.104+
- MLX-Whisper (Apple Silicon optimization)
- Piper-TTS (high-quality voice synthesis)
- httpx (async HTTP client)
- Ollama Python client

**Frontend (JavaScript):**
- React 18+
- Vite 4+ (build tool)
- Tailwind CSS (styling)

### Performance Metrics

- **Transcription**: <2 seconds for 30-second audio clips (Apple Silicon)
- **TTS Generation**: <1 second for typical questions (high-quality voices)
- **AI Scoring**: 3-5 seconds per response (Gemma 27B)
- **Memory Usage**: ~8GB peak (with Gemma model loaded)
- **Voice Quality**: High-quality Piper voices (63MB models vs 15MB medium)

## Configuration

Create a `.env` file with:

```bash
HOST=0.0.0.0
PORT=8000
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL = "gemma3:27b"
```

## 🔧 Troubleshooting

### Common Issues

**Microphone Access**
- Ensure browser has microphone permissions
- On macOS: System Settings → Privacy & Security → Microphone

**Ollama Connection**
- Verify Ollama is running: `ollama serve`
- Check model is installed: `ollama list`
- No scoring results in summary
- Ensure Gemma model is available: `ollama pull gemma3:27b`
- Check Ollama service: `ollama list`

**Audio Issues**
- Check browser audio permissions
- Verify high-quality TTS voice files are downloaded in `piper_voices/` and `client_server/server/piper_voices/`
- Test audio endpoints: `curl http://localhost:8000/api/tts/health`
- Voice quality issues: Run `python client_server/server/download_hq_voices.py` to download high-quality voices

**GPU Acceleration**
- MLX-Whisper requires Apple Silicon for optimal performance
- For other systems, the app falls back to CPU processing

### Performance Tips

- **Use Apple Silicon Mac** for best MLX-Whisper performance
- **Ensure sufficient RAM** (16GB+ recommended for Gemma model)
- **Close unnecessary applications** when running interviews
- **Use wired microphone** for best audio quality

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **MLX** team for Apple Silicon optimization
- **Piper TTS** for high-quality voice synthesis
- **Ollama** for local LLM inference
- **Meta** for the Gemma language model
- **FastAPI** and **React** communities

---