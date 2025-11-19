"""
Authentication service.

Helper functions for user authentication and authorization.
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException

from ..data_manager import data_manager


def require_user(user_id: str, expected_role: Optional[str] = None) -> Dict[str, Any]:
    """
    Verify user exists and optionally check role.
    
    Args:
        user_id: User ID to verify
        expected_role: Optional role to enforce (admin/candidate)
        
    Returns:
        User dict if valid
        
    Raises:
        HTTPException: If user not found or unauthorized
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    user = data_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if expected_role and user.get("role") != expected_role:
        raise HTTPException(status_code=403, detail="User is not authorized for this action")
    return user


def require_admin(user_id: str) -> Dict[str, Any]:
    """Verify user is an admin."""
    return require_user(user_id, expected_role="admin")


def require_candidate(user_id: str) -> Dict[str, Any]:
    """Verify user is a candidate."""
    return require_user(user_id, expected_role="candidate")
