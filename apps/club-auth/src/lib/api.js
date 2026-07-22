const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const token = localStorage.getItem("coxa_token");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? `HTTP ${res.status}`), { code: data.code });
  return data;
}

export const authApi = {
  signup: (body) => request("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/api/v1/auth/me"),
  forgotPassword: (body) => request("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => request("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
};
