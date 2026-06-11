import json
import sqlite3
from pathlib import Path
from typing import Dict, Any

from app.models import (
    User,
    Role,
    Resource,
    Permission,
    SecurityLevel,
)


class AppStorage:
    def __init__(self, db_path: str = "data/access_control.db"):
        self.db_path = db_path
        self._init_database()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _dump_model(self, model: Any) -> dict:
        """
        Підтримка Pydantic v1 і v2.
        Повертає JSON-сумісний dict.
        """

        if hasattr(model, "model_dump"):
            return model.model_dump(mode="json")

        return json.loads(model.json())

    def _init_database(self) -> None:
        """
        Створює таблиці для користувачів, ролей і ресурсів.
        """

        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    permissions_json TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL,
                    role_ids_json TEXT NOT NULL,
                    clearance_level INTEGER NOT NULL,
                    department TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS resources (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    classification_level INTEGER NOT NULL,
                    department TEXT NOT NULL
                )
                """
            )

            connection.commit()

    def _count_table(self, table_name: str) -> int:
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            return cursor.fetchone()[0]

    def seed_if_empty(
        self,
        default_users: Dict[int, User],
        default_roles: Dict[int, Role],
        default_resources: Dict[int, Resource],
    ) -> None:
        """
        Заповнює базу стартовими тестовими даними,
        якщо таблиці ще порожні.
        """

        if self._count_table("roles") == 0:
            for role in default_roles.values():
                self.save_role(role)

        if self._count_table("users") == 0:
            for user in default_users.values():
                self.save_user(user)

        if self._count_table("resources") == 0:
            for resource in default_resources.values():
                self.save_resource(resource)

    # ---------- Roles ----------

    def load_roles(self) -> Dict[int, Role]:
        roles: Dict[int, Role] = {}

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, name, permissions_json
                FROM roles
                ORDER BY id
                """
            )

            rows = cursor.fetchall()

        for role_id, name, permissions_json in rows:
            permissions_data = json.loads(permissions_json)

            permissions = [
                Permission(**permission)
                for permission in permissions_data
            ]

            roles[role_id] = Role(
                id=role_id,
                name=name,
                permissions=permissions,
            )

        return roles

    def save_role(self, role: Role) -> None:
        permissions_data = [
            self._dump_model(permission)
            for permission in role.permissions
        ]

        permissions_json = json.dumps(
            permissions_data,
            ensure_ascii=False,
        )

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT OR REPLACE INTO roles (
                    id,
                    name,
                    permissions_json
                )
                VALUES (?, ?, ?)
                """,
                (
                    role.id,
                    role.name,
                    permissions_json,
                ),
            )

            connection.commit()

    def delete_role(self, role_id: int) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                DELETE FROM roles
                WHERE id = ?
                """,
                (role_id,),
            )

            connection.commit()

    # ---------- Users ----------

    def load_users(self) -> Dict[int, User]:
        users: Dict[int, User] = {}

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, username, role_ids_json, clearance_level, department
                FROM users
                ORDER BY id
                """
            )

            rows = cursor.fetchall()

        for user_id, username, role_ids_json, clearance_level, department in rows:
            users[user_id] = User(
                id=user_id,
                username=username,
                role_ids=json.loads(role_ids_json),
                clearance_level=SecurityLevel(clearance_level),
                department=department,
            )

        return users

    def save_user(self, user: User) -> None:
        role_ids_json = json.dumps(user.role_ids)

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT OR REPLACE INTO users (
                    id,
                    username,
                    role_ids_json,
                    clearance_level,
                    department
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    user.username,
                    role_ids_json,
                    int(user.clearance_level),
                    user.department,
                ),
            )

            connection.commit()

    def delete_user(self, user_id: int) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                DELETE FROM users
                WHERE id = ?
                """,
                (user_id,),
            )

            connection.commit()

    # ---------- Resources ----------

    def load_resources(self) -> Dict[int, Resource]:
        resources: Dict[int, Resource] = {}

        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, name, resource_type, classification_level, department
                FROM resources
                ORDER BY id
                """
            )

            rows = cursor.fetchall()

        for resource_id, name, resource_type, classification_level, department in rows:
            resources[resource_id] = Resource(
                id=resource_id,
                name=name,
                resource_type=resource_type,
                classification_level=SecurityLevel(classification_level),
                department=department,
            )

        return resources

    def save_resource(self, resource: Resource) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT OR REPLACE INTO resources (
                    id,
                    name,
                    resource_type,
                    classification_level,
                    department
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    resource.id,
                    resource.name,
                    resource.resource_type,
                    int(resource.classification_level),
                    resource.department,
                ),
            )

            connection.commit()

    def delete_resource(self, resource_id: int) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()

            cursor.execute(
                """
                DELETE FROM resources
                WHERE id = ?
                """,
                (resource_id,),
            )

            connection.commit()

    # ---------- Common ----------

    def load_all(self):
        return (
            self.load_users(),
            self.load_roles(),
            self.load_resources(),
        )