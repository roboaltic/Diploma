from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access_policy import evaluate_access
from app.auth_context import (
    get_current_actor,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import AuditLog, Resource, User
from app.schemas import AccessCheckRequest


router = APIRouter(
    prefix="/access",
    tags=["Access Control"],
)


def get_user_or_404(user_id: int, db: Session) -> User:
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


def get_resource_or_404(resource_id: int, db: Session) -> Resource:
    resource = (
        db.query(Resource)
        .filter(Resource.id == resource_id)
        .first()
    )

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Resource not found",
        )

    return resource


def ensure_actor_can_check_access(
    actor: User,
    target_user: User,
    resource: Resource,
):
    if is_global_admin_user(actor):
        return

    actor_department = normalize_department_name(actor.department)
    target_user_department = normalize_department_name(target_user.department)
    resource_department = normalize_department_name(resource.department)

    if (
        actor_department == target_user_department
        and actor_department == resource_department
    ):
        return

    raise HTTPException(
        status_code=403,
        detail="You can check access only inside your own department",
    )


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "department": user.department,
        "department_position": user.department_position,
        "clearance_level": user.clearance_level,
        "roles": [role.name for role in user.roles],
    }


def serialize_resource(resource: Resource, include_content: bool = False):
    created_by = getattr(resource, "created_by", None)

    data = {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "required_clearance_level": resource.required_clearance_level,
        "required_position_level": resource.required_position_level,
        "description": resource.description,
        "created_by_username": created_by.username if created_by else None,
        "created_by_position": (
            created_by.department_position
            if created_by
            else None
        ),
    }

    if include_content:
        data["content"] = getattr(resource, "content", None)

    return data


@router.post("/check")
def check_access(
    access_data: AccessCheckRequest,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(
        user_id=access_data.user_id,
        db=db,
    )

    resource = get_resource_or_404(
        resource_id=access_data.resource_id,
        db=db,
    )

    ensure_actor_can_check_access(
        actor=actor,
        target_user=user,
        resource=resource,
    )

    action = access_data.action

    access_granted, reason = evaluate_access(
        user=user,
        resource=resource,
        action=action,
    )

    audit_log = AuditLog(
        event_type="ACCESS_GRANTED" if access_granted else "ACCESS_DENIED",
        actor_username=actor.username,
        target_username=user.username,
        department=resource.department,
        action=action,
        details=(
            f"user={user.username}; "
            f"resource={resource.name}; "
            f"result={'granted' if access_granted else 'denied'}; "
            f"reason={reason}"
        ),
        created_at=datetime.utcnow(),
    )

    db.add(audit_log)
    db.commit()

    return {
        "access_granted": access_granted,
        "reason": reason,
        "user": serialize_user(user),
        "resource": serialize_resource(
            resource,
            include_content=access_granted,
        ),
        "action": action,
    }