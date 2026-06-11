from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_context import (
    ensure_can_manage_department,
    get_current_actor,
    is_global_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import Resource, User
from app.schemas import ResourceCreate, ResourceUpdate


router = APIRouter(
    prefix="/resources",
    tags=["Resources"],
)


POSITION_LEVELS = {
    "employee": 1,
    "deputy_head": 2,
    "department_head": 3,
}


def get_position_level(position: str | None) -> int:
    if not position:
        return 1

    return POSITION_LEVELS.get(position, 1)


def serialize_resource(resource: Resource):
    created_by = resource.created_by

    return {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "required_clearance_level": resource.required_clearance_level,
        "required_position_level": resource.required_position_level,
        "description": resource.description,
        "content": resource.content,
        "created_by_user_id": resource.created_by_user_id,
        "created_by_username": created_by.username if created_by else None,
        "created_by_position": (
            created_by.department_position
            if created_by
            else None
        ),
        "created_by_position_level": (
            get_position_level(created_by.department_position)
            if created_by
            else None
        ),
    }


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


def ensure_same_department(actor: User, resource_department: str):
    if is_global_admin_user(actor):
        return

    actor_department = normalize_department_name(actor.department)
    target_department = normalize_department_name(resource_department)

    if actor_department != target_department:
        raise HTTPException(
            status_code=403,
            detail="You can manage resources only inside your department",
        )


def ensure_can_create_resource(actor: User, target_department: str):
    if is_global_admin_user(actor):
        return

    ensure_same_department(actor, target_department)


def ensure_can_edit_resource(actor: User, resource: Resource):
    if is_global_admin_user(actor):
        return

    ensure_same_department(actor, resource.department)

    if not resource.created_by:
        if actor.department_position == "department_head":
            return

        raise HTTPException(
            status_code=403,
            detail=(
                "Resource has no author. Only department head or global admin "
                "can edit it."
            ),
        )

    actor_level = get_position_level(actor.department_position)
    author_level = get_position_level(resource.created_by.department_position)

    if actor_level >= author_level:
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "You cannot edit resources created by users with higher "
            "department position level"
        ),
    )


@router.get("/")
def get_resources(
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    query = db.query(Resource)

    if not is_global_admin_user(actor):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            Resource.department == actor_department
        )

    resources = query.order_by(Resource.id).all()

    return [serialize_resource(resource) for resource in resources]


@router.get("/{resource_id}")
def get_resource(
    resource_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    resource = get_resource_or_404(resource_id, db)

    ensure_same_department(actor, resource.department)

    return serialize_resource(resource)


@router.post("/")
def create_resource(
    resource: ResourceCreate,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    normalized_department = normalize_department_name(resource.department)

    ensure_can_create_resource(
        actor,
        normalized_department,
    )

    existing_resource = (
        db.query(Resource)
        .filter(Resource.name == resource.name.strip())
        .first()
    )

    if existing_resource:
        raise HTTPException(
            status_code=400,
            detail="Resource with this name already exists",
        )

    new_resource = Resource(
        name=resource.name.strip(),
        department=normalized_department,
        required_clearance_level=resource.required_clearance_level,
        required_position_level=resource.required_position_level,
        description=resource.description,
        content=resource.content,
        created_by_user_id=actor.id,
    )

    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)

    return {
        "message": "Resource created successfully",
        "resource": serialize_resource(new_resource),
    }


@router.put("/{resource_id}")
def update_resource(
    resource_id: int,
    resource_data: ResourceUpdate,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    resource = get_resource_or_404(resource_id, db)

    ensure_can_edit_resource(actor, resource)

    if resource_data.name is not None:
        new_name = resource_data.name.strip()

        if not new_name:
            raise HTTPException(
                status_code=400,
                detail="Resource name cannot be empty",
            )

        existing_resource = (
            db.query(Resource)
            .filter(
                Resource.name == new_name,
                Resource.id != resource_id,
            )
            .first()
        )

        if existing_resource:
            raise HTTPException(
                status_code=400,
                detail="Another resource with this name already exists",
            )

        resource.name = new_name

    if resource_data.department is not None:
        normalized_department = normalize_department_name(
            resource_data.department
        )

        ensure_can_manage_department(
            actor,
            normalized_department,
        )

        resource.department = normalized_department

    if resource_data.required_clearance_level is not None:
        resource.required_clearance_level = (
            resource_data.required_clearance_level
        )

    if resource_data.required_position_level is not None:
        resource.required_position_level = (
            resource_data.required_position_level
        )

    if resource_data.description is not None:
        resource.description = resource_data.description

    if resource_data.content is not None:
        resource.content = resource_data.content

    db.commit()
    db.refresh(resource)

    return {
        "message": "Resource updated successfully",
        "resource": serialize_resource(resource),
    }


@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    resource = get_resource_or_404(resource_id, db)

    ensure_can_edit_resource(actor, resource)

    db.delete(resource)
    db.commit()

    return {
        "message": "Resource deleted successfully",
        "deleted_resource_id": resource_id,
    }