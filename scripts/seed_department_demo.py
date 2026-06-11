import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models import Department, Role, User
from app.security import hash_password


DEFAULT_PASSWORD = "Demo12345"


DEPARTMENTS = [
    {
        "name": "hr",
        "description": "Human Resources department",
        "label": "HR",
    },
    {
        "name": "finance",
        "description": "Finance department",
        "label": "Finance",
    },
    {
        "name": "lawyer",
        "description": "Legal department",
        "label": "Lawyer",
    },
    {
        "name": "engineer",
        "description": "Engineering department",
        "label": "Engineer",
    },
]


POSITION_CONFIG = [
    {
        "suffix": "head",
        "role_suffix": "head",
        "role_description": "Department head",
        "department_position": "department_head",
        "clearance_level": 5,
        "count": 1,
    },
    {
        "suffix": "deputy",
        "role_suffix": "deputy",
        "role_description": "Deputy department head",
        "department_position": "deputy_head",
        "clearance_level": 4,
        "count": 1,
    },
    {
        "suffix": "employee",
        "role_suffix": "employee",
        "role_description": "Department employee",
        "department_position": "employee",
        "clearance_level": 2,
        "count": 2,
    },
]


SYSTEM_ROLES = [
    {
        "name": "admin",
        "description": "Global administrator",
        "department": "system",
    },
    {
        "name": "department_admin",
        "description": "Administrator limited to own department",
        "department": "system",
    },
    {
        "name": "department_head",
        "description": "Head of department",
        "department": "system",
    },
    {
        "name": "employee",
        "description": "Regular employee",
        "department": "system",
    },
]


def normalize(value: str) -> str:
    return value.strip().lower()


def role_has_department_field() -> bool:
    return hasattr(Role, "department")


def get_or_create_department(db, name: str, description: str):
    normalized_name = normalize(name)

    department = (
        db.query(Department)
        .filter(Department.name == normalized_name)
        .first()
    )

    if department:
        department.description = description
        return department

    department = Department(
        name=normalized_name,
        description=description,
    )

    db.add(department)
    db.flush()

    return department


def get_or_create_role(db, name: str, description: str, department: str):
    normalized_department = normalize(department)

    query = db.query(Role).filter(Role.name == name)

    if role_has_department_field():
        query = query.filter(Role.department == normalized_department)

    role = query.first()

    if role:
        role.description = description

        if role_has_department_field():
            role.department = normalized_department

        return role

    role_kwargs = {
        "name": name,
        "description": description,
    }

    if role_has_department_field():
        role_kwargs["department"] = normalized_department

    role = Role(**role_kwargs)

    db.add(role)
    db.flush()

    return role


def get_or_create_user(
    db,
    username: str,
    department: str,
    department_position: str,
    clearance_level: int,
    roles: list[Role],
):
    normalized_department = normalize(department)

    user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if user:
        user.password_hash = hash_password(DEFAULT_PASSWORD)
        user.department = normalized_department
        user.department_position = department_position
        user.clearance_level = clearance_level
        user.roles = roles

        return user

    user = User(
        username=username,
        password_hash=hash_password(DEFAULT_PASSWORD),
        department=normalized_department,
        department_position=department_position,
        clearance_level=clearance_level,
    )

    user.roles = roles

    db.add(user)
    db.flush()

    return user


def seed_system_roles(db):
    created_roles = []

    for role_data in SYSTEM_ROLES:
        role = get_or_create_role(
            db=db,
            name=role_data["name"],
            description=role_data["description"],
            department=role_data["department"],
        )

        created_roles.append(role)

    return created_roles


def seed_department(db, department_data):
    department_name = normalize(department_data["name"])
    department_label = department_data["label"]

    get_or_create_department(
        db=db,
        name=department_name,
        description=department_data["description"],
    )

    created_roles = []
    created_users = []

    for position in POSITION_CONFIG:
        role_name = f"{department_name}_{position['role_suffix']}"
        role_description = f"{department_label}: {position['role_description']}"

        role = get_or_create_role(
            db=db,
            name=role_name,
            description=role_description,
            department=department_name,
        )

        created_roles.append(role)

        for index in range(1, position["count"] + 1):
            if position["count"] == 1:
                username = f"{department_name}.{position['suffix']}"
            else:
                username = f"{department_name}.{position['suffix']}{index}"

            user_roles = [role]

            user = get_or_create_user(
                db=db,
                username=username,
                department=department_name,
                department_position=position["department_position"],
                clearance_level=position["clearance_level"],
                roles=user_roles,
            )

            created_users.append(user)

    return created_roles, created_users


def main():
    db = SessionLocal()

    try:
        print("Seeding system roles...")
        system_roles = seed_system_roles(db)

        print("System roles:")
        for role in system_roles:
            department = getattr(role, "department", "—")
            print(f"  role_id={role.id} | {role.name} | department={department}")

        print("\nSeeding departments, department roles and users...")

        all_department_roles = []
        all_users = []

        for department_data in DEPARTMENTS:
            roles, users = seed_department(db, department_data)
            all_department_roles.extend(roles)
            all_users.extend(users)

        db.commit()

        print("\nDepartment roles:")
        for role in all_department_roles:
            department = getattr(role, "department", "—")
            print(f"  role_id={role.id} | {role.name} | department={department}")

        print("\nUsers:")
        for user in all_users:
            role_names = ", ".join(role.name for role in user.roles)

            print(
                f"  user_id={user.id} | username={user.username} | "
                f"department={user.department} | "
                f"position={user.department_position} | "
                f"clearance={user.clearance_level} | "
                f"roles={role_names}"
            )

        print("\nSeed completed successfully.")
        print(f"Default password for created/updated demo users: {DEFAULT_PASSWORD}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
