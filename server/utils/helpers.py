"""
Utility helper functions used across the application.
"""

from typing import Any, List, Optional
import requests


def normalize_ids(values: Optional[List[Any]]) -> List[str]:
    """Normalize a list of values to string IDs."""
    if not values:
        return []
    return [str(value) for value in values]


def check_ollama_available(
    ollama_base_url: str,
    timeout: Optional[float] = None,
    retries: Optional[int] = None,
    backoff: Optional[float] = None
) -> tuple[bool, str]:
    """
    Probe the OLLAMA endpoint to ensure it's reachable.
    
    Args:
        ollama_base_url: Base URL of the Ollama service
        timeout: Request timeout in seconds
        retries: Number of retry attempts
        backoff: Backoff time between retries
        
    Returns:
        Tuple of (is_available, reason)
    """
    probe_timeout = timeout or 2.0
    probe_retries = retries or 3
    probe_backoff = backoff or 1.0
    
    url = f"{ollama_base_url.rstrip('/')}/api/version"
    last_err = None
    
    for attempt in range(probe_retries):
        try:
            r = requests.get(url, timeout=probe_timeout)
            if r.status_code == 200:
                return True, "ok"
            return False, f"status_code={r.status_code}"
        except Exception as e:
            last_err = e
            if attempt < (probe_retries - 1):
                import time
                time.sleep(probe_backoff)
            continue
    
    return False, str(last_err)


def get_local_ip() -> str:
    """
    Get the primary local IP address of the machine.
    """
    import socket
    try:
        # Connect to an external server (doesn't actually send data) to get the interface IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"
