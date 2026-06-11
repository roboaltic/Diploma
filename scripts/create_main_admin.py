from app.database import SessionLocal
from app.models import User
from app.security import hash_password


USERNAME = "main.admin"
PASSWORD = "Simka200231"


def main():
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.username == USERNAME).first()

        if user:
            user.password_hash = hash_password(PASSWORD)
            user.clearance_level = 10
            user.department = "system"
            user.department_position = "department_head"
            user.roles = []

            db.commit()
            db.refresh(user)

            print("main.admin already existed. Password was reset.")
            print(f"username: {USERNAME}")
            print(f"password: {PASSWORD}")
            print(f"id: {user.id}")
            return

        user = User(
            username=USERNAME,
            password_hash=hash_password(PASSWORD),
            clearance_level=10,
            department="system",
            department_position="department_head",
        )

        user.roles = []

        db.add(user)
        db.commit()
        db.refresh(user)

        print("main.admin created successfully.")
        print(f"username: {USERNAME}")
        print(f"password: {PASSWORD}")
        print(f"id: {user.id}")

    finally:
        db.close()


if __name__ == "__main__":
    main()