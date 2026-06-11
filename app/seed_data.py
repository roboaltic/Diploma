from app.database import Base, engine, SessionLocal
from app.models import Department, Role, Resource


def seed_database():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        default_departments = [
            {
                "name": "finance",
                "description": "Department responsible for financial reports, budgets and financial documents."
            },
            {
                "name": "security",
                "description": "Department responsible for security monitoring and incident logs."
            },
            {
                "name": "hr",
                "description": "Human resources department responsible for employee records."
            }
        ]

        for department_data in default_departments:
            existing_department = db.query(Department).filter(
                Department.name == department_data["name"]
            ).first()

            if not existing_department:
                department = Department(
                    name=department_data["name"],
                    description=department_data["description"]
                )
                db.add(department)

        default_roles = [
            {
                "name": "admin",
                "description": "System administrator with full access to manage users, roles, resources and audit logs."
            },
            {
                "name": "manager",
                "description": "Department manager with extended permissions inside the department."
            },
            {
                "name": "auditor",
                "description": "User responsible for reviewing access decisions and audit logs."
            },
            {
                "name": "employee",
                "description": "Regular department employee with limited access."
            }
        ]

        for role_data in default_roles:
            existing_role = db.query(Role).filter(
                Role.name == role_data["name"]
            ).first()

            if not existing_role:
                role = Role(
                    name=role_data["name"],
                    description=role_data["description"]
                )
                db.add(role)

        default_resources = [
            {
                "name": "finance_reports",
                "department": "finance",
                "required_clearance_level": 2,
                "required_position_level": 1,
                "description": "Financial reports available for authorized finance department users."
            },
            {
                "name": "finance_management_docs",
                "department": "finance",
                "required_clearance_level": 3,
                "required_position_level": 2,
                "description": "Management-level financial documents."
            },
            {
                "name": "security_incident_logs",
                "department": "security",
                "required_clearance_level": 3,
                "required_position_level": 2,
                "description": "Security incident logs for authorized security staff."
            },
            {
                "name": "hr_employee_records",
                "department": "hr",
                "required_clearance_level": 3,
                "required_position_level": 2,
                "description": "Human resources employee records."
            }
        ]

        for resource_data in default_resources:
            existing_resource = db.query(Resource).filter(
                Resource.name == resource_data["name"]
            ).first()

            if not existing_resource:
                resource = Resource(
                    name=resource_data["name"],
                    department=resource_data["department"],
                    required_clearance_level=resource_data["required_clearance_level"],
                    required_position_level=resource_data["required_position_level"],
                    description=resource_data["description"]
                )
                db.add(resource)

        db.commit()

        print("Database initialized successfully.")
        print("Default departments, roles and resources were added.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()