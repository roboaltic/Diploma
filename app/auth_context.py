import os

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


SUPER_ADMIN_USERNAME = os.getenv("SUPER_ADMIN_USERNAME", "main.admin")
DIRECTOR_USERNAME = os.getenv("DIRECTOR_USERNAME", "director")
DEPUTY_DIRECTOR_USERNAME = os.getenv(
    "DEPUTY_DIRECTOR_USERNAME",
    "deputy.director",
)

SYSTEM_USERNAMES = {
    SUPER_ADMIN_USERNAME,
    DIRECTOR_USERNAME,
    DEPUTY_DIRECTOR_USERNAME,
}


def normalize_department_name(department: str | None) -> str:
    if not department:
        return ""

    return department.strip().lower()


def get_role_names(user: User) -> list[str]:
    return [role.name for role in user.roles]


def is_super_admin_user(user: User) -> bool:
    return user.username == SUPER_ADMIN_USERNAME


def is_director_user(user: User) -> bool:
    return user.username == DIRECTOR_USERNAME


def is_deputy_director_user(user: User) -> bool:
    return user.username == DEPUTY_DIRECTOR_USERNAME


def is_system_user(user: User) -> bool:
    return user.username in SYSTEM_USERNAMES


def get_system_role_name(user: User) -> str | None:
    if is_super_admin_user(user):
        return "main_admin"

    if is_director_user(user):
        return "director"

    if is_deputy_director_user(user):
        return "deputy_director"

    return None


def is_global_admin_user(user: User) -> bool:
    if is_system_user(user):
        return True

    return "admin" in get_role_names(user)


def is_department_admin_user(user: User) -> bool:
    role_names = get_role_names(user)

    return (
        "department_admin" in role_names
        or "department_head" in role_names
        or user.department_position == "department_head"
    )


def can_use_admin_area(user: User) -> bool:
    return is_global_admin_user(user) or is_department_admin_user(user)


def get_current_actor_optional(
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User | None:
    if x_user_id is None:
        return None

    user = db.query(User).filter(User.id == x_user_id).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Current user not found",
        )

    return user


def get_current_actor(
    actor: User | None = Depends(get_current_actor_optional),
) -> User:
    if actor is None:
        raise HTTPException(
            status_code=401,
            detail="X-User-Id header is required",
        )

    return actor


def ensure_can_use_admin_area(actor: User):
    if not can_use_admin_area(actor):
        raise HTTPException(
            status_code=403,
            detail="Admin or department admin access required",
        )


def require_global_admin_actor(
    actor: User = Depends(get_current_actor),
) -> User:
    if not is_global_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Global admin access required",
        )

    return actor


def ensure_can_see_user(actor: User, target_user: User):
    if is_system_user(target_user) and not is_super_admin_user(actor):
        if actor.id == target_user.id:
            return

        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if is_global_admin_user(actor):
        return

    if actor.id == target_user.id:
        return

    if is_department_admin_user(actor):
        actor_department = normalize_department_name(actor.department)
        target_department = normalize_department_name(target_user.department)

        if actor_department == target_department:
            return

    raise HTTPException(
        status_code=403,
        detail="You can see only users from your own department",
    )


def ensure_can_modify_user(actor: User, target_user: User):
    if is_system_user(target_user) and not is_super_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Only main.admin can modify system users",
        )

    if is_global_admin_user(actor):
        return

    if is_department_admin_user(actor):
        actor_department = normalize_department_name(actor.department)
        target_department = normalize_department_name(target_user.department)

        if actor_department == target_department:
            return

    raise HTTPException(
        status_code=403,
        detail="Department admin can modify only users from own department",
    )


def ensure_can_manage_department(actor: User, target_department: str):
    if is_global_admin_user(actor):
        return

    if not is_department_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Department admin access required",
        )

    actor_department = normalize_department_name(actor.department)
    target_department = normalize_department_name(target_department)

    if actor_department != target_department:
        raise HTTPException(
            status_code=403,
            detail="Department admin can manage only own department",
        )


def ensure_not_deleting_system_user(target_user: User):
    if is_system_user(target_user):
        raise HTTPException(
            status_code=403,
            detail="System users cannot be deleted",
        )


def ensure_not_deleting_super_admin(target_user: User):
    ensure_not_deleting_system_user(target_user)