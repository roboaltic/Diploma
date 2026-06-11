import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";

const emptyForm = {
  username: "",
  password: "",
  department: "",
  clearance_level: 1,
  department_position: "employee",
  role_ids: "",
};

function UsersSection({ currentUser }) {
  const isGlobalAdmin = currentUser?.is_admin === true;

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/users/");

      if (Array.isArray(data)) {
        setUsers(data);
      } else if (Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завантажити користувачів");
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    if (!isGlobalAdmin) {
      setRoles([]);
      return;
    }

    try {
      const data = await apiGet("/roles/");

      if (Array.isArray(data)) {
        setRoles(data);
      } else if (Array.isArray(data.roles)) {
        setRoles(data.roles);
      } else {
        setRoles([]);
      }
    } catch {
      setRoles([]);
    }
  }

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [isGlobalAdmin]);

  function openCreateModal() {
    setEditingUserId(null);

    setForm({
      ...emptyForm,
      department: isGlobalAdmin ? "" : currentUser.department,
    });

    setMessage("");
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUserId(user.id);

    setForm({
      username: user.username || "",
      password: "",
      department: user.department || "",
      clearance_level: user.clearance_level || 1,
      department_position: user.department_position || "employee",
      role_ids: isGlobalAdmin ? getUserRoleIds(user) : "",
    });

    setMessage("");
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function parseRoleIds(value) {
    if (!value.trim()) {
      return [];
    }

    return value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => !Number.isNaN(item));
  }

  function getUserRoleIds(user) {
    if (!user.roles) {
      return "";
    }

    return user.roles
      .map((role) => {
        if (typeof role === "number") {
          return role;
        }

        if (typeof role === "string") {
          const foundRole = roles.find((item) => item.name === role);
          return foundRole?.id;
        }

        return role.id;
      })
      .filter(Boolean)
      .join(", ");
  }

  function getUserRolesText(user) {
    if (!user.roles || user.roles.length === 0) {
      return "немає ролей";
    }

    return user.roles
      .map((role) => {
        if (typeof role === "string") {
          return role;
        }

        return role.name || `role_${role.id}`;
      })
      .join(", ");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!editingUserId && !form.password.trim()) {
      setError("Для нового користувача потрібно вказати пароль.");
      return;
    }

    const payload = {
      username: form.username.trim(),
      department: isGlobalAdmin
        ? form.department.trim()
        : currentUser.department,
      clearance_level: Number(form.clearance_level),
      department_position: form.department_position,
    };

    if (!editingUserId) {
      payload.password = form.password;
    }

    if (editingUserId && form.password.trim()) {
      payload.password = form.password;
    }

    if (isGlobalAdmin) {
      payload.role_ids = parseRoleIds(form.role_ids);
    }

    if (!isGlobalAdmin && !editingUserId) {
      payload.role_ids = [];
    }

    try {
      if (editingUserId) {
        await apiPut(`/users/${editingUserId}`, payload);
        setMessage("Користувача оновлено.");
      } else {
        await apiPost("/users/", payload);
        setMessage("Користувача створено.");
      }

      closeModal();
      await loadUsers();
    } catch (err) {
      setError(err.message || "Помилка при збереженні користувача");
    }
  }

  async function handleDelete(user) {
    const confirmed = window.confirm(
      `Видалити користувача "${user.username}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/users/${user.id}`);
      setMessage("Користувача видалено.");
      await loadUsers();
    } catch (err) {
      setError(err.message || "Не вдалося видалити користувача");
    }
  }

  return (
    <section className="card">
      <div className="section-title-row">
        <div>
          <h3>Користувачі</h3>
          <p>
            Керування користувачами у межах доступної області. Для
            адміністратора департаменту відображаються лише користувачі його
            відділу.
          </p>
        </div>

        <button onClick={openCreateModal}>Створити користувача</button>
      </div>

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="info">Завантаження користувачів...</div>}

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Департамент</th>
              <th>Посада</th>
              <th>MAC</th>
              <th>Ролі</th>
              <th>Дії</th>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan="7">Користувачів поки немає.</td>
              </tr>
            )}

            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.department || "—"}</td>
                <td>{user.department_position || "—"}</td>
                <td>{user.clearance_level ?? "—"}</td>
                <td>{getUserRolesText(user)}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => openEditModal(user)}>
                      Редагувати
                    </button>

                    <button
                      className="danger"
                      onClick={() => handleDelete(user)}
                    >
                      Видалити
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>
                  {editingUserId
                    ? "Редагування користувача"
                    : "Створення користувача"}
                </h3>

                <p>
                  Заповніть основні параметри користувача. Ролі може
                  змінювати лише глобальний адміністратор.
                </p>
              </div>

              <button className="danger" onClick={closeModal}>
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>Username</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Наприклад: hr.employee3"
                required
              />

              <label>
                Пароль{" "}
                {editingUserId &&
                  "(залиш порожнім, якщо не потрібно змінювати)"}
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder={
                  editingUserId
                    ? "Новий пароль або залишити порожнім"
                    : "Пароль нового користувача"
                }
                required={!editingUserId}
              />

              <label>Департамент</label>
              <input
                name="department"
                value={isGlobalAdmin ? form.department : currentUser.department}
                onChange={handleChange}
                disabled={!isGlobalAdmin}
                required
              />

              <label>Посада</label>
              <select
                name="department_position"
                value={form.department_position}
                onChange={handleChange}
              >
                <option value="employee">employee</option>
                <option value="deputy_head">deputy_head</option>
                <option value="department_head">department_head</option>
              </select>

              <label>Рівень MAC</label>
              <input
                name="clearance_level"
                type="number"
                min="1"
                value={form.clearance_level}
                onChange={handleChange}
                required
              />

              {isGlobalAdmin && (
                <>
                  <label>Role IDs</label>
                  <input
                    name="role_ids"
                    value={form.role_ids}
                    onChange={handleChange}
                    placeholder="Наприклад: 1, 2, 3"
                  />

                  {roles.length > 0 && (
                    <div className="muted">
                      Доступні ролі:{" "}
                      {roles
                        .map((role) => `${role.id} — ${role.name}`)
                        .join("; ")}
                    </div>
                  )}
                </>
              )}

              {!isGlobalAdmin && (
                <div className="muted">
                  Ролі користувачів змінює тільки глобальний адміністратор.
                </div>
              )}

              <div className="row-actions">
                <button type="submit">
                  {editingUserId ? "Зберегти зміни" : "Створити"}
                </button>

                <button type="button" onClick={closeModal}>
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default UsersSection;