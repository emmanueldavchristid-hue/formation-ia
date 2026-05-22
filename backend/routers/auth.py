from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.user import LoginRequest, Token
from services.auth import authenticate, create_token, verify_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])
security = HTTPBearer()

@router.post("/login", response_model=Token)
def login(req: LoginRequest):
    user = authenticate(req.username, req.password)
    if not user:
        raise HTTPException(401, "Identifiants incorrects")
    token = create_token(user)
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        full_name=user.full_name
    )

@router.get("/me")
def me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(401, "Token invalide ou expire")
    return {"username": payload["sub"], "role": payload["role"]}

def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials.credentials)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(403, "Acces admin requis")
    return payload

def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(401, "Connexion requise")
    return payload
