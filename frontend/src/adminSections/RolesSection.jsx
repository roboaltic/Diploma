import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";

const emptyForm = {
  name: "",
  description: "",
};

function RolesSection() {
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRoles() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/roles");

      if (Array.isArray(data)) {
        setRoles(data);
      } else if (Array.isArray(data.roles)) {
        setRoles(data.roles);
      } else {
        setRoles([]);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завантажити ролі");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const payload = {
      name: form.name.trim(),
    };

    if (form.description.trim()) {
      payload.description = form.description.trim();
    }

    if (!payload.name) {
      setError("Назва ролі не може бути порожньою.");
      return;
    }

    try {
      if (editingRoleId) {
        await apiPut(`/roles/${editingRoleId}`, payload);
        setMessage("Роль оновлено.");
      } else {
        await apiPost("/roles", payload);
        setMessage("Роль створено.");
      }

      setForm(emptyForm);
      setEditingRoleId(null);
      await loadRoles();
    } catch (err) {
      setError(err.message || "Помилка при збереженні ролі");
    }
  }

  function handleEdit(role) {
    setEditingRoleId(role.id);

    setForm({
      name: role.name || "",
      description: role.description || "",
    });

    setMessage("");
    setError("");
  }

  function handleCancelEdit() {
    setEditingRoleId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  async function handleDelete(role) {
    const confirmed = window.confirm(`Видалити роль "${role.name}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/roles/${role.id}`);
      setMessage("Роль видалено.");
      await loadRoles();
    } catch (err) {
      setError(
        err.message ||
          "Не вдалося видалити роль. Можливо, backend ще не має маршруту DELETE /roles/{id}."
      );
    }
  }

  return (
    <section className="card">
      <h3>Ролі</h3>

      <p>
        У цьому розділі реалізовано керування RBAC-ролями: перегляд, створення,
        редагування та видалення ролей, які надалі можуть призначатися
        користувачам.
      </p>

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="info">Завантаження ролей...</div>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <h4>{editingRoleId ? "Редагування ролі" : "Нова роль"}</h4>

        <label>Назва ролі</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Наприклад: finance_manager"
          required
        />

        <label>Опис ролі</label>
        <input
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Наприклад: Керування фінансовими ресурсами"
        />

        <div className="row-actions">
          <button type="submit">
            {editingRoleId ? "Зберегти зміни" : "Додати роль"}
          </button>

          {editingRoleId && (
            <button type="button" onClick={handleCancelEdit}>
              Скасувати
            </button>
          )}

          <button type="button" onClick={loadRoles}>
            Оновити список
          </button>
        </div>
      </form>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Назва ролі</th>
              <th>Опис</th>
              <th>Дії</th>
            </tr>
          </thead>

          <tbody>
            {roles.length === 0 && !loading && (
              <tr>
                <td colSpan="4">Ролей поки немає.</td>
              </tr>
            )}

            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.id}</td>
                <td>{role.name}</td>
                <td>{role.description || "—"}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => handleEdit(role)}>Редагувати</button>

                    <button
                      className="danger"
                      onClick={() => handleDelete(role)}
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
    </section>
  );
}

export default RolesSection;