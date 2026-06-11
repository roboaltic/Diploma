from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access_policy import evaluate_access
from app.auth_context import (
    get_current_actor,
    is_department_admin_user,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import AuditLog, Department, Resource, Role, User


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "clearance_level": user.clearance_level,
        "department": user.department,
        "department_position": user.department_position,
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
    created_by = getattr(resource, "created_by", None)

    return {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "required_clearance_level": resource.required_clearance_level,
        "required_position_level": resource.required_position_level,
        "description": resource.description,
        "created_by_username": created_by.username if created_by else None,
        "created_by_position": (
            created_by.department_position if created_by else None
        ),
    }


@router.get("/admin")
def get_admin_dashboard(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    if not is_global_admin_user(actor) and not is_department_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Admin or department admin access required",
        )

    users_query = db.query(User)
    resources_query = db.query(Resource)
    roles_query = db.query(Role)
    departments_query = db.query(Department)
    audit_query = db.query(AuditLog)

    dashboard_title = "Адміністративна панель"
    dashboard_mode = "global"

    if is_department_admin_user(actor) and not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        users_query = users_query.filter(User.department == actor_department)
        resources_query = resources_query.filter(
            Resource.department == actor_department
        )

        if hasattr(Role, "department"):
            roles_query = roles_query.filter(
                Role.department.in_([actor_department, "system"])
            )

        departments_query = departments_query.filter(
            Department.name == actor_department
        )

        if hasattr(AuditLog, "department"):
            audit_query = audit_query.filter(
                AuditLog.department == actor_department
            )

        dashboard_title = f"Панель департаменту {actor_department}"
        dashboard_mode = "department"

    users_count = users_query.count()
    resources_count = resources_query.count()
    roles_count = roles_query.count()
    departments_count = departments_query.count()
    audit_logs_count = audit_query.count()

    departments = departments_query.order_by(Department.name).all()

    department_stats = []

    for department in departments:
        department_name = normalize_department_name(department.name)

        department_stats.append(
            {
                "name": department_name,
                "description": department.description,
                "users_count": (
                    db.query(User)
                    .filter(User.department == department_name)
                    .count()
                ),
                "resources_count": (
                    db.query(Resource)
                    .filter(Resource.department == department_name)
                    .count()
                ),
            }
        )

    return {
        "title": dashboard_title,
        "mode": dashboard_mode,
        "current_department": actor.department,
        "stats": {
            "users_count": users_count,
            "roles_count": roles_count,
            "resources_count": resources_count,
            "departments_count": departments_count,
            "audit_logs_count": audit_logs_count,
        },
        "departments": department_stats,
    }


@router.get("/user/{user_id}")
def get_user_dashboard(
    user_id: int,
    include_denied: bool = False,
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if not is_global_admin_user(actor):
        if actor.id != user.id:
            raise HTTPException(
                status_code=403,
                detail="You can open only your own user panel",
            )

    resources_query = db.query(Resource)

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        resources_query = resources_query.filter(
            Resource.department == actor_department
        )

    resources = resources_query.order_by(Resource.id).all()

    available_resources = []
    denied_resources = []

    for resource in resources:
        access_granted, reason = evaluate_access(
            user=user,
            resource=resource,
            action="read",
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
        "available_resources": available_resources,
        "available_count": len(available_resources),
    }

    if include_denied:
        response["denied_resources"] = denied_resources
        response["denied_count"] = len(denied_resources)

    return response