from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, unique=True, index=True, nullable=False)

    description = Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, index=True, nullable=False)

    password_hash = Column(String, nullable=False, default="")

    clearance_level = Column(Integer, nullable=False, default=1)

    department = Column(String, nullable=False)

    department_position = Column(String, nullable=False, default="employee")

    roles = relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
    )

    created_resources = relationship(
        "Resource",
        back_populates="created_by",
        foreign_keys="Resource.created_by_user_id",
    )


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, unique=False, nullable=False)

    description = Column(String, nullable=True)

    department = Column(String, nullable=True)

    users = relationship(
        "User",
        secondary=user_roles,
        back_populates="roles",
    )


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, unique=True, index=True, nullable=False)

    department = Column(String, nullable=False)

    required_clearance_level = Column(Integer, nullable=False, default=1)

    required_position_level = Column(Integer, nullable=False, default=1)

    description = Column(String, nullable=True)

    content = Column(Text, nullable=True)

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    created_by = relationship(
        "User",
        back_populates="created_resources",
        foreign_keys=[created_by_user_id],
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    event_type = Column(String, nullable=False)

    actor_username = Column(String, nullable=True)

    target_username = Column(String, nullable=True)

    department = Column(String, nullable=True)

    action = Column(String, nullable=False)

    details = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class CrossDepartmentAccessRequest(Base):
    __tablename__ = "cross_department_access_requests"

    id = Column(Integer, primary_key=True, index=True)

    requester_head_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    target_head_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)

    source_department = Column(String, nullable=False)

    target_department = Column(String, nullable=False)

    action = Column(String, nullable=False, default="read")

    reason = Column(Text, nullable=True)

    status = Column(String, nullable=False, default="pending")

    response_comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    resolved_at = Column(DateTime, nullable=True)

    requester_head = relationship(
        "User",
        foreign_keys=[requester_head_id],
    )

    target_head = relationship(
        "User",
        foreign_keys=[target_head_id],
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
    )

    resource = relationship(
        "Resource",
        foreign_keys=[resource_id],
    )