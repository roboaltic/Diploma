from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Department, User, Resource
from app.schemas import DepartmentCreate, DepartmentUpdate


router = APIRouter(
    prefix="/departments",
    tags=["Departments"]
)


POSITION_LABELS = {
    "department_head": "Начальник департаменту",
    "deputy_head": "Заступник начальника",
    "employee": "Працівник"
}


def normalize_department_name(name: str) -> str:
    return name.strip().lower()


def get_position_label(position: str) -> str:
    return POSITION_LABELS.get(position, position)


def serialize_department(department: Department):
    return {
        "id": department.id,
        "name": department.name,
        "description": department.description
    }


def serialize_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "clearance_level": user.clearance_level,
        "department": user.department,
        "department_position": user.department_position,
        "department_position_label": get_position_label(user.department_position),
        "roles": [
            {
                "id": role.id,
                "name": role.name,
                "description": role.description
            }
            for role in user.roles
        ]
    }


def serialize_resource(resource: Resource):
    return {
        "id": resource.id,
        "name": resource.name,
        "department": resource.department,
        "required_clearance_level": resource.required_clearance_level,
        "required_position_level": resource.required_position_level,
        "description": resource.description
    }


def serialize_user_for_tree(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "clearance_level": user.clearance_level,
        "department": user.department,
        "department_position": user.department_position,
        "department_position_label": get_position_label(user.department_position),
        "roles": [
            role.name
            for role in user.roles
        ],
        "actions": {
            "edit": f"/users/{user.id}",
            "delete": f"/departments/{user.department}/users/{user.id}",
            "transfer": f"/users/{user.id}"
        }
    }


def get_all_department_names(db: Session):
    department_table_names = [
        department.name
        for department in db.query(Department).all()
    ]

    user_departments = [
        user.department
        for user in db.query(User).all()
    ]

    resource_departments = [
        resource.department
        for resource in db.query(Resource).all()
    ]

    departments = sorted(
        set(department_table_names + user_departments + resource_departments)
    )

    return departments


def build_department_summary(department_name: str, db: Session):
    users = db.query(User).filter(
        User.department == department_name
    ).all()

    resources = db.query(Resource).filter(
        Resource.department == department_name
    ).all()

    department = db.query(Department).filter(
        Department.name == department_name
    ).first()

    role_counter = Counter()
    position_counter = Counter()

    for user in users:
        position_counter[user.department_position] += 1

        for role in user.roles:
            role_counter[role.name] += 1

    return {
        "department": department_name,
        "description": department.description if department else None,
        "users_count": len(users),
        "resources_count": len(resources),
        "roles_distribution": dict(role_counter),
        "positions_distribution": dict(position_counter)
    }


@router.get("/")
def get_departments(db: Session = Depends(get_db)):
    departments = db.query(Department).order_by(
        Department.name.asc()
    ).all()

    return [
        serialize_department(department)
        for department in departments
    ]


@router.post("/")
def create_department(
    department_data: DepartmentCreate,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_data.name)

    existing_department = db.query(Department).filter(
        Department.name == department_name
    ).first()

    if existing_department:
        raise HTTPException(
            status_code=400,
            detail="Department with this name already exists"
        )

    new_department = Department(
        name=department_name,
        description=department_data.description
    )

    db.add(new_department)
    db.commit()
    db.refresh(new_department)

    return {
        "message": "Department created successfully",
        "department": serialize_department(new_department)
    }


@router.get("/summary")
def get_departments_summary(db: Session = Depends(get_db)):
    departments = get_all_department_names(db)

    return {
        "departments_count": len(departments),
        "departments": [
            build_department_summary(department, db)
            for department in departments
        ]
    }


