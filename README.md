# 🎯 AI-Powered HR Interview Platform

> An intelligent, automated interview platform that leverages Large Language Models to streamline technical candidate assessments at scale.

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![Material-UI](https://img.shields.io/badge/MUI-%230081CB.svg?style=for-the-badge&logo=mui&logoColor=white)](https://mui.com/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

## ✨ Features

### 🤖 AI-Powered Automation
- **Dynamic Question Generation**: AI creates role-specific questions tailored to job descriptions using LLMs
- **Question Refinement**: AI-assisted editing and reordering of interview questions
- **Intelligent Evaluation**: Multi-dimensional scoring (0-10 scale) with detailed qualitative feedback
- **Hiring Recommendations**: AI generates summary insights and "Hire/No Hire" recommendations
- **Real-Time Processing**: Speech-to-text powered interviews with instant transcription
- **Smart Analysis**: Evaluates technical accuracy, communication clarity, and depth of understanding

### 👥 Role-Based Dashboards
- **Admin Dashboard**: Create interviews, assign candidates, review results, manage hiring pipeline
- **Candidate Dashboard**: View assigned interviews, start sessions, track application status
- **Interview Workspace**: Voice-driven interview experience with microphone integration

### 📧 Automated Notifications
- **Email Integration**: Gmail API (OAuth2) for secure, automated communications
- **Smart Targeting**: Only newly added candidates receive invitations (no duplicates)
- **Network-Ready Links**: Dynamic IP detection for cross-device accessibility
- **Status Updates**: Automated notifications for acceptance/rejection decisions

### ⏰ Scheduling & Management
- **Deadline Support**: Set interview expiration dates with countdown timers
- **Calendar Integration**: Visual deadline tracking in candidate dashboard
- **Status Management**: Accept, reject, or mark candidates as pending

### 🎨 Modern UI/UX
- **Glassmorphism Design**: Beautiful, modern interface with frosted glass effects
- **Smooth Animations**: Framer Motion for polished transitions
- **Dark Mode**: Full theming support
- **Responsive**: Works on desktop, tablet, and mobile

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (Python 3.13 recommended)
- **Node.js 16+** and npm
- **Ollama** (for local LLM - required for AI features)
- **macOS (Apple Silicon)** (Required for local Speech-to-Text via `mlx-whisper`)

### 🛠️ Install Dependencies

#### 1. Ollama (Local LLM - Required)
```bash
# macOS (Homebrew)
brew install ollama

# Or download directly from https://ollama.ai

# Start Ollama and pull the model
ollama serve  # Run in background or separate terminal
ollama pull gemma3:27b  # Or: llama3.1:8b for smaller machines
```

#### 2. Piper TTS (Text-to-Speech)
```bash
# Installed automatically via requirements.txt
# Voice models are downloaded on first use, or manually:
python server/download_hq_voices.py
```

#### 3. MLX-Whisper (Speech-to-Text - Apple Silicon Only)
```bash
# Installed automatically via requirements.txt
# Requires Apple Silicon Mac (M1/M2/M3/M4)
```

### 1️⃣ Clone Repository
```bash
git clone https://github.com/yourusername/hr-interview-agent.git
cd hr-interview-agent
```

### 2️⃣ Automated Setup (Recommended)
```bash
chmod +x start_client_server.sh
./start_client_server.sh
```

**This will:**
- ✅ Check and install Python/Node dependencies
- ✅ Generate HTTPS certificates for microphone access
- ✅ Start FastAPI server (ports 8001 HTTP, 8002 HTTPS)
- ✅ Start Vite dev server (port 5173)
- ✅ Start Ollama if available (port 11434)
- ✅ Display all access URLs (local + network)

### 3️⃣ Manual Setup (Alternative)

#### Backend
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r server/requirements.txt

# Start server
cd server
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

#### Frontend
```bash
# In a new terminal
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

#### Ollama (Optional - for local LLM)
```bash
# Install Ollama: https://ollama.ai
ollama serve
ollama pull gemma2:27b  # Or any model you prefer
```

### 4️⃣ Access the Application
- **Frontend UI**: https://localhost:5173
- **API Docs**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health

---

## 👤 Demo Accounts

### Admin Login
- **Email**: `admin@example.com`
- **Password**: `admin123`

### Candidate Logins
- **Email**: `omar@example.com` / **Password**: `omar`
- **Email**: `alice@example.com` / **Password**: `alice`
- **Email**: `bob@example.com` / **Password**: `bob`

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   React Frontend    │  (Vite + Material-UI + Framer Motion)
│   Port: 5173        │
└──────────┬──────────┘
           │
           │ HTTPS/HTTP
           ▼
┌─────────────────────┐
│   FastAPI Backend   │  ← SQLite Database
│   Port: 8001/8002   │  ← Gmail API (OAuth2)
└──────────┬──────────┘
           │
           │ HTTP
           ▼
┌─────────────────────┐
│   Ollama / OpenAI   │  (LLM for Q&A Generation/Evaluation)
│   Port: 11434       │
└─────────────────────┘
```

### Tech Stack

#### Backend
- **FastAPI**: Modern, fast API framework
- **SQLite**: Lightweight database for development
- **Pydantic**: Data validation
- **OAuth2**: Secure Gmail integration
- **MLX-Whisper**: Speech-to-text (Apple Silicon optimized)
- **Piper TTS**: Natural voice synthesis

#### Frontend
- **React 18**: Component-based UI
- **Vite**: Fast build tool and dev server
- **Material-UI v7**: Google's Material Design
- **Framer Motion**: Smooth animations
- **Axios**: HTTP client
- **React Router**: Navigation

#### AI/ML
- **LLM**: Ollama (Gemma, Llama) or OpenAI API
- **Speech Recognition**: Web Speech API + MLX-Whisper
- **Text-to-Speech**: Piper TTS (ONNX models)

---

## 📁 Project Structure

```
hr-interview-agent/
├── frontend/                    # React application (Vite)
│   ├── src/
│   │   ├── components/          # Reusable UI (Navbar, StatsCard, etc.)
│   │   ├── pages/               # Application Pages
│   │   │   ├── AdminDashboard.jsx   # Admin overview
│   │   │   ├── AdminInterviews.jsx  # Interview management
│   │   │   ├── AdminResults.jsx     # Results & Analytics
│   │   │   ├── CandidateDashboard.jsx # Candidate portal
│   │   │   └── WorkspacePage.jsx    # Interview session UI
│   │   ├── context/             # Auth & Theme Context
│   │   ├── hooks/               # Custom hooks (useAudioRecorder)
│   │   └── api/                 # Axios client configuration
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # FastAPI backend
│   ├── routers/                 # API route handlers
│   │   ├── admin.py             # Admin CRUD & Dashboard stats
│   │   ├── candidate.py         # Candidate endpoints
│   │   ├── auth.py              # JWT Authentication
│   │   ├── interview.py         # Session logic & Evaluation trigger
│   │   └── ai.py                # LLM integration (Gemma/Llama)
│   │
│   ├── services/                # Business logic layer
│   │   ├── email_service.py     # Gmail OAuth2 & SMTP
│   │   ├── question_service.py  # Prompt engineering for questions
│   │   ├── evaluation_service.py# Scoring & Feedback logic
│   │   ├── stt.py               # MLX Whisper (Speech-to-Text)
│   │   └── tts.py               # Piper TTS (Text-to-Speech)
│   │
│   ├── models/                  # Pydantic schemas
│   ├── utils/                   # Helpers & Security
│   ├── data/                    # SQLite DB & File storage (audio/json)
│   ├── main.py                  # App entry point
│   └── requirements.txt
│
├── authorize_gmail.py           # OAuth2 setup script
├── setup_email.sh               # SMTP configuration script
├── start_client_server.sh       # Unified startup script
├── .gitignore
└── README.md
```

---

## 🎓 Usage Guide

### For Admins

#### 1. Create an Interview
1. Login at https://localhost:5173
2. Navigate to "Create Interview"
3. Enter job role and description
4. Click "Generate Questions" (AI-powered)
5. Edit, reorder, or refine questions
6. Assign candidates by email/ID
7. Set deadline (optional)
8. Save

#### 2. Review Results
1. Go to "View All Results"
2. Filter by candidate or interview
3. Review AI scores and feedback
4. Accept/Reject candidates
5. Candidates receive automated email notifications

### For Candidates

#### 1. Check Assigned Interviews
1. Login at https://localhost:5173
2. View assigned interviews on dashboard
3. Check deadlines and requirements

#### 2. Take Interview
1. Click "Start Interview"
2. Answer questions via microphone
3. Submit when complete
4. Await admin review

---

## 📧 Email Setup (Gmail OAuth2)

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Desktop app)
5. Download `client_secret.json`

