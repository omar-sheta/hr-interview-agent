# Technical Architecture

## System Overview

The HR Interview Agent is a full-stack web application designed for conducting AI-powered interview assessments. The system consists of a FastAPI backend with multiple AI services and a React frontend for user interaction.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │    │                  │    │                 │
│   Frontend      │◄──►│   FastAPI        │◄──►│   AI Services   │
│   (React)       │    │   Backend        │    │   (Local)       │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │                  │
                       │   File System    │
                       │   Storage        │
                       │                  │
                       └──────────────────┘
```

## Components Deep Dive

### Frontend Layer (React + Vite)

**Location:** `/frontend/`

**Key Technologies:**
- React 18 with hooks
- Vite for build tooling and HMR
- Tailwind CSS for styling
- MediaRecorder API for audio capture

**Main Components:**
- `App.jsx`: Main application component with state management
- Audio recording and playback functionality
- Real-time interview progress tracking
- Score visualization dashboard

**State Management:**
```javascript
// Core application state
const [sessionId, setSessionId] = useState(null);
const [currentQuestion, setCurrentQuestion] = useState(null);
const [interviewStatus, setInterviewStatus] = useState('setup');
const [questions, setQuestions] = useState([]);
const [scores, setScores] = useState(null);
```

**Audio Pipeline:**
1. MediaRecorder captures audio in MP4/WebM format
2. Audio chunks collected during recording
3. Blob created and uploaded to backend
4. Real-time visual feedback during recording

### Backend Layer (FastAPI)

**Location:** `/hr_agent/`

**Architecture Pattern:** Modular API routers with dependency injection

**Core Components:**

#### 1. Main Application (`main.py`)
- FastAPI app configuration
- CORS middleware setup
- Router registration
- Startup events for model preloading

#### 2. API Routers (`/api/`)
- **interviews.py**: Session management and workflow orchestration
- **questions.py**: AI-powered question generation
- **scoring.py**: Response evaluation using Gemma model
- **tts.py**: Text-to-speech conversion with Piper
- **stt_mlx.py**: Speech-to-text using MLX-Whisper
- **health.py**: System health monitoring

#### 3. Configuration (`config.py`)
```python
class Settings:
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GEMMA_MODEL: str = "gemma3:27b"
    TTS_VOICE: str = "en_US-amy-medium"
    UPLOAD_DIR: str = "hr_agent/uploads"
    SESSION_DIR: str = "hr_agent/data/sessions"
```

#### 4. Models (`models.py`)
- MLX-Whisper model management
- Model loading and health checking
- GPU acceleration detection

### AI Services Layer

#### 1. Speech-to-Text (MLX-Whisper)
**Technology:** MLX-optimized Whisper models for Apple Silicon

**Features:**
- GPU acceleration on Apple Silicon
- Multiple model sizes (tiny, base, small, medium, large)
- Automatic audio format conversion
- Fallback to CPU processing

**Performance:**
```python
# Model specifications
models = {
    "tiny": "~74 MB, Very Fast, Basic accuracy",
    "large": "~3 GB, Very Slow, Excellent accuracy"
}
```

#### 2. Text-to-Speech (Piper)
**Technology:** Local neural TTS with Piper voices

**Features:**
- High-quality voice synthesis
- Multiple voice models
- Configurable sample rates
- WAV output format

**Voice Pipeline:**
1. Text input validation
2. Piper model loading (lazy initialization)
3. Audio chunk generation
4. WAV file creation with headers
5. Binary audio response

#### 3. Question Generation (Ollama + Gemma)
**Technology:** Local LLM inference via Ollama

**Process:**
1. Job description analysis
2. Prompt engineering for interview questions
3. Gemma model inference
4. Response parsing and validation
5. Question formatting and storage

#### 4. Response Scoring (Gemma)
**Technology:** Structured evaluation using Gemma 3:27B model

**Scoring Rubric:**
```python
rubric = {
    "linguistic_competence": {
        "weight": 0.5,
        "components": {
            "clarity_structure": 0.2,
            "grammar_vocabulary": 0.15,
            "conciseness_relevance": 0.15
        }
    },
    "behavioral_competence": {
        "weight": 0.5,
        "components": {
            "professionalism": 0.2,
            "confidence_delivery": 0.15,
            "engagement_adaptability": 0.15
        }
    }
}
```

### Data Storage Layer

#### Session Management
**Location:** `/hr_agent/data/sessions/`

**Schema:**
```json
{
  "id": "session-uuid",
  "job_description": "mechanic",
  "questions": [
    {
      "question": "How do you stay current with automotive technology?",
      "answered": true,
      "response": "transcribed response text",
      "audio_file": "session_uuid_0_response.mp4",
      "transcript": "...",
      "score": {
        "final_score": 8.5,
        "linguistic_score": 8.0,
        "behavioral_score": 9.0
      }
    }
  ],
  "current_question_index": 1,
  "status": "completed",
  "created_at": "2025-09-29T10:30:00Z"
}
```

#### File Storage
**Audio Files:** `/hr_agent/uploads/`
- Naming: `{session_id}_{question_index}_response.{ext}`
- Formats: MP4, WebM, WAV
- Max size: 100MB per file

**Voice Models:** `/piper_voices/`
- ONNX model files
- JSON metadata files
- Automatic download on first use

## Data Flow

### Interview Session Flow
```
1. User enters job description
   ↓
