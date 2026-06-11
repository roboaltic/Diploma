import { useState } from "react";
import { apiPost, apiDelete } from "../../api";

function DepartmentBlock({ department, onChanged }) {
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const users = department.users || [];

  function formatRoles(roles) {
    if (!roles || roles.length === 0) {
      return "немає ролей";
    }

    return roles
      .map((role) => {
        if (typeof role === "string") {
          return role;
        }

        return role.name || role.title || `role_${role.id}`;
      })
      .join(", ");
  }

  function handleEditUser(user) {
    alert(
      `Редагування користувача буде підключено наступним кроком.\n\nКористувач: ${
        user.username
      }\nID: ${user.id}\nДепартамент: ${
        user.department || department.department
      }`
    );
  }

  async function handleResetPassword(userId) {
    setMessage("");
    setTemporaryPassword("");

    try {
      const data = await apiPost(`/users/${userId}/reset-password`, {
        generate_temporary: true,
      });

      setTemporaryPassword(data.temporary_password);
      setMessage(`Пароль для ${data.username} успішно скинуто.`);
    } catch (err) {
      setMessage(`Помилка: ${err.message}`);
    }
  }

  async function handleDeleteUser(userId) {
    const confirmed = window.confirm(
      "Видалити цього користувача з департаменту?"
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setTemporaryPassword("");

    try {
      await apiDelete(`/departments/${department.department}/users/${userId}`);
      setMessage("Користувача видалено.");
      onChanged();
    } catch (err) {
      setMessage(`Помилка: ${err.message}`);
    }
  }

  return (
    <div className="department">
      <button className="department-title" onClick={() => setOpen(!open)}>
        {open ? "▼" : "▶"} {department.department}
        <span>
          Користувачів: {department.users_count} | Ресурсів:{" "}
          {department.resources_count}
        </span>
      </button>

      {open && (
        <div className="department-content">
          {message && <div className="info small-info">{message}</div>}

          {temporaryPassword && (
            <div className="password-box">
              <strong>Тимчасовий пароль:</strong>
              <code>{temporaryPassword}</code>
              <span>
                Покажи або скопіюй його користувачу. Він відображається один раз.
              </span>
            </div>
          )}

          {users.length === 0 && (
            <p className="muted">
              У цьому департаменті поки немає користувачів.
            </p>
          )}

          {users.map((user) => (
            <div className="user-row" key={user.id}>
              <div>
                <strong>{user.username}</strong>
                <span>
                  {user.department_position_label} | Ролі:{" "}
                  {formatRoles(user.roles)}
                </span>
              </div>

              <div className="row-actions">
                <button onClick={() => handleEditUser(user)}>Редагувати</button>

                <button onClick={() => handleResetPassword(user.id)}>
                  Скинути пароль
                </button>

                <button
                  className="danger"
                  onClick={() => handleDeleteUser(user.id)}
                >
                  Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DepartmentBlock;