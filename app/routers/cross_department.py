from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth_context import (
    get_current_actor,
    is_department_admin_user,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import CrossDepartmentAccessRequest, Resource, User
from app.schemas import (
    CrossDepartmentAccessRequestCreate,
    CrossDepartmentAccessRequestResolve,
)


router = APIRouter(
    prefix="/cross-department-access",
    tags=["Cross Department Access"],
)


ALLOWED_ACTIONS = {
    "read",
    "write",
}


def get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")

    return user


def get_resource_or_404(resource_id: int, db: Session) -> Resource:
    resource = db.query(Resource).filter(Resource.id == resource_id).first()

    if not resource:
        raise HTTPException(status_code=404, detail="Ресурс не знайдено")

    return resource


def get_request_or_404(
    request_id: int,
    db: Session,
) -> CrossDepartmentAccessRequest:
    request = (
        db.query(CrossDepartmentAccessRequest)
        .filter(CrossDepartmentAccessRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Запит міждепартаментного доступу не знайдено",
        )

    return request


def is_department_head_like(user: User) -> bool:
    return (
        is_global_admin_user(user)
        or is_department_admin_user(user)
        or user.department_position == "department_head"
    )


def get_department_label(department: str | None) -> str:
    labels = {
        "hr": "HR-відділ",
        "finance": "фінансовий відділ",
        "lawyer": "юридичний відділ",
        "engineer": "інженерний відділ",
        "system": "системний департамент",
    }

    normalized = normalize_department_name(department)
    return labels.get(normalized, department or "—")


def get_action_label(action: str | None) -> str:
    labels = {
        "read": "перегляд",
        "write": "редагування",
    }

    return labels.get(action or "", action or "—")


def ensure_can_create_cross_department_request(
    actor: User,
    target_user: User,
    resource: Resource,
):
    if not is_department_head_like(actor):
        raise HTTPException(
            status_code=403,
            detail="Створювати міждепартаментні запити може тільки начальник департаменту, адміністратор департаменту або головний адміністратор",
        )

    if is_global_admin_user(actor):
        return

    actor_department = normalize_department_name(actor.department)
    target_user_department = normalize_department_name(target_user.department)
    resource_department = normalize_department_name(resource.department)

    if actor_department != target_user_department:
        raise HTTPException(
            status_code=403,
            detail="Можна створювати запит тільки для користувачів свого департаменту",
        )

    if actor_department == resource_department:
        raise HTTPException(
            status_code=400,
            detail="Цей ресурс уже належить вашому департаменту",
        )

    if resource_department == "system":
        raise HTTPException(
            status_code=403,
            detail="До ресурсів системного департаменту не можна створювати міждепартаментний запит",
        )


def ensure_can_resolve_request(
    actor: User,
    request: CrossDepartmentAccessRequest,
):
    if is_global_admin_user(actor):
        return

    if not is_department_head_like(actor):
        raise HTTPException(
            status_code=403,
            detail="Погоджувати або відхиляти запит може тільки начальник цільового департаменту або головний адміністратор",
        )

    actor_department = normalize_department_name(actor.department)
    target_department = normalize_department_name(request.target_department)

    if actor_department != target_department:
        raise HTTPException(
            status_code=403,
            detail="Можна погоджувати тільки запити до свого департаменту",
        )


def ensure_can_revoke_request(
    actor: User,
    request: CrossDepartmentAccessRequest,
):
    if is_global_admin_user(actor):
        return

    if not is_department_head_like(actor):
        raise HTTPException(
            status_code=403,
            detail="Відкликати доступ може тільки начальник пов’язаного департаменту або головний адміністратор",
        )

    actor_department = normalize_department_name(actor.department)

    if actor_department not in [
        normalize_department_name(request.source_department),
        normalize_department_name(request.target_department),
    ]:
        raise HTTPException(
            status_code=403,
            detail="Можна відкликати тільки доступ, пов’язаний із вашим департаментом",
        )


def ensure_can_view_request(
    actor: User,
    request: CrossDepartmentAccessRequest,
):
    if is_global_admin_user(actor):
        return

    actor_department = normalize_department_name(actor.department)

    if actor_department in [
        normalize_department_name(request.source_department),
        normalize_department_name(request.target_department),
    ]:
        return

    if actor.id == request.user_id:
        return

    raise HTTPException(
        status_code=403,
        detail="Ви не можете переглядати цей запит",
    )


def find_department_head(
    department: str,
    db: Session,
) -> User | None:
    normalized_department = normalize_department_name(department)

    return (
        db.query(User)
        .filter(
            func.lower(User.department) == normalized_department,
            User.department_position == "department_head",
        )
        .order_by(User.id)
        .first()
    )


def serialize_request(request: CrossDepartmentAccessRequest):
    requester = request.requester_head
    target_head = request.target_head
    target_user = request.user
    resource = request.resource

    return {
        "id": request.id,
        "requester_head_id": request.requester_head_id,
        "requester_head_username": requester.username if requester else None,
        "target_head_id": request.target_head_id,
        "target_head_username": target_head.username if target_head else None,
        "user_id": request.user_id,
        "user_username": target_user.username if target_user else None,
        "username": target_user.username if target_user else None,
        "resource_id": request.resource_id,
        "resource_name": resource.name if resource else None,
        "source_department": request.source_department,
        "target_department": request.target_department,
        "action": request.action,
        "reason": request.reason,
        "status": request.status,
        "response_comment": request.response_comment,
        "created_at": request.created_at,
        "resolved_at": request.resolved_at,
    }


def build_sender_alert(
    request: CrossDepartmentAccessRequest,
    target_user: User,
    resource: Resource,
    target_head: User | None,
    mac_warning: str | None = None,
    already_exists: bool = False,
) -> str:
    action_label = get_action_label(request.action)
    target_department_label = get_department_label(request.target_department)
    target_head_name = (
        target_head.username
        if target_head
        else "начальник цільового департаменту"
    )

    if already_exists:
        base = (
            f"Такий запит уже існує та очікує погодження. "
            f"Користувач: {target_user.username}. "
            f"Ресурс: {resource.name}. "
            f"Дія: {action_label}. "
            f"Погоджує: {target_head_name} ({target_department_label})."
        )
    else:
        base = (
            f"Запит на доступ успішно створено та надіслано на погодження. "
            f"Користувач: {target_user.username}. "
            f"Ресурс: {resource.name}. "
            f"Дія: {action_label}. "
            f"Погоджує: {target_head_name} ({target_department_label})."
        )

    if mac_warning:
        return f"{base} {mac_warning}"

    return base


@router.get("/")
def get_requests(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    query = db.query(CrossDepartmentAccessRequest)

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            (
                CrossDepartmentAccessRequest.source_department
                == actor_department
            )
            | (
                CrossDepartmentAccessRequest.target_department
                == actor_department
            )
            | (
                CrossDepartmentAccessRequest.user_id
                == actor.id
            )
        )

    requests = (
        query
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    return [serialize_request(request) for request in requests]


@router.get("/incoming")
def get_incoming_requests(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_department_head_like(actor):
        raise HTTPException(
            status_code=403,
            detail="Переглядати вхідні запити може тільки начальник департаменту або головний адміністратор",
        )

    query = db.query(CrossDepartmentAccessRequest)

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            CrossDepartmentAccessRequest.target_department == actor_department
        )

    requests = (
        query
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    return [serialize_request(request) for request in requests]


@router.get("/outgoing")
def get_outgoing_requests(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_department_head_like(actor):
        raise HTTPException(
            status_code=403,
            detail="Переглядати вихідні запити може тільки начальник департаменту або головний адміністратор",
        )

    query = db.query(CrossDepartmentAccessRequest)

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            CrossDepartmentAccessRequest.source_department == actor_department
        )

    requests = (
        query
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    return [serialize_request(request) for request in requests]


@router.get("/active")
def get_active_permissions(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    query = db.query(CrossDepartmentAccessRequest).filter(
        CrossDepartmentAccessRequest.status == "approved"
    )

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            (
                CrossDepartmentAccessRequest.source_department
                == actor_department
            )
            | (
                CrossDepartmentAccessRequest.target_department
                == actor_department
            )
            | (
                CrossDepartmentAccessRequest.user_id
                == actor.id
            )
        )

    requests = (
        query
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    return [serialize_request(request) for request in requests]


@router.get("/department-users")
def get_department_users(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_department_head_like(actor):
        return []

    actor_department = normalize_department_name(actor.department)

    users = (
        db.query(User)
        .filter(
            func.lower(User.department) == actor_department,
            func.lower(User.department) != "system",
            User.id != actor.id,
        )
        .order_by(User.department_position.asc(), User.id.asc())
        .all()
    )

    return [
        {
            "id": user.id,
            "username": user.username,
            "department": user.department,
            "department_position": user.department_position,
            "clearance_level": user.clearance_level,
        }
        for user in users
    ]


@router.get("/available-resources")
def get_available_cross_department_resources(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_department_head_like(actor):
        return []

    actor_department = normalize_department_name(actor.department)

    resources = (
        db.query(Resource)
        .filter(
            func.lower(Resource.department) != actor_department,
            func.lower(Resource.department) != "system",
        )
        .order_by(Resource.department.asc(), Resource.id.asc())
        .all()
    )

    result = []

    for resource in resources:
        author = None

        if getattr(resource, "created_by_user_id", None):
            author = (
                db.query(User)
                .filter(User.id == resource.created_by_user_id)
                .first()
            )

        result.append(
            {
                "id": resource.id,
                "name": resource.name,
                "department": resource.department,
                "required_clearance_level": resource.required_clearance_level,
                "required_position_level": getattr(
                    resource,
                    "required_position_level",
                    None,
                ),
                "created_by_user_id": getattr(
                    resource,
                    "created_by_user_id",
                    None,
                ),
                "created_by_username": author.username if author else None,
            }
        )

    return result


@router.get("/approved-resources")
def get_approved_cross_department_resources(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    actor_department = normalize_department_name(actor.department)

    query = (
        db.query(CrossDepartmentAccessRequest)
        .join(Resource, Resource.id == CrossDepartmentAccessRequest.resource_id)
        .filter(
            CrossDepartmentAccessRequest.status == "approved",
            func.lower(Resource.department) != actor_department,
            func.lower(Resource.department) != "system",
        )
    )

    if not is_global_admin_user(actor):
        if is_department_head_like(actor):
            query = query.filter(
                CrossDepartmentAccessRequest.source_department == actor_department
            )
        else:
            query = query.filter(
                CrossDepartmentAccessRequest.user_id == actor.id
            )

    approved_requests = (
        query
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    result = []

    for request in approved_requests:
        resource = request.resource
        target_user = request.user

        if not resource:
            continue

        result.append(
            {
                "id": resource.id,
                "name": resource.name,
                "department": resource.department,
                "required_clearance_level": resource.required_clearance_level,
                "required_position_level": getattr(
                    resource,
                    "required_position_level",
                    None,
                ),
                "created_by_user_id": getattr(
                    resource,
                    "created_by_user_id",
                    None,
                ),
                "temporary_access": True,
                "access_label": "тимчасовий доступ",
                "access_request_id": request.id,
                "access_action": request.action,
                "access_for_user_id": request.user_id,
                "access_for_username": target_user.username if target_user else None,
                "source_department": request.source_department,
                "target_department": request.target_department,
            }
        )

    return result


@router.get("/{request_id}")
def get_request(
    request_id: int,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    request = get_request_or_404(request_id, db)

    ensure_can_view_request(actor, request)

    return serialize_request(request)


@router.post("/")
def create_request(
    request_data: CrossDepartmentAccessRequestCreate,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if request_data.action not in ALLOWED_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail="Міждепартаментний доступ підтримує тільки дії перегляду або редагування",
        )

    target_user = get_user_or_404(
        user_id=request_data.user_id,
        db=db,
    )

    resource = get_resource_or_404(
        resource_id=request_data.resource_id,
        db=db,
    )

    ensure_can_create_cross_department_request(
        actor=actor,
        target_user=target_user,
        resource=resource,
    )

    source_department = normalize_department_name(target_user.department)
    target_department = normalize_department_name(resource.department)

    target_head = find_department_head(
        department=target_department,
        db=db,
    )

    mac_warning = None

    if target_user.clearance_level < resource.required_clearance_level:
        mac_warning = (
            "Увага: рівня MAC користувача недостатньо для цього ресурсу. "
            "Запит створено, але після погодження фінальний доступ може бути заблокований MAC-перевіркою."
        )

    existing_request = (
        db.query(CrossDepartmentAccessRequest)
        .filter(
            CrossDepartmentAccessRequest.user_id == target_user.id,
            CrossDepartmentAccessRequest.resource_id == resource.id,
            CrossDepartmentAccessRequest.action == request_data.action,
            CrossDepartmentAccessRequest.status.in_(["pending", "approved"]),
        )
        .first()
    )

    if existing_request:
        alert_message = build_sender_alert(
            request=existing_request,
            target_user=target_user,
            resource=resource,
            target_head=target_head,
            mac_warning=mac_warning,
            already_exists=True,
        )

        return {
            "message": "Такий запит уже існує",
            "alert_message": alert_message,
            "already_exists": True,
            "mac_warning": mac_warning,
            "request": serialize_request(existing_request),
        }

    request = CrossDepartmentAccessRequest(
        requester_head_id=actor.id,
        target_head_id=target_head.id if target_head else None,
        user_id=target_user.id,
        resource_id=resource.id,
        source_department=source_department,
        target_department=target_department,
        action=request_data.action,
        reason=request_data.reason,
        status="pending",
        created_at=datetime.utcnow(),
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    alert_message = build_sender_alert(
        request=request,
        target_user=target_user,
        resource=resource,
        target_head=target_head,
        mac_warning=mac_warning,
        already_exists=False,
    )

    return {
        "message": "Запит на міждепартаментний доступ створено",
        "alert_message": alert_message,
        "already_exists": False,
        "mac_warning": mac_warning,
        "request": serialize_request(request),
    }


@router.post("/{request_id}/approve")
def approve_request(
    request_id: int,
    resolve_data: CrossDepartmentAccessRequestResolve,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    request = get_request_or_404(request_id, db)

    ensure_can_resolve_request(actor, request)

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Погодити можна тільки запит зі статусом pending",
        )

    request.status = "approved"
    request.target_head_id = actor.id
    request.response_comment = resolve_data.response_comment
    request.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(request)

    return {
        "message": "Запит погоджено",
        "request": serialize_request(request),
    }


@router.post("/{request_id}/reject")
def reject_request(
    request_id: int,
    resolve_data: CrossDepartmentAccessRequestResolve,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    request = get_request_or_404(request_id, db)

    ensure_can_resolve_request(actor, request)

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Відхилити можна тільки запит зі статусом pending",
        )

    request.status = "rejected"
    request.target_head_id = actor.id
    request.response_comment = resolve_data.response_comment
    request.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(request)

    return {
        "message": "Запит відхилено",
        "request": serialize_request(request),
    }


@router.post("/{request_id}/revoke")
def revoke_request(
    request_id: int,
    resolve_data: CrossDepartmentAccessRequestResolve,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    request = get_request_or_404(request_id, db)

    ensure_can_revoke_request(actor, request)

    if request.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Відкликати можна тільки погоджений доступ",
        )

    request.status = "revoked"
    request.response_comment = resolve_data.response_comment
    request.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(request)

    return {
        "message": "Доступ відкликано",
        "request": serialize_request(request),
    }