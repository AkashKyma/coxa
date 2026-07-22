const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? `HTTP ${res.status}`), { code: data.code });
  return data;
}

export const authApi = {
  login: (body) => request("/api/v1/auth/fan/login", { method: "POST", body: JSON.stringify(body) }),
  signup: (body) => request("/api/v1/auth/fan/signup", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (body) => request("/api/v1/auth/fan/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => request("/api/v1/auth/fan/reset-password", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body) => request("/api/v1/auth/fan/verify-email", { method: "POST", body: JSON.stringify(body) }),
};
