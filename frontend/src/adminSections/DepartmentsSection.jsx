import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";

const emptyDepartmentForm = {
  name: "",
  description: "",
};

const emptyUserForm = {
  username: "",
  password: "",
  department: "",
  department_position: "employee",
  clearance_level: 1,
};

const emptyResourceForm = {
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

const POSITION_LABELS = {
  employee: "Підлеглий",
  deputy_head: "Заступник начальника",
  department_head: "Начальник департаменту",
};

const DEPARTMENT_LABELS = {
  hr: "HR-відділ",
  finance: "Фінансовий відділ",
  lawyer: "Юридичний відділ",
  engineer: "Інженерний відділ",
  system: "Системний відділ",
};

function DepartmentsSection({
  currentUser,
  departmentTree,
  reloadDepartments,
}) {
  const [tree, setTree] = useState([]);
  const [openedDepartments, setOpenedDepartments] = useState({});
  const [selectedResource, setSelectedResource] = useState(null);

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [resourceForm, setResourceForm] = useState(emptyResourceForm);

  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isGlobalAdmin = currentUser?.is_admin === true;
  const isDirector = currentUser?.is_director === true;
  const isDeputyDirector = currentUser?.is_deputy_director === true;

  const canManageDepartments =
    currentUser?.can_manage_departments === true || isGlobalAdmin || isDirector;

  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim().toLowerCase();
  }

  function getDepartmentKey(department) {
    if (!department) {
      return "";
    }

    if (typeof department === "string") {
      return normalizeText(department);
    }

    return normalizeText(
      department.name ||
        department.department ||
        department.department_name ||
        department.title ||
        ""
    );
  }

  function formatDepartmentName(department) {
    const key = getDepartmentKey(department);

    return DEPARTMENT_LABELS[key] || key || "не вказано";
  }

  function formatPosition(position) {
    const key = normalizeText(position);

    return POSITION_LABELS[key] || position || "не вказано";
  }

  function getPositionLevel(position) {
    const key = normalizeText(position);

    return POSITION_LEVELS[key] || 1;
  }

  function isSameDepartment(departmentName) {
    return (
      normalizeText(currentUser?.department) === normalizeText(departmentName)
    );
  }

  function canEditUser(user) {
    if (!currentUser || !user) {
      return false;
    }

    if (isGlobalAdmin) {
      return true;
    }

    if (isDirector || isDeputyDirector) {
      return false;
    }

    if (!isSameDepartment(user.department)) {
      return false;
    }

    const actorLevel = getPositionLevel(currentUser.department_position);
    const targetLevel = getPositionLevel(user.department_position);

    return actorLevel > targetLevel;
  }

  function canDeleteUser(user) {
    if (!canEditUser(user)) {
      return false;
    }

    return currentUser?.id !== user.id;
  }

  function canEditResource(resource) {
    if (!currentUser || !resource) {
      return false;
    }

    if (isGlobalAdmin) {
      return true;
    }

    if (isDirector || isDeputyDirector) {
      return false;
    }

    if (!isSameDepartment(resource.department)) {
      return false;
    }

    const actorLevel = getPositionLevel(currentUser.department_position);

    if (!resource.created_by_username && !resource.created_by_position) {
      return currentUser.department_position === "department_head";
    }

    const authorLevel =
      resource.created_by_position_level ||
      getPositionLevel(resource.created_by_position);

    return actorLevel >= authorLevel;
  }

  function canDeleteResource(resource) {
    return canEditResource(resource);
  }

  function canShowDepartmentActions(department) {
    if (!canManageDepartments) {
      return false;
    }

    return getDepartmentKey(department) !== "system";
  }

  async function loadTree() {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/departments/tree");

      if (Array.isArray(data)) {
        setTree(data);
      } else if (Array.isArray(data.departments)) {
        setTree(data.departments);
      } else {
        setTree([]);
      }
    } catch (err) {
      setError(err.message || "Не вдалося завантажити дерево департаментів");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTree() {
    if (reloadDepartments) {
      await reloadDepartments();
    }

    await loadTree();
  }

  useEffect(() => {
    if (Array.isArray(departmentTree)) {
      setTree(departmentTree);
    } else {
      loadTree();
    }
  }, [departmentTree]);

  function toggleDepartment(departmentKey) {
    setOpenedDepartments((prev) => ({
      ...prev,
      [departmentKey]: !prev[departmentKey],
    }));
  }

  function openCreateDepartmentModal() {
    setEditingDepartmentId(null);
    setDepartmentForm(emptyDepartmentForm);
    setMessage("");
    setError("");
    setDepartmentModalOpen(true);
  }

  function openEditDepartmentModal(department) {
    setEditingDepartmentId(department.id);
    setDepartmentForm({
      name: getDepartmentKey(department),
      description: department.description || "",
    });
    setMessage("");
    setError("");
    setDepartmentModalOpen(true);
  }

  function closeDepartmentModal() {
    setDepartmentModalOpen(false);
    setEditingDepartmentId(null);
    setDepartmentForm(emptyDepartmentForm);
  }

  function handleDepartmentChange(event) {
    const { name, value } = event.target;

    setDepartmentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleDepartmentSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const payload = {
      name: departmentForm.name.trim(),
      description: departmentForm.description.trim() || null,
    };

    if (!payload.name) {
      setError("Назва департаменту не може бути порожньою.");
      return;
    }

    try {
      if (editingDepartmentId) {
        await apiPut(`/departments/${editingDepartmentId}`, payload);
        setMessage("Департамент оновлено.");
      } else {
        await apiPost("/departments/", payload);
        setMessage("Департамент створено.");
      }

      closeDepartmentModal();
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося зберегти департамент");
    }
  }

  async function handleDeleteDepartment(department) {
    const confirmed = window.confirm(
      `Видалити департамент "${formatDepartmentName(
        department
      )}"? Видалити можна тільки порожній департамент.`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/departments/${department.id}`);
      setMessage("Департамент видалено.");
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося видалити департамент");
    }
  }

  function openEditUserModal(user) {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username || "",
      password: "",
      department: user.department || "",
      department_position: user.department_position || "employee",
      clearance_level: user.clearance_level || 1,
    });
    setMessage("");
    setError("");
    setUserModalOpen(true);
  }

  function closeUserModal() {
    setUserModalOpen(false);
    setEditingUserId(null);
    setUserForm(emptyUserForm);
  }

  function handleUserChange(event) {
    const { name, value } = event.target;

    setUserForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleUserSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const payload = {
      username: userForm.username.trim(),
      department: isGlobalAdmin
        ? userForm.department.trim()
        : currentUser.department,
      department_position: userForm.department_position,
      clearance_level: Number(userForm.clearance_level),
    };

    if (userForm.password.trim()) {
      payload.password = userForm.password;
    }

    try {
      await apiPut(`/users/${editingUserId}`, payload);
      setMessage("Користувача оновлено.");
      closeUserModal();
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося оновити користувача");
    }
  }

  async function handleResetPassword(user) {
    const confirmed = window.confirm(
      `Згенерувати тимчасовий пароль для "${user.username}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");
    setTemporaryPassword(null);

    try {
      const data = await apiPost(`/users/${user.id}/reset-password`, {
        generate_temporary: true,
      });

      setTemporaryPassword({
        username: data.username,
        password: data.temporary_password,
      });

      setMessage("Пароль скинуто.");
    } catch (err) {
      setError(err.message || "Не вдалося скинути пароль");
    }
  }

  async function handleDeleteUser(user) {
    const confirmed = window.confirm(
      `Видалити користувача "${user.username}"?`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/users/${user.id}`);
      setMessage("Користувача видалено.");
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося видалити користувача");
    }
  }

  function openEditResourceModal(resource) {
    setEditingResourceId(resource.id);
    setResourceForm({
      name: resource.name || "",
      department: resource.department || "",
      required_clearance_level: resource.required_clearance_level || 1,
      required_position_level: resource.required_position_level || 1,
      description: resource.description || "",
      content: resource.content || "",
    });
    setMessage("");
    setError("");
    setResourceModalOpen(true);
  }

  function closeResourceModal() {
    setResourceModalOpen(false);
    setEditingResourceId(null);
    setResourceForm(emptyResourceForm);
  }

  function handleResourceChange(event) {
    const { name, value } = event.target;

    setResourceForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleResourceSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const payload = {
      name: resourceForm.name.trim(),
      department: isGlobalAdmin
        ? resourceForm.department.trim()
        : currentUser.department,
      required_clearance_level: Number(resourceForm.required_clearance_level),
      required_position_level: Number(resourceForm.required_position_level),
      description: resourceForm.description.trim() || null,
      content: resourceForm.content.trim() || null,
    };

    try {
      await apiPut(`/resources/${editingResourceId}`, payload);
      setMessage("Ресурс оновлено.");
      closeResourceModal();
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося оновити ресурс");
    }
  }

  async function handleDeleteResource(resource) {
    const confirmed = window.confirm(`Видалити ресурс "${resource.name}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await apiDelete(`/resources/${resource.id}`);
      setMessage("Ресурс видалено.");
      await refreshTree();
    } catch (err) {
      setError(err.message || "Не вдалося видалити ресурс");
    }
  }

  function formatRoles(user) {
    if (!user.roles || user.roles.length === 0) {
      return "немає ролей";
    }

    return user.roles
      .map((role) => {
        if (typeof role === "string") {
          return role;
        }

        return role.name || `role_${role.id}`;
      })
      .join(", ");
  }

  return (
    <section className="card">
      <div className="section-title-row">
        <div>
          <h3>Департаменти</h3>
          <p>
            Дерево департаментів показує користувачів і ресурси за
            підрозділами. Кнопки редагування відображаються тільки там, де
            поточний користувач має відповідні права.
          </p>
        </div>

        <div className="row-actions">
          {canManageDepartments && (
            <button type="button" onClick={openCreateDepartmentModal}>
              Створити департамент
            </button>
          )}

          <button type="button" onClick={refreshTree}>
            Оновити дерево
          </button>
        </div>
      </div>

      {message && <div className="info small-info">{message}</div>}
      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="info">Завантаження департаментів...</div>}

      {temporaryPassword && (
        <div className="password-box">
          <strong>Тимчасовий пароль для {temporaryPassword.username}</strong>
          <code>{temporaryPassword.password}</code>
        </div>
      )}

      {selectedResource && (
        <div className="resource-view-box">
          <h4>Вміст ресурсу: {selectedResource.name}</h4>

          <p>
            <strong>Департамент:</strong>{" "}
            {formatDepartmentName(selectedResource.department)}
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
            {formatPosition(selectedResource.created_by_position)}
          </p>

          <div className="resource-content-box">
            {selectedResource.content || "Ресурс поки не має наповнення."}
          </div>

          <button type="button" onClick={() => setSelectedResource(null)}>
            Закрити ресурс
          </button>
        </div>
      )}

      {tree.length === 0 && !loading && (
        <div className="info">Департаментів поки немає.</div>
      )}

      {tree.map((department) => {
        const departmentKey = getDepartmentKey(department);
        const departmentDisplayName = formatDepartmentName(department);
        const isOpen = openedDepartments[departmentKey];

        const users = Array.isArray(department.users)
          ? department.users
          : [];

        const resources = Array.isArray(department.resources)
          ? department.resources
          : [];

        const usersCount =
          department.users_count ?? department.usersCount ?? users.length ?? 0;

        const resourcesCount =
          department.resources_count ??
          department.resourcesCount ??
          resources.length ??
          0;

        return (
          <div className="department" key={department.id || departmentKey}>
            <button
              className="department-title"
              type="button"
              onClick={() => toggleDepartment(departmentKey)}
            >
              <strong>{departmentDisplayName}</strong>

              <span>
                Користувачі: {usersCount} | Ресурси: {resourcesCount}
              </span>
            </button>

            {isOpen && (
              <div className="department-content">
                <div className="section-title-row">
                  <div>
                    <h4>{departmentDisplayName}</h4>
                    <p>{department.description || "Опис відсутній"}</p>
                  </div>

                  {canShowDepartmentActions(department) && (
                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => openEditDepartmentModal(department)}
                      >
                        Редагувати департамент
                      </button>

                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteDepartment(department)}
                      >
                        Видалити департамент
                      </button>
                    </div>
                  )}
                </div>

                <h4>Користувачі</h4>

                {users.length === 0 && (
                  <p className="muted">Користувачів у департаменті немає.</p>
                )}

                {users.map((user) => (
                  <div className="user-row" key={user.id}>
                    <div>
                      <strong>{user.username || "Без імені"}</strong>

                      <span>
                        Посада: {formatPosition(user.department_position)} |
                        MAC: {user.clearance_level ?? "—"} | Ролі:{" "}
                        {formatRoles(user)}
                      </span>
                    </div>

                    {(canEditUser(user) || canDeleteUser(user)) && (
                      <div className="row-actions">
                        {canEditUser(user) && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditUserModal(user)}
                            >
                              Редагувати
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                            >
                              Скинути пароль
                            </button>
                          </>
                        )}

                        {canDeleteUser(user) && (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Видалити
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <h4>Ресурси</h4>

                {resources.length === 0 && (
                  <p className="muted">Ресурсів у департаменті немає.</p>
                )}

                {resources.map((resource) => (
                  <div className="resource-row" key={resource.id}>
                    <div>
                      <strong>{resource.name || "Без назви"}</strong>

                      <span>
                        MAC: {resource.required_clearance_level ?? "—"} |
                        Позиція: {resource.required_position_level ?? "—"} |
                        Автор: {resource.created_by_username || "не вказано"}
                        {resource.created_by_position
                          ? ` (${formatPosition(resource.created_by_position)})`
                          : ""}
                      </span>
                    </div>

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedResource(resource)}
                      >
                        Відкрити
                      </button>

                      {canEditResource(resource) && (
                        <button
                          type="button"
                          onClick={() => openEditResourceModal(resource)}
                        >
                          Редагувати
                        </button>
                      )}

                      {canDeleteResource(resource) && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDeleteResource(resource)}
                        >
                          Видалити
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {departmentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>
                  {editingDepartmentId
                    ? "Редагування департаменту"
                    : "Створення департаменту"}
                </h3>
                <p>Керування структурними підрозділами системи.</p>
              </div>

              <button
                type="button"
                className="danger"
                onClick={closeDepartmentModal}
              >
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleDepartmentSubmit}>
              <label>Назва департаменту</label>
              <input
                name="name"
                value={departmentForm.name}
                onChange={handleDepartmentChange}
                required
              />

              <label>Опис</label>
              <input
                name="description"
                value={departmentForm.description}
                onChange={handleDepartmentChange}
              />

              <div className="row-actions">
                <button type="submit">
                  {editingDepartmentId ? "Зберегти" : "Створити"}
                </button>

                <button type="button" onClick={closeDepartmentModal}>
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>Редагування користувача</h3>
                <p>
                  Редагування доступне тільки для користувачів нижчого рівня в
                  межах власного департаменту.
                </p>
              </div>

              <button type="button" className="danger" onClick={closeUserModal}>
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleUserSubmit}>
              <label>Username</label>
              <input
                name="username"
                value={userForm.username}
                onChange={handleUserChange}
                required
              />

              <label>Новий пароль</label>
              <input
                name="password"
                type="password"
                value={userForm.password}
                onChange={handleUserChange}
                placeholder="Залишити порожнім, якщо не змінювати"
              />

              <label>Департамент</label>
              <input
                name="department"
                value={isGlobalAdmin ? userForm.department : currentUser?.department || ""}
                onChange={handleUserChange}
                disabled={!isGlobalAdmin}
                required
              />

              <label>Посада</label>
              <select
                name="department_position"
                value={userForm.department_position}
                onChange={handleUserChange}
              >
                <option value="employee">Підлеглий</option>
                <option value="deputy_head">Заступник начальника</option>
                <option value="department_head">Начальник департаменту</option>
              </select>

              <label>MAC-рівень</label>
              <input
                name="clearance_level"
                type="number"
                min="1"
                value={userForm.clearance_level}
                onChange={handleUserChange}
                required
              />

              <div className="row-actions">
                <button type="submit">Зберегти</button>

                <button type="button" onClick={closeUserModal}>
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resourceModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title-row">
              <div>
                <h3>Редагування ресурсу</h3>
                <p>
                  Редагування доступне тільки відповідно до департаменту та
                  посадової ієрархії.
                </p>
              </div>

              <button
                type="button"
                className="danger"
                onClick={closeResourceModal}
              >
                Закрити
              </button>
            </div>

            <form className="admin-form" onSubmit={handleResourceSubmit}>
              <label>Назва</label>
              <input
                name="name"
                value={resourceForm.name}
                onChange={handleResourceChange}
                required
              />

              <label>Департамент</label>
              <input
                name="department"
                value={isGlobalAdmin ? resourceForm.department : currentUser?.department || ""}
                onChange={handleResourceChange}
                disabled={!isGlobalAdmin}
                required
              />

              <label>MAC-рівень</label>
              <input
                name="required_clearance_level"
                type="number"
                min="1"
                value={resourceForm.required_clearance_level}
                onChange={handleResourceChange}
                required
              />

              <label>Рівень позиції</label>
              <input
                name="required_position_level"
                type="number"
                min="1"
                value={resourceForm.required_position_level}
                onChange={handleResourceChange}
                required
              />

              <label>Опис</label>
              <input
                name="description"
                value={resourceForm.description}
                onChange={handleResourceChange}
              />

              <label>Наповнення</label>
              <textarea
                name="content"
                value={resourceForm.content}
                onChange={handleResourceChange}
                rows="7"
              />

              <div className="row-actions">
                <button type="submit">Зберегти</button>

                <button type="button" onClick={closeResourceModal}>
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

export default DepartmentsSection;