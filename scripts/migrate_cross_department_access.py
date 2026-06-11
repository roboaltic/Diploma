import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "access_control.db"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )

    return cursor.fetchone() is not None


def main():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    try:
        if table_exists(cursor, "cross_department_access_requests"):
            print("Table cross_department_access_requests already exists.")
            return

        cursor.execute(
            """
            CREATE TABLE cross_department_access_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_head_id INTEGER NOT NULL,
                target_head_id INTEGER,
                user_id INTEGER NOT NULL,
                resource_id INTEGER NOT NULL,
                source_department VARCHAR NOT NULL,
                target_department VARCHAR NOT NULL,
                action VARCHAR NOT NULL DEFAULT 'read',
                reason TEXT,
                status VARCHAR NOT NULL DEFAULT 'pending',
                response_comment TEXT,
                created_at DATETIME,
                resolved_at DATETIME,
                FOREIGN KEY(requester_head_id) REFERENCES users(id),
                FOREIGN KEY(target_head_id) REFERENCES users(id),
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(resource_id) REFERENCES resources(id)
            )
            """
        )

        connection.commit()

        print("Table cross_department_access_requests created successfully.")

    finally:
        connection.close()


if __name__ == "__main__":
    main()
