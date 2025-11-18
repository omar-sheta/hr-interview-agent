# HR Interview Agent - Architecture Documentation

## Overview

The HR Interview Agent is a full-stack web application designed to conduct AI-powered voice-based job interviews. It features a client-server architecture with local AI processing for privacy, a React-based management dashboard, and a voice-driven interview workspace.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐       │
│  │   React Dashboard    │      │  Interview Workspace │       │
│  │   (Vite + React)     │      │   (Vanilla JS/HTML)  │       │
│  │                      │      │                      │       │
│  │  - Admin Portal      │      │  - Voice Recording   │       │
│  │  - Candidate Portal  │      │  - Audio Playback    │       │
│  │  - Interview Mgmt    │      │  - STT/TTS UI        │       │
│  └──────────────────────┘      └──────────────────────┘       │
│           │                              │                     │
│           │                              │                     │
└───────────┼──────────────────────────────┼─────────────────────┘
            │                              │
            │        HTTPS/REST API        │
            └──────────────┬───────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                      SERVER LAYER                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              FastAPI Server (main.py)                  │    │
│  │                                                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │  │ API Routes   │  │   Business   │  │  Data Mgmt  │ │    │
│  │  │              │  │    Logic     │  │             │ │    │
│  │  │ /api/*       │  │              │  │ Sessions    │ │    │
│  │  │ /interview/* │  │ Interview    │  │ Transcripts │ │    │
│  │  │ /transcribe  │  │ Management   │  │ Results     │ │    │
│  │  │ /synthesize  │  │              │  │             │ │    │
│  │  │ /generate    │  │              │  │             │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    SERVICES LAYER                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   STT       │  │     TTS      │  │    LLM Generation    │  │
│  │  Service    │  │   Service    │  │                      │  │
│  │             │  │              │  │                      │  │
│  │ MLX-Whisper │  │  Piper TTS   │  │  Ollama (Gemma 3)   │  │
│  │ (Apple MLX) │  │   (ONNX)     │  │  - Question Gen     │  │
│  │             │  │              │  │  - Evaluation       │  │
│  │ Fallback:   │  │  Voice:      │  │                      │  │
│  │ OpenAI      │  │  en_US-amy   │  │  External API:      │  │
│  │ Whisper     │  │              │  │  OpenAI compatible  │  │
│  └─────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                     DATA LAYER                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐         ┌────────────────────────┐      │
│  │  SQLite Database  │         │   File System Storage  │      │
│  │                   │         │                        │      │
│  │  - users          │         │  /data/sessions/       │      │
│  │  - interviews     │         │  /data/transcripts/    │      │
│  │  - results        │         │  /data/audio/          │      │
│  │                   │         │  /piper_voices/        │      │
│  └───────────────────┘         └────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Client Layer

#### React Dashboard (`hr_agent/frontend/`)

A modern React single-page application built with Vite that provides role-based interfaces for managing interviews.

**Technology Stack:**
- React 18.2.0
- React Router 6.22.3 (routing)
- Material-UI 7.3.5 (UI components)
- Axios (HTTP client)
- Vite 5.2.0 (build tool)

**Key Components:**

- **Authentication & Authorization:**
  - `LoginPage.jsx` - User authentication
  - `SignUpPage.jsx` - User registration
  - `ProtectedRoute.jsx` - Route guards based on user roles
  - Context API for auth state management

- **Admin Portal:**
  - `AdminDashboard.jsx` - Interview creation and management
  - `AdminInterviewForm.jsx` - Interview configuration with AI question generation
  - `AdminResultsPage.jsx` - View candidate results and feedback

- **Candidate Portal:**
  - `CandidateDashboard.jsx` - View assigned interviews
  - `WorkspacePage.jsx` - Launch interview workspace

**Features:**
- Role-based access control (admin vs. candidate)
- AI-powered question generation using Gemma 3 27B
- Interview assignment and management
- Results viewing and analysis

#### Interview Workspace

A lightweight, standalone web interface for conducting voice-based interviews. Originally located in `client/`, it's now served as a static HTML/JS/CSS application.

**Technology:**
- Vanilla JavaScript (ES6+ modules)
- HTML5 Web APIs (MediaRecorder, Audio)
- CSS3

**Structure:**
- `index.html` - Main workspace shell
- `css/styles.css` - Styling
- `js/` modules:
  - `api.js` - REST API client
  - `audio.js` - Audio recording and playback
  - `ui.js` - UI state management
  - `workspace.js` - Interview orchestration

**Features:**
- Real-time voice recording with auto-stop detection
- Smart silence and noise detection (5-second threshold)
- Audio playback controls
- Question navigation (redo, skip)
- File upload alternative to recording
- Query parameter configuration for seamless handoff from React dashboard

**URL Parameters:**
```
?api_host=127.0.0.1
&api_port=8001
&candidate_id=candidate-1
&candidate_name=John
&interview_id=int-1
&interview_title=Backend Engineer
&session_id=session-uuid
```

### 2. Server Layer

#### FastAPI Server (`hr_agent/server/main.py`)

The central backend server handling all API requests, business logic, and AI service orchestration.

**Technology:**
- FastAPI (modern async Python web framework)
- Uvicorn (ASGI server)
- Pydantic (data validation)

**API Endpoints:**

**Authentication & User Management:**
```
POST   /api/login           - User authentication
POST   /api/signup          - User registration
GET    /api/users           - List all users (admin)
GET    /api/users/{id}      - Get user by ID
```

**Interview Management:**
```
GET    /api/interviews               - List all interviews
POST   /api/interviews               - Create interview
GET    /api/interviews/{id}          - Get interview details
PUT    /api/interviews/{id}          - Update interview
DELETE /api/interviews/{id}          - Delete interview
GET    /api/assignments/{candidate}  - Get candidate assignments
```

**Interview Session Flow:**
```
POST   /interview/start              - Initialize interview session
POST   /interview/submit             - Submit answer for question
GET    /interview/{session}/results  - Get interview results
POST   /interview/{session}/feedback - Generate AI feedback
```

**AI Services:**
```
POST   /transcribe    - Speech-to-Text conversion
POST   /synthesize    - Text-to-Speech synthesis
POST   /generate      - LLM text generation
```

**System:**
```
GET    /health        - Health check endpoint
GET    /models/status - AI model loading status
```

**Key Modules:**

- **`data_manager.py`** - Persistence layer for sessions, users, interviews, results
- **`database.py`** - SQLite database connection and schema management
- **`config.py`** - Configuration settings (Ollama URL, model names, etc.)
- **`routes/`** - Modular route handlers
- **`services/`** - AI service implementations

#### Data Manager (`data_manager.py`)

Handles all persistent storage operations with a hybrid approach:
- SQLite for structured data (users, interviews, results)
- File system for binary/large data (audio files, transcripts)

**Responsibilities:**
- User CRUD operations
- Interview lifecycle management
- Session state persistence
- Result storage and retrieval
- Audio file management

### 3. Services Layer

#### Speech-to-Text Service (`services/stt.py`)

Converts audio recordings to text transcriptions.

**Primary Implementation:**
- **MLX-Whisper** - Optimized for Apple Silicon
  - Hardware acceleration via Apple MLX framework
  - Models: tiny, base, small, medium, large
  - Memory: 39MB (tiny) to 3.09GB (large-v3)
  - Performance: <2 seconds for 30-second audio on Apple Silicon

**Fallback Implementation:**
- **OpenAI Whisper** (CPU mode)
  - For non-Apple Silicon systems
  - Slower but accurate

**Features:**
- Automatic model downloading from Hugging Face
- Environment variable configuration (`HF_TOKEN`, `MLX_WHISPER_MODEL_PATH`)
- Async processing

#### Text-to-Speech Service (`services/tts.py`)

Generates natural-sounding speech from text.

**Implementation:**
- **Piper TTS** - Neural TTS with ONNX runtime
  - Voice: en_US-amy (medium quality)
  - Model size: ~15MB
  - Memory usage: ~50-100MB
  - Format: ONNX optimized
  - Output: WAV audio files

**Features:**
- Text preprocessing and normalization
- Voice metadata management
- Efficient WAV byte generation
- High-quality neural voice synthesis

#### LLM Service (Ollama Integration)

Provides AI-powered question generation and answer evaluation.

**Implementation:**
- **Ollama** - Local LLM inference server
  - Default model: Gemma 3 27B
  - API-compatible with OpenAI
  - Configurable endpoint

**Use Cases:**
1. **Question Generation** - Generate interview questions based on job role and context
2. **Question Refinement** - Edit existing questions with AI assistance
3. **Answer Evaluation** - Analyze candidate responses and provide feedback

**Features:**
- Connection health checking with retries
- Configurable timeout and backoff
- Fallback to cloud LLM APIs if needed

### 4. Data Layer

#### SQLite Database (`hr_agent.db`)

Structured data storage with three main tables:

**Users Table:**
```sql
- id (TEXT PRIMARY KEY)
- username (TEXT UNIQUE)
- password (TEXT)
- email (TEXT)
- role (TEXT)  -- 'admin' or 'candidate'
- created_at (TEXT)
```

**Interviews Table:**
```sql
- id (TEXT PRIMARY KEY)
- title (TEXT)
- description (TEXT)
- config (TEXT)  -- JSON: {job_role, num_questions, etc.}
- allowed_candidate_ids (TEXT)  -- JSON array
- active (BOOLEAN)
```

**Results Table:**
```sql
- id (TEXT PRIMARY KEY)
- session_id (TEXT UNIQUE)
- interview_id (TEXT)
- candidate_id (TEXT)
- candidate_username (TEXT)
- interview_title (TEXT)
- timestamp (TEXT)
- answers (TEXT)  -- JSON array
- feedback (TEXT)  -- JSON object
- scores (TEXT)  -- JSON object
- summary (TEXT)
- created_at (TEXT)
- updated_at (TEXT)
- status (TEXT)
```

#### File System Storage

**Directory Structure:**
```
hr_agent/server/data/
├── hr_agent.db              # SQLite database
├── sessions/                # Session state files
│   └── {session_id}.json
├── transcripts/             # Transcription results
│   └── {session_id}/
│       └── {question_index}.txt
├── audio/                   # Audio recordings
│   └── {session_id}/
│       ├── {question_index}.wav
│       └── {question_index}_response.wav
└── interviews.json          # Legacy interview data
```

**Voice Models:**
```
hr_agent/server/piper_voices/
├── en_US-amy-high.onnx
├── en_US-amy-medium.onnx.json
└── en_US-lessac-high.onnx.json
```

## Data Flow & Request Lifecycle

### Interview Creation Flow (Admin)

```
1. Admin logs in via /api/login
   ├─> Server validates credentials against users table
   └─> Returns JWT/session token

2. Admin navigates to AdminDashboard
   ├─> Fetches existing interviews via GET /api/interviews
   └─> Displays interview list

3. Admin creates new interview
   ├─> Fills AdminInterviewForm with:
   │   ├─> Title, description, job role
   │   └─> Generates questions via AI (POST /generate)
   ├─> Selects candidate IDs to assign
   └─> Submits via POST /api/interviews

4. Server processes interview creation
   ├─> Validates admin role
   ├─> Generates unique interview ID
   ├─> Stores in interviews table
   └─> Returns created interview object
```

### Interview Execution Flow (Candidate)

```
1. Candidate logs in via /api/login
   └─> Server returns session token + user data

2. Candidate views assigned interviews
   ├─> GET /api/assignments/{candidate_id}
   └─> Server filters interviews by allowed_candidate_ids

3. Candidate clicks "Start Interview"
   ├─> POST /interview/start
   │   ├─> candidate_id
   │   └─> interview_id
   ├─> Server:
   │   ├─> Creates session ID (UUID)
   │   ├─> Loads interview questions
   │   ├─> Synthesizes first question audio via Piper TTS
   │   └─> Saves session state to data/sessions/{session_id}.json
   └─> Returns: {session_id, questions, audio_url}

4. React app launches Interview Workspace
   ├─> Builds URL with query parameters
   └─> Opens in new tab/window

5. Workspace loads and initializes
   ├─> Parses URL parameters
   ├─> Displays first question
   ├─> Auto-plays question audio
   └─> Enables recording controls

6. Candidate records answer
   ├─> User clicks "Start Recording"
   ├─> MediaRecorder captures audio stream
   ├─> Auto-stop detection monitors:
   │   ├─> Silence detection (5 seconds)
   │   └─> Noise threshold
   └─> Audio blob created

7. Submit answer
   ├─> POST /interview/submit
   │   ├─> session_id
   │   ├─> question_index
   │   └─> audio file (multipart/form-data)
   ├─> Server:
   │   ├─> Saves audio to data/audio/{session_id}/
   │   ├─> Transcribes via MLX-Whisper (POST /transcribe)
   │   ├─> Saves transcript to data/transcripts/{session_id}/
   │   ├─> Updates session state
   │   ├─> Synthesizes next question audio
   │   └─> Returns next question data
   └─> Workspace displays next question

8. Repeat steps 6-7 for each question

9. Interview completion
   ├─> All questions answered
   ├─> GET /interview/{session_id}/results
   ├─> Server:
   │   ├─> Loads all transcripts
   │   ├─> Generates AI feedback via Ollama (POST /generate)
   │   ├─> Calculates scores
   │   ├─> Saves to results table
   │   └─> Returns comprehensive results
   └─> Workspace displays completion message
```

### AI Processing Flow

**Speech-to-Text (STT):**
```
Audio Recording → POST /transcribe
    ├─> services/stt.py
    ├─> MLX-Whisper model (if Apple Silicon)
    │   ├─> Load audio file
    │   ├─> Process through neural network
    │   └─> Return text transcription
    └─> Fallback: OpenAI Whisper (CPU mode)
```

**Text-to-Speech (TTS):**
```
Question Text → POST /synthesize
    ├─> services/tts.py
    ├─> Text preprocessing
    ├─> Piper TTS ONNX model
    │   ├─> Load voice metadata
    │   ├─> Generate phonemes
    │   ├─> Synthesize audio waveform
    │   └─> Encode as WAV
    └─> Return audio bytes
```

**LLM Generation:**
```
Prompt → POST /generate
    ├─> Ollama connection check
    ├─> Format prompt for model
    ├─> POST to Ollama API
    │   ├─> Model: Gemma 3 27B
    │   ├─> Generate response
    │   └─> Stream or complete response
    └─> Return generated text
```

## Key Design Decisions

### 1. Privacy-First Architecture

**Decision:** All AI processing runs locally on the server
**Rationale:**
- No candidate data sent to external APIs
- Full control over data privacy
- GDPR/compliance friendly
- Network can be air-gapped

**Implementation:**
- Local MLX-Whisper for STT
- Local Piper TTS
- Local Ollama LLM server
- Optional cloud API fallbacks

### 2. Client-Server Separation

**Decision:** Lightweight clients, heavy server processing
**Rationale:**
- AI models require significant resources
- Centralized processing enables multiple clients
- Easier model updates and maintenance
- Consistent results across devices

**Benefits:**
- React dashboard on any device
- Interview workspace works on mobile browsers
- Single point of model management

### 3. Hybrid Storage Strategy

**Decision:** SQLite + File System
**Rationale:**
- SQLite for structured, queryable data
- File system for large binary files (audio)
- Simpler backup and recovery
- Easier debugging

**Trade-offs:**
- Not as scalable as dedicated database
- Suitable for small-to-medium deployments
- Easy migration path to PostgreSQL if needed

### 4. Modular Service Layer

**Decision:** Separate service modules for STT, TTS, LLM
**Rationale:**
- Easy to swap implementations
- Independent testing
- Graceful degradation
- Model upgrades without affecting other services

**Implementation:**
- `services/stt.py` - STT abstraction
- `services/tts.py` - TTS abstraction
- Ollama integration in main.py (can be extracted)

### 5. RESTful API Design

**Decision:** HTTP REST instead of WebSockets
**Rationale:**
- Simpler implementation
- Better debugging
- Standard HTTP caching
- Works with existing tools

**Trade-offs:**
- No real-time streaming (acceptable for use case)
- Request/response overhead minimal for audio processing
- Could add WebSocket later for live transcription

### 6. React + Vanilla JS Split

**Decision:** React dashboard + Vanilla JS workspace
**Rationale:**
- React best for complex state management (admin/candidate portals)
- Vanilla JS optimal for audio-focused workspace
- Separation of concerns
- Independent deployment

**Benefits:**
- Lighter workspace bundle
- Direct Web API access for audio
- React benefits where needed

## Security Considerations

### Authentication & Authorization

- **Current:** Simple username/password with role checking
- **Storage:** Plain text passwords in database (development only)
- **Recommendation:** Implement bcrypt hashing and JWT tokens for production

### Data Privacy

- **Audio Storage:** Local file system, not cloud
- **Transcripts:** Stored locally with session association
- **Results:** Accessible only to admins and respective candidates

### Network Security

- **HTTPS Support:** Self-signed certificates for local network
- **CORS:** Configured for allowed origins
- **API Validation:** Pydantic models for request validation

### Recommendations for Production

1. **Hash passwords** with bcrypt or argon2
2. **Implement JWT** with refresh tokens
3. **Add rate limiting** on API endpoints
4. **Enable HTTPS** with valid certificates
5. **Add audit logging** for sensitive operations
6. **Implement RBAC** with granular permissions
7. **Add input sanitization** for file uploads
8. **Enable CSRF protection**

## Performance Characteristics

### Response Times (Apple Silicon M1/M2)

- **STT Transcription:** <2 seconds for 30-second audio
- **TTS Synthesis:** <1 second for typical question
- **LLM Question Generation:** 5-15 seconds (depends on model size)
- **API Response:** <100ms for non-AI endpoints

### Resource Usage

**Minimum Requirements:**
- RAM: 8GB (16GB recommended with LLM)
- Storage: 5GB
- CPU: Multi-core processor

**Model Memory Footprint:**
- MLX-Whisper base: ~1GB
- Piper TTS: ~100MB
- Gemma 3 27B: ~16GB
- Total: ~17GB with all models loaded

### Scaling Considerations

**Current Capacity:**
- Suitable for: 1-50 concurrent interviews
- Bottleneck: LLM inference time
- Storage: Limited by disk space

**Horizontal Scaling Options:**
1. Separate STT/TTS/LLM services
2. Load balancer for FastAPI instances
3. Shared database (PostgreSQL)
4. Object storage for audio files (S3-compatible)
5. Redis for session caching

## Technology Stack Summary

### Backend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Web Framework | FastAPI | Latest | REST API server |
| ASGI Server | Uvicorn | Latest | High-performance async server |
| Database | SQLite | 3.x | Structured data storage |
| STT | MLX-Whisper | 0.1.0+ | Speech-to-text (Apple Silicon) |
| STT Fallback | OpenAI Whisper | Latest | Speech-to-text (CPU) |
| TTS | Piper TTS | 1.2.0+ | Text-to-speech synthesis |
| LLM | Ollama (Gemma 3) | Latest | Question generation & evaluation |
| Validation | Pydantic | 2.7+ | Data validation |

### Frontend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 18.2.0 | UI framework |
| Build Tool | Vite | 5.2.0 | Fast dev server & bundler |
| Routing | React Router | 6.22.3 | Client-side routing |
| UI Library | Material-UI | 7.3.5 | Component library |
| HTTP Client | Axios | 1.6.8 | API requests |
| State Management | Context API | Built-in | Auth & global state |

### Development
| Tool | Purpose |
|------|---------|
| Python 3.9+ | Backend runtime |
| Node.js 18+ | Frontend tooling |
| npm | Package management |
| pip | Python package management |

## Deployment Architecture

### Development Setup

```
┌─────────────────────────────────────────────────┐
│             Developer Machine                    │
│                                                  │
│  ┌─────────────┐    ┌──────────────────┐       │
│  │   Vite Dev  │    │  FastAPI Server  │       │
│  │   Server    │    │  (Uvicorn)       │       │
│  │  Port 5173  │    │  Port 8001       │       │
│  └──────┬──────┘    └────────┬─────────┘       │
│         │                    │                   │
│         └────────┬───────────┘                   │
│                  │                               │
│         Browser: localhost:5173                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Production Setup

```
┌─────────────────────────────────────────────────┐
│              Server/Cloud Instance               │
│                                                  │
│  ┌──────────────────────────────────┐           │
│  │         Nginx Reverse Proxy      │           │
│  │       (HTTPS Termination)        │           │
│  │           Port 443               │           │
│  └────────────┬─────────────────────┘           │
│               │                                  │
│       ┌───────┴────────┐                        │
│       │                │                        │
│  ┌────▼─────┐    ┌────▼─────┐                  │
│  │  Static  │    │ FastAPI  │                  │
│  │  Files   │    │  Server  │                  │
│  │  (React) │    │  (Uvicorn)│                  │
│  └──────────┘    └──────┬───┘                  │
│                          │                       │
│                   ┌──────▼──────┐               │
│                   │   SQLite    │               │
│                   │  + Storage  │               │
│                   └─────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Network Access Modes

**Mode 1: Local Development**
- Backend: http://localhost:8001
- Frontend: http://localhost:5173
- Workspace: http://localhost:8080/hr_agent/client/

**Mode 2: Local Network (LAN)**
- Backend: http://<machine-ip>:8001
- Frontend: http://<machine-ip>:5173
- HTTPS: https://<machine-ip>:8443 (self-signed cert)

**Mode 3: Production**
- All services: https://<domain>/
- Nginx reverse proxy to backend
- Static files served by Nginx
- SSL/TLS with valid certificate

## Future Enhancements

### Short-term
1. **Video interview support** - Add webcam recording
2. **Live transcription** - Real-time STT feedback
3. **Multiple languages** - Add language selection
4. **Better analytics** - Detailed candidate metrics
5. **Email notifications** - Interview invites and results

### Medium-term
1. **Microservices split** - Separate STT/TTS/LLM services
2. **PostgreSQL migration** - Better scalability
3. **Redis caching** - Session and result caching
4. **WebSocket support** - Real-time updates
5. **Mobile apps** - Native iOS/Android clients

### Long-term
1. **Multi-tenant support** - Multiple organizations
2. **Advanced AI features** - Sentiment analysis, body language
3. **Integration APIs** - ATS system integration
4. **Collaborative interviewing** - Multiple interviewers
5. **Kubernetes deployment** - Container orchestration

## Conclusion

The HR Interview Agent demonstrates a well-architected solution that balances privacy, performance, and user experience. Its modular design allows for easy maintenance and future enhancements while the local-first AI approach ensures data privacy. The separation between the React dashboard and voice workspace provides flexibility for different use cases and deployment scenarios.

The architecture is suitable for small-to-medium scale deployments and can be scaled horizontally with appropriate infrastructure changes. The use of open-source models and frameworks ensures cost-effectiveness and flexibility in customization.
