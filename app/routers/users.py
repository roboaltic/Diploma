import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.access_policy import evaluate_access
from app.auth_context import (
    SUPER_ADMIN_USERNAME,
    ensure_can_manage_department,
    ensure_can_modify_user,
    ensure_can_see_user,
    ensure_can_use_admin_area,
    ensure_not_deleting_super_admin,
    get_current_actor,
    get_current_actor_optional,
    is_department_admin_user,
    is_global_admin_user,
    is_super_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import Resource, Role, User
from app.schemas import PasswordResetRequest, UserCreate, UserUpdate
from app.security import hash_password


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


PRIVILEGED_ROLE_NAMES = {
    "admin",
}


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "clearance_level": user.clearance_level,
        "department": user.department,
        "department_position": user.department_position,
        "is_super_admin": is_super_admin_user(user),
        "roles": [
            {
                "id": role.id,
                "name": role.name,
                "description": role.description,
            }
            for role in user.roles
        ],
    }


def serialize_resource(resource: Resource):
    return {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "required_clearance_level": resource.required_clearance_level,
        "required_position_level": resource.required_position_level,
        "description": resource.description,
    }


def get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


def get_roles_by_ids(role_ids: list[int], db: Session) -> list[Role]:
    if not role_ids:
        return []

    roles = (
        db.query(Role)
        .filter(Role.id.in_(role_ids))
        .all()
    )

    if len(roles) != len(role_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more roles were not found",
        )

    return roles


def ensure_department_admin_can_assign_roles(actor: User, roles: list[Role]):
    if is_global_admin_user(actor):
        return

    for role in roles:
        if role.name in PRIVILEGED_ROLE_NAMES:
            raise HTTPException(
                status_code=403,
                detail="Department admin cannot assign global admin role",
            )


def ensure_department_admin_can_use_position(actor: User, position: str | None):
    if is_global_admin_user(actor):
        return

    if position == "department_head":
        raise HTTPException(
            status_code=403,
            detail="Department admin cannot assign department_head position",
        )


def ensure_actor_can_manage_users(actor: User):
    ensure_can_use_admin_area(actor)


