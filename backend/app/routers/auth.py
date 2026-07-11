import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Mocked authentication: any non-empty email/password signs you in.
    A user record is created on first sign-in and a session token is issued."""
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        display = email.split("@")[0].replace(".", " ").replace("_", " ").title()
        user = models.User(email=email, name=display or "Demo User")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = secrets.token_hex(24)
    db.add(models.SessionToken(token=token, user_id=user.id))
    db.commit()
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "name": user.name},
    }


@router.get("/me")
def me(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name}


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        sess = db.get(models.SessionToken, token)
        if sess:
            db.delete(sess)
            db.commit()
    return {"ok": True}
