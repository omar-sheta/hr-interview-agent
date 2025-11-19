from __future__ import annotations

import io
import json
import logging
import os
import wave
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Any, Dict, Iterable, Optional, Tuple

try:  # pragma: no cover - guarded by runtime detection
    from piper import voice as piper_voice
    from piper.config import SynthesisConfig
    TTS_AVAILABLE = True
    _IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover
    piper_voice = None  # type: ignore
    SynthesisConfig = None  # type: ignore
    TTS_AVAILABLE = False
    _IMPORT_ERROR = exc

if TYPE_CHECKING:  # pragma: no cover - imported only for type checkers
    from piper.voice import PiperVoice

LOGGER = logging.getLogger("hr_interview_agent.tts")
DEFAULT_VOICE = os.environ.get("PIPER_DEFAULT_VOICE", "en_US-lessac-high")
_VOICE_CACHE: Dict[str, "PiperVoice"] = {}
_CACHE_LOCK = Lock()


def _candidate_dirs() -> Iterable[Path]:
    roots = []
    env_dir = os.environ.get("PIPER_VOICES_DIR")
    if env_dir:
        roots.append(Path(env_dir))

    server_dir = Path(__file__).resolve().parent
    roots.extend(
        [
            server_dir / "piper_voices",
            server_dir.parent / "piper_voices",
            server_dir.parent.parent / "piper_voices",
            server_dir.parent.parent.parent / "piper_voices",
            Path.cwd() / "piper_voices",
        ]
    )

    seen: set[Path] = set()
    for root in roots:
        if not root:
            continue
        root = root.expanduser()
        if root in seen:
            continue
        seen.add(root)
        if root.exists():
            yield root


def _ensure_ready() -> None:
    if TTS_AVAILABLE:
        return
    raise RuntimeError(
        "Piper TTS is not installed. Run `pip install piper-tts onnxruntime` to enable speech synthesis."
    ) from _IMPORT_ERROR


def _voice_filenames(voice: str) -> Tuple[str, Tuple[str, ...]]:
    voice = voice.strip() or DEFAULT_VOICE
    model_filename = voice if voice.endswith(".onnx") else f"{voice}.onnx"
    base = model_filename[: -len(".onnx")] if model_filename.endswith(".onnx") else model_filename
    config_candidates = (
        f"{model_filename}.json",
        f"{base}.json",
        f"{base}.onnx.json",
    )
    return model_filename, config_candidates


def _resolve_voice_paths(voice: str) -> Tuple[Path, Path]:
    model_filename, config_candidates = _voice_filenames(voice)
    for root in _candidate_dirs():
        model_path = root / model_filename
        if not model_path.exists():
            continue
        for config_name in config_candidates:
            config_path = root / config_name
            if config_path.exists():
                LOGGER.debug("Using Piper voice | voice=%s | model=%s | config=%s", voice, model_path, config_path)
                return model_path, config_path
    raise FileNotFoundError(
        f"Voice '{voice}' not found in any piper_voices directory. Configure PIPER_VOICES_DIR or download the voice model."
    )


def _load_voice(voice: str):
    _ensure_ready()
    with _CACHE_LOCK:
        cached = _VOICE_CACHE.get(voice)
        if cached:
            return cached
        model_path, config_path = _resolve_voice_paths(voice)
        loaded = piper_voice.PiperVoice.load(model_path, config_path)  # type: ignore[attr-defined]
        _VOICE_CACHE[voice] = loaded
        return loaded


def get_piper_voice(voice: Optional[str] = None):
    """Return a cached Piper voice instance."""
    target = (voice or DEFAULT_VOICE).strip() or DEFAULT_VOICE
    return _load_voice(target)


def _prepare_text(text: str | None, ensure_punctuation: bool = True) -> str:
    cleaned = (text or "").strip()
    if ensure_punctuation and cleaned and cleaned[-1] not in ".?!":
        cleaned += "."
    return cleaned


@lru_cache(maxsize=8)
def _load_voice_metadata(voice: str) -> Dict[str, Any]:
    _, config_path = _resolve_voice_paths(voice)
    with open(config_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _synthesize_to_wav_bytes(
    voice_instance,
    text: str,
    *,
    sample_rate: Optional[int] = None,
    length_scale: Optional[float] = None,
    noise_scale: Optional[float] = None,
    noise_w: Optional[float] = None,
) -> bytes:
    _ensure_ready()
    syn_config = None
    if any(value is not None for value in (length_scale, noise_scale, noise_w)):
        syn_config = SynthesisConfig(
            length_scale=length_scale,
            noise_scale=noise_scale,
            noise_w_scale=noise_w,
        )

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice_instance.synthesize_wav(
            text,
            wav_file,
            syn_config=syn_config,
            set_wav_format=True,
        )

    wav_bytes = buffer.getvalue()
    if sample_rate and wav_bytes:
        # wave module already encoded the rate; nothing further required.
        pass
    return wav_bytes


__all__ = [
    "get_piper_voice",
    "_prepare_text",
    "_load_voice_metadata",
    "_synthesize_to_wav_bytes",
    "TTS_AVAILABLE",
]
