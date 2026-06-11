from fastapi import APIRouter


router = APIRouter(
    prefix="/system",
    tags=["System"]
)


@router.get("/api-map")
def get_api_map():
    return {
        "title": "Hybrid RBAC/MAC Access Control API Map",
        "description": "List of main backend modules and endpoints used by the administrator and user interfaces.",
        "modules": {
            "users": {
                "description": "User management module.",
                "endpoints": {
                    "list_users": "GET /users/",
                    "get_user": "GET /users/{user_id}",
                    "create_user": "POST /users/",
                    "update_user": "PUT /users/{user_id}",
                    "delete_user": "DELETE /users/{user_id}",
                    "available_resources": "GET /users/{user_id}/available-resources"
                },
                "frontend_usage": [
                    "Admin panel user table",
                    "User creation form",
                    "User editing form",
                    "User profile page",
                    "Available resources button"
                ]
            },
            "roles": {
                "description": "Role management module for RBAC.",
                "endpoints": {
                    "list_roles": "GET /roles/",
                    "get_role": "GET /roles/{role_id}",
                    "create_role": "POST /roles/",
                    "update_role": "PUT /roles/{role_id}",
                    "delete_role": "DELETE /roles/{role_id}"
                },
                "frontend_usage": [
                    "Admin role management",
                    "Role selection in user forms"
                ]
            },
            "resources": {
                "description": "Protected business resources managed by the access control system.",
                "endpoints": {
                    "list_resources": "GET /resources/",
                    "get_resource": "GET /resources/{resource_id}",
                    "create_resource": "POST /resources/",
                    "update_resource": "PUT /resources/{resource_id}",
                    "delete_resource": "DELETE /resources/{resource_id}"
                },
                "frontend_usage": [
                    "Admin resource table",
                    "Resource creation form",
                    "Resource editing form",
                    "User available resources view"
                ]
            },
            "departments": {
                "description": "Department management and department analytics.",
                "endpoints": {
                    "list_departments": "GET /departments/",
                    "create_department": "POST /departments/",
                    "update_department": "PUT /departments/{department_name}",
                    "delete_department": "DELETE /departments/{department_name}",
                    "summary": "GET /departments/summary",
                    "tree": "GET /departments/tree",
                    "overview": "GET /departments/{department_name}/overview",
                    "users": "GET /departments/{department_name}/users",
                    "resources": "GET /departments/{department_name}/resources",
                    "roles": "GET /departments/{department_name}/roles",
                    "delete_department_user": "DELETE /departments/{department_name}/users/{user_id}"
                },
                "frontend_usage": [
                    "Department tree view",
                    "Department accordion",
                    "Users inside department",
                    "Department analytics",
                    "Delete user from department button"
                ]
            },
            "access_control": {
                "description": "Hybrid access check based on RBAC, MAC, department and department position.",
                "endpoints": {
                    "check_access": "POST /access/check"
                },
                "frontend_usage": [
                    "Access check button",
                    "Admin access testing form",
                    "User access verification"
                ]
            },
            "audit": {
                "description": "Audit log module for storing access check results.",
                "endpoints": {
                    "list_audit_logs": "GET /audit/",
                    "get_audit_log": "GET /audit/{log_id}",
                    "delete_audit_log": "DELETE /audit/{log_id}"
                },
                "frontend_usage": [
                    "Audit log table",
                    "Recent access checks",
                    "Security monitoring"
                ]
            },
            "dashboard": {
                "description": "Prepared data for administrator and user dashboards.",
                "endpoints": {
                    "admin_dashboard": "GET /dashboard/admin",
                    "user_dashboard": "GET /dashboard/user/{user_id}"
                },
                "frontend_usage": [
                    "Admin main screen",
                    "User main screen",
                    "Quick action buttons"
                ]
            },
            "health": {
                "description": "System status and database connection check.",
                "endpoints": {
                    "simple_health": "GET /health",
                    "detailed_health": "GET /health/details"
                },
                "frontend_usage": [
                    "System status button",
                    "API and database status card"
                ]
            }
        }
    }