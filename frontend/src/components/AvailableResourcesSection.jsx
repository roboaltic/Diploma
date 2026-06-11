import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";

function getSavedUser() {
  try {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.resources)) return data.resources;
  return [];
}

function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase();
}

function getDepartmentLabel(department) {
  const labels = {
    hr: "HR-відділ",
    finance: "Фінансовий відділ",
    lawyer: "Юридичний відділ",
    engineer: "Інженерний відділ",
    system: "Системний департамент",
  };

  return labels[normalizeDepartment(department)] || department || "—";
}

function getActionLabel(action) {
  const labels = {
    read: "перегляд",
    write: "редагування",
    manage: "керування",
    delete: "видалення",
  };

  return labels[action] || action || "перегляд";
}

function isTemporaryResource(resource) {
  return (
    resource?.temporary_access === true ||
    resource?.access_type === "temporary_cross_department" ||
    resource?.access_label === "тимчасовий доступ"
  );
}

function canEditResource(user, resource) {
  if (!user || !resource) return false;

  if (isTemporaryResource(resource)) return false;

  const userDepartment = normalizeDepartment(user.department);
  const resourceDepartment = normalizeDepartment(resource.department);

  if (!userDepartment || userDepartment !== resourceDepartment) {
    return false;
  }

  return (
    user.department_position === "department_head" ||
    user.department_position === "deputy_head" ||
    user.username === "main.admin"
  );
}

function getResourceContent(resource) {
  return (
    resource?.content ||
    resource?.description ||
    resource?.body ||
    `Документ: ${resource?.name || "—"}\nДепартамент: ${
      resource?.department || "—"
    }\n\nТекстовий вміст документа не задано.`
  );
}

