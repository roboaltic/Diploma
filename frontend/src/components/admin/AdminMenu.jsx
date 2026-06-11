function AdminMenu({
  activeSection,
  setActiveSection,
  openHealthPanel,
  currentUser,
}) {
  const isGlobalAdmin = currentUser?.is_admin === true;

  function getButtonClass(sectionName) {
    return activeSection === sectionName ? "active" : "";
  }

  return (
    <section className="button-grid">
      <button
        className={getButtonClass("users")}
        onClick={() => setActiveSection("users")}
      >
        Користувачі
      </button>

      {isGlobalAdmin && (
        <button
          className={getButtonClass("roles")}
          onClick={() => setActiveSection("roles")}
        >
          Ролі
        </button>
      )}

      <button
        className={getButtonClass("resources")}
        onClick={() => setActiveSection("resources")}
      >
        Ресурси
      </button>

      <button
        className={getButtonClass("departments")}
        onClick={() => setActiveSection("departments")}
      >
        Департамент
      </button>

      <button
        className={getButtonClass("access-check")}
        onClick={() => setActiveSection("access-check")}
      >
        Перевірка доступу
      </button>

      {isGlobalAdmin && (
        <button
          className={getButtonClass("audit")}
          onClick={() => setActiveSection("audit")}
        >
          Журнал аудиту
        </button>
      )}

      {isGlobalAdmin && (
        <button onClick={openHealthPanel}>
          Стан системи
        </button>
      )}
    </section>
  );
}

export default AdminMenu;