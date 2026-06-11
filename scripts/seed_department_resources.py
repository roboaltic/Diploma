import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models import Department, Resource


DEPARTMENTS = [
    {
        "name": "hr",
        "label": "HR",
        "description": "Human Resources department",
    },
    {
        "name": "finance",
        "label": "Finance",
        "description": "Finance department",
    },
    {
        "name": "lawyer",
        "label": "Lawyer",
        "description": "Legal department",
    },
    {
        "name": "engineer",
        "label": "Engineer",
        "description": "Engineering department",
    },
]


RESOURCE_TEMPLATES = [
    {
        "suffix": "general_docs",
        "title": "General documents",
        "required_clearance_level": 1,
        "required_position_level": 1,
        "description": "Загальні документи департаменту, доступні працівникам відділу.",
    },
    {
        "suffix": "internal_tasks",
        "title": "Internal tasks",
        "required_clearance_level": 2,
        "required_position_level": 1,
        "description": "Внутрішні робочі матеріали департаменту для повсякденної роботи.",
    },
    {
        "suffix": "management_report",
        "title": "Management report",
        "required_clearance_level": 4,
        "required_position_level": 2,
        "description": "Управлінські звіти, доступні заступнику та голові департаменту.",
    },
    {
        "suffix": "confidential_strategy",
        "title": "Confidential strategy",
        "required_clearance_level": 5,
        "required_position_level": 3,
        "description": "Конфіденційна стратегічна інформація, доступна лише керівнику департаменту.",
    },
]


def normalize(value: str) -> str:
    return value.strip().lower()


def get_or_create_department(db, name: str, description: str):
    normalized_name = normalize(name)

    department = (
        db.query(Department)
        .filter(Department.name == normalized_name)
        .first()
    )

    if department:
        if hasattr(department, "description"):
            department.description = description

        return department

    department_kwargs = {
        "name": normalized_name,
    }

    if hasattr(Department, "description"):
        department_kwargs["description"] = description

    department = Department(**department_kwargs)

    db.add(department)
    db.flush()

    return department


def get_or_create_resource(
    db,
    name: str,
    department: str,
    required_clearance_level: int,
    required_position_level: int,
    description: str,
):
    normalized_department = normalize(department)

    resource = (
        db.query(Resource)
        .filter(Resource.name == name)
        .first()
    )

    if resource:
        resource.department = normalized_department
        resource.required_clearance_level = required_clearance_level
        resource.required_position_level = required_position_level
        resource.description = description

        return resource

    resource = Resource(
        name=name,
        department=normalized_department,
        required_clearance_level=required_clearance_level,
        required_position_level=required_position_level,
        description=description,
    )

    db.add(resource)
    db.flush()

    return resource


def seed_resources_for_department(db, department_data):
    department_name = normalize(department_data["name"])
    department_label = department_data["label"]

    get_or_create_department(
        db=db,
        name=department_name,
        description=department_data["description"],
    )

    created_resources = []

    for template in RESOURCE_TEMPLATES:
        resource_name = f"{department_name}_{template['suffix']}"

        description = (
            f"{department_label}: {template['description']}"
        )

        resource = get_or_create_resource(
            db=db,
            name=resource_name,
            department=department_name,
            required_clearance_level=template["required_clearance_level"],
            required_position_level=template["required_position_level"],
            description=description,
        )

        created_resources.append(resource)

    return created_resources


def main():
    db = SessionLocal()

    try:
        all_resources = []

        print("Seeding department resources...")

        for department_data in DEPARTMENTS:
            resources = seed_resources_for_department(db, department_data)
            all_resources.extend(resources)

        db.commit()

        print("\nResources:")

        for resource in all_resources:
            print(
                f"  resource_id={resource.id} | "
                f"name={resource.name} | "
                f"department={resource.department} | "
                f"clearance={resource.required_clearance_level} | "
                f"position={resource.required_position_level}"
            )

        print("\nDepartment resources seed completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
