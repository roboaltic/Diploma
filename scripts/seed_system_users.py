import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models import User
from app.security import hash_password


SYSTEM_USERS = [
    {
        "username": "main.admin",
        "password": "MainAdmin123",
        "department": "system",
        "department_position": "department_head",
        "clearance_level": 10,
    },
    {
        "username": "director",
        "password": "Director123",
        "department": "system",
        "department_position": "department_head",
        "clearance_level": 10,
    },
    {
        "username": "deputy.director",
        "password": "DeputyDirector123",
        "department": "system",
        "department_position": "deputy_head",
        "clearance_level": 9,
    },
]


def get_or_create_system_user(db, user_data):
    user = (
        db.query(User)
        .filter(User.username == user_data["username"])
        .first()
    )

    if user:
        user.password_hash = hash_password(user_data["password"])
        user.department = user_data["department"]
        user.department_position = user_data["department_position"]
        user.clearance_level = user_data["clearance_level"]
        user.roles = []

        return user, False

    user = User(
        username=user_data["username"],
        password_hash=hash_password(user_data["password"]),
        department=user_data["department"],
        department_position=user_data["department_position"],
        clearance_level=user_data["clearance_level"],
    )

    user.roles = []

    db.add(user)
    db.flush()

    return user, True


def main():
    db = SessionLocal()

    try:
        print("Seeding system users...")

        for user_data in SYSTEM_USERS:
            user, created = get_or_create_system_user(db, user_data)

            status = "created" if created else "updated"

            print(
                f"{status}: id={user.id} | "
                f"username={user.username} | "
                f"password={user_data['password']} | "
                f"department={user.department} | "
                f"position={user.department_position} | "
                f"clearance={user.clearance_level}"
            )

        db.commit()

        print("\nSystem users seed completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