2. Frontend → POST /api/questions/generate
   ↓
3. Backend → Ollama (Gemma) → Questions generated
   ↓
4. Frontend → POST /api/questions/approve
   ↓
5. Frontend → POST /api/interviews/create
   ↓
6. Session created with UUID
   ↓
7. Frontend → POST /api/interviews/{id}/next
   ↓
8. Backend returns first question
   ↓
9. Frontend → POST /api/tts/speak (question audio)
   ↓
10. User records response
    ↓
11. Frontend → POST /api/interviews/{id}/submit_response/{index}
    ↓
12. Audio file saved to uploads/
    ↓
13. Repeat steps 7-12 for remaining questions
    ↓
14. Frontend → POST /api/interviews/{id}/transcribe_all
    ↓
15. MLX-Whisper processes all audio files
    ↓
16. Frontend → POST /api/interviews/{id}/score_all
    ↓
17. Gemma model scores all responses
    ↓
18. Results displayed to user
```

### Audio Processing Pipeline
```
MediaRecorder → Blob → FormData → FastAPI → File System
                                      ↓
MLX-Whisper ← Audio File ←───────────┘
     ↓
Transcript → Gemma Model → Score → Frontend
```

## Performance Considerations

### Memory Usage
- **Gemma 3:27B Model**: ~15GB RAM when loaded
- **MLX-Whisper Large**: ~3GB VRAM
- **Piper TTS**: ~100MB per voice model
- **Session Data**: Minimal (JSON files)

### Processing Times
- **Question Generation**: 5-10 seconds
- **TTS Generation**: <1 second per question
- **STT Transcription**: 1-3 seconds per 30s audio (Apple Silicon)
- **Response Scoring**: 3-5 seconds per response

### Optimization Strategies
1. **Model Preloading**: Load models at startup
2. **Lazy Loading**: Load voice models on demand
3. **Async Processing**: Non-blocking API endpoints
4. **GPU Acceleration**: MLX optimization for Apple Silicon
5. **Memory Management**: Model caching and cleanup

## Security Considerations

### Local-First Architecture
- All processing happens locally
- No external API calls (except Ollama)
- No data transmission to cloud services

### File Security
- Input validation for uploaded files
- File type restrictions
- Size limits on uploads
- Temporary file cleanup

### API Security
- CORS enabled for development
- Input validation with Pydantic
- Error handling without information leakage

## Scalability

### Current Limitations
- Single-user system (no multi-tenancy)
- Local storage only
- Sequential processing of requests

### Future Enhancements
- Database integration (PostgreSQL/SQLite)
- User authentication and sessions
- Queue system for long-running tasks
- Distributed processing capabilities

## Monitoring and Debugging

### Logging
```python
# Structured logging throughout the application
print(f"🎵 MLX-Whisper transcribing: {file_path}")
print(f"✅ Scored question {index}: {score}/10")
print(f"📊 Scoring response: question_len={len(question)}")
```

### Health Checks
- `/health`: Overall system status
- `/api/tts/health`: TTS system status
- `/api/stt/health`: STT system status
- `/api/scoring/health`: Scoring system status

### Error Handling
- Graceful degradation for missing components
- Detailed error messages for debugging
- Fallback mechanisms for AI services