@router.get("/")
def get_users(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_actor_can_manage_users(actor)

    query = db.query(User)

    if is_super_admin_user(actor):
        users = query.order_by(User.id).all()
        return [serialize_user(user) for user in users]

    query = query.filter(User.username != SUPER_ADMIN_USERNAME)

    if is_global_admin_user(actor):
        users = query.order_by(User.id).all()
        return [serialize_user(user) for user in users]

    if is_department_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        users = (
            query
            .filter(User.department == actor_department)
            .order_by(User.id)
            .all()
        )

        return [serialize_user(user) for user in users]

    raise HTTPException(
        status_code=403,
        detail="Admin access required",
    )


@router.get("/{user_id}/available-resources")
def get_available_resources_for_user(
    user_id: int,
    action: str = Query(default="read"),
    include_denied: bool = Query(default=False),
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(user_id, db)
    ensure_can_see_user(actor, user)

    resources_query = db.query(Resource)

    if is_department_admin_user(actor) and not is_global_admin_user(actor):
        resources_query = resources_query.filter(
            Resource.department == normalize_department_name(actor.department)
        )

    resources = resources_query.all()

    available_resources = []
    denied_resources = []

    for resource in resources:
        access_granted, reason = evaluate_access(
            user=user,
            resource=resource,
            action=action,
        )

        resource_data = serialize_resource(resource)
        resource_data["access_granted"] = access_granted
        resource_data["reason"] = reason

        if access_granted:
            available_resources.append(resource_data)
        else:
            denied_resources.append(resource_data)

    response = {
        "user": serialize_user(user),
        "action": action,
        "available_count": len(available_resources),
        "available_resources": available_resources,
    }

    if include_denied:
        response["denied_count"] = len(denied_resources)
        response["denied_resources"] = denied_resources

    return response


@router.get("/{user_id}")
def get_user(
    user_id: int,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(user_id, db)
    ensure_can_see_user(actor, user)

    return serialize_user(user)


@router.post("/")
def create_user(
    user_data: UserCreate,
    actor: User | None = Depends(get_current_actor_optional),
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.username == user_data.username)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this username already exists",
        )

    is_creating_super_admin = user_data.username == SUPER_ADMIN_USERNAME

    if is_creating_super_admin:
        existing_super_admin = (
            db.query(User)
            .filter(User.username == SUPER_ADMIN_USERNAME)
            .first()
        )

        if existing_super_admin:
            raise HTTPException(
                status_code=400,
                detail="main.admin already exists",
            )

        roles = []
    else:
        if actor is None:
            raise HTTPException(
                status_code=401,
                detail="X-User-Id header is required",
            )

        ensure_actor_can_manage_users(actor)
        ensure_can_manage_department(actor, user_data.department)
        ensure_department_admin_can_use_position(
            actor,
            user_data.department_position.value,
        )

        roles = get_roles_by_ids(user_data.role_ids, db)
        ensure_department_admin_can_assign_roles(actor, roles)

    new_user = User(
        username=user_data.username,
        password_hash=hash_password(user_data.password),
        clearance_level=user_data.clearance_level,
        department=normalize_department_name(user_data.department),
        department_position=user_data.department_position.value,
    )

    new_user.roles = roles

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "user": serialize_user(new_user),
    }


@router.put("/{user_id}")
def update_user(
    user_id: int,
    user_data: UserUpdate,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_actor_can_manage_users(actor)

    user = get_user_or_404(user_id, db)

    ensure_can_modify_user(actor, user)

    target_department_after_update = (
        user_data.department
        if user_data.department is not None
        else user.department
    )

    ensure_can_manage_department(actor, user.department)
    ensure_can_manage_department(actor, target_department_after_update)

    if user_data.username is not None:
        if is_super_admin_user(user) and user_data.username != SUPER_ADMIN_USERNAME:
            raise HTTPException(
                status_code=403,
                detail="main.admin username cannot be changed",
            )

        existing_user = (
            db.query(User)
            .filter(
                User.username == user_data.username,
                User.id != user_id,
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Another user with this username already exists",
            )

        user.username = user_data.username

    if user_data.password is not None:
        user.password_hash = hash_password(user_data.password)

    if user_data.clearance_level is not None:
        user.clearance_level = user_data.clearance_level

    if user_data.department is not None:
        user.department = normalize_department_name(user_data.department)

    if user_data.department_position is not None:
        ensure_department_admin_can_use_position(
            actor,
            user_data.department_position.value,
        )

        user.department_position = user_data.department_position.value

    if user_data.role_ids is not None:
        if is_super_admin_user(user) and not is_super_admin_user(actor):
            raise HTTPException(
                status_code=403,
                detail="Only main.admin can change main.admin roles",
            )

        roles = get_roles_by_ids(user_data.role_ids, db)
        ensure_department_admin_can_assign_roles(actor, roles)

        user.roles = roles

    db.commit()
    db.refresh(user)

    return {
        "message": "User updated successfully",
        "user": serialize_user(user),
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_actor_can_manage_users(actor)

    user = get_user_or_404(user_id, db)

    ensure_can_modify_user(actor, user)
    ensure_not_deleting_super_admin(user)
    ensure_can_manage_department(actor, user.department)

    if actor.id == user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot delete your own account",
        )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully",
        "deleted_user_id": user_id,
    }


def generate_temporary_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    password_data: PasswordResetRequest,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_actor_can_manage_users(actor)

    user = get_user_or_404(user_id, db)

    ensure_can_modify_user(actor, user)
    ensure_can_manage_department(actor, user.department)

    if password_data.new_password:
        new_password = password_data.new_password
        generated = False
    elif password_data.generate_temporary:
        new_password = generate_temporary_password()
        generated = True
    else:
        raise HTTPException(
            status_code=400,
            detail="Password was not provided and generation is disabled",
        )

    user.password_hash = hash_password(new_password)

    db.commit()
    db.refresh(user)

    return {
        "message": "Password reset successfully",
        "user_id": user.id,
        "username": user.username,
        "generated": generated,
        "temporary_password": new_password,
        "warning": (
            "Show this password to the user only once. "
            "It is stored in the database only as a hash."
        ),
    }