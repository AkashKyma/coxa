const BASE = import.meta.env.VITE_API_URL ?? "";
const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:5173";

function getToken() {
  return localStorage.getItem("coxa_token");
}

function getClubId() {
  return localStorage.getItem("coxa_selected_club_id");
}

export async function request(path, options = {}) {
  const token = getToken();
  const clubId = getClubId();

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(clubId && { "X-Club-Id": clubId }),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem("coxa_token");
    window.location.href = AUTH_URL;
    throw new Error("Session expired");
  }

  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  health: () => request("/api/health"),

  /* Clubs */
  listMyClubs: () => request("/api/v1/clubs"),
  createClub: (body) => request("/api/v1/clubs", { method: "POST", body: JSON.stringify(body) }),
  updateClub: (clubId, body) => request(`/api/v1/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify(body) }),
  listClubMembers: (clubId) => request(`/api/v1/clubs/${clubId}/members`),
  inviteClubMember: (clubId, body) =>
    request(`/api/v1/clubs/${clubId}/members`, { method: "POST", body: JSON.stringify(body) }),
  updateMemberRole: (clubId, membershipId, role) =>
    request(`/api/v1/clubs/${clubId}/members/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeClubMember: (clubId, membershipId) =>
    request(`/api/v1/clubs/${clubId}/members/${membershipId}`, { method: "DELETE" }),

  /* Roles */
  listRoles: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/v1/roles${qs ? `?${qs}` : ""}`);
  },

  /* Users (members of current club) */
  listUsers: () => {
    const clubId = getClubId();
    return clubId ? request(`/api/v1/clubs/${clubId}/members`) : Promise.resolve({ data: { members: [] } });
  },

  /* Retail */
  retailStatus: () => request("/api/v1/retail/status"),
  listProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/retail/products${q ? `?${q}` : ""}`);
  },
  getProduct: (id) => request(`/api/v1/retail/products/${id}`),
  createProduct: (body) =>
    request("/api/v1/retail/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) =>
    request(`/api/v1/retail/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  updateSku: (skuId, body) =>
    request(`/api/v1/retail/products/skus/${skuId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listCategories: () => request("/api/v1/retail/categories"),
  createCategory: (body) =>
    request("/api/v1/retail/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id, body) =>
    request(`/api/v1/retail/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listLocations: () => request("/api/v1/retail/locations"),
  createLocation: (body) =>
    request("/api/v1/retail/locations", { method: "POST", body: JSON.stringify(body) }),

  listStock: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/retail/stock${q ? `?${q}` : ""}`);
  },
  createStockAdjustment: (body) =>
    request("/api/v1/retail/stock/adjustments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  receiveStock: (body) =>
    request("/api/v1/retail/stock/receive", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  syncStockCatalog: () =>
    request("/api/v1/retail/stock/sync-catalog", { method: "POST" }),
  fetchCatalog: () => request("/api/v1/retail/catalog"),

  getSale: (id) => request(`/api/v1/retail/sales/${id}`),

  listReturns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/retail/returns${q ? `?${q}` : ""}`);
  },
  createReturn: (body) =>
    request("/api/v1/retail/returns", { method: "POST", body: JSON.stringify(body) }),

  listTransfers: () => request("/api/v1/retail/transfers"),
  createTransfer: (body) =>
    request("/api/v1/retail/transfers", { method: "POST", body: JSON.stringify(body) }),

  listSales: (params = {}) => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    );
    const q = new URLSearchParams(filtered).toString();
    return request(`/api/v1/retail/sales${q ? `?${q}` : ""}`);
  },
  lowStockAlerts: () => request("/api/v1/retail/alerts/low-stock"),

  listFoodLots: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null)),
    ).toString();
    return request(`/api/v1/retail/lots${q ? `?${q}` : ""}`);
  },
  receiveFoodLot: (body) =>
    request("/api/v1/retail/lots/receive", { method: "POST", body: JSON.stringify(body) }),
  recordLotWastage: (lotId, body) =>
    request(`/api/v1/retail/lots/${lotId}/wastage`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markExpiredLots: () => request("/api/v1/retail/lots/mark-expired", { method: "POST" }),

  /* CDP */
  cdpStatus: () => request("/api/v1/cdp/status"),
  listEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/cdp/events${q ? `?${q}` : ""}`);
  },
  searchProfiles: (q) => request(`/api/v1/cdp/profiles/search?q=${encodeURIComponent(q)}`),
  customer360: (q) => request(`/api/v1/cdp/customer-360?q=${encodeURIComponent(q)}`),
  listSegments: () => request("/api/v1/cdp/segments"),
  createSegment: (body) =>
    request("/api/v1/cdp/segments", { method: "POST", body: JSON.stringify(body) }),
  updateSegment: (id, body) =>
    request(`/api/v1/cdp/segments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSegment: (id) =>
    request(`/api/v1/cdp/segments/${id}`, { method: "DELETE" }),
  estimateSegment: (body) =>
    request("/api/v1/cdp/segments/estimate", { method: "POST", body: JSON.stringify(body) }),
  previewSegment: (rules) =>
    request("/api/v1/cdp/segments/preview", { method: "POST", body: JSON.stringify({ rules }) }),
  editFanProfile: (profileId, body) =>
    request(`/api/v1/cdp/profiles/${profileId}/edit`, { method: "PATCH", body: JSON.stringify(body) }),
  getMlScores: (fanProfileId) => request(`/api/v1/cdp/ml/scores/${fanProfileId}`),
  getMlSummary: () => request("/api/v1/cdp/ml/summary"),

  // Tracardi — Visual Segment Builder (Phase 3)
  tracardiHealth: () => request("/api/v1/cdp/tracardi/health"),
  listTracardiSegments: () => request("/api/v1/cdp/tracardi/segments"),
  getTracardiSegment: (id) => request(`/api/v1/cdp/tracardi/segments/${id}`),
  getTracardiSegmentProfiles: (id, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/cdp/tracardi/segments/${id}/profiles${q ? `?${q}` : ""}`);
  },

  /* Loyalty */
  loyaltyStatus: () => request("/api/v1/loyalty/status"),
  listLoyaltyRules: () => request("/api/v1/loyalty/rules"),
  saveLoyaltyRule: (body) =>
    request("/api/v1/loyalty/rules", { method: "POST", body: JSON.stringify(body) }),
  listLoyaltyRewards: () => request("/api/v1/loyalty/rewards"),
  saveLoyaltyReward: (body) =>
    request("/api/v1/loyalty/rewards", { method: "POST", body: JSON.stringify(body) }),
  adjustPoints: (body) =>
    request("/api/v1/loyalty/adjust", { method: "POST", body: JSON.stringify(body) }),
  getLoyaltyTiers: () => request("/api/v1/loyalty/tiers"),
  saveLoyaltyTiers: (tiers) =>
    request("/api/v1/loyalty/tiers", { method: "PUT", body: JSON.stringify({ tiers }) }),

  /* Ticketing */
  ticketingStatus: () => request("/api/v1/ticketing/status"),
  listVenues: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/ticketing/venues${q ? `?${q}` : ""}`);
  },
  getVenue: (id) => request(`/api/v1/ticketing/venues/${id}`),
  createVenue: (body) =>
    request("/api/v1/ticketing/venues", { method: "POST", body: JSON.stringify(body) }),
  updateVenue: (id, body) =>
    request(`/api/v1/ticketing/venues/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVenue: (id) =>
    request(`/api/v1/ticketing/venues/${id}`, { method: "DELETE" }),
  listMatchEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/v1/ticketing/events${q ? `?${q}` : ""}`);
  },
  getMatchEvent: (id) => request(`/api/v1/ticketing/events/${id}`),
  createMatchEvent: (body) =>
    request("/api/v1/ticketing/events", { method: "POST", body: JSON.stringify(body) }),
  updateEventStatus: (id, status) =>
    request(`/api/v1/ticketing/events/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createTicketProduct: (eventId, body) =>
    request(`/api/v1/ticketing/events/${eventId}/ticket-products`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listEventTickets: (eventId) =>
    request(`/api/v1/ticketing/tickets?matchEventId=${encodeURIComponent(eventId)}`),
  issueTickets: (body) =>
    request("/api/v1/ticketing/tickets/issue", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  validateEntitlement: (qrToken, { markUsed = false, gateId = "GATE-A", matchEventId } = {}) => {
    const params = new URLSearchParams({
      qrToken,
      markUsed: String(markUsed),
      gateId,
    });
    if (matchEventId) params.set("matchEventId", matchEventId);
    return request(`/api/v1/ticketing/entitlements/validate?${params}`);
  },
  memberCheckIn: (body) =>
    request("/api/v1/ticketing/check-ins", { method: "POST", body: JSON.stringify(body) }),
  recordNoShows: (eventId) =>
    request(`/api/v1/ticketing/events/${eventId}/record-no-shows`, { method: "POST" }),

  /* Sale QR codes */
  getSaleQrCodes: (saleId) => request(`/api/v1/retail/sales/${saleId}/qr-codes`),
  redeemSaleQr: (qrToken) =>
    request("/api/v1/retail/sale-qr/redeem", {
      method: "POST",
      body: JSON.stringify({ qrToken }),
    }),

  /* Personalization */
  nextBestOffer: (fanProfileId) =>
    request(`/api/v1/personalization/next-best-offer?fanProfileId=${encodeURIComponent(fanProfileId)}`),
  nextBestOfferByEmail: (email) =>
    request(`/api/v1/personalization/next-best-offer?email=${encodeURIComponent(email)}`),
  // v2: top-3 ML-ranked offers — Phase 4
  nextBestOffers: (fanProfileId, email) => {
    const q = email ? `email=${encodeURIComponent(email)}` : `fanProfileId=${encodeURIComponent(fanProfileId)}`;
    return request(`/api/v1/personalization/next-best-offers?${q}&n=3`);
  },

  listOffers: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")),
    ).toString();
    return request(`/api/v1/personalization/offers${q ? `?${q}` : ""}`);
  },
  createOffer: (body) =>
    request("/api/v1/personalization/offers", { method: "POST", body: JSON.stringify(body) }),
  updateOffer: (id, body) =>
    request(`/api/v1/personalization/offers/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }),
  archiveOffer: (id) =>
    request(`/api/v1/personalization/offers/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /* Membership admin */
  listMembershipPlans: () => request("/api/v1/membership/plans"),
  getMembershipPlan: (planCode) => request(`/api/v1/membership/plans/${encodeURIComponent(planCode)}`),
  createMembershipPlan: (body) =>
    request("/api/v1/membership/plans", { method: "POST", body: JSON.stringify(body) }),
  listMembers: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null)),
    ).toString();
    return request(`/api/v1/membership/members${q ? `?${q}` : ""}`);
  },
  getMember: (id) => request(`/api/v1/membership/members/${encodeURIComponent(id)}`),
  getPriorityRanking: (matchEventId, limit) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries({ matchEventId, limit }).filter(([, v]) => v != null),
      ),
    ).toString();
    return request(`/api/v1/membership/priority-ranking${q ? `?${q}` : ""}`);
  },

  /* Check-in windows (membership) */
  listCheckInWindows: (matchEventId) =>
    request(`/api/v1/ticketing/check-ins/windows/${encodeURIComponent(matchEventId)}`),
  createCheckInWindow: (body) =>
    request("/api/v1/ticketing/check-ins/windows", { method: "POST", body: JSON.stringify(body) }),
  syncCheckInWindows: (matchEventId) =>
    request(`/api/v1/ticketing/check-ins/windows/${encodeURIComponent(matchEventId)}/sync`, {
      method: "POST",
    }),

  /* ── Club Analytics (Phase 2 — Cube/ClickHouse powered) ── */
  analyticsOverview: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/overview${q ? `?${q}` : ""}`);
  },
  analyticsRetail: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/retail${q ? `?${q}` : ""}`);
  },
  analyticsRetailTopProducts: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/retail/top-products${q ? `?${q}` : ""}`);
  },
  analyticsRetailByLocation: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/retail/by-location${q ? `?${q}` : ""}`);
  },
  analyticsFnb: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/fnb${q ? `?${q}` : ""}`);
  },
  analyticsFnbTopProducts: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/fnb/top-products${q ? `?${q}` : ""}`);
  },
  analyticsTicketing: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/ticketing${q ? `?${q}` : ""}`);
  },
  analyticsMembership: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/membership${q ? `?${q}` : ""}`);
  },
  analyticsLoyalty: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString();
    return request(`/api/v1/club/analytics/loyalty${q ? `?${q}` : ""}`);
  },

  /* ── ML Scores (Phase 3 — CDP) ── */
  getMlScores: (fanProfileId) => request(`/api/v1/cdp/ml/scores/${fanProfileId}`),
  getMlSummary: () => request("/api/v1/cdp/ml/summary"),
};

/* ── Email Campaigns ── */
export const emailApi = {
  listTemplates: () => request("/api/v1/channels/email/templates"),
  listCampaigns: () => request("/api/v1/channels/email/campaigns"),
  createCampaign: (body) =>
    request("/api/v1/channels/email/campaigns", { method: "POST", body: JSON.stringify(body) }),
  approveCampaign: (id) =>
    request(`/api/v1/channels/email/campaigns/${id}/approve`, { method: "POST" }),
  sendCampaign: (id) =>
    request(`/api/v1/channels/email/campaigns/${id}/send`, { method: "POST" }),
  getCampaignStats: (id) => request(`/api/v1/channels/email/campaigns/${id}/stats`),
};

export function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}
