from app.models import Resource, User


POSITION_LEVELS = {
    "employee": 1,
    "deputy_head": 2,
    "department_head": 3,
}


FULL_ACCESS_ROLES = {
    "admin",
}


DEPARTMENT_ADMIN_ROLES = {
    "department_admin",
    "department_head",
}


def normalize_department_name(department: str | None) -> str:
    if not department:
        return ""

    return department.strip().lower()


def get_user_position_level(position: str | None) -> int:
    if not position:
        return 1

    return POSITION_LEVELS.get(position, 1)


def get_role_names(user: User) -> list[str]:
    return [role.name for role in user.roles]


def has_global_admin_role(user: User) -> bool:
    role_names = get_role_names(user)

    return any(role_name in FULL_ACCESS_ROLES for role_name in role_names)


def has_department_admin_role(user: User) -> bool:
    role_names = get_role_names(user)

    return (
        any(role_name in DEPARTMENT_ADMIN_ROLES for role_name in role_names)
        or user.department_position == "department_head"
    )


def role_allows_action(user: User, action: str) -> bool:
    role_names = get_role_names(user)
    position = user.department_position

    if has_global_admin_role(user):
        return True

    if "department_admin" in role_names:
        return action in ["read", "write", "delete", "manage", "audit"]

    if position == "department_head":
        return action in ["read", "write", "delete", "manage"]

    if position == "deputy_head":
        return action in ["read", "write", "manage"]

    if position == "employee":
        return action in ["read", "write"]

    for role_name in role_names:
        if role_name.endswith("_head"):
            return action in ["read", "write", "delete", "manage"]

        if role_name.endswith("_deputy"):
            return action in ["read", "write", "manage"]

        if role_name.endswith("_employee"):
            return action in ["read", "write"]

    return action == "read"


def evaluate_access(
    user: User,
    resource: Resource,
    action: str = "read",
):
    if has_global_admin_role(user):
        return True, "Access granted: global administrator role has full access"

    user_department = normalize_department_name(user.department)
    resource_department = normalize_department_name(resource.department)

    if user_department != resource_department:
        return False, "Access denied: user department does not match resource department"

    if not role_allows_action(user, action):
        return False, "Access denied: user role or department position does not allow this action"

    if user.clearance_level < resource.required_clearance_level:
        return False, "Access denied: user clearance level is lower than resource requirement"

    user_position_level = get_user_position_level(user.department_position)

    if user_position_level < resource.required_position_level:
        return False, "Access denied: user department position level is lower than resource requirement"

    return True, "Access granted"