@router.get("/tree")
def get_departments_tree(db: Session = Depends(get_db)):
    departments = get_all_department_names(db)

    tree = []

    for department_name in departments:
        department = db.query(Department).filter(
            Department.name == department_name
        ).first()

        users = db.query(User).filter(
            User.department == department_name
        ).all()

        resources = db.query(Resource).filter(
            Resource.department == department_name
        ).all()

        tree.append(
            {
                "department": department_name,
                "description": department.description if department else None,
                "users_count": len(users),
                "resources_count": len(resources),
                "users": [
                    serialize_user_for_tree(user)
                    for user in users
                ],
                "resources": [
                    serialize_resource(resource)
                    for resource in resources
                ],
                "actions": {
                    "view": f"/departments/{department_name}/overview",
                    "edit": f"/departments/{department_name}",
                    "delete": f"/departments/{department_name}",
                    "add_user": "/users/",
                    "add_resource": "/resources/"
                }
            }
        )

    return {
        "departments_count": len(tree),
        "departments": tree
    }


@router.get("/{department_name}/overview")
def get_department_overview(
    department_name: str,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    departments = get_all_department_names(db)

    if department_name not in departments:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    users = db.query(User).filter(
        User.department == department_name
    ).all()

    resources = db.query(Resource).filter(
        Resource.department == department_name
    ).all()

    summary = build_department_summary(department_name, db)

    return {
        "summary": summary,
        "users": [
            serialize_user(user)
            for user in users
        ],
        "resources": [
            serialize_resource(resource)
            for resource in resources
        ]
    }


@router.get("/{department_name}/users")
def get_department_users(
    department_name: str,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    users = db.query(User).filter(
        User.department == department_name
    ).all()

    return {
        "department": department_name,
        "users_count": len(users),
        "users": [
            serialize_user(user)
            for user in users
        ]
    }


@router.get("/{department_name}/resources")
def get_department_resources(
    department_name: str,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    resources = db.query(Resource).filter(
        Resource.department == department_name
    ).all()

    return {
        "department": department_name,
        "resources_count": len(resources),
        "resources": [
            serialize_resource(resource)
            for resource in resources
        ]
    }


@router.get("/{department_name}/roles")
def get_department_roles(
    department_name: str,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    users = db.query(User).filter(
        User.department == department_name
    ).all()

    role_counter = Counter()

    for user in users:
        for role in user.roles:
            role_counter[role.name] += 1

    return {
        "department": department_name,
        "roles_count": len(role_counter),
        "roles_distribution": dict(role_counter)
    }


@router.put("/{department_name}")
def update_department(
    department_name: str,
    department_data: DepartmentUpdate,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    department = db.query(Department).filter(
        Department.name == department_name
    ).first()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    if department_data.name is not None:
        new_department_name = normalize_department_name(department_data.name)

        existing_department = db.query(Department).filter(
            Department.name == new_department_name,
            Department.id != department.id
        ).first()

        if existing_department:
            raise HTTPException(
                status_code=400,
                detail="Another department with this name already exists"
            )

        old_department_name = department.name

        department.name = new_department_name

        db.query(User).filter(
            User.department == old_department_name
        ).update(
            {"department": new_department_name}
        )

        db.query(Resource).filter(
            Resource.department == old_department_name
        ).update(
            {"department": new_department_name}
        )

    if department_data.description is not None:
        department.description = department_data.description

    db.commit()
    db.refresh(department)

    return {
        "message": "Department updated successfully",
        "department": serialize_department(department)
    }


@router.delete("/{department_name}/users/{user_id}")
def delete_department_user(
    department_name: str,
    user_id: int,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.department != department_name:
        raise HTTPException(
            status_code=400,
            detail="User does not belong to this department"
        )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted from department successfully",
        "department": department_name,
        "deleted_user_id": user_id
    }


@router.delete("/{department_name}")
def delete_department(
    department_name: str,
    db: Session = Depends(get_db)
):
    department_name = normalize_department_name(department_name)

    department = db.query(Department).filter(
        Department.name == department_name
    ).first()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    users_count = db.query(User).filter(
        User.department == department_name
    ).count()

    resources_count = db.query(Resource).filter(
        Resource.department == department_name
    ).count()

    if users_count > 0 or resources_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete department because it has assigned users or resources"
        )

    db.delete(department)
    db.commit()

    return {
        "message": "Department deleted successfully",
        "deleted_department": department_name
    }