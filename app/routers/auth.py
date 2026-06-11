from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_context import (
    get_system_role_name,
    is_department_admin_user,
    is_deputy_director_user,
    is_director_user,
    is_global_admin_user,
    is_super_admin_user,
)
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest
from app.security import verify_password


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def serialize_user(user: User):
    roles = [role.name for role in user.roles]

    is_super_admin = is_super_admin_user(user)
    is_director = is_director_user(user)
    is_deputy_director = is_deputy_director_user(user)
    is_admin = is_global_admin_user(user)
    is_department_admin = is_department_admin_user(user)

    return {
        "id": user.id,
        "username": user.username,
        "department": user.department,
        "department_position": user.department_position,
        "clearance_level": user.clearance_level,
        "roles": roles,
        "system_role": get_system_role_name(user),
        "is_admin": is_admin,
        "is_super_admin": is_super_admin,
        "is_director": is_director,
        "is_deputy_director": is_deputy_director,
        "is_department_admin": is_department_admin,
        "default_panel": "admin" if is_admin or is_department_admin else "user",
    }


@router.post("/login")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.username == login_data.username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    return {
        "message": "Login successful",
        "user": serialize_user(user),
    }