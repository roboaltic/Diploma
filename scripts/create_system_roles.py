from app.database import SessionLocal
from app.models import Role


db = SessionLocal()

roles = [
    {
        "name": "admin",
        "description": "Global administrator",
        "department": "system",
    },
    {
        "name": "department_admin",
        "description": "Department administrator",
        "department": "system",
    },
    {
        "name": "employee",
        "description": "Regular employee",
        "department": "system",
    },
]

for role_data in roles:
    existing = (
        db.query(Role)
        .filter(
            Role.name == role_data["name"],
            Role.department == role_data["department"],
        )
        .first()
    )

    if existing:
        continue

    role = Role(
        name=role_data["name"],
        description=role_data["description"],
        department=role_data["department"],
    )

    db.add(role)

db.commit()

print("System roles created successfully.")
