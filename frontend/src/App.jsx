import { useEffect, useState } from "react";
import { apiGet } from "./api";
import LoginScreen from "./pages/LoginScreen";
import AdminPanel from "./pages/AdminPanel";
import UserPanel from "./pages/UserPanel";
import HealthPanel from "./pages/HealthPanel";
import CrossDepartmentAccessSection from "./pages/CrossDepartmentAccessSection";
import "./App.css";

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("currentUser");

    if (!savedUser) {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem("currentUser");
      return null;
    }
  });

  const [activePanel, setActivePanel] = useState("user");
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [userDashboard, setUserDashboard] = useState(null);
  const [health, setHealth] = useState(null);
  const [departmentTree, setDepartmentTree] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function isFullAdmin(user) {
    return (
      user?.is_admin === true ||
      user?.is_super_admin === true ||
      user?.username === "main.admin"
    );
  }

  function isDirector(user) {
    return user?.is_director === true || user?.username === "director";
  }

  function isDepartmentHead(user) {
    return (
      user?.is_department_admin === true ||
      user?.department_position === "department_head"
    );
  }

  function userCanLoadManagementData(user) {
    return isFullAdmin(user) || isDirector(user) || isDepartmentHead(user);
  }

  function getDefaultPanel(user) {
    if (isFullAdmin(user)) {
      return "admin";
    }

    if (isDirector(user)) {
      return "director";
    }

    if (isDepartmentHead(user)) {
      return "department";
    }

    return "user";
  }

  function handleLogin(user) {
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));

    setSelectedUserId(user.id);
    setActivePanel(getDefaultPanel(user));
  }

  function handleLogout() {
    setCurrentUser(null);
    setAdminDashboard(null);
    setUserDashboard(null);
    setHealth(null);
    setDepartmentTree(null);
    setSelectedUserId("");
    setError("");
    localStorage.removeItem("currentUser");
  }

  async function loadAdminDashboard() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/dashboard/admin");
      setAdminDashboard(data);
    } catch (err) {
      setError(err.message || "Не вдалося завантажити панель керування");
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartmentTree() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/departments/tree");
      setDepartmentTree(data);
    } catch (err) {
      setError(err.message || "Не вдалося завантажити дерево департаментів");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserDashboard(userId) {
    const targetUserId = userId || selectedUserId || currentUser?.id;

    if (!targetUserId) {
      setError("Не вказано ID користувача");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiGet(
        `/dashboard/user/${targetUserId}?include_denied=true`
      );

      setUserDashboard(data);
    } catch (err) {
      setError(err.message || "Не вдалося завантажити користувацьку панель");
    } finally {
      setLoading(false);
    }
  }

  async function loadHealth() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/health/details");
      setHealth(data);
    } catch (err) {
      setError(err.message || "Не вдалося завантажити стан системи");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (userCanLoadManagementData(currentUser)) {
      loadAdminDashboard();
      loadDepartmentTree();

      if (isFullAdmin(currentUser)) {
        loadHealth();
      }
    } else {
      setSelectedUserId(currentUser.id);
      loadUserDashboard(currentUser.id);
    }

    setActivePanel(getDefaultPanel(currentUser));
  }, [currentUser]);

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const fullAdmin = isFullAdmin(currentUser);
  const director = isDirector(currentUser);
  const departmentHead = isDepartmentHead(currentUser);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Hybrid RBAC/MAC Access Control</h1>

          <p>
            Ви увійшли як <strong>{currentUser.username}</strong>
          </p>

          {fullAdmin && (
            <p className="muted">Режим: системний адміністратор</p>
          )}

          {!fullAdmin && director && (
            <p className="muted">Режим: директорський рівень</p>
          )}

          {!fullAdmin && !director && departmentHead && (
            <p className="muted">
              Режим: начальник департаменту{" "}
              <strong>{currentUser.department}</strong>
            </p>
          )}
        </div>

        <div className="top-buttons">
          {fullAdmin && (
            <button onClick={() => setActivePanel("admin")}>
              Адмін-панель
            </button>
          )}

          {!fullAdmin && director && (
            <button onClick={() => setActivePanel("director")}>
              Панель директора
            </button>
          )}

          {!fullAdmin && !director && departmentHead && (
            <button onClick={() => setActivePanel("department")}>
              Панель департаменту
            </button>
          )}

          {departmentHead && !director && !fullAdmin && (
            <button onClick={() => setActivePanel("crossDepartment")}>
              Міждепартаментний доступ
            </button>
          )}

          <button onClick={() => setActivePanel("user")}>
            Користувацька панель
          </button>

          {fullAdmin && (
            <button onClick={() => setActivePanel("health")}>
              Стан системи
            </button>
          )}

          <button className="danger" onClick={handleLogout}>
            Вийти
          </button>
        </div>
      </header>

      {loading && <div className="info">Завантаження...</div>}

      {error && <div className="error">Помилка: {error}</div>}

      {activePanel === "admin" && fullAdmin && (
        <AdminPanel
          currentUser={currentUser}
          dashboard={adminDashboard}
          departmentTree={departmentTree}
          reloadDashboard={loadAdminDashboard}
          reloadDepartments={loadDepartmentTree}
          openHealthPanel={() => setActivePanel("health")}
        />
      )}

      {activePanel === "director" && director && (
        <AdminPanel
          currentUser={currentUser}
          dashboard={adminDashboard}
          departmentTree={departmentTree}
          reloadDashboard={loadAdminDashboard}
          reloadDepartments={loadDepartmentTree}
          openHealthPanel={() => setActivePanel("health")}
          panelMode="director"
        />
      )}

      {activePanel === "department" && departmentHead && !director && (
        <AdminPanel
          currentUser={currentUser}
          dashboard={adminDashboard}
          departmentTree={departmentTree}
          reloadDashboard={loadAdminDashboard}
          reloadDepartments={loadDepartmentTree}
          openHealthPanel={() => setActivePanel("health")}
          panelMode="department"
        />
      )}

      {activePanel === "crossDepartment" && departmentHead && !director && (
        <CrossDepartmentAccessSection currentUser={currentUser} />
      )}

      {activePanel === "user" && (
        <UserPanel
          currentUser={currentUser}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          dashboard={userDashboard}
          loadUserDashboard={loadUserDashboard}
        />
      )}

      {activePanel === "health" && fullAdmin && (
        <HealthPanel health={health} reloadHealth={loadHealth} />
      )}
    </div>
  );
}

export default App;