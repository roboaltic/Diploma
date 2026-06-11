import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api";

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
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.resources)) return data.resources;
  return [];
}

function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase();
}

function getItemId(item) {
  return item?.id ?? item?.request_id ?? item?.access_id;
}

function getUserName(item) {
  return (
    item?.user_username ||
    item?.target_username ||
    item?.username ||
    item?.user?.username ||
    "Невідомий користувач"
  );
}

function getResourceName(item) {
  return (
    item?.resource_name ||
    item?.resource?.name ||
    item?.resource_title ||
    item?.name ||
    "Невідомий ресурс"
  );
}

function getDepartmentLabel(department) {
  const value = normalizeDepartment(department);

  const labels = {
    hr: "HR-відділ",
    finance: "Фінансовий відділ",
    lawyer: "Юридичний відділ",
    engineer: "Інженерний відділ",
    system: "Системний департамент",
  };

  return labels[value] || department || "—";
}

function getPositionLabel(position) {
  const labels = {
    department_head: "начальник департаменту",
    deputy_head: "заступник начальника",
    employee: "співробітник",
  };

  return labels[position] || position || "—";
}

function getActionLabel(action) {
  const labels = {
    read: "перегляд",
    write: "редагування",
    manage: "керування",
    delete: "видалення",
  };

  return labels[action] || action || "—";
}

function getStatusLabel(status) {
  const labels = {
    pending: "очікує погодження",
    approved: "погоджено",
    rejected: "відхилено",
    revoked: "відкликано",
  };

  return labels[status] || status || "—";
}

function TabButton({ active, children, count, onClick }) {
  return (
    <button
      type="button"
      className={`cross-tab-button ${active ? "cross-tab-button-active" : ""}`}
      onClick={onClick}
    >
      <span>{children}</span>

      {Number(count) > 0 && (
        <span className="cross-tab-count">{count}</span>
      )}
    </button>
  );
}

function RequestCard({ item, mode, onApprove, onReject, onRevoke }) {
  const id = getItemId(item);

  return (
    <div className="cross-request-card">
      <div className="cross-request-card-header">
        <div>
          <strong>{getUserName(item)}</strong>
          <span>
            {getDepartmentLabel(item?.source_department || item?.department)}
          </span>
        </div>

        <span className={`cross-status cross-status-${item?.status || "pending"}`}>
          {getStatusLabel(item?.status || "pending")}
        </span>
      </div>

      <div className="cross-request-grid">
        <div>
          <span>Ресурс</span>
          <strong>{getResourceName(item)}</strong>
        </div>

        <div>
          <span>Дія</span>
          <strong>{getActionLabel(item?.action)}</strong>
        </div>

        <div>
          <span>Звідки</span>
          <strong>{getDepartmentLabel(item?.source_department)}</strong>
        </div>

        <div>
          <span>Куди</span>
          <strong>{getDepartmentLabel(item?.target_department)}</strong>
        </div>
      </div>

      {item?.reason && (
        <div className="cross-reason">
          <span>Причина запиту</span>
          <p>{item.reason}</p>
        </div>
      )}

      {item?.response_comment && (
        <div className="cross-reason">
          <span>Коментар рішення</span>
          <p>{item.response_comment}</p>
        </div>
      )}

      {mode === "incoming" && item?.status === "pending" && (
        <div className="cross-card-actions">
          <button
            type="button"
            className="cross-action-approve"
            onClick={() => onApprove(id)}
          >
            Погодити
          </button>

          <button
            type="button"
            className="cross-action-reject"
            onClick={() => onReject(id)}
          >
            Відхилити
          </button>
        </div>
      )}

      {mode === "active" && (
        <div className="cross-card-actions">
          <button
            type="button"
            className="cross-action-reject"
            onClick={() => onRevoke(id)}
          >
            Відкликати доступ
          </button>
        </div>
      )}
    </div>
  );
}

