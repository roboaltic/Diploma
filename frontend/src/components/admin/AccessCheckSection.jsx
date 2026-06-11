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

function sameId(a, b) {
  return Number(a) === Number(b);
}

function getResourceId(resource) {
  return (
    resource?.id ??
    resource?.resource_id ??
    resource?.resource?.id ??
    null
  );
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

function getDecisionLabel(value) {
  if (
    value === true ||
    value === "ALLOW" ||
    value === "ALLOWED" ||
    value === "allowed" ||
    value === "ДОЗВОЛЕНО"
  ) {
    return "ДОЗВОЛЕНО";
  }

  if (
    value === false ||
    value === "DENY" ||
    value === "DENIED" ||
    value === "denied" ||
    value === "ЗАБОРОНЕНО"
  ) {
    return "ЗАБОРОНЕНО";
  }

  return value || "—";
}

function isAllowedResult(result) {
  return (
    result?.allowed === true ||
    result?.decision === "ALLOW" ||
    result?.access === "allowed"
  );
}

function getResourceClearance(resource) {
  return (
    resource?.required_clearance_level ??
    resource?.classification_level ??
    resource?.clearance_level ??
    "—"
  );
}

function getResourcePosition(resource) {
  return (
    resource?.required_position_level ??
    resource?.position_level ??
    "—"
  );
}

function getResourceTitle(resource) {
  const resourceId = getResourceId(resource);

  const name =
    resource?.name ||
    resource?.resource_name ||
    resource?.resource?.name ||
    "Невідомий ресурс";

  const department = getDepartmentLabel(
    resource?.department || resource?.resource?.department
  );

  const mac = getResourceClearance(resource);
  const position = getResourcePosition(resource);

  let label = `${resourceId ?? "—"} — ${name} | ${department} | MAC ${mac} | position ${position}`;

  if (resource?.temporary_access || resource?.access_label) {
    const accessFor = resource?.access_for_username
      ? ` для ${resource.access_for_username}`
      : "";

    label += ` | ${resource?.access_label || "тимчасовий доступ"}${accessFor}`;
  }

  return label;
}

export default function AccessCheckSection({ currentUser }) {
  const actor = currentUser || getSavedUser();

  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]);
  const [approvedResources, setApprovedResources] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedAction, setSelectedAction] = useState("read");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState(null);

  const actorDepartment = normalizeDepartment(actor?.department);

  const visibleUsers = useMemo(() => {
    const preparedUsers = users.filter((user) => {
      if (!user) return false;

      const userDepartment = normalizeDepartment(user.department);

      if (userDepartment === "system") return false;

      if (!actorDepartment || actorDepartment === "system") {
        return true;
      }

      return userDepartment === actorDepartment;
    });

    if (preparedUsers.length > 0) {
      return preparedUsers;
    }

    return actor
      ? [
          {
            id: actor.id,
            username: actor.username,
            department: actor.department,
            department_position: actor.department_position,
            clearance_level: actor.clearance_level,
          },
        ]
      : [];
  }, [users, actor, actorDepartment]);

  const selectedUser = useMemo(() => {
    return visibleUsers.find((user) => sameId(user.id, selectedUserId));
  }, [visibleUsers, selectedUserId]);

  const visibleResources = useMemo(() => {
    const selectedDepartment = normalizeDepartment(
      selectedUser?.department || actor?.department
    );

    const ownDepartmentResources = resources.filter((resource) => {
      if (!resource) return false;

      const resourceDepartment = normalizeDepartment(resource.department);

      if (resourceDepartment === "system") return false;

      if (!selectedDepartment || selectedDepartment === "system") {
        return true;
      }

      return resourceDepartment === selectedDepartment;
    });

    const temporaryResources = approvedResources
      .filter((resource) => {
        if (!resource) return false;

        const resourceDepartment = normalizeDepartment(
          resource.department || resource?.resource?.department
        );

        if (resourceDepartment === "system") return false;

        return true;
      })
      .map((resource) => ({
        ...resource,
        id: getResourceId(resource),
        temporary_access: true,
        access_label: resource.access_label || "тимчасовий доступ",
      }));

    const merged = [...ownDepartmentResources];

    temporaryResources.forEach((temporaryResource) => {
      const temporaryResourceId = getResourceId(temporaryResource);

      const exists = merged.some((resource) =>
        sameId(getResourceId(resource), temporaryResourceId)
      );

      if (!exists) {
        merged.push(temporaryResource);
      }
    });

    return merged;
  }, [resources, approvedResources, selectedUser, actor]);

  const selectedTemporaryResource = useMemo(() => {
    return visibleResources.find(
      (resource) =>
        sameId(getResourceId(resource), selectedResourceId) &&
        (resource.temporary_access || resource.access_label)
    );
  }, [visibleResources, selectedResourceId]);

  async function loadOptionalList(paths) {
    for (const path of paths) {
      try {
        const data = await apiGet(path);
        return normalizeList(data);
      } catch {
        // пробуємо наступний шлях
      }
    }

    return [];
  }

  async function postOptional(paths, payload) {
    let lastError = null;

    for (const path of paths) {
      try {
        return await apiPost(path, payload);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Не вдалося виконати POST-запит");
  }

  async function loadData() {
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const [usersData, resourcesData, approvedResourcesData] =
        await Promise.all([
          loadOptionalList(["/users/", "/users"]),
          loadOptionalList(["/resources/", "/resources"]),
          loadOptionalList([
            "/cross-department-access/approved-resources",
            "/cross-department-access/approved-resources/",
          ]),
        ]);

      setUsers(usersData);
      setResources(resourcesData);
      setApprovedResources(approvedResourcesData);

      console.log("APPROVED RESOURCES FROM FRONT:", approvedResourcesData);
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
    if (!selectedUserId && visibleUsers.length > 0) {
      setSelectedUserId(String(visibleUsers[0].id));
    }
  }, [visibleUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedResourceId && visibleResources.length > 0) {
      setSelectedResourceId(String(getResourceId(visibleResources[0])));
      return;
    }

    if (
      selectedResourceId &&
      visibleResources.length > 0 &&
      !visibleResources.some((resource) =>
        sameId(getResourceId(resource), selectedResourceId)
      )
    ) {
      setSelectedResourceId(String(getResourceId(visibleResources[0])));
      return;
    }

    if (visibleResources.length === 0) {
      setSelectedResourceId("");
    }
  }, [visibleResources, selectedResourceId]);

  async function handleCheckAccess(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setResult(null);

    if (!selectedUserId) {
      setError("Оберіть користувача.");
      return;
    }

    if (!selectedResourceId) {
      setError("Оберіть ресурс.");
      return;
    }

    if (
      selectedTemporaryResource?.access_for_user_id &&
      !sameId(selectedTemporaryResource.access_for_user_id, selectedUserId)
    ) {
      setError(
        `Цей тимчасовий доступ надано для користувача ${
          selectedTemporaryResource.access_for_username || "іншого користувача"
        }. Оберіть відповідного користувача у полі “Користувач”.`
      );
      return;
    }

    setChecking(true);

    try {
      const data = await postOptional(
        ["/access/check", "/access/check/"],
        {
          user_id: Number(selectedUserId),
          resource_id: Number(selectedResourceId),
          action: selectedAction,
        }
      );

      setResult(data);
    } catch (err) {
      setError(
        `Помилка перевірки доступу: ${err?.message || "невідома помилка"}`
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="access-check-section">
      <style>
        {`
          .access-check-section {
            width: 100%;
          }

          .access-check-title {
            text-align: center;
            margin-bottom: 12px;
            color: #e5e7eb;
          }

          .access-check-description {
            max-width: 920px;
            margin: 0 auto 24px;
            text-align: center;
            color: #cbd5e1;
            line-height: 1.55;
          }

          .access-check-toolbar {
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
          }

          .access-check-refresh,
          .access-check-submit {
            border: none;
            cursor: pointer;
            font-weight: 800;
            border-radius: 10px;
            transition: 0.2s ease;
            background: #2563eb;
            color: #ffffff;
            padding: 12px 18px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.25);
          }

          .access-check-refresh:hover,
          .access-check-submit:hover {
            transform: translateY(-1px);
            background: #1d4ed8;
          }

          .access-check-refresh:disabled,
          .access-check-submit:disabled {
            cursor: not-allowed;
            opacity: 0.65;
            transform: none;
          }

          .access-check-panel {
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 18px;
            padding: 24px;
          }

          .access-check-panel h3 {
            text-align: center;
            margin-top: 0;
            margin-bottom: 20px;
            color: #e5e7eb;
          }

          .access-check-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .access-check-form label {
            display: flex;
            flex-direction: column;
            gap: 8px;
            color: #dbe4f0;
            font-weight: 800;
            text-align: center;
          }

          .access-check-form select {
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

          .access-check-actions {
            display: flex;
            justify-content: center;
            margin-top: 6px;
          }

          .access-message-error,
          .access-message-success,
          .access-message-info {
            border-radius: 10px;
            padding: 14px 18px;
            margin: 18px 0;
            text-align: center;
            font-weight: 700;
            line-height: 1.45;
          }

          .access-message-error {
            color: #fecaca;
            background: rgba(127, 29, 29, 0.35);
            border: 1px solid rgba(239, 68, 68, 0.55);
          }

          .access-message-success {
            color: #bbf7d0;
            background: rgba(20, 83, 45, 0.35);
            border: 1px solid rgba(34, 197, 94, 0.5);
          }

          .access-message-info {
            color: #c7d2fe;
            background: rgba(30, 64, 175, 0.35);
            border: 1px solid rgba(96, 165, 250, 0.5);
          }

          .temporary-resource-note {
            margin-top: 18px;
            border-radius: 12px;
            padding: 14px 16px;
            background: rgba(234, 179, 8, 0.12);
            border: 1px solid rgba(234, 179, 8, 0.45);
            color: #fde68a;
            font-weight: 700;
            line-height: 1.45;
            text-align: center;
          }

          .access-result {
            margin-top: 22px;
            border-radius: 16px;
            padding: 18px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            background: rgba(15, 23, 42, 0.92);
          }

          .access-result-allow {
            border-color: rgba(34, 197, 94, 0.58);
          }

          .access-result-deny {
            border-color: rgba(239, 68, 68, 0.58);
          }

          .access-result h4 {
            margin: 0 0 14px;
            text-align: center;
            color: #ffffff;
          }

          .access-result-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }

          .access-result-item {
            background: rgba(30, 41, 59, 0.75);
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 12px;
            padding: 12px;
            min-width: 0;
          }

          .access-result-item span {
            display: block;
            margin-bottom: 5px;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 800;
          }

          .access-result-item strong {
            display: block;
            color: #e5e7eb;
            overflow-wrap: anywhere;
          }

          .access-reason {
            margin-top: 14px;
            background: rgba(30, 41, 59, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 12px;
            padding: 12px;
          }

          .access-reason span {
            display: block;
            margin-bottom: 5px;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 800;
          }

          .access-reason p {
            margin: 0;
            color: #e5e7eb;
            line-height: 1.5;
          }

          @media (max-width: 760px) {
            .access-result-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      <h2 className="access-check-title">Перевірка доступу</h2>

      <p className="access-check-description">
        У цьому розділі можна виконати тестову перевірку доступу: обрати
        користувача, ресурс і дію. Якщо міждепартаментний доступ погоджено,
        ресурс з’явиться у списку з поміткою “тимчасовий доступ”.
      </p>

      <div className="access-check-toolbar">
        <button
          type="button"
          className="access-check-refresh"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? "Оновлення..." : "Оновити"}
        </button>
      </div>

      {error && <div className="access-message-error">{error}</div>}
      {success && <div className="access-message-success">{success}</div>}

      <div className="access-check-panel">
        <h3>Параметри перевірки</h3>

        <form className="access-check-form" onSubmit={handleCheckAccess}>
          <label>
            Користувач
            <select
              value={selectedUserId}
              onChange={(event) => {
                setSelectedUserId(event.target.value);
                setSelectedResourceId("");
                setResult(null);
                setError("");
              }}
            >
              {visibleUsers.length === 0 && (
                <option value="">Немає доступних користувачів</option>
              )}

              {visibleUsers.map((user) => (
                <option key={user.id || user.username} value={user.id}>
                  {user.id} — {user.username} |{" "}
                  {getDepartmentLabel(user.department)} | MAC{" "}
                  {user.clearance_level ?? "—"} |{" "}
                  {getPositionLabel(user.department_position)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ресурс
            <select
              value={selectedResourceId}
              onChange={(event) => {
                setSelectedResourceId(event.target.value);
                setResult(null);
                setError("");
              }}
            >
              {visibleResources.length === 0 && (
                <option value="">Немає доступних ресурсів</option>
              )}

              {visibleResources.map((resource) => {
                const resourceId = getResourceId(resource);

                return (
                  <option
                    key={`${resourceId}-${resource.access_request_id || "own"}`}
                    value={resourceId}
                  >
                    {getResourceTitle(resource)}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Дія
            <select
              value={selectedAction}
              onChange={(event) => {
                setSelectedAction(event.target.value);
                setResult(null);
                setError("");
              }}
            >
              <option value="read">Перегляд</option>
              <option value="write">Редагування</option>
              <option value="manage">Керування</option>
              <option value="delete">Видалення</option>
            </select>
          </label>

          {selectedTemporaryResource && (
            <div className="temporary-resource-note">
              Обраний ресурс має статус: тимчасовий міждепартаментний доступ.
              {selectedTemporaryResource.access_for_username
                ? ` Доступ надано для користувача ${selectedTemporaryResource.access_for_username}.`
                : ""}
            </div>
          )}

          <div className="access-check-actions">
            <button
              type="submit"
              className="access-check-submit"
              disabled={checking}
            >
              {checking ? "Перевірка..." : "Перевірити доступ"}
            </button>
          </div>
        </form>

        {result && (
          <div
            className={`access-result ${
              isAllowedResult(result)
                ? "access-result-allow"
                : "access-result-deny"
            }`}
          >
            <h4>
              Результат:{" "}
              {getDecisionLabel(result.allowed ?? result.decision)}
            </h4>

            <div className="access-result-grid">
              <div className="access-result-item">
                <span>RBAC</span>
                <strong>
                  {getDecisionLabel(
                    result.rbac ??
                      result.rbac_result ??
                      result.RBAC_ALLOWED
                  )}
                </strong>
              </div>

              <div className="access-result-item">
                <span>MAC</span>
                <strong>
                  {getDecisionLabel(
                    result.mac ??
                      result.mac_result ??
                      result.MAC_ALLOWED
                  )}
                </strong>
              </div>

              <div className="access-result-item">
                <span>Дія</span>
                <strong>{getActionLabel(selectedAction)}</strong>
              </div>
            </div>

            <div className="access-reason">
              <span>Пояснення</span>
              <p>
                {result.reason ||
                  result.message ||
                  result.calculation ||
                  "Перевірку виконано."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}