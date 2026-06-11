from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_context import (
    ensure_can_manage_department,
    ensure_can_use_admin_area,
    get_current_actor,
    is_department_admin_user,
    is_global_admin_user,
    is_super_admin_user,
    normalize_department_name,
)
from app.database import get_db
from app.models import Role
from app.schemas import RoleCreate, RoleUpdate


router = APIRouter(
    prefix="/roles",
    tags=["Roles"],
)


PROTECTED_ROLE_NAMES = {
    "admin",
    "department_admin",
    "department_head",
}


def role_has_department_field() -> bool:
    return hasattr(Role, "department")


def get_role_department(role: Role) -> str | None:
    if not role_has_department_field():
        return None

    return getattr(role, "department", None)


def get_payload_department(payload, actor) -> str | None:
    department = getattr(payload, "department", None)

    if department:
        return normalize_department_name(department)

    if role_has_department_field():
        if is_department_admin_user(actor) and not is_global_admin_user(actor):
            return normalize_department_name(actor.department)

        return "system"

    return None


def serialize_role(role: Role):
    data = {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_protected_role": role.name in PROTECTED_ROLE_NAMES,
    }

    if role_has_department_field():
        data["department"] = get_role_department(role)

    return data


def get_role_or_404(role_id: int, db: Session) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    return role


def ensure_actor_can_access_role(actor, role: Role):
    ensure_can_use_admin_area(actor)

    if is_global_admin_user(actor):
        return

    if not role_has_department_field():
        raise HTTPException(
            status_code=403,
            detail="Department admin cannot manage global roles without department field",
        )

    actor_department = normalize_department_name(actor.department)
    role_department = normalize_department_name(get_role_department(role))

    if actor_department != role_department:
        raise HTTPException(
            status_code=403,
            detail="Department admin can manage only own department roles",
        )


def ensure_actor_can_create_role(actor, role_name: str, role_department: str | None):
    ensure_can_use_admin_area(actor)

    if is_global_admin_user(actor):
        return

    if role_name in PROTECTED_ROLE_NAMES:
        raise HTTPException(
            status_code=403,
            detail="Department admin cannot create protected system roles",
        )

    if not role_has_department_field():
        raise HTTPException(
            status_code=403,
            detail="Department admin cannot create global roles without department field",
        )

    ensure_can_manage_department(actor, role_department)


def ensure_actor_can_modify_protected_role(actor, role: Role):
    if role.name in PROTECTED_ROLE_NAMES and not is_super_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Only main.admin can modify protected system roles",
        )


@router.get("")
@router.get("/")
def get_roles(
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    ensure_can_use_admin_area(actor)

    query = db.query(Role)

    if (
        role_has_department_field()
        and is_department_admin_user(actor)
        and not is_global_admin_user(actor)
    ):
        actor_department = normalize_department_name(actor.department)

        query = query.filter(
            Role.department == actor_department
        )

    roles = query.order_by(Role.id).all()

    return [serialize_role(role) for role in roles]


@router.get("/{role_id}")
def get_role(
    role_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    role = get_role_or_404(role_id, db)

    ensure_actor_can_access_role(actor, role)

    return serialize_role(role)


@router.post("")
@router.post("/")
def create_role(
    role_data: RoleCreate,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    role_name = role_data.name.strip()

    if not role_name:
        raise HTTPException(
            status_code=400,
            detail="Role name cannot be empty",
        )

    role_department = get_payload_department(role_data, actor)

    ensure_actor_can_create_role(
        actor=actor,
        role_name=role_name,
        role_department=role_department,
    )

    query = db.query(Role).filter(Role.name == role_name)

    if role_has_department_field():
        query = query.filter(Role.department == role_department)

    existing_role = query.first()

    if existing_role:
        raise HTTPException(
            status_code=400,
            detail="Role already exists",
        )

    role_kwargs = {
        "name": role_name,
        "description": role_data.description,
    }

    if role_has_department_field():
        role_kwargs["department"] = role_department

    new_role = Role(**role_kwargs)

    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return {
        "message": "Role created successfully",
        "role": serialize_role(new_role),
    }


@router.put("/{role_id}")
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    role = get_role_or_404(role_id, db)

    ensure_actor_can_access_role(actor, role)
    ensure_actor_can_modify_protected_role(actor, role)

    if role_data.name is not None:
        new_name = role_data.name.strip()

        if not new_name:
            raise HTTPException(
                status_code=400,
                detail="Role name cannot be empty",
            )

        if role.name in PROTECTED_ROLE_NAMES and new_name != role.name:
            raise HTTPException(
                status_code=403,
                detail="Protected role name cannot be changed",
            )

        query = (
            db.query(Role)
            .filter(Role.name == new_name)
            .filter(Role.id != role_id)
        )

        if role_has_department_field():
            query = query.filter(
                Role.department == get_role_department(role)
            )

        existing_role = query.first()

        if existing_role:
            raise HTTPException(
                status_code=400,
                detail="Another role with this name already exists",
            )

        role.name = new_name

    if role_data.description is not None:
        role.description = role_data.description

    if role_has_department_field():
        new_department = getattr(role_data, "department", None)

        if new_department is not None:
            normalized_department = normalize_department_name(new_department)

            ensure_can_manage_department(actor, normalized_department)

            role.department = normalized_department

    db.commit()
    db.refresh(role)

    return {
        "message": "Role updated successfully",
        "role": serialize_role(role),
    }


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    actor=Depends(get_current_actor),
    db: Session = Depends(get_db),
):
    role = get_role_or_404(role_id, db)

    ensure_actor_can_access_role(actor, role)

    if role.name in PROTECTED_ROLE_NAMES and not is_super_admin_user(actor):
        raise HTTPException(
            status_code=403,
            detail="Only main.admin can delete protected system roles",
        )

    if role.users:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete role because it is assigned to one or more users",
        )

    db.delete(role)
    db.commit()

    return {
        "message": "Role deleted successfully",
        "deleted_role_id": role_id,
    }