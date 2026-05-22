from fastapi import APIRouter
from pydantic import BaseModel
from services.auth import create_user, _load_users, _save_users

router = APIRouter(prefix="/api/admin", tags=["Users"])

class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: str = "user"

@router.post("/users")
def add_user(req: CreateUserRequest):
    create_user(req.username, req.password, req.role, req.full_name)
    return {"status": "ok", "username": req.username}

@router.get("/users")
def list_users():
    users = _load_users()
    return {"users": [
        {"username": u, "role": d["role"], "full_name": d.get("full_name", "")}
        for u, d in users.items()
    ]}

@router.delete("/users/{username}")
def delete_user(username: str):
    users = _load_users()
    if username in users:
        del users[username]
        _save_users(users)
    return {"status": "ok"}