### 2. Authorize Application
```bash
# Place client_secret.json in project root
python3 authorize_gmail.py

# Follow browser prompts to authorize
# token.json will be created automatically
```

### 3. Configure Email Service
The `server/services/email_service.py` will automatically use:
- `token.json` for OAuth2
- Falls back to SMTP if OAuth fails

### Alternative: Quick SMTP Setup
If you prefer not to set up Google Cloud OAuth, you can use a Gmail App Password:
```bash
chmod +x setup_email.sh
./setup_email.sh
```
This script helps you configure SMTP credentials and starts the server automatically.

---

## 🔧 Configuration

### Environment Variables (Optional)

Create `.env` file in project root:

```bash
# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=sk-...  # If using OpenAI instead of Ollama

# SMTP Fallback (if not using Gmail OAuth)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8001
```

### Customization

#### Change LLM Model
Edit `server/services/question_service.py`:
```python
MODEL_NAME = "gemma2:27b"  # Change to any Ollama model
```

#### Modify Email Templates
Edit `server/services/email_templates.py` to customize email content.

#### Adjust Evaluation Criteria
Edit `server/services/evaluation_service.py` to change scoring logic.

---

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/logout` - Logout

### Admin
- `GET /api/admin/interviews` - List all interviews
- `POST /api/admin/interviews` - Create interview
- `PUT /api/admin/interviews/{id}` - Update interview
- `DELETE /api/admin/interviews/{id}` - Delete interview
- `GET /api/admin/results` - View all results

### Candidate
- `GET /api/candidate/interviews` - Get assigned interviews
- `POST /api/candidate/interviews/{id}/start` - Start interview session
- `GET /api/candidate/results` - View my results

### AI/LLM
- `POST /generate` - Generate interview questions
- `POST /questions/edit` - Refine questions with AI
- `POST /transcribe` - Speech-to-text
- `POST /synthesize` - Text-to-speech

Full API documentation: http://localhost:8001/docs

---

## 🚢 Deployment

### Production Build

#### Frontend
```bash
cd frontend
npm run build
# Serve dist/ folder with nginx or similar
```

#### Backend
```bash
# Use production server like Gunicorn
pip install gunicorn
gunicorn server.main:app --workers 4 --bind 0.0.0.0:8001
```

### Docker (Coming Soon)
```bash
docker-compose up -d
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- **OpenAI Whisper** - Speech recognition
- **Piper TTS** - Voice synthesis
- **Ollama** - Local LLM inference
- **FastAPI** - Modern Python framework
- **Material-UI** - React components
- **Framer Motion** - Animation library

---

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for efficient, AI-powered hiring**
