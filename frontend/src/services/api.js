/**
 * Study Gen AI â€” API Client
 *
 * Central place for talking to the FastAPI backend.
 * Attaches the JWT token when present and handles errors
 * consistently across the app.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "Study Gen AI_token";
const USER_KEY = "Study Gen AI_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};
export const setStoredUser = (user) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user));
export const clearStoredUser = () => localStorage.removeItem(USER_KEY);

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    clearStoredUser();
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    let message;
    let code = null;
    let retryAfter = null;

    if (data && typeof data === "object" && data.detail && typeof data.detail === "object") {
      code = data.detail.code || null;
      message = data.detail.message || "Something went wrong. Please try again.";
      if (response.headers.get("retry-after")) {
        const n = parseInt(response.headers.get("retry-after"), 10);
        if (!Number.isNaN(n)) retryAfter = n;
      }
    } else {
      message =
        (data && data.detail) ||
        (typeof data === "string" && data) ||
        "Something went wrong. Please try again.";
    }

    if (Array.isArray(data?.detail)) {
      const err = new Error("Please check your input and try again.");
      err.fieldErrors = data.detail;
      throw err;
    }

    const err = new Error(message);
    err.code = code;
    err.retryAfter = retryAfter;
    err.status = response.status;
    throw err;
  }

  return data;
}

export const authApi = {
  register: (payload) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),
};

export const documentsApi = {
  list: () => request("/documents"),
  get: (id) => request(`/documents/${id}`),
  upload: (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/documents/upload`);

      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        const contentType = xhr.getResponseHeader("content-type") || "";
        let data;
        try {
          data = contentType.includes("application/json")
            ? JSON.parse(xhr.responseText)
            : xhr.responseText;
        } catch {
          data = xhr.responseText;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          if (xhr.status === 401) {
            clearToken();
            clearStoredUser();
          }
          let message, code = null;
          if (data && typeof data === "object" && data.detail && typeof data.detail === "object") {
            code = data.detail.code || null;
            message = data.detail.message || `Upload failed (${xhr.status})`;
          } else {
            message = (data && data.detail) || `Upload failed (${xhr.status})`;
          }
          const err = new Error(message);
          err.code = code;
          err.status = xhr.status;
          reject(err);
        }
      };

      xhr.onerror = () => {
        const err = new Error("Network error during upload");
        err.code = "AI_NETWORK_ERROR";
        reject(err);
      };
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  },
  remove: (id) => request(`/documents/${id}`, { method: "DELETE" }),
};

export const chatApi = {
  ask: (payload) =>
    request("/chat/ask", { method: "POST", body: JSON.stringify(payload) }),
  chat: (payload) =>
    request("/chat", { method: "POST", body: JSON.stringify(payload) }),
  history: () => request("/chat/history"),
};

export const quizApi = {
  generate: (payload) =>
    request("/quiz/generate", { method: "POST", body: JSON.stringify(payload) }),
};

export const revisionApi = {
  generate: (payload) =>
    request("/revision/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};