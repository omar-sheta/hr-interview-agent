from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    OLLAMA_MODEL: str = "gemma3:27b"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    DATA_DIR: str = "hr_agent/data"
    UPLOAD_DIR: str = "hr_agent/uploads"
    
    @property
    def uploads_dir(self) -> Path:
        """Get uploads directory as pathlib.Path"""
        return Path(self.UPLOAD_DIR)
    
    @property
    def sessions_dir(self) -> Path:
        """Get sessions directory as pathlib.Path"""
        return Path(self.DATA_DIR) / "sessions"

settings = Settings()
