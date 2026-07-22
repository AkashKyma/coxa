const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const TOKEN_KEY = "coxa_fan_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

const headers = () => ({
  "Content-Type": "application/json",
  "x-tenant-id": TENANT_ID,
  ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
});

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error("Session expired — please sign in again");
  }
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export const shopApi = {
  catalog: () => request("/api/v1/retail/shop/catalog"),
  placeOrder: (body) =>
    request("/api/v1/retail/shop/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  myOrders: () => request("/api/v1/retail/shop/orders"),
  saleQrCodes: (saleId) => request(`/api/v1/retail/sales/${encodeURIComponent(saleId)}/qr-codes`),
};

export const loyaltyApi = {
  me: () => request("/api/v1/loyalty/me"),
  redeemReward: (rewardId) =>
    request("/api/v1/loyalty/me/redeem-reward", {
      method: "POST",
      body: JSON.stringify({ rewardId }),
    }),
  nextBestOffer: (fanProfileId) =>
    request(
      `/api/v1/personalization/next-best-offer?fanProfileId=${encodeURIComponent(fanProfileId)}`,
    ),
};

export const ticketsApi = {
  myTickets: () => request("/api/v1/ticketing/tickets"),
  shopEvents: () => request("/api/v1/ticketing/shop/events"),
  purchase: (body) =>
    request("/api/v1/ticketing/shop/purchase", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const profileApi = {
  me: () => request("/api/v1/auth/fan/me"),
  update: (body) => request("/api/v1/fanprofile/me", { method: "PATCH", body: JSON.stringify(body) }),
  updateProfile: (body) => request("/api/v1/auth/fan/profile", { method: "PATCH", body: JSON.stringify(body) }),
};

export const membershipApi = {
  // Plans
  listPlans: () => request("/api/v1/membership/plans"),
  getTierThresholds: () => request("/api/v1/membership/tiers"),

  // Fan self-service
  myMembership: () => request("/api/v1/membership/me"),
  myScore: () => request("/api/v1/membership/me/score"),
  join: (body) =>
    request("/api/v1/membership/join", { method: "POST", body: JSON.stringify(body) }),
  renew: (body) =>
    request("/api/v1/membership/renew", { method: "POST", body: JSON.stringify(body) }),
  upgrade: (body) =>
    request("/api/v1/membership/upgrade", { method: "POST", body: JSON.stringify(body) }),
  cancel: (body) =>
    request("/api/v1/membership/cancel", { method: "POST", body: JSON.stringify(body) }),

  // Referrals
  myReferralCode: () => request("/api/v1/membership/referrals/code"),
  redeemCode: (referralCode) =>
    request("/api/v1/membership/referrals/redeem", {
      method: "POST",
      body: JSON.stringify({ referralCode }),
    }),
  myReferrals: () => request("/api/v1/membership/referrals"),

  // Check-in window eligibility
  eligibleWindows: (matchEventId) =>
    request(`/api/v1/ticketing/check-ins/windows/${encodeURIComponent(matchEventId)}/eligible`),
};

export function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}
