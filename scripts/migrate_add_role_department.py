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


def main():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return

    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()

    try:
        if column_exists(cursor, "roles", "department"):
            print("Column roles.department already exists.")
        else:
            cursor.execute("ALTER TABLE roles ADD COLUMN department VARCHAR")
            print("Column roles.department added.")

        cursor.execute(
            """
            UPDATE roles
            SET department = 'system'
            WHERE department IS NULL OR department = ''
            """
        )

        connection.commit()

        cursor.execute("SELECT id, name, description, department FROM roles")
        roles = cursor.fetchall()

        print("\nCurrent roles:")

        for role in roles:
            print(
                f"id={role[0]} | name={role[1]} | "
                f"description={role[2]} | department={role[3]}"
            )

        print("\nMigration completed successfully.")

    finally:
        connection.close()


if __name__ == "__main__":
    main()
