"""
Authentification simple JWT.
"""
import json, os, hashlib
from pathlib import Path
from datetime import datetime, timedelta
from jose import jwt, JWTError
from models.user import UserInDB

SECRET_KEY = os.getenv("SECRET_KEY", "formation-ia-secret-2024")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8
USERS_FILE = Path(__file__).parent.parent / "data" / "users.json"

def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _load_users() -> dict:
    if not USERS_FILE.exists():
        return {}
    with open(USERS_FILE) as f:
        return json.load(f)

def _save_users(users: dict):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

def create_user(username: str, password: str, role: str = "user", full_name: str = ""):
    users = _load_users()
    users[username] = {
        "username": username,
        "hashed_password": _hash(password),
        "role": role,
        "full_name": full_name
    }
    _save_users(users)
    print(f"User cree: {username} ({role})")

def authenticate(username: str, password: str):
    users = _load_users()
    if username not in users:
        return None
    user = users[username]
    if user["hashed_password"] != _hash(password):
        return None
    return UserInDB(**user)

def create_token(user: UserInDB) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": user.username, "role": user.role, "name": user.full_name, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def verify_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
