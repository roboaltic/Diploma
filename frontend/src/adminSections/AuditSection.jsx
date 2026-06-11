import { useEffect, useState } from "react";
import { apiGet, apiDelete } from "../api";

function AuditSection() {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAuditLogs() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await apiGet("/audit/");

      if (Array.isArray(data)) {
        setLogs(data);
      } else if (Array.isArray(data.logs)) {
        setLogs(data.logs);
      } else if (Array.isArray(data.audit_logs)) {
        setLogs(data.audit_logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завантажити журнал аудиту");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogDetails(logId) {
    setDetailsLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await apiGet(`/audit/${logId}`);
      setSelectedLog(data);
    } catch (err) {
      setError(err.message || "Не вдалося завантажити деталі запису аудиту");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleDelete(log) {
    const confirmed = window.confirm(
      `Видалити запис аудиту #${log.id}?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiDelete(`/audit/${log.id}`);
      setMessage(`Запис аудиту #${log.id} видалено.`);

      if (selectedLog?.id === log.id) {
        setSelectedLog(null);
      }

      await loadAuditLogs();
    } catch (err) {
      setError(err.message || "Не вдалося видалити запис аудиту");
    }
  }

  useEffect(() => {
    loadAuditLogs();
  }, []);

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Date(value).toLocaleString("uk-UA");
    } catch {
      return value;
    }
  }

  function getResultLabel(result) {
    if (!result) {
      return "—";
    }

    if (result === "allowed" || result === "granted" || result === "success") {
      return "Дозволено";
    }

    if (result === "denied" || result === "blocked" || result === "failed") {
      return "Заборонено";
    }

    return result;
  }

  function getResultClass(result) {
    if (result === "allowed" || result === "granted" || result === "success") {
      return "success";
    }

    if (result === "denied" || result === "blocked" || result === "failed") {
      return "danger-text";
    }

    return "";
  }

  return (
    <section className="card">
      <h3>Журнал аудиту</h3>

      <p>
        У цьому розділі відображаються події системи: перевірки доступу,
        результат рішення RBAC/MAC, користувач, ресурс, дія та причина
        дозволу або заборони.
      </p>

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="info">Завантаження журналу аудиту...</div>}
      {detailsLoading && <div className="info">Завантаження деталей...</div>}

      <div className="row-actions">
        <button onClick={loadAuditLogs}>Оновити журнал</button>

        {selectedLog && (
          <button onClick={() => setSelectedLog(null)}>
            Закрити деталі
          </button>
        )}
      </div>

      {selectedLog && (
        <div className="access-result">
          <h4>Деталі запису аудиту #{selectedLog.id}</h4>

          <div className="access-details">
            <div>
              <h5>Користувач</h5>

              <p>
                <strong>ID:</strong> {selectedLog.user_id ?? "—"}
              </p>

              <p>
                <strong>Username:</strong> {selectedLog.username || "—"}
              </p>
            </div>

            <div>
              <h5>Ресурс</h5>

              <p>
                <strong>ID:</strong> {selectedLog.resource_id ?? "—"}
              </p>

              <p>
                <strong>Назва:</strong> {selectedLog.resource_name || "—"}
              </p>
            </div>
          </div>

          <p>
            <strong>Дія:</strong> {selectedLog.action || "—"}
          </p>

          <p>
            <strong>Результат:</strong>{" "}
            <span className={getResultClass(selectedLog.result)}>
              {getResultLabel(selectedLog.result)}
            </span>
          </p>

          <p>
            <strong>Причина:</strong> {selectedLog.reason || "—"}
          </p>

          <p>
            <strong>Дата створення:</strong>{" "}
            {formatDate(selectedLog.created_at)}
          </p>
        </div>
      )}

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Дата</th>
              <th>Користувач</th>
              <th>Ресурс</th>
              <th>Дія</th>
              <th>Результат</th>
              <th>Причина</th>
              <th>Дії</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan="8">Журнал аудиту поки порожній.</td>
              </tr>
            )}

            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>{formatDate(log.created_at)}</td>
                <td>
                  {log.username || "—"}
                  {log.user_id ? ` (#${log.user_id})` : ""}
                </td>
                <td>
                  {log.resource_name || "—"}
                  {log.resource_id ? ` (#${log.resource_id})` : ""}
                </td>
                <td>{log.action || "—"}</td>
                <td>
                  <span className={getResultClass(log.result)}>
                    {getResultLabel(log.result)}
                  </span>
                </td>
                <td>{log.reason || "—"}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => loadLogDetails(log.id)}>
                      Деталі
                    </button>

                    <button
                      className="danger"
                      onClick={() => handleDelete(log)}
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

export default AuditSection;
