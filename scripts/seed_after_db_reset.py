import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password


MAIN_ADMIN_USERNAME = "main.admin"
MAIN_ADMIN_PASSWORD = "MainAdmin123"


SYSTEM_ROLES = [
    {
        "name": "admin",
        "description": "Global administrator with full system access",
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


def role_has_department_field() -> bool:
    return hasattr(Role, "department")


def get_or_create_role(db, role_data):
    query = db.query(Role).filter(Role.name == role_data["name"])

    if role_has_department_field():
        query = query.filter(Role.department == role_data["department"])

    existing_role = query.first()

    if existing_role:
        existing_role.description = role_data["description"]

        if role_has_department_field():
            existing_role.department = role_data["department"]

        return existing_role

    role_kwargs = {
        "name": role_data["name"],
        "description": role_data["description"],
    }

    if role_has_department_field():
        role_kwargs["department"] = role_data["department"]

    role = Role(**role_kwargs)
    db.add(role)

    return role


def create_or_update_main_admin(db):
    user = (
        db.query(User)
        .filter(User.username == MAIN_ADMIN_USERNAME)
        .first()
    )

    if user:
        user.password_hash = hash_password(MAIN_ADMIN_PASSWORD)
        user.clearance_level = 10
        user.department = "system"
        user.department_position = "department_head"
        user.roles = []

        db.commit()
        db.refresh(user)

        print("main.admin already existed. Password was reset.")
        print(f"username: {MAIN_ADMIN_USERNAME}")
        print(f"password: {MAIN_ADMIN_PASSWORD}")
        print(f"id: {user.id}")
        return user

    user = User(
        username=MAIN_ADMIN_USERNAME,
        password_hash=hash_password(MAIN_ADMIN_PASSWORD),
        clearance_level=10,
        department="system",
        department_position="department_head",
    )

    user.roles = []

    db.add(user)
    db.commit()
    db.refresh(user)

    print("main.admin created successfully.")
    print(f"username: {MAIN_ADMIN_USERNAME}")
    print(f"password: {MAIN_ADMIN_PASSWORD}")
    print(f"id: {user.id}")

    return user


def main():
    db = SessionLocal()

    try:
        create_or_update_main_admin(db)

        created_roles = []

        for role_data in SYSTEM_ROLES:
            role = get_or_create_role(db, role_data)
            created_roles.append(role)

        db.commit()

        print("\nSystem roles are ready:")

        for role in created_roles:
            department_text = ""

            if role_has_department_field():
                department_text = f" | department={role.department}"

            print(f"- id={role.id} | name={role.name}{department_text}")

        print("\nDatabase seed completed successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
