from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class DepartmentPosition(str, Enum):
    department_head = "department_head"
    deputy_head = "deputy_head"
    employee = "employee"


class LoginRequest(BaseModel):
    username: str
    password: str


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None


class RoleResponse(RoleBase):
    id: int

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    role_ids: List[int]
    clearance_level: int
    department: str
    department_position: DepartmentPosition = DepartmentPosition.employee


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role_ids: Optional[List[int]] = None
    clearance_level: Optional[int] = None
    department: Optional[str] = None
    department_position: Optional[DepartmentPosition] = None


class UserResponse(BaseModel):
    id: int
    username: str
    clearance_level: int
    department: str
    department_position: str
    roles: List[RoleResponse] = []

    class Config:
        from_attributes = True


class ResourceCreate(BaseModel):
    name: str
    department: str
    required_clearance_level: int
    required_position_level: int = 1
    description: Optional[str] = None
    content: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    required_clearance_level: Optional[int] = None
    required_position_level: Optional[int] = None
    description: Optional[str] = None
    content: Optional[str] = None


class ResourceResponse(BaseModel):
    id: int
    name: str
    department: str
    required_clearance_level: int
    required_position_level: int
    description: Optional[str] = None
    content: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_by_username: Optional[str] = None
    created_by_position: Optional[str] = None
    created_by_position_level: Optional[int] = None

    class Config:
        from_attributes = True


class AccessCheckRequest(BaseModel):
    user_id: int
    resource_id: int
    action: str = "read"


class AccessCheckResponse(BaseModel):
    access_granted: bool
    reason: str
    user_id: int
    resource_id: int
    action: str


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    resource_id: int
    action: str
    result: str
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    new_password: Optional[str] = None
    generate_temporary: bool = True


class CrossDepartmentAccessRequestCreate(BaseModel):
    user_id: int
    resource_id: int
    action: str = "read"
    reason: Optional[str] = None


class CrossDepartmentAccessRequestResolve(BaseModel):
    response_comment: Optional[str] = None


class CrossDepartmentAccessRequestResponse(BaseModel):
    id: int
    requester_head_id: int
    target_head_id: Optional[int] = None
    user_id: int
    resource_id: int
    source_department: str
    target_department: str
    action: str
    reason: Optional[str] = None
    status: str
    response_comment: Optional[str] = None

    class Config:
        from_attributes = True