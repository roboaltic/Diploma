import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../api";

const emptyForm = {
  user_id: "",
  resource_id: "",
  action: "read",
};

const emptyEditForm = {
  name: "",
  department: "",
  required_clearance_level: 1,
  required_position_level: 1,
  description: "",
  content: "",
};

function AccessCheckSection() {
  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [result, setResult] = useState(null);
  const [openedResource, setOpenedResource] = useState(null);
  const [editingResource, setEditingResource] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [usersData, resourcesData] = await Promise.all([
        apiGet("/users/"),
        apiGet("/resources/"),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : usersData.users || []);
      setResources(
        Array.isArray(resourcesData) ? resourcesData : resourcesData.resources || []
      );
    } catch (err) {
      setError(err.message || "Не вдалося завантажити дані для перевірки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setResult(null);
    setOpenedResource(null);
    setEditingResource(null);

    if (!form.user_id) {
      setError("Оберіть користувача.");
      return;
    }

    if (!form.resource_id) {
      setError("Оберіть ресурс.");
      return;
    }

    const payload = {
      user_id: Number(form.user_id),
      resource_id: Number(form.resource_id),
      action: form.action,
    };

    setChecking(true);

    try {
      const data = await apiPost("/access/check", payload);
      setResult(data);
    } catch (err) {
      setError(err.message || "Не вдалося виконати перевірку доступу");
    } finally {
      setChecking(false);
    }
  }

  function getRoleName(role) {
    if (typeof role === "string") {
      return role;
    }

    return role.name || `role_${role.id}`;
  }

  function getUserLabel(user) {
    const rolesText =
      user.roles && user.roles.length > 0
        ? user.roles.map(getRoleName).join(", ")
        : "без ролей";

    return `${user.id} — ${user.username} | ${
      user.department || "без департаменту"
    } | MAC ${user.clearance_level ?? "?"} | ${rolesText}`;
  }

  function getResourceLabel(resource) {
    return `${resource.id} — ${resource.name} | ${
      resource.department || "без департаменту"
    } | MAC ${resource.required_clearance_level ?? "?"} | position ${
      resource.required_position_level ?? "?"
    }`;
  }

  function handleOpenResource() {
    if (!result?.resource) {
      return;
    }

    setOpenedResource(result.resource);
  }

  function canShowEditButton() {
    if (!result?.access_granted) {
      return false;
    }

    return result.action === "write" || result.action === "manage";
  }

  function handleStartEditResource() {
    if (!result?.resource) {
      return;
    }

    const resource = result.resource;

    setEditingResource(resource);
    setOpenedResource(null);

    setEditForm({
      name: resource.name || "",
      department: resource.department || "",
      required_clearance_level: resource.required_clearance_level || 1,
      required_position_level: resource.required_position_level || 1,
      description: resource.description || "",
      content: resource.content || "",
    });

    setError("");
    setMessage("");
  }

  function handleCancelEditResource() {
    setEditingResource(null);
    setEditForm(emptyEditForm);
  }

  async function handleSaveResource(event) {
    event.preventDefault();

    if (!editingResource?.id) {
      setError("Не визначено ресурс для редагування.");
      return;
    }

    setSavingEdit(true);
    setError("");
    setMessage("");

    const payload = {
      name: editForm.name.trim(),
      department: editForm.department.trim(),
      required_clearance_level: Number(editForm.required_clearance_level),
      required_position_level: Number(editForm.required_position_level),
      description: editForm.description.trim() || null,
      content: editForm.content.trim() || null,
    };

    if (!payload.name) {
      setError("Назва ресурсу не може бути порожньою.");
      setSavingEdit(false);
      return;
    }

    if (!payload.department) {
      setError("Департамент ресурсу не може бути порожнім.");
      setSavingEdit(false);
      return;
    }

    try {
      const data = await apiPut(`/resources/${editingResource.id}`, payload);

      const updatedResource = data.resource || data;

      setMessage("Ресурс оновлено.");
      setEditingResource(null);
      setEditForm(emptyEditForm);

      await loadData();

      if (result) {
        setResult((prev) => ({
          ...prev,
          resource: {
            ...prev.resource,
            ...updatedResource,
          },
        }));
      }
    } catch (err) {
      setError(err.message || "Не вдалося оновити ресурс");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <section className="card">
      <h3>Перевірка доступу</h3>

      <p>
        У цьому розділі адміністратор може виконати тестову перевірку доступу:
        обрати користувача, ресурс і дію. Після цього система застосовує
        комбіновану RBAC/MAC логіку та повертає рішення.
      </p>

      {loading && (
        <div className="info">
          Завантаження користувачів і ресурсів...
        </div>
      )}

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <h4>Параметри перевірки</h4>

        <label>Користувач</label>
        <select
          name="user_id"
          value={form.user_id}
          onChange={handleChange}
          required
        >
          <option value="">Оберіть користувача</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserLabel(user)}
            </option>
          ))}
        </select>

        <label>Ресурс</label>
        <select
          name="resource_id"
          value={form.resource_id}
          onChange={handleChange}
          required
        >
          <option value="">Оберіть ресурс</option>

          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {getResourceLabel(resource)}
            </option>
          ))}
        </select>

        <label>Дія</label>
        <select name="action" value={form.action} onChange={handleChange}>
          <option value="read">read</option>
          <option value="write">write</option>
          <option value="delete">delete</option>
          <option value="manage">manage</option>
        </select>

        <div className="row-actions">
          <button type="submit" disabled={checking}>
            {checking ? "Перевірка..." : "Перевірити доступ"}
          </button>

          <button type="button" onClick={loadData}>
            Оновити дані
          </button>
        </div>
      </form>

      {result && (
        <div
          className={
            result.access_granted
              ? "access-result access-granted"
              : "access-result access-denied"
          }
        >
          <h4>
            Результат:{" "}
            {result.access_granted ? "Доступ дозволено" : "Доступ заборонено"}
          </h4>

          <p>
            <strong>Причина:</strong> {result.reason}
          </p>

          <div className="row-actions">
            {result.access_granted && (
              <button onClick={handleOpenResource}>
                Переглянути ресурс
              </button>
            )}

            {canShowEditButton() && (
              <button onClick={handleStartEditResource}>
                Редагувати ресурс
              </button>
            )}

            {openedResource && (
              <button onClick={() => setOpenedResource(null)}>
                Закрити ресурс
              </button>
            )}
          </div>

          <div className="access-details">
            <div>
              <h5>Користувач</h5>

              <p>
                <strong>ID:</strong> {result.user?.id}
              </p>

              <p>
                <strong>Username:</strong> {result.user?.username}
              </p>

              <p>
                <strong>Департамент:</strong> {result.user?.department}
              </p>

              <p>
                <strong>Посада:</strong> {result.user?.department_position}
              </p>

              <p>
                <strong>MAC-рівень:</strong> {result.user?.clearance_level}
              </p>

              <p>
                <strong>Ролі:</strong>{" "}
                {result.user?.roles?.length
                  ? result.user.roles.join(", ")
                  : "немає ролей"}
              </p>
            </div>

            <div>
              <h5>Ресурс</h5>

              <p>
                <strong>ID:</strong> {result.resource?.id}
              </p>

              <p>
                <strong>Назва:</strong> {result.resource?.name}
              </p>

              <p>
                <strong>Департамент:</strong> {result.resource?.department}
              </p>

              <p>
                <strong>Автор:</strong>{" "}
                {result.resource?.created_by_username || "не вказано"}
              </p>

              <p>
                <strong>Посада автора:</strong>{" "}
                {result.resource?.created_by_position || "не вказано"}
              </p>

              <p>
                <strong>Необхідний MAC-рівень:</strong>{" "}
                {result.resource?.required_clearance_level}
              </p>

              <p>
                <strong>Необхідний рівень позиції:</strong>{" "}
                {result.resource?.required_position_level}
              </p>

              <p>
                <strong>Дія:</strong> {result.action}
              </p>
            </div>
          </div>
        </div>
      )}

      {openedResource && (
        <div className="resource-view-box">
          <h4>Вміст ресурсу: {openedResource.name}</h4>

          <p>
            <strong>Департамент:</strong> {openedResource.department}
          </p>

          <p>
            <strong>Опис:</strong> {openedResource.description || "—"}
          </p>

          <p>
            <strong>Автор:</strong>{" "}
            {openedResource.created_by_username || "не вказано"}
          </p>

          <div className="resource-content-box">
            {openedResource.content || "Ресурс поки не має наповнення."}
          </div>
        </div>
      )}

      {editingResource && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>Редагування ресурсу</h3>
                <p>
                  Ресурс можна змінити лише тоді, коли перевірка доступу
                  дозволила дію <strong>write</strong> або{" "}
                  <strong>manage</strong>.
                </p>
              </div>

              <button className="danger" onClick={handleCancelEditResource}>
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleSaveResource}>
              <label>Назва ресурсу</label>
              <input
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
              />

              <label>Департамент</label>
              <input
                name="department"
                value={editForm.department}
                onChange={handleEditChange}
                required
              />

              <label>Необхідний рівень MAC</label>
              <input
                name="required_clearance_level"
                type="number"
                min="1"
                value={editForm.required_clearance_level}
                onChange={handleEditChange}
                required
              />

              <label>Необхідний рівень позиції</label>
              <input
                name="required_position_level"
                type="number"
                min="1"
                value={editForm.required_position_level}
                onChange={handleEditChange}
                required
              />

              <label>Опис ресурсу</label>
              <input
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                placeholder="Короткий опис ресурсу"
              />

              <label>Наповнення ресурсу</label>
              <textarea
                name="content"
                value={editForm.content}
                onChange={handleEditChange}
                rows="7"
                placeholder="Вміст ресурсу"
              />

              <div className="row-actions">
                <button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Збереження..." : "Зберегти зміни"}
                </button>

                <button type="button" onClick={handleCancelEditResource}>
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

export default AccessCheckSection;