import { useState } from "react";
import { apiPost } from "../api";

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("ivan.finance.head");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const data = await apiPost("/auth/login", {
        username,
        password,
      });

      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Вхід до системи</h1>
        <p>Hybrid RBAC/MAC Access Control</p>

        <label>Логін користувача</label>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Наприклад: ivan.finance.head"
        />

        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Введіть пароль"
        />

        {error && <div className="error login-error">Помилка: {error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "Перевірка..." : "Увійти"}
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;