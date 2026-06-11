const API_BASE_URL = "http://127.0.0.1:8000";

function getCurrentUser() {
  try {
    const savedUser = localStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

function getHeaders() {
  const currentUser = getCurrentUser();

  const headers = {
    "Content-Type": "application/json",
  };

  if (currentUser?.id) {
    headers["X-User-Id"] = String(currentUser.id);
  }

  return headers;
}

async function handleResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      response.statusText ||
      "Помилка запиту";

    throw new Error(message);
  }

  return data;
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: getHeaders(),
  });

  return handleResponse(response);
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}

export async function apiPut(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  return handleResponse(response);
}

export async function apiDelete(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  return handleResponse(response);
}