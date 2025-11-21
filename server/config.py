import os


class Settings:
    # Base URL of the Ollama daemon, change with OLLAMA_BASE_URL env var if needed
    OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    # Default model
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma2:27b")
    # Retry policy when probing the Ollama endpoint
    OLLAMA_PROBE_RETRIES = int(os.environ.get("OLLAMA_PROBE_RETRIES", "3"))
    OLLAMA_PROBE_TIMEOUT = float(os.environ.get("OLLAMA_PROBE_TIMEOUT", "30"))
    OLLAMA_PROBE_BACKOFF = float(os.environ.get("OLLAMA_PROBE_BACKOFF", "1"))


settings = Settings()
