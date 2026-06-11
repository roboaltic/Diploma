from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Role, Resource, Department, AuditLog


router = APIRouter(
    prefix="/health",
    tags=["Health"]
)


@router.get("")
def health_check():
    return {
        "status": "ok",
        "message": "Hybrid RBAC/MAC API is running",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/details")
def health_details(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "api": "running",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "statistics": {
                "users_count": db.query(User).count(),
                "roles_count": db.query(Role).count(),
                "resources_count": db.query(Resource).count(),
                "departments_count": db.query(Department).count(),
                "audit_logs_count": db.query(AuditLog).count()
            }
        }

    except Exception as error:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "api": "running",
                "database": "not connected",
                "message": str(error),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )