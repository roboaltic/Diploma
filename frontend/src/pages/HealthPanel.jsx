import StatCard from "../components/StatCard";

function HealthPanel({ health, reloadHealth }) {
  return (
    <main className="panel">
      <section className="panel-header">
        <div>
          <h2>Стан системи</h2>
          <p>Перевірка доступності API та підключення до бази даних.</p>
        </div>

        <button onClick={reloadHealth}>Перевірити стан</button>
      </section>

      {health && (
        <section className="card">
          <h3>
            Статус:{" "}
            <span className={health.status === "ok" ? "success" : "danger-text"}>
              {health.status}
            </span>
          </h3>

          <p>
            <strong>API:</strong> {health.api}
          </p>

          <p>
            <strong>База даних:</strong> {health.database}
          </p>

          {health.statistics && (
            <div className="stats-grid">
              <StatCard
                title="Користувачі"
                value={health.statistics.users_count}
              />
              <StatCard title="Ролі" value={health.statistics.roles_count} />
              <StatCard
                title="Ресурси"
                value={health.statistics.resources_count}
              />
              <StatCard
                title="Департаменти"
                value={health.statistics.departments_count}
              />
              <StatCard
                title="Audit logs"
                value={health.statistics.audit_logs_count}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default HealthPanel;