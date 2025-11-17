from __future__ import annotations

import asyncio
import logging
import os
import shutil
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List

try:  # pragma: no cover - import guarded for non-Apple platforms
    import mlx_whisper  # type: ignore
    STT_AVAILABLE = True
    _IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover - surfaced via STT_AVAILABLE flag
    mlx_whisper = None  # type: ignore
    STT_AVAILABLE = False
    _IMPORT_ERROR = exc

LOGGER = logging.getLogger("hr_interview_agent.stt")
_AVAILABLE_MODELS = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large": "mlx-community/whisper-large-v3-mlx",
}
_DEFAULT_MODEL_KEY = os.environ.get("MLX_WHISPER_MODEL_PRESET", "large").lower()
_ENV_MODEL_REPO = os.environ.get("MLX_WHISPER_MODEL")
if _ENV_MODEL_REPO:
    _INITIAL_MODEL_REPO = _ENV_MODEL_REPO
    _INITIAL_MODEL_KEY = next(
        (name for name, repo in _AVAILABLE_MODELS.items() if repo == _ENV_MODEL_REPO),
        None,
    )
else:
    _INITIAL_MODEL_REPO = _AVAILABLE_MODELS.get(_DEFAULT_MODEL_KEY, _AVAILABLE_MODELS["large"])
    _INITIAL_MODEL_KEY = _DEFAULT_MODEL_KEY if _DEFAULT_MODEL_KEY in _AVAILABLE_MODELS else "large"

_ACTIVE_MODEL_REPO = _INITIAL_MODEL_REPO
_ACTIVE_MODEL_KEY = _INITIAL_MODEL_KEY
DEFAULT_REVISION = os.environ.get("MLX_WHISPER_REVISION", "main")
MODEL_PATH_OVERRIDE = os.environ.get("MLX_WHISPER_MODEL_PATH")
MODEL_CACHE_BASE = Path(
    os.environ.get("MLX_WHISPER_CACHE_DIR", Path.home() / ".cache/hr_agent/mlx_whisper")
)
_MODEL_LOCK = Lock()
_RESOLVED_MODEL_PATH: Path | None = None


def _ensure_ready() -> None:
    if STT_AVAILABLE:
        return
    raise RuntimeError(
        "MLX Whisper is not installed. Install `mlx` and `mlx-whisper` to enable speech recognition."
    ) from _IMPORT_ERROR


