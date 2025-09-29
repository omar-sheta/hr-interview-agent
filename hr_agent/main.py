import uvicorn
import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.responses import FileResponse

from hr_agent.config import settings
from hr_agent.api import interviews, questions, health, tts, stt_mlx, scoring
from hr_agent import models

# Ensure ffmpeg and other Homebrew tools are available
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", "")

app = FastAPI(
    title="HR Interview Agent",
    description="A local, privacy-friendly interview system with GPU-accelerated speech recognition.",
    version="0.1.0",
)

# Global exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"[VALIDATION ERROR] URL: {request.url}")
    print(f"[VALIDATION ERROR] Method: {request.method}")
    print(f"[VALIDATION ERROR] Headers: {dict(request.headers)}")
    try:
        body = await request.body()
        print(f"[VALIDATION ERROR] Body: {body}")
    except Exception as e:
        print(f"[VALIDATION ERROR] Could not read body: {e}")
    print(f"[VALIDATION ERROR] Details: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": f"Validation error: {exc.errors()}"}
    )

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["Interviews"])
app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(tts.router, prefix="/api/tts", tags=["Text-to-Speech"])
app.include_router(stt_mlx.router, prefix="/api/stt", tags=["Speech-to-Text (GPU)"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["Interview Scoring"])

@app.on_event("startup")
async def preload_voice_and_models():
    print("🚀 Starting HR Interview Agent...")
    
    # Preload default Piper voice to avoid first-request lag
    try:
        tts.get_piper_voice("en_US-amy-medium")
        print("✅ TTS (Piper) voice loaded successfully")
    except Exception as e:
        print(f"⚠️ TTS voice loading failed: {e}")
    
    # Preload MLX-Whisper models only (skip regular Whisper to avoid downloads)
    try:
        if models.load_models():
            print("✅ MLX-Whisper models loaded successfully")
        else:
            print("⚠️ MLX-Whisper model loading failed")
    except Exception as e:
        print(f"❌ Model loading error: {e}")
    
    print("🎉 HR Interview Agent ready!")

@app.get("/")
async def read_index():
    return FileResponse('frontend/index.html')

@app.get("/health")
async def health_check():
    """Health check endpoint with model status"""
    return {
        "status": "healthy",
        "models": models.get_model_status(),
        "message": "HR Interview Agent is running"
    }

if __name__ == "__main__":
    uvicorn.run(
        "hr_agent.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