export default function CrossDepartmentAccessSection({ currentUser }) {
  const actor = currentUser || getSavedUser();

  const [activeTab, setActiveTab] = useState("create");

  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [activeAccesses, setActiveAccesses] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedAction, setSelectedAction] = useState("read");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isDepartmentHead =
    actor?.department_position === "department_head" ||
    actor?.is_department_head ||
    actor?.username?.endsWith(".head");

  const requestUsers = useMemo(() => {
    return users.filter((user) => {
      if (!user) return false;
      if (normalizeDepartment(user.department) === "system") return false;
      return true;
    });
  }, [users]);

  const externalResources = useMemo(() => {
    return resources.filter((resource) => {
      if (!resource) return false;
      if (normalizeDepartment(resource.department) === "system") return false;
      return true;
    });
  }, [resources]);

  async function loadOptionalList(paths) {
    for (const path of paths) {
      try {
        const data = await apiGet(path);
        return normalizeList(data);
      } catch {
        // Пробуємо наступний шлях
      }
    }

    return [];
  }

  async function loadData() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const [
        departmentUsersData,
        availableResourcesData,
        incomingData,
        outgoingData,
        activeData,
      ] = await Promise.all([
        loadOptionalList([
          "/cross-department-access/department-users",
          "/cross-department-access/department-users/",
        ]),
        loadOptionalList([
          "/cross-department-access/available-resources",
          "/cross-department-access/available-resources/",
        ]),
        loadOptionalList([
          "/cross-department-access/incoming",
          "/cross-department-access/incoming/",
        ]),
        loadOptionalList([
          "/cross-department-access/outgoing",
          "/cross-department-access/outgoing/",
        ]),
        loadOptionalList([
          "/cross-department-access/active",
          "/cross-department-access/active/",
        ]),
      ]);

      setUsers(departmentUsersData);
      setResources(availableResourcesData);
      setIncomingRequests(incomingData);
      setOutgoingRequests(outgoingData);
      setActiveAccesses(activeData);
    } catch (err) {
      setError(
        `Помилка завантаження даних: ${err?.message || "невідома помилка"}`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedUserId && requestUsers.length > 0) {
      setSelectedUserId(String(requestUsers[0].id));
    }
  }, [requestUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedResourceId && externalResources.length > 0) {
      setSelectedResourceId(String(externalResources[0].id));
    }
  }, [externalResources, selectedResourceId]);

  async function handleCreateRequest(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedUserId) {
      setError("Оберіть користувача, якому потрібно надати доступ.");
      return;
    }

    if (!selectedResourceId) {
      setError("Оберіть ресурс іншого департаменту.");
      return;
    }

    if (!reason.trim()) {
      setError("Вкажіть причину запиту.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiPost("/cross-department-access/", {
        user_id: Number(selectedUserId),
        resource_id: Number(selectedResourceId),
        action: selectedAction,
        reason: reason.trim(),
      });

      const successMessage =
        response?.message ||
        "Запит на міждепартаментний доступ створено.";

      setSuccess(successMessage);

      setReason("");
      await loadData();
      setActiveTab("outgoing");
    } catch (err) {
      setError(
        `Помилка створення запиту: ${err?.message || "невідома помилка"}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id) {
    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiPost(`/cross-department-access/${id}/approve`, {
        response_comment: "Запит погоджено начальником цільового департаменту.",
      });

      setSuccess(response?.message || "Запит погоджено.");
      await loadData();
    } catch (err) {
      setError(`Помилка погодження: ${err?.message || "невідома помилка"}`);
    }
  }

  async function handleReject(id) {
    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiPost(`/cross-department-access/${id}/reject`, {
        response_comment: "Запит відхилено начальником цільового департаменту.",
      });

      setSuccess(response?.message || "Запит відхилено.");
      await loadData();
    } catch (err) {
      setError(`Помилка відхилення: ${err?.message || "невідома помилка"}`);
    }
  }

  async function handleRevoke(id) {
    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiPost(`/cross-department-access/${id}/revoke`, {
        response_comment: "Раніше наданий доступ відкликано.",
      });

      setSuccess(response?.message || "Доступ відкликано.");
      await loadData();
    } catch (err) {
      setError(`Помилка відкликання: ${err?.message || "невідома помилка"}`);
    }
  }

  return (
    <section className="cross-section">
      <style>
        {`
          .cross-section {
            width: 100%;
          }

          .cross-title {
            text-align: center;
            margin-bottom: 10px;
          }

          .cross-description {
            max-width: 860px;
            margin: 0 auto 8px;
            text-align: center;
            color: #aeb9cc;
            line-height: 1.55;
          }

          .cross-refresh-row {
            display: flex;
            justify-content: center;
            margin: 10px 0 26px;
          }

          .cross-refresh-button,
          .cross-submit-button,
          .cross-tab-button,
          .cross-action-approve,
          .cross-action-reject {
            border: none;
            cursor: pointer;
            font-weight: 800;
            border-radius: 10px;
            transition: 0.2s ease;
          }

          .cross-refresh-button,
          .cross-submit-button {
            background: #2563eb;
            color: #ffffff;
            padding: 12px 18px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.25);
          }

          .cross-refresh-button:hover,
          .cross-submit-button:hover {
            transform: translateY(-1px);
            background: #1d4ed8;
          }

          .cross-tabs {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 14px;
            margin: 26px 0 20px;
          }

          .cross-tab-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            min-height: 46px;
            padding: 0 18px;
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.22);
          }

          .cross-tab-button:hover {
            transform: translateY(-1px);
            background: #1d4ed8;
          }

          .cross-tab-button-active {
            background: #1e40af;
            outline: 1px solid rgba(147, 197, 253, 0.55);
          }

          .cross-tab-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.18);
            color: #ffffff;
            font-size: 13px;
            line-height: 1;
          }

          .cross-message-error,
          .cross-message-success,
          .cross-message-info {
            border-radius: 10px;
            padding: 14px 18px;
            margin: 18px 0;
            text-align: center;
            font-weight: 700;
            line-height: 1.45;
          }

          .cross-message-error {
            color: #fecaca;
            background: rgba(127, 29, 29, 0.35);
            border: 1px solid rgba(239, 68, 68, 0.55);
          }

          .cross-message-success {
            color: #bbf7d0;
            background: rgba(20, 83, 45, 0.35);
            border: 1px solid rgba(34, 197, 94, 0.5);
          }

          .cross-message-info {
            color: #c7d2fe;
            background: rgba(30, 64, 175, 0.35);
            border: 1px solid rgba(96, 165, 250, 0.5);
          }

          .cross-panel {
            background: rgba(30, 41, 59, 0.88);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 22px;
            padding: 24px;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
          }

          .cross-panel h3 {
            text-align: center;
            margin-top: 0;
            margin-bottom: 12px;
          }

          .cross-panel-description {
            max-width: 900px;
            margin: 0 auto 18px;
            text-align: center;
            color: #cbd5e1;
            line-height: 1.55;
          }

          .cross-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .cross-form label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            color: #dbe4f0;
            font-weight: 800;
            text-align: center;
          }

          .cross-form select,
          .cross-form textarea {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 10px;
            background: #0f172a;
            color: #e5e7eb;
            padding: 13px 16px;
            font-size: 15px;
            font-weight: 700;
            outline: none;
          }

          .cross-form textarea {
            min-height: 120px;
            resize: vertical;
          }

          .cross-form-actions {
            display: flex;
            justify-content: center;
            margin-top: 6px;
          }

          .cross-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .cross-request-card {
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 16px;
            padding: 18px;
          }

          .cross-request-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
          }

          .cross-request-card-header div {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .cross-request-card-header strong {
            color: #ffffff;
          }

          .cross-request-card-header span {
            color: #94a3b8;
            font-size: 14px;
          }

          .cross-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 88px;
            padding: 7px 12px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 900;
            color: #ffffff;
          }

          .cross-status-pending {
            background: rgba(234, 179, 8, 0.22);
            border: 1px solid rgba(234, 179, 8, 0.45);
          }

          .cross-status-approved {
            background: rgba(34, 197, 94, 0.22);
            border: 1px solid rgba(34, 197, 94, 0.45);
          }

          .cross-status-rejected,
          .cross-status-revoked {
            background: rgba(239, 68, 68, 0.22);
            border: 1px solid rgba(239, 68, 68, 0.45);
          }

          .cross-request-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }

          .cross-request-grid div {
            background: rgba(30, 41, 59, 0.75);
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 12px;
            padding: 12px;
            min-width: 0;
          }

          .cross-request-grid span,
          .cross-reason span {
            display: block;
            margin-bottom: 5px;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 800;
          }

          .cross-request-grid strong {
            display: block;
            color: #e5e7eb;
            overflow-wrap: anywhere;
          }

          .cross-reason {
            margin-top: 14px;
            background: rgba(30, 41, 59, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 12px;
            padding: 12px;
          }

          .cross-reason p {
            margin: 0;
            color: #e5e7eb;
            line-height: 1.5;
          }

          .cross-card-actions {
            display: flex;
            justify-content: flex-end;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
          }

          .cross-action-approve,
          .cross-action-reject {
            color: #ffffff;
            padding: 10px 14px;
          }

          .cross-action-approve {
            background: #16a34a;
          }

          .cross-action-reject {
            background: #dc2626;
          }

          .cross-action-approve:hover,
          .cross-action-reject:hover {
            transform: translateY(-1px);
            filter: brightness(1.08);
          }

          @media (max-width: 900px) {
            .cross-request-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 560px) {
            .cross-request-grid {
              grid-template-columns: 1fr;
            }

            .cross-tab-button {
              width: 100%;
            }

            .cross-tabs {
              align-items: stretch;
            }
          }
        `}
      </style>

      <h2 className="cross-title">Міждепартаментний доступ</h2>

      <p className="cross-description">
        Начальник департаменту {getDepartmentLabel(actor?.department)} може
        створювати запити на доступ до ресурсів інших департаментів або
        погоджувати вхідні запити до ресурсів свого відділу.
      </p>

      <div className="cross-refresh-row">
        <button
          type="button"
          className="cross-refresh-button"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {error && <div className="cross-message-error">{error}</div>}
      {success && <div className="cross-message-success">{success}</div>}

      {!isDepartmentHead && (
        <div className="cross-message-info">
          Міждепартаментні запити доступні для начальника департаменту.
        </div>
      )}

      <div className="cross-tabs">
        <TabButton
          active={activeTab === "create"}
          onClick={() => setActiveTab("create")}
        >
          Створити запит
        </TabButton>

        <TabButton
          active={activeTab === "incoming"}
          count={incomingRequests.length}
          onClick={() => setActiveTab("incoming")}
        >
          Вхідні запити
        </TabButton>

        <TabButton
          active={activeTab === "outgoing"}
          count={outgoingRequests.length}
          onClick={() => setActiveTab("outgoing")}
        >
          Вихідні запити
        </TabButton>

        <TabButton
          active={activeTab === "active"}
          count={activeAccesses.length}
          onClick={() => setActiveTab("active")}
        >
          Активні доступи
        </TabButton>
      </div>

      {activeTab === "create" && (
        <div className="cross-panel">
          <h3>Створити запит на доступ</h3>

          <p className="cross-panel-description">
            Запит створюється для конкретного користувача, конкретного документа
            та конкретної дії. Після цього начальник цільового департаменту має
            погодити або відхилити запит.
          </p>

          <form className="cross-form" onSubmit={handleCreateRequest}>
            <label>
              Кому надати доступ
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {requestUsers.length === 0 && (
                  <option value="">Немає доступних користувачів департаменту</option>
                )}

                {requestUsers.map((user) => (
                  <option key={user.id || user.username} value={user.id}>
                    {user.username} — {getPositionLabel(user.department_position)} —
                    MAC {user.clearance_level ?? "—"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              До якого документа / ресурсу
              <select
                value={selectedResourceId}
                onChange={(event) => setSelectedResourceId(event.target.value)}
              >
                {externalResources.length === 0 && (
                  <option value="">Немає доступних ресурсів інших департаментів</option>
                )}

                {externalResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} — {getDepartmentLabel(resource.department)} —
                    MAC{" "}
                    {resource.required_clearance_level ??
                      resource.classification_level ??
                      "—"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Дія
              <select
                value={selectedAction}
                onChange={(event) => setSelectedAction(event.target.value)}
              >
                <option value="read">Перегляд</option>
                <option value="write">Редагування</option>
              </select>
            </label>

            <label>
              Причина запиту
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Наприклад: потрібен доступ для перевірки договору або підготовки звіту..."
              />
            </label>

            <div className="cross-form-actions">
              <button
                type="submit"
                className="cross-submit-button"
                disabled={submitting || !isDepartmentHead}
              >
                {submitting ? "Надсилання..." : "Надіслати запит"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "incoming" && (
        <div className="cross-panel">
          <h3>Вхідні запити</h3>

          {incomingRequests.length === 0 ? (
            <div className="cross-message-info">
              Вхідних запитів поки немає.
            </div>
          ) : (
            <div className="cross-list">
              {incomingRequests.map((item) => (
                <RequestCard
                  key={getItemId(item)}
                  item={item}
                  mode="incoming"
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "outgoing" && (
        <div className="cross-panel">
          <h3>Вихідні запити</h3>

          {outgoingRequests.length === 0 ? (
            <div className="cross-message-info">
              Вихідних запитів поки немає.
            </div>
          ) : (
            <div className="cross-list">
              {outgoingRequests.map((item) => (
                <RequestCard
                  key={getItemId(item)}
                  item={item}
                  mode="outgoing"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "active" && (
        <div className="cross-panel">
          <h3>Активні доступи</h3>

          {activeAccesses.length === 0 ? (
            <div className="cross-message-info">
              Активних міждепартаментних доступів поки немає.
            </div>
          ) : (
            <div className="cross-list">
              {activeAccesses.map((item) => (
                <RequestCard
                  key={getItemId(item)}
                  item={item}
                  mode="active"
                  onRevoke={handleRevoke}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}