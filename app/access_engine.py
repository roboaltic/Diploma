from app.state import users, roles, resources


def check_access_logic(user_id: int, resource_id: int, action: str):
    user = next((u for u in users if u["id"] == user_id), None)
    resource = next((r for r in resources if r["id"] == resource_id), None)

    if user is None:
        return {
            "error": "User not found",
            "status_code": 404
        }

    if resource is None:
        return {
            "error": "Resource not found",
            "status_code": 404
        }

    user_roles = [
        role for role in roles
        if role["id"] in user["role_ids"]
    ]

    # RBAC-перевірка
    rbac_allowed = any(
        action in role["permissions"]
        for role in user_roles
    )

    # MAC-перевірка
    mac_allowed = user["clearance_level"] >= resource["classification_level"]

    # Department-перевірка
    department_allowed = (
        user["department"].lower() == resource["department"].lower()
    )

    deny_reasons = []

    if not rbac_allowed:
        deny_reasons.append(
            "RBAC denied access: user role does not have required permission"
        )

    if not mac_allowed:
        deny_reasons.append(
            "MAC denied access: user clearance level is lower than resource classification level"
        )

    if not department_allowed:
        deny_reasons.append(
            "Department policy denied access: user department does not match resource department"
        )

    final_decision = rbac_allowed and mac_allowed and department_allowed

    return {
        "user": user,
        "resource": resource,
        "action": action,
        "rbac_allowed": rbac_allowed,
        "mac_allowed": mac_allowed,
        "department_allowed": department_allowed,
        "final_decision": final_decision,
        "decision": "ALLOW" if final_decision else "DENY",
        "deny_reasons": deny_reasons
    }