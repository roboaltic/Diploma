from datetime import datetime
from app.state import audit_logs


def add_audit_log(
    user_id: int,
    resource_id: int,
    action: str,
    rbac_allowed: bool,
    mac_allowed: bool,
    department_allowed: bool,
    decision: str,
    deny_reasons: list
):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "user_id": user_id,
        "resource_id": resource_id,
        "action": action,
        "rbac_allowed": rbac_allowed,
        "mac_allowed": mac_allowed,
        "department_allowed": department_allowed,
        "decision": decision,
        "deny_reasons": deny_reasons
    }

    audit_logs.append(log_entry)

    return log_entry


def get_audit_logs():
    return audit_logs