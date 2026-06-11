from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_context import (
    ensure_can_use_admin_area,
    get_current_actor,
    is_department_admin_user,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import AuditLog, User


router = APIRouter(
    prefix="/audit",
    tags=["Audit"],
)


def serialize_audit(log: AuditLog):
    return {
        "id": log.id,
        "event_type": log.event_type,
        "actor_username": log.actor_username,
        "target_username": log.target_username,
        "department": log.department,
        "action": log.action,
        "details": log.details,
        "created_at": log.created_at,
    }


@router.get("/")
def get_audit_logs(
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_can_use_admin_area(actor)

    query = db.query(AuditLog)

    if is_department_admin_user(actor) and not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            AuditLog.department == actor_department
        )

    logs = (
        query
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )

    return [serialize_audit(log) for log in logs]


@router.get("/{log_id}")
def get_audit_log(
    log_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_can_use_admin_area(actor)

    log = (
        db.query(AuditLog)
        .filter(AuditLog.id == log_id)
        .first()
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Audit log not found",
        )

    if is_department_admin_user(actor) and not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        if log.department != actor_department:
            raise HTTPException(
                status_code=403,
                detail="You can access only your department audit logs",
            )

    return serialize_audit(log)


@router.delete("/{log_id}")
def delete_audit_log(
    log_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_global_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Only global admin can delete audit logs",
        )

    log = (
        db.query(AuditLog)
        .filter(AuditLog.id == log_id)
        .first()
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="Audit log not found",
        )

    db.delete(log)
    db.commit()

    return {
        "message": "Audit log deleted successfully",
        "deleted_log_id": log_id,
    }


def create_audit_log(
    db: Session,
    event_type: str,
    action: str,
    actor: User | None = None,
    target_username: str | None = None,
    department: str | None = None,
    details: str | None = None,
):
    actor_username = None

    if actor:
        actor_username = actor.username

    normalized_department = normalize_department_name(
        department
    )

    log = AuditLog(
        event_type=event_type,
        actor_username=actor_username,
        target_username=target_username,
        department=normalized_department,
        action=action,
        details=details,
        created_at=datetime.utcnow(),
    )

    db.add(log)
    db.commit()

    return log