export default function AvailableResourcesSection({ currentUser }) {
  const actor = currentUser || getSavedUser();

  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);

  const [editingResource, setEditingResource] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "document",
    required_clearance_level: 1,
    required_position_level: 1,
    content: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadResources() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiGet("/my-resources/");
      setResources(normalizeList(data));
    } catch (err) {
      setError(
        `Помилка завантаження доступних документів: ${
          err?.message || "невідома помилка"
        }`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResources();
  }, []);

  function startEditResource(resource) {
    setError("");
    setSuccess("");
    setSelectedResource(null);
    setEditingResource(resource);

    setEditForm({
      name: resource.name || "",
      type: resource.type || "document",
      required_clearance_level:
        resource.required_clearance_level ??
        resource.classification_level ??
        1,
      required_position_level: resource.required_position_level ?? 1,
      content: getResourceContent(resource),
    });
  }

  function cancelEdit() {
    setEditingResource(null);
    setEditForm({
      name: "",
      type: "document",
      required_clearance_level: 1,
      required_position_level: 1,
      content: "",
    });
  }

  function updateEditField(field, value) {
    setEditForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSaveResource(event) {
    event.preventDefault();

    if (!editingResource?.id) {
      setError("Не вдалося визначити ресурс для редагування.");
      return;
    }

    if (!editForm.name.trim()) {
      setError("Назва документа не може бути порожньою.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiPut(`/resources/${editingResource.id}`, {
        name: editForm.name.trim(),
        type: editForm.type || "document",
        department: editingResource.department,
        required_clearance_level: Number(editForm.required_clearance_level),
        required_position_level: Number(editForm.required_position_level),
        content: editForm.content,
        description: editForm.content,
      });

      setSuccess("Документ успішно оновлено.");
      cancelEdit();
      await loadResources();
    } catch (err) {
      setError(
        `Помилка збереження документа: ${
          err?.message || "невідома помилка"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="available-resources-section">
      <style>
        {`
          .available-resources-section {
            width: 100%;
            margin-top: 24px;
          }

          .available-resources-header {
            text-align: center;
            margin-bottom: 20px;
          }

          .available-resources-header h3 {
            margin: 0 0 8px;
            color: #e5e7eb;
          }

          .available-resources-header p {
            margin: 0;
            color: #aeb9cc;
            line-height: 1.5;
          }

          .available-resources-toolbar {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
          }

          .available-refresh-button,
          .available-open-button,
          .available-edit-button,
          .available-save-button,
          .available-cancel-button,
          .available-close-button {
            border: none;
            cursor: pointer;
            font-weight: 800;
            border-radius: 10px;
            transition: 0.2s ease;
          }

          .available-refresh-button,
          .available-open-button,
          .available-save-button {
            background: #2563eb;
            color: #ffffff;
            padding: 11px 16px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.22);
          }

          .available-edit-button {
            background: #16a34a;
            color: #ffffff;
            padding: 11px 16px;
            box-shadow: 0 10px 25px rgba(22, 163, 74, 0.2);
          }

          .available-cancel-button,
          .available-close-button {
            background: rgba(239, 68, 68, 0.9);
            color: #ffffff;
            padding: 11px 16px;
          }

          .available-refresh-button:hover,
          .available-open-button:hover,
          .available-edit-button:hover,
          .available-save-button:hover,
          .available-cancel-button:hover,
          .available-close-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.08);
          }

          .available-refresh-button:disabled,
          .available-save-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
            transform: none;
          }

          .available-message-error,
          .available-message-success,
          .available-message-info {
            border-radius: 10px;
            padding: 14px 18px;
            margin: 16px 0;
            text-align: center;
            font-weight: 700;
            line-height: 1.45;
          }

          .available-message-error {
            color: #fecaca;
            background: rgba(127, 29, 29, 0.35);
            border: 1px solid rgba(239, 68, 68, 0.55);
          }

          .available-message-success {
            color: #bbf7d0;
            background: rgba(20, 83, 45, 0.35);
            border: 1px solid rgba(34, 197, 94, 0.5);
          }

          .available-message-info {
            color: #c7d2fe;
            background: rgba(30, 64, 175, 0.35);
            border: 1px solid rgba(96, 165, 250, 0.5);
          }

          .available-resources-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
          }

          .available-resource-card {
            background: rgba(15, 23, 42, 0.86);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 18px;
            padding: 18px;
            box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
          }

          .available-resource-card h4 {
            margin: 0 0 12px;
            color: #ffffff;
            overflow-wrap: anywhere;
          }

          .available-resource-meta {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }

          .available-resource-meta div {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(30, 41, 59, 0.68);
            color: #cbd5e1;
          }

          .available-resource-meta span {
            color: #94a3b8;
            font-weight: 800;
          }

          .available-resource-meta strong {
            color: #e5e7eb;
            text-align: right;
          }

          .available-resource-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: fit-content;
            margin-bottom: 12px;
            padding: 7px 10px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 900;
            color: #ffffff;
            background: rgba(37, 99, 235, 0.35);
            border: 1px solid rgba(96, 165, 250, 0.5);
          }

          .available-resource-badge-temporary {
            background: rgba(234, 179, 8, 0.2);
            border-color: rgba(234, 179, 8, 0.55);
            color: #fde68a;
          }

          .available-card-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }

          .available-document-viewer,
          .available-edit-panel {
            margin-top: 22px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(34, 197, 94, 0.45);
            border-radius: 18px;
            padding: 20px;
          }

          .available-edit-panel {
            border-color: rgba(96, 165, 250, 0.55);
          }

          .available-document-viewer-header,
          .available-edit-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }

          .available-document-viewer-header h4,
          .available-edit-header h4 {
            margin: 0;
            color: #ffffff;
          }

          .available-document-content {
            white-space: pre-wrap;
            color: #e5e7eb;
            line-height: 1.55;
            background: rgba(30, 41, 59, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 12px;
            padding: 16px;
          }

          .available-edit-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .available-edit-form label {
            display: flex;
            flex-direction: column;
            gap: 7px;
            color: #dbe4f0;
            font-weight: 800;
          }

          .available-edit-form input,
          .available-edit-form textarea {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            background: #0f172a;
            color: #e5e7eb;
            padding: 13px 16px;
            font-size: 15px;
            font-weight: 700;
            outline: none;
          }

          .available-edit-form textarea {
            min-height: 180px;
            resize: vertical;
            line-height: 1.5;
          }

          .available-edit-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .available-edit-actions {
            display: flex;
            justify-content: flex-end;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 6px;
          }

          @media (max-width: 680px) {
            .available-edit-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <div className="available-resources-header">
        <h3>Доступні документи</h3>

        <p>
          Користувач {actor?.username || "—"} може переглядати документи свого
          департаменту, які відповідають його рівню MAC, а також ресурси,
          надані через погоджений міждепартаментний доступ. Начальник і
          заступник можуть редагувати документи свого департаменту.
        </p>
      </div>

      <div className="available-resources-toolbar">
        <button
          type="button"
          className="available-refresh-button"
          onClick={loadResources}
          disabled={loading}
        >
          {loading ? "Оновлення..." : "Оновити документи"}
        </button>
      </div>

      {error && <div className="available-message-error">{error}</div>}
      {success && <div className="available-message-success">{success}</div>}

      {!error && resources.length === 0 && (
        <div className="available-message-info">
          Наразі для цього користувача немає доступних документів.
        </div>
      )}

      {resources.length > 0 && (
        <div className="available-resources-grid">
          {resources.map((resource) => (
            <article
              key={`${resource.id}-${resource.access_request_id || "standard"}`}
              className="available-resource-card"
            >
              <div
                className={`available-resource-badge ${
                  isTemporaryResource(resource)
                    ? "available-resource-badge-temporary"
                    : ""
                }`}
              >
                {resource.access_label || "доступний ресурс"}
              </div>

              <h4>{resource.name}</h4>

              <div className="available-resource-meta">
                <div>
                  <span>ID</span>
                  <strong>{resource.id}</strong>
                </div>

                <div>
                  <span>Департамент</span>
                  <strong>{getDepartmentLabel(resource.department)}</strong>
                </div>

                <div>
                  <span>MAC</span>
                  <strong>
                    {resource.required_clearance_level ??
                      resource.classification_level ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Дія</span>
                  <strong>{getActionLabel(resource.access_action)}</strong>
                </div>
              </div>

              <div className="available-card-actions">
                <button
                  type="button"
                  className="available-open-button"
                  onClick={() => {
                    setSelectedResource(resource);
                    setEditingResource(null);
                  }}
                >
                  Відкрити документ
                </button>

                {canEditResource(actor, resource) && (
                  <button
                    type="button"
                    className="available-edit-button"
                    onClick={() => startEditResource(resource)}
                  >
                    Редагувати
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedResource && (
        <div className="available-document-viewer">
          <div className="available-document-viewer-header">
            <h4>{selectedResource.name}</h4>

            <button
              type="button"
              className="available-close-button"
              onClick={() => setSelectedResource(null)}
            >
              Закрити
            </button>
          </div>

          <div className="available-document-content">
            {getResourceContent(selectedResource)}
          </div>
        </div>
      )}

      {editingResource && (
        <div className="available-edit-panel">
          <div className="available-edit-header">
            <h4>Редагування документа: {editingResource.name}</h4>

            <button
              type="button"
              className="available-close-button"
              onClick={cancelEdit}
            >
              Закрити
            </button>
          </div>

          <form className="available-edit-form" onSubmit={handleSaveResource}>
            <label>
              Назва документа
              <input
                type="text"
                value={editForm.name}
                onChange={(event) =>
                  updateEditField("name", event.target.value)
                }
              />
            </label>

            <div className="available-edit-grid">
              <label>
                Рівень MAC
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={editForm.required_clearance_level}
                  onChange={(event) =>
                    updateEditField(
                      "required_clearance_level",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Рівень посади
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={editForm.required_position_level}
                  onChange={(event) =>
                    updateEditField(
                      "required_position_level",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <label>
              Вміст документа
              <textarea
                value={editForm.content}
                onChange={(event) =>
                  updateEditField("content", event.target.value)
                }
              />
            </label>

            <div className="available-edit-actions">
              <button
                type="button"
                className="available-cancel-button"
                onClick={cancelEdit}
              >
                Скасувати
              </button>

              <button
                type="submit"
                className="available-save-button"
                disabled={saving}
              >
                {saving ? "Збереження..." : "Зберегти зміни"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}