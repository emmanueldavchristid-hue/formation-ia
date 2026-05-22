from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    username: str
    role: str  # "admin" ou "user"
    full_name: str = ""

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str

class LoginRequest(BaseModel):
    username: str
    password: str
