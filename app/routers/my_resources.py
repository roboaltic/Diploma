from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth_context import (
    get_current_actor,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import CrossDepartmentAccessRequest, Resource, User


router = APIRouter(
    prefix="/my-resources",
    tags=["My Resources"],
)


def get_resource_clearance(resource: Resource) -> int:
    return (
        getattr(resource, "required_clearance_level", None)
        or getattr(resource, "classification_level", None)
        or 1
    )


def get_resource_position_level(resource: Resource):
    return getattr(resource, "required_position_level", None)


def get_resource_content(resource: Resource) -> str:
    content = (
        getattr(resource, "content", None)
        or getattr(resource, "description", None)
        or getattr(resource, "body", None)
    )

    if content:
        return content

    return (
        f"Документ: {resource.name}\n"
        f"Департамент: {resource.department}\n"
        f"Рівень MAC: {get_resource_clearance(resource)}\n\n"
        "Вміст документа не задано в базі даних, тому відображаються його метадані."
    )


def serialize_available_resource(
    resource: Resource,
    access_type: str,
    access_label: str,
    access_action: str = "read",
    access_request_id: int | None = None,
):
    return {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "type": getattr(resource, "type", None),
        "required_clearance_level": get_resource_clearance(resource),
        "required_position_level": get_resource_position_level(resource),
        "created_by_user_id": getattr(resource, "created_by_user_id", None),
        "content": get_resource_content(resource),
        "access_type": access_type,
        "access_label": access_label,
        "access_action": access_action,
        "access_request_id": access_request_id,
        "temporary_access": access_type == "temporary_cross_department",
    }


@router.get("/")
def get_my_available_resources(
    actor: User = Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    actor_department = normalize_department_name(actor.department)
    actor_clearance = actor.clearance_level or 1

    result = []

    own_department_resources = (
        db.query(Resource)
        .filter(
            func.lower(Resource.department) == actor_department,
            func.lower(Resource.department) != "system",
        )
        .order_by(Resource.id.asc())
        .all()
    )

    for resource in own_department_resources:
        required_clearance = get_resource_clearance(resource)

        if is_global_admin_user(actor) or actor_clearance >= required_clearance:
            result.append(
                serialize_available_resource(
                    resource=resource,
                    access_type="department_standard",
                    access_label="доступний ресурс департаменту",
                    access_action="read",
                )
            )

    temporary_accesses = (
        db.query(CrossDepartmentAccessRequest)
        .join(Resource, Resource.id == CrossDepartmentAccessRequest.resource_id)
        .filter(
            CrossDepartmentAccessRequest.user_id == actor.id,
            CrossDepartmentAccessRequest.status == "approved",
            func.lower(Resource.department) != actor_department,
            func.lower(Resource.department) != "system",
        )
        .order_by(CrossDepartmentAccessRequest.created_at.desc())
        .all()
    )

    existing_resource_ids = {item["id"] for item in result}

    for access_item in temporary_accesses:
        resource = access_item.resource

        if not resource:
            continue

        if resource.id in existing_resource_ids:
            continue

        result.append(
            serialize_available_resource(
                resource=resource,
                access_type="temporary_cross_department",
                access_label="тимчасовий доступ",
                access_action=access_item.action,
                access_request_id=access_item.id,
            )
        )

    return result