def _is_valid_model_dir(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        next(path.iterdir())
        return True
    except StopIteration:
        return False


def _resolve_model_path() -> Path:
    global _RESOLVED_MODEL_PATH
    with _MODEL_LOCK:
        if _RESOLVED_MODEL_PATH and _RESOLVED_MODEL_PATH.exists():
            return _RESOLVED_MODEL_PATH

        if MODEL_PATH_OVERRIDE:
            override_path = Path(MODEL_PATH_OVERRIDE)
            if not _is_valid_model_dir(override_path):
                raise FileNotFoundError(
                    f"MLX Whisper override path '{override_path}' does not exist or is empty."
                )
            _RESOLVED_MODEL_PATH = override_path
            return _RESOLVED_MODEL_PATH

        active_repo = _ACTIVE_MODEL_REPO
        MODEL_CACHE_BASE.mkdir(parents=True, exist_ok=True)
        cache_target = MODEL_CACHE_BASE / active_repo.replace("/", "-") / DEFAULT_REVISION
        if cache_target.exists():
            if _is_valid_model_dir(cache_target):
                _RESOLVED_MODEL_PATH = cache_target
                return _RESOLVED_MODEL_PATH
            LOGGER.warning("Removing empty Whisper cache at %s", cache_target)
            shutil.rmtree(cache_target, ignore_errors=True)

        try:
            from huggingface_hub import snapshot_download  # type: ignore
            from huggingface_hub.utils import HfHubHTTPError  # type: ignore
        except Exception as import_err:  # pragma: no cover - surfaces to caller
            raise RuntimeError(
                "huggingface_hub is not installed. Install it or set MLX_WHISPER_MODEL_PATH to a local model."
            ) from import_err

        LOGGER.info(
            "Downloading mlx-whisper model '%s' (revision %s) to %s",
            active_repo,
            DEFAULT_REVISION,
            cache_target,
        )
        try:
            local_dir = snapshot_download(  # type: ignore[misc]
                repo_id=active_repo,
                revision=DEFAULT_REVISION,
                cache_dir=str(MODEL_CACHE_BASE),
                local_dir=str(cache_target),
                local_dir_use_symlinks=False,
                token=os.environ.get("HF_TOKEN"),
            )
        except HfHubHTTPError as err:  # type: ignore[name-defined]
            shutil.rmtree(cache_target, ignore_errors=True)
            raise RuntimeError(
                "Unable to download mlx-whisper model. Provide an HF_TOKEN env var if the repo is gated"
                " or set MLX_WHISPER_MODEL_PATH to a local directory."
            ) from err
        except Exception as err:
            shutil.rmtree(cache_target, ignore_errors=True)
            raise RuntimeError(
                f"Failed to download mlx-whisper model '{active_repo}': {err}"
            ) from err

        _RESOLVED_MODEL_PATH = Path(local_dir)
        return _RESOLVED_MODEL_PATH


def _transcribe_sync(audio_path: Path, detailed: bool) -> Dict[str, Any]:
    model_path = _resolve_model_path()
    LOGGER.debug(
        "Transcribing audio with mlx-whisper | path=%s | detailed=%s | model=%s",
        audio_path,
        detailed,
        model_path,
    )
    return mlx_whisper.transcribe(  # type: ignore[union-attr]
        str(audio_path),
        path_or_hf_repo=str(model_path),
        verbose=False,
        word_timestamps=detailed,
    )


async def transcribe_audio_mlx(filepath: str, detailed: bool = False) -> Any:
    """Asynchronously transcribe an audio file using mlx-whisper."""
    _ensure_ready()
    audio_path = Path(filepath)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {filepath}")

    result = await asyncio.to_thread(_transcribe_sync, audio_path, detailed)
    if detailed:
        return result

    transcript = (result.get("text") or "").strip()
    if not transcript:
        raise RuntimeError("mlx-whisper returned an empty transcript")
    return transcript


def list_available_models() -> List[Dict[str, Any]]:
    with _MODEL_LOCK:
        active_repo = _ACTIVE_MODEL_REPO
    return [
        {
            "name": name,
            "hf_repo": repo,
            "selected": repo == active_repo,
        }
        for name, repo in _AVAILABLE_MODELS.items()
    ]


def get_active_model_info() -> Dict[str, Any]:
    with _MODEL_LOCK:
        repo = _ACTIVE_MODEL_REPO
        name = _ACTIVE_MODEL_KEY or next(
            (model_name for model_name, candidate in _AVAILABLE_MODELS.items() if candidate == repo),
            repo,
        )
    return {
        "name": name,
        "hf_repo": repo,
    }


def switch_model(model_name: str) -> Dict[str, Any]:
    if model_name not in _AVAILABLE_MODELS:
        raise ValueError(
            f"Invalid model '{model_name}'. Valid options: {', '.join(sorted(_AVAILABLE_MODELS))}"
        )
    repo = _AVAILABLE_MODELS[model_name]
    with _MODEL_LOCK:
        global _ACTIVE_MODEL_REPO, _ACTIVE_MODEL_KEY, _RESOLVED_MODEL_PATH
        if repo == _ACTIVE_MODEL_REPO:
            return get_active_model_info()
        _ACTIVE_MODEL_REPO = repo
        _ACTIVE_MODEL_KEY = model_name
        _RESOLVED_MODEL_PATH = None
    LOGGER.info("Switched mlx-whisper model to %s (%s)", model_name, repo)
    return get_active_model_info()


def stt_health_report() -> Dict[str, Any]:
    if not STT_AVAILABLE:
        return {
            "status": "unavailable",
            "engine": "mlx-whisper",
            "error": str(_IMPORT_ERROR) if _IMPORT_ERROR else "mlx-whisper not importable",
        }

    try:
        model_path = _resolve_model_path()
        status = "ok"
        error = None
    except Exception as exc:  # pragma: no cover - propagates health errors
        model_path = None
        status = "degraded"
        error = str(exc)

    info = get_active_model_info()
    return {
        "status": status,
        "engine": "mlx-whisper",
        "model": info,
        "cache_dir": str(MODEL_CACHE_BASE),
        "revision": DEFAULT_REVISION,
        "model_path": str(model_path) if model_path else None,
        "error": error,
    }


__all__ = [
    "transcribe_audio_mlx",
    "list_available_models",
    "get_active_model_info",
    "switch_model",
    "stt_health_report",
    "STT_AVAILABLE",
]
