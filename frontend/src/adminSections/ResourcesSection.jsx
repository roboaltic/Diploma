import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";

const emptyForm = {
  name: "",
  department: "",
  required_clearance_level: 1,
  required_position_level: 1,
  description: "",
  content: "",
};

const POSITION_LEVELS = {
  employee: 1,
  deputy_head: 2,
  department_head: 3,
};

function ResourcesSection({ currentUser }) {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isGlobalAdmin = currentUser?.is_admin === true;

  function normalizeDepartment(value) {
    return (value || "").trim().toLowerCase();
  }

  function getPositionLevel(position) {
    return POSITION_LEVELS[position] || 1;
  }

  function canManageResource(resource) {
    if (!currentUser) {
      return false;
    }

    if (isGlobalAdmin) {
      return true;
    }

    const userDepartment = normalizeDepartment(currentUser.department);
    const resourceDepartment = normalizeDepartment(resource.department);

    if (userDepartment !== resourceDepartment) {
      return false;
    }

    const actorLevel = getPositionLevel(currentUser.department_position);

    const authorLevel =
      resource.created_by_position_level ||
      getPositionLevel(resource.created_by_position);

    return actorLevel >= authorLevel;
  }

  async function loadResources() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/resources/");

      if (Array.isArray(data)) {
        setResources(data);
      } else if (Array.isArray(data.resources)) {
        setResources(data.resources);
      } else {
        setResources([]);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завантажити ресурси");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResources();
  }, []);

  function openCreateModal() {
    setEditingResourceId(null);

    setForm({
      ...emptyForm,
      department: isGlobalAdmin ? "" : currentUser?.department || "",
    });

    setMessage("");
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(resource) {
    setEditingResourceId(resource.id);

    setForm({
      name: resource.name || "",
      department: resource.department || "",
      required_clearance_level: resource.required_clearance_level || 1,
      required_position_level: resource.required_position_level || 1,
      description: resource.description || "",
      content: resource.content || "",
    });

    setMessage("");
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingResourceId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      department: isGlobalAdmin
        ? form.department.trim()
        : currentUser?.department || "",
      required_clearance_level: Number(form.required_clearance_level),
      required_position_level: Number(form.required_position_level),
      description: form.description.trim() || null,
      content: form.content.trim() || null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const payload = buildPayload();

    if (!payload.name) {
      setError("Назва ресурсу не може бути порожньою.");
      return;
    }

    if (!payload.department) {
      setError("Департамент ресурсу не може бути порожнім.");
      return;
    }

    try {
      if (editingResourceId) {
        await apiPut(`/resources/${editingResourceId}`, payload);
        setMessage("Ресурс оновлено.");
      } else {
        await apiPost("/resources/", payload);
        setMessage("Ресурс створено.");
      }

      closeModal();
      await loadResources();
    } catch (err) {
      setError(err.message || "Помилка при збереженні ресурсу");
    }
  }

  async function handleDelete(resource) {
    const confirmed = window.confirm(
      `Видалити ресурс "${resource.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/resources/${resource.id}`);
      setMessage("Ресурс видалено.");
      await loadResources();
    } catch (err) {
      setError(err.message || "Не вдалося видалити ресурс");
    }
  }

  return (
    <section className="card">
      <div className="section-title-row">
        <div>
          <h3>Ресурси</h3>

          <p>
            У цьому розділі реалізовано створення, перегляд і редагування
            ресурсів. Для начальників, заступників і працівників дії
            обмежуються межами власного департаменту та посадовою ієрархією.
          </p>
        </div>

        <button onClick={openCreateModal}>Створити ресурс</button>
      </div>

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="info">Завантаження ресурсів...</div>}

      {selectedResource && (
        <div className="resource-view-box">
          <h4>Вміст ресурсу: {selectedResource.name}</h4>

          <p>
            <strong>Департамент:</strong> {selectedResource.department}
          </p>

          <p>
            <strong>Опис:</strong> {selectedResource.description || "—"}
          </p>

          <p>
            <strong>Автор:</strong>{" "}
            {selectedResource.created_by_username || "не вказано"}
          </p>

          <p>
            <strong>Посада автора:</strong>{" "}
            {selectedResource.created_by_position || "не вказано"}
          </p>

          <div className="resource-content-box">
            {selectedResource.content || "Ресурс поки не має наповнення."}
          </div>

          <button onClick={() => setSelectedResource(null)}>
            Закрити ресурс
          </button>
        </div>
      )}

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Назва</th>
              <th>Департамент</th>
              <th>MAC</th>
              <th>Позиція</th>
              <th>Автор</th>
              <th>Посада автора</th>
              <th>Контент</th>
              <th>Дії</th>
            </tr>
          </thead>

          <tbody>
            {resources.length === 0 && !loading && (
              <tr>
                <td colSpan="9">Ресурсів поки немає.</td>
              </tr>
            )}

            {resources.map((resource) => {
              const canEdit = canManageResource(resource);

              return (
                <tr key={resource.id}>
                  <td>{resource.id}</td>
                  <td>{resource.name}</td>
                  <td>{resource.department || "—"}</td>
                  <td>{resource.required_clearance_level ?? "—"}</td>
                  <td>{resource.required_position_level ?? "—"}</td>
                  <td>{resource.created_by_username || "не вказано"}</td>
                  <td>{resource.created_by_position || "не вказано"}</td>
                  <td>{resource.content ? "є" : "немає"}</td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setSelectedResource(resource)}>
                        Відкрити
                      </button>

                      {canEdit && (
                        <>
                          <button onClick={() => openEditModal(resource)}>
                            Редагувати
                          </button>

                          <button
                            className="danger"
                            onClick={() => handleDelete(resource)}
                          >
                            Видалити
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>
                  {editingResourceId
                    ? "Редагування ресурсу"
                    : "Створення ресурсу"}
                </h3>

                <p>
                  Ресурс створюється в межах доступного департаменту.
                  Редагування дозволене лише відповідно до посадової ієрархії.
                </p>
              </div>

              <button className="danger" onClick={closeModal}>
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>Назва ресурсу</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Наприклад: hr_employee_notes"
                required
              />

              <label>Департамент</label>
              <input
                name="department"
                value={isGlobalAdmin ? form.department : currentUser?.department || ""}
                onChange={handleChange}
                disabled={!isGlobalAdmin}
                required
              />

              <label>Необхідний рівень MAC</label>
              <input
                name="required_clearance_level"
                type="number"
                min="1"
                value={form.required_clearance_level}
                onChange={handleChange}
                required
              />

              <label>Необхідний рівень позиції</label>
              <input
                name="required_position_level"
                type="number"
                min="1"
                value={form.required_position_level}
                onChange={handleChange}
                required
              />

              <label>Опис ресурсу</label>
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Короткий опис ресурсу"
              />

              <label>Наповнення ресурсу</label>
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                rows="7"
                placeholder="Вміст ресурсу"
              />

              <div className="row-actions">
                <button type="submit">
                  {editingResourceId ? "Зберегти зміни" : "Створити"}
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

export default ResourcesSection;