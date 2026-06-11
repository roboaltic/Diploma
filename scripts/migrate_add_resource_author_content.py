import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "access_control.db"


def column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()

    for column in columns:
        if column[1] == column_name:
            return True

    return False


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )

    return cursor.fetchone() is not None


def get_department_head_user_id(cursor, department: str):
    cursor.execute(
        """
        SELECT id
        FROM users
        WHERE department = ?
          AND department_position = 'department_head'
        ORDER BY id
        LIMIT 1
        """,
        (department,),
    )

    row = cursor.fetchone()

    if not row:
        return None

    return row[0]


def main():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    try:
        if not table_exists(cursor, "resources"):
            print("Table resources does not exist.")
            return

        if column_exists(cursor, "resources", "content"):
            print("Column resources.content already exists.")
        else:
            cursor.execute("ALTER TABLE resources ADD COLUMN content TEXT")
            print("Column resources.content added.")

        if column_exists(cursor, "resources", "created_by_user_id"):
            print("Column resources.created_by_user_id already exists.")
        else:
            cursor.execute(
                "ALTER TABLE resources ADD COLUMN created_by_user_id INTEGER"
            )
            print("Column resources.created_by_user_id added.")

        cursor.execute(
            """
            UPDATE resources
            SET content = description
            WHERE content IS NULL
              AND description IS NOT NULL
            """
        )

        cursor.execute(
            """
            SELECT id, department
            FROM resources
            WHERE created_by_user_id IS NULL
            """
        )

        resources_without_author = cursor.fetchall()

        for resource_id, department in resources_without_author:
            if not department:
                continue

            head_user_id = get_department_head_user_id(cursor, department)

            if not head_user_id:
                continue

            cursor.execute(
                """
                UPDATE resources
                SET created_by_user_id = ?
                WHERE id = ?
                """,
                (head_user_id, resource_id),
            )

        connection.commit()

        cursor.execute(
            """
            SELECT id, name, department, created_by_user_id
            FROM resources
            ORDER BY id
            """
        )

        resources = cursor.fetchall()

        print("\nResources after migration:")

        for resource in resources:
            print(
                f"id={resource[0]} | "
                f"name={resource[1]} | "
                f"department={resource[2]} | "
                f"created_by_user_id={resource[3]}"
            )

        print("\nMigration completed successfully.")

    finally:
        connection.close()


if __name__ == "__main__":
    main()
