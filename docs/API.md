# API Documentation

## Overview

The HR Interview Agent API is built with FastAPI and provides endpoints for managing interviews, questions, scoring, and speech services.

**Base URL:** `http://localhost:8000`
**API Documentation:** `http://localhost:8000/docs` (Swagger UI)
**Alternative Docs:** `http://localhost:8000/redoc` (ReDoc)

## Authentication

Currently, the API does not require authentication for local development. All endpoints are publicly accessible.

## API Endpoints

### Health Check

#### GET `/health`
Get the overall health status of the application.

**Response:**
```json
{
  "status": "healthy",
  "models": {
    "mlx_whisper": true,
    "regular_whisper": false
  },
  "message": "HR Interview Agent is running"
}
```

### Interview Management

#### POST `/api/interviews/create`
Create a new interview session with pre-generated questions.

**Request Body:**
```json
{
  "job_description": "mechanic",
  "questions": [
    {
      "question": "How do you stay current with new automotive technologies?",
      "answered": false,
      "response": "",
      "audio_file": null
    }
  ]
}
```

**Response:**
```json
{
  "session_id": "uuid-string",
  "status": "created",
  "message": "Interview session created successfully"
}
```

#### POST `/api/interviews/{session_id}/next`
Get the next question in the interview sequence.

**Response:**
```json
{
  "question": "How do you stay current with new automotive technologies?",
  "question_index": 0,
  "status": "in_progress",
  "message": null
}
```

#### POST `/api/interviews/{session_id}/submit_response/{question_index}`
Submit an audio response for a specific question.

**Request:** Multipart form data with audio file
- `audio_file`: Audio file (MP4, WebM, WAV, etc.)

**Response:**
```json
{
  "message": "Response submitted successfully",
  "question_index": 0,
  "audio_file": "session_id_0_response.mp4"
}
```

#### POST `/api/interviews/{session_id}/transcribe_all`
Transcribe all audio responses in the session.

**Response:**
```json
{
  "message": "All responses transcribed successfully",
  "transcribed_count": 2,
  "failed_count": 0
}
```

#### POST `/api/interviews/{session_id}/score_all`
Score all responses in the session using AI.

**Response:**
```json
{
  "message": "All responses scored successfully",
  "scored_count": 2,
  "average_score": 7.5
}
```

### Question Generation

#### POST `/api/questions/generate`
Generate interview questions for a job description using AI.

**Request Body:**
```json
{
  "job_description": "software engineer",
  "num_questions": 5
}
```

**Response:**
```json
{
  "questions": [
    "Tell me about your experience with software development.",
    "How do you approach debugging complex issues?",
    "Describe your experience with version control systems."
  ],
  "job_description": "software engineer",
  "generated_at": "2025-09-29T10:30:00Z"
}
```

#### POST `/api/questions/approve`
Approve and finalize generated questions.

**Request Body:**
```json
{
  "questions": [
    "Tell me about your experience with software development.",
    "How do you approach debugging complex issues?"
  ],
  "job_description": "software engineer"
}
```

**Response:**
```json
{
  "approved_questions": [
    {
      "question": "Tell me about your experience with software development.",
      "answered": false,
      "response": "",
      "audio_file": null
    }
  ],
  "message": "Questions approved successfully"
}
```

### Text-to-Speech (TTS)

#### POST `/api/tts/speak`
Convert text to speech using Piper TTS.

**Request Body:**
```json
{
  "text": "How do you stay current with new automotive technologies?",
  "voice": "en_US-amy-medium"
}
```

**Response:** Audio file (WAV format)
- Content-Type: `audio/wav`
- Content-Disposition: `inline; filename=question.wav`

#### GET `/api/tts/voices`
Get list of available TTS voices.

**Response:**
```json
{
  "voices": [
    {
      "name": "en_US-amy-medium",
      "language": "English (US)",
      "quality": "medium"
    }
  ]
}
```

