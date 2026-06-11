import { useState } from "react";
import AdminMenu from "../components/admin/AdminMenu";
import UsersSection from "../adminSections/UsersSection";
import RolesSection from "../adminSections/RolesSection";
import ResourcesSection from "../adminSections/ResourcesSection";
import DepartmentsSection from "../adminSections/DepartmentsSection";
import AccessCheckSection from "../adminSections/AccessCheckSection";
import AuditSection from "../adminSections/AuditSection";

function AdminPanel({
  currentUser,
  dashboard,
  departmentTree,
  reloadDashboard,
  reloadDepartments,
  openHealthPanel,
}) {
  const [adminSection, setAdminSection] = useState("users");

  const isGlobalAdmin = currentUser?.is_admin === true;
  const isDepartmentAdmin =
    !isGlobalAdmin && currentUser?.is_department_admin === true;

  const stats = dashboard?.stats || {};

  const panelTitle = isDepartmentAdmin
    ? `Панель департаменту ${currentUser.department}`
    : "Адміністративна панель";

  const panelDescription = isDepartmentAdmin
    ? "Керування користувачами, ресурсами та перевірками доступу в межах власного департаменту."
    : "Керування користувачами, департаментами, ресурсами, ролями, журналом аудиту та станом системи.";

  function renderSection() {
    if (adminSection === "users") {
      return <UsersSection currentUser={currentUser} />;
    }

    if (adminSection === "roles" && isGlobalAdmin) {
      return <RolesSection />;
    }

    if (adminSection === "resources") {
      return <ResourcesSection currentUser={currentUser} />;
    }

    if (adminSection === "departments") {
      return (
        <DepartmentsSection
          currentUser={currentUser}
          departmentTree={departmentTree}
          reloadDepartments={reloadDepartments}
        />
      );
    }

    if (adminSection === "access-check") {
      return <AccessCheckSection />;
    }

    if (adminSection === "audit" && isGlobalAdmin) {
      return <AuditSection />;
    }

    return (
      <section className="card">
        <h3>Розділ недоступний</h3>
        <p>У вас немає прав для перегляду цього розділу.</p>
      </section>
    );
  }

  return (
    <main className="panel">
      <section className="panel-header">
        <div>
          <h2>{panelTitle}</h2>
          <p>{panelDescription}</p>
        </div>

        <div className="row-actions">
          <button onClick={reloadDashboard}>Оновити статистику</button>

          <button
            onClick={() => {
              setAdminSection("departments");
              reloadDepartments();
            }}
          >
            Відкрити департаменти
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>Користувачі</span>
          <strong>{stats.users_count ?? 0}</strong>
        </div>

        {isGlobalAdmin && (
          <div className="stat-card">
            <span>Ролі</span>
            <strong>{stats.roles_count ?? 0}</strong>
          </div>
        )}

        <div className="stat-card">
          <span>Ресурси</span>
          <strong>{stats.resources_count ?? 0}</strong>
        </div>

        <div className="stat-card">
          <span>Департаменти</span>
          <strong>{stats.departments_count ?? 0}</strong>
        </div>

        {isGlobalAdmin && (
          <div className="stat-card">
            <span>Audit logs</span>
            <strong>{stats.audit_logs_count ?? 0}</strong>
          </div>
        )}
      </section>

      <AdminMenu
        activeSection={adminSection}
        setActiveSection={setAdminSection}
        openHealthPanel={openHealthPanel}
        currentUser={currentUser}
      />

      {renderSection()}
    </main>
  );
}

export default AdminPanel;