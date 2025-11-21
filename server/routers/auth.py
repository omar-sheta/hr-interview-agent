"""
Authentication router.

Endpoints for user login, signup, and logout.
"""

from fastapi import APIRouter
from ..models.schemas import LoginRequest, SignUpRequest
from ..data_manager import data_manager

router = APIRouter()


@router.post("/api/login")
async def login(request: LoginRequest):
    """Simple username/password login backed by the database."""
    print(f"--- LOGIN ATTEMPT: username='{request.username}' ---")
    user = data_manager.get_user_by_username(request.username)
    print(f"--- DB LOOKUP RESULT: user={user} ---")
    if not user or user.get("password") != request.password:
        print(f"--- LOGIN FAILED: Invalid credentials for '{request.username}' ---")
        return {"success": False, "message": "Invalid credentials"}
    
    print(f"--- LOGIN SUCCESS: user_id='{user.get('id')}' ---")
    return {
        "success": True,
        "user_id": user.get("id"),
        "role": user.get("role"),
        "username": user.get("username"),
        "avatar_url": user.get("avatar_url"),
        "message": "Login successful"
    }


@router.post("/api/signup")
async def signup(request: SignUpRequest):
    """Register a new candidate user."""
    existing_user = data_manager.get_user_by_username(request.username)
    if existing_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = data_manager.create_user(request.username, request.password, role="candidate", email=request.email)
    if not new_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    return {
        "success": True,
        "message": "User registered successfully. Please log in.",
        "user_id": new_user["id"],
        "username": new_user["username"],
        "role": new_user["role"],
    }


@router.post("/api/logout")
async def logout():
    """Client-driven logout placeholder (no server-side session)."""
    return {"success": True, "message": "Logged out"}
