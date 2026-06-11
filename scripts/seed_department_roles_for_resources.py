import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models import Role, User


DEPARTMENTS = [
    "hr",
    "finance",
    "lawyer",
    "engineer",
]


SYSTEM_ROLES = [
    {
        "name": "admin",
        "description": "Global administrator with full access to the system",
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


DEPARTMENT_ROLE_TEMPLATES = [
    {
        "suffix": "employee",
        "description": (
            "Працівник департаменту. Має базовий доступ до загальних "
            "та внутрішніх ресурсів свого відділу."
        ),
        "users": ["employee1", "employee2"],
    },
    {
        "suffix": "deputy",
        "description": (
            "Заступник керівника департаменту. Має доступ до робочих "
            "матеріалів та управлінських звітів свого відділу."
        ),
        "users": ["deputy"],
    },
    {
        "suffix": "head",
        "description": (
            "Керівник департаменту. Має найвищий рівень доступу в межах "
            "свого відділу, включно з конфіденційними ресурсами."
        ),
        "users": ["head"],
    },
]


def normalize(value: str) -> str:
    return value.strip().lower()


def role_has_department_field() -> bool:
    return hasattr(Role, "department")


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


def get_role_by_name(db, name: str):
    return (
        db.query(Role)
        .filter(Role.name == name)
        .first()
    )


def attach_role_to_user(user: User, role: Role):
    if role not in user.roles:
        user.roles.append(role)


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


def seed_department_roles(db):
    created_roles = []

    for department in DEPARTMENTS:
        for template in DEPARTMENT_ROLE_TEMPLATES:
            role_name = f"{department}_{template['suffix']}"

            role_description = (
                f"{department.upper()}: {template['description']}"
            )

            role = get_or_create_role(
                db=db,
                name=role_name,
                description=role_description,
                department=department,
            )

            created_roles.append(role)

    return created_roles


def assign_department_roles_to_users(db):
    department_admin_role = get_role_by_name(db, "department_admin")
    department_head_role = get_role_by_name(db, "department_head")
    employee_system_role = get_role_by_name(db, "employee")

    updated_users = []

    for department in DEPARTMENTS:
        for template in DEPARTMENT_ROLE_TEMPLATES:
            department_role_name = f"{department}_{template['suffix']}"
            department_role = get_role_by_name(db, department_role_name)

            if not department_role:
                print(f"Role not found, skipped: {department_role_name}")
                continue

            for user_suffix in template["users"]:
                username = f"{department}.{user_suffix}"

                user = (
                    db.query(User)
                    .filter(User.username == username)
                    .first()
                )

                if not user:
                    print(f"User not found, skipped: {username}")
                    continue

                user.department = department

                if user_suffix == "head":
                    user.department_position = "department_head"
                    user.clearance_level = 5

                    attach_role_to_user(user, department_role)

                    if department_admin_role:
                        attach_role_to_user(user, department_admin_role)

                    if department_head_role:
                        attach_role_to_user(user, department_head_role)

                elif user_suffix == "deputy":
                    user.department_position = "deputy_head"
                    user.clearance_level = 4

                    attach_role_to_user(user, department_role)

                else:
                    user.department_position = "employee"
                    user.clearance_level = 2

                    attach_role_to_user(user, department_role)

                    if employee_system_role:
                        attach_role_to_user(user, employee_system_role)

                updated_users.append(user)

    return updated_users


def main():
    db = SessionLocal()

    try:
        print("Seeding system roles...")
        system_roles = seed_system_roles(db)

        print("\nSystem roles:")
        for role in system_roles:
            department = getattr(role, "department", "—")

            print(
                f"  role_id={role.id} | "
                f"name={role.name} | "
                f"department={department}"
            )

        print("\nSeeding department roles...")
        department_roles = seed_department_roles(db)

        print("\nDepartment roles:")
        for role in department_roles:
            department = getattr(role, "department", "—")

            print(
                f"  role_id={role.id} | "
                f"name={role.name} | "
                f"department={department}"
            )

        print("\nAssigning roles to demo users...")
        updated_users = assign_department_roles_to_users(db)

        db.commit()

        print("\nUpdated users:")
        for user in updated_users:
            role_names = ", ".join(role.name for role in user.roles)

            print(
                f"  user_id={user.id} | "
                f"username={user.username} | "
                f"department={user.department} | "
                f"position={user.department_position} | "
                f"clearance={user.clearance_level} | "
                f"roles={role_names}"
            )

        print("\nDepartment roles seed completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
