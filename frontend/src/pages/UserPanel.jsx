import { useEffect } from "react";
import AvailableResourcesSection from "../components/AvailableResourcesSection";

function UserPanel({
  currentUser,
  dashboard,
  loadUserDashboard,
}) {
  useEffect(() => {
    if (currentUser?.id) {
      loadUserDashboard(currentUser.id);
    }
  }, [currentUser?.id]);

  const user = dashboard?.user || currentUser;

  const deniedResources = (dashboard?.denied_resources || []).filter(
    (resource) => resource.department === currentUser.department
  );

  function formatRoles(roles) {
    if (!roles || roles.length === 0) {
      return "немає ролей";
    }

    return roles
      .map((role) => {
        if (typeof role === "string") {
          return role;
        }

        return role.name || `role_${role.id}`;
      })
      .join(", ");
  }

  return (
    <main className="panel">
      <section className="panel-header">
        <div>
          <h2>Користувацька панель</h2>
          <p>
            Перегляд власного профілю, департаменту та доступних ресурсів.
          </p>
        </div>

        <div className="user-selector">
          <button onClick={() => loadUserDashboard(currentUser.id)}>
            Оновити профіль
          </button>
        </div>
      </section>

      {!dashboard && (
        <div className="card">
          <p>Завантаження користувацької панелі...</p>
        </div>
      )}

      {dashboard && (
        <>
          <section className="card">
            <h3>Мій профіль</h3>

            <p>
              <strong>Ім’я:</strong> {user.username}
            </p>

            <p>
              <strong>Департамент:</strong> {user.department}
            </p>

            <p>
              <strong>Посада:</strong>{" "}
              {user.department_position_label ||
                user.department_position ||
                "не вказано"}
            </p>

            <p>
              <strong>Рівень доступу:</strong> {user.clearance_level}
            </p>

            <p>
              <strong>Ролі:</strong> {formatRoles(user.roles)}
            </p>
          </section>

          <AvailableResourcesSection currentUser={currentUser} />

          <section className="card">
            <h3>Недоступні ресурси мого департаменту</h3>

            {deniedResources.length === 0 && (
              <p className="muted">
                Немає недоступних ресурсів у межах вашого департаменту.
              </p>
            )}

            {deniedResources.map((resource) => (
              <div className="resource-row denied" key={resource.id}>
                <strong>{resource.name}</strong>
                <span>{resource.reason}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default UserPanel;