#### GET `/api/tts/health`
Check TTS system health.

**Query Parameters:**
- `voice_name` (optional): Test specific voice

**Response:**
```json
{
  "status": "ok",
  "tts_engine": "piper",
  "voice": "en_US-amy-medium"
}
```

### Speech-to-Text (STT)

#### POST `/api/stt/transcribe`
Transcribe audio file using MLX-Whisper.

**Request:** Multipart form data
- `audio_file`: Audio file to transcribe

**Response:**
```json
{
  "transcript": "I have five years of experience in automotive repair...",
  "processing_time": 1.23,
  "model": "whisper-large-v3-mlx",
  "language": "en"
}
```

#### GET `/api/stt/models`
Get available STT models.

**Response:**
```json
{
  "models": [
    {
      "name": "large",
      "hf_repo": "mlx-community/whisper-large-v3-mlx",
      "size": "~3 GB",
      "speed": "Slow",
      "accuracy": "Excellent"
    }
  ],
  "current": "large",
  "engine": "mlx-whisper-gpu"
}
```

#### GET `/api/stt/health`
Check STT system health.

**Response:**
```json
{
  "status": "ok",
  "engine": "mlx-whisper-gpu",
  "model": "whisper-large-v3-mlx",
  "gpu_available": true
}
```

### Scoring System

#### POST `/api/scoring/score`
Score a single interview response using AI.

**Request Body:**
```json
{
  "question": "How do you stay current with new automotive technologies?",
  "response": "I regularly read automotive journals and attend training sessions..."
}
```

**Response:**
```json
{
  "final_score": 8.5,
  "linguistic_score": 8.0,
  "behavioral_score": 9.0,
  "detailed_scores": {
    "clarity_structure": 8,
    "grammar_vocabulary": 8,
    "conciseness_relevance": 8,
    "professionalism": 9,
    "confidence_delivery": 9,
    "engagement_adaptability": 9
  },
  "feedback": {
    "strengths": ["Clear structure", "Professional tone"],
    "improvements": ["Could be more specific about training programs"]
  }
}
```

#### GET `/api/scoring/health`
Check scoring system health.

**Response:**
```json
{
  "status": "ok",
  "model": "gemma3:27b",
  "ollama_available": true,
  "model_loaded": true
}
```

## Error Responses

All endpoints return structured error responses:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation error
- **500 Internal Server Error**: Server error

## Rate Limiting

Currently, no rate limiting is implemented for local development.

## CORS

CORS is enabled for all origins during development:
```python
allow_origins=["*"]
allow_methods=["*"]
allow_headers=["*"]
```

## WebSocket Support

Currently, the API does not support WebSocket connections. All communication is via HTTP REST endpoints.

## File Upload Limits

- **Maximum file size**: 100MB
- **Supported audio formats**: MP4, WebM, WAV, M4A, OGG
- **Upload timeout**: 300 seconds

## Model Information

### MLX-Whisper Models
- **tiny**: ~74 MB, Very Fast, Basic accuracy
- **base**: ~144 MB, Fast, Good accuracy
- **small**: ~488 MB, Medium speed, Better accuracy
- **medium**: ~1.5 GB, Slow, Very Good accuracy
- **large**: ~3 GB, Very Slow, Excellent accuracy

### Gemma Model
- **Model**: gemma3:27b
- **Size**: ~15 GB
- **Inference Time**: 3-5 seconds per response
- **Context Length**: 8192 tokens

## Development Notes

### Testing Endpoints

Use curl to test endpoints:

```bash
# Health check
curl http://localhost:8000/health

# Generate questions
curl -X POST http://localhost:8000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{"job_description": "mechanic", "num_questions": 3}'

# Test TTS
curl -X POST http://localhost:8000/api/tts/speak \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "en_US-amy-medium"}' \
  --output test.wav
```

### Monitoring

Check server logs for detailed information about requests and processing:

```bash
tail -f server.log
```