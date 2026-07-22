const BASE = import.meta.env.VITE_API_URL ?? "";
const FANBOX = "/api/v1/fanbox";
export const TOKEN_KEY = "fanbox_token";
export const SELECTED_CLUB_KEY = "fanbox_selected_club_id";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getClubId() {
  return localStorage.getItem(SELECTED_CLUB_KEY);
}

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}

async function request(path, options = {}, { auth = true } = {}) {
  const token = getToken();
  const clubId = getClubId();
  const headers = {
    ...(auth && token && { Authorization: `Bearer ${token}` }),
    ...(auth && clubId && { "X-Club-Id": clubId }),
    ...options.headers,
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && auth) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELECTED_CLUB_KEY);
    if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    throw new Error("Session expired");
  }
  return res;
}

async function fetchJson(path, options = {}, config = {}) {
  const res = await request(path, options, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

async function fetchBlob(path, options = {}, config = {}) {
  const res = await request(path, options, config);
  if (!res.ok) {
    const maybeJson = await res.json().catch(() => ({}));
    throw new Error(maybeJson.message ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

export const authApi = {
  login: (body) =>
    fetchJson(`${FANBOX}/auth/login`, { method: "POST", body: JSON.stringify(body) }, { auth: false }),
  me: () => fetchJson(`${FANBOX}/auth/me`),
  listClubs: () => fetchJson(`${FANBOX}/auth/clubs`),
};

export const staffApi = {
  list: () => fetchJson(`${FANBOX}/staff`),
  create: (body) => fetchJson(`${FANBOX}/staff`, { method: "POST", body: JSON.stringify(body) }),
  update: (staffId, body) =>
    fetchJson(`${FANBOX}/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (staffId) => fetchJson(`${FANBOX}/staff/${staffId}`, { method: "DELETE" }),
};

export const fanboxApi = {
  health: () => fetchJson("/api/health", {}, { auth: false }),
  status: () => fetchJson(`${FANBOX}/status`, {}, { auth: false }),

  // Analytics
  fanCounters: () => fetchJson(`${FANBOX}/analytics/fan-counters`),
  fanGrowth: (params = {}) => fetchJson(`${FANBOX}/analytics/fan-growth${toQuery(params)}`),
  engagementReports: (params = {}) => fetchJson(`${FANBOX}/analytics/engagement-reports${toQuery(params)}`),
  spendReports: (params = {}) => fetchJson(`${FANBOX}/analytics/spend-reports${toQuery(params)}`),
  fanDemographics: (params = {}) => fetchJson(`${FANBOX}/analytics/fan-demographics${toQuery(params)}`),
  businessReport: (source, params = {}) => fetchJson(`${FANBOX}/analytics/business/${source}${toQuery(params)}`),
  memberReports: (params = {}) => fetchJson(`${FANBOX}/analytics/member-reports${toQuery(params)}`),
  loyaltyReports: (params = {}) => fetchJson(`${FANBOX}/analytics/loyalty-reports${toQuery(params)}`),

  // Fans
  searchFans: (q, field = "email") => fetchJson(`${FANBOX}/fans/search${toQuery({ q, field })}`),
  getFan: (id) => fetchJson(`${FANBOX}/fans/${id}`),
  getCustomer360: (q) => fetchJson(`${FANBOX}/fans/customer-360${toQuery({ q })}`),
  updateFan: (id, body) => fetchJson(`${FANBOX}/fans/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Intelligence
  listFilters: (params = {}) => fetchJson(`${FANBOX}/intelligence/filters${toQuery(params)}`),
  createFilter: (body) => fetchJson(`${FANBOX}/intelligence/filters`, { method: "POST", body: JSON.stringify(body) }),
  updateFilter: (id, body) =>
    fetchJson(`${FANBOX}/intelligence/filters/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFilter: (id) => fetchJson(`${FANBOX}/intelligence/filters/${id}`, { method: "DELETE" }),
  previewFilter: (body) =>
    fetchJson(`${FANBOX}/intelligence/filters/preview`, { method: "POST", body: JSON.stringify(body) }),
  exportFilter: (id) => fetchBlob(`${FANBOX}/intelligence/filters/${id}/export`, { method: "POST" }),
  promoteFilter: (id) => fetchJson(`${FANBOX}/intelligence/filters/${id}/promote`, { method: "POST" }),
  // Multiwoven sync status — Phase 4
  multiwovenSyncStatus: () => fetchJson("/api/v1/activation/sync-status").catch(() => ({ syncs: [] })),

  // Campaigns
  listCampaigns: (params = {}) => fetchJson(`${FANBOX}/campaigns${toQuery(params)}`),
  createCampaign: (body) => fetchJson(`${FANBOX}/campaigns`, { method: "POST", body: JSON.stringify(body) }),
  getCampaign: (id) => fetchJson(`${FANBOX}/campaigns/${id}`),
  updateCampaign: (id, body) =>
    fetchJson(`${FANBOX}/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCampaign: (id) => fetchJson(`${FANBOX}/campaigns/${id}`, { method: "DELETE" }),
  scheduleCampaign: (id, body) =>
    fetchJson(`${FANBOX}/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify(body) }),
  sendCampaign: (id) => fetchJson(`${FANBOX}/campaigns/${id}/send`, { method: "POST" }),
  // AI Campaigns — Phase 4
  generateAiCampaign: (body) => fetchJson(`${FANBOX}/campaigns/ai/generate`, { method: "POST", body: JSON.stringify(body) }),
  listAiPending: () => fetchJson(`${FANBOX}/campaigns/ai/pending`),
  approveAiCampaign: (id, body = {}) => fetchJson(`${FANBOX}/campaigns/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
  rejectAiCampaign: (id, body = {}) => fetchJson(`${FANBOX}/campaigns/${id}/reject`, { method: "POST", body: JSON.stringify(body) }),
  getAbSummary: () => fetchJson(`${FANBOX}/campaigns/ai/ab-summary`, { method: "POST", body: JSON.stringify({}) }),
  // A/B test results per offer — Phase 4
  getOfferAbResults: (offerId) => fetchJson(`/api/v1/personalization/offers/${encodeURIComponent(offerId)}/ab-results`),
  listTemplates: (params = {}) => fetchJson(`${FANBOX}/campaigns/templates${toQuery(params)}`),
  createTemplate: (body) =>
    fetchJson(`${FANBOX}/campaigns/templates`, { method: "POST", body: JSON.stringify(body) }),
  updateTemplate: (id, body) =>
    fetchJson(`${FANBOX}/campaigns/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTemplate: (id) => fetchJson(`${FANBOX}/campaigns/templates/${id}`, { method: "DELETE" }),

  // Projects
  listProjects: (params = {}) => fetchJson(`${FANBOX}/projects${toQuery(params)}`),
  createProject: (body) => fetchJson(`${FANBOX}/projects`, { method: "POST", body: JSON.stringify(body) }),
  getProject: (id) => fetchJson(`${FANBOX}/projects/${id}`),
  updateProject: (id, body) =>
    fetchJson(`${FANBOX}/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  closeProject: (id) => fetchJson(`${FANBOX}/projects/${id}/close`, { method: "POST" }),
  listProjectResponses: (id, params = {}) => fetchJson(`${FANBOX}/projects/${id}/responses${toQuery(params)}`),
  createProjectResponse: (id, body) =>
    fetchJson(`${FANBOX}/projects/${id}/responses`, { method: "POST", body: JSON.stringify(body) }),
  drawProjectWinner: (id) => fetchJson(`${FANBOX}/projects/${id}/draw-winner`, { method: "POST" }),

  // Retail analytics (WS4)
  retailSummary: (params = {}) => fetchJson(`/api/v1/retail/analytics/summary${toQuery(params)}`),
  retailTopProducts: (params = {}) => fetchJson(`/api/v1/retail/analytics/top-products${toQuery(params)}`),
  retailByLocation: (params = {}) => fetchJson(`/api/v1/retail/analytics/by-location${toQuery(params)}`),

  // Advanced KPIs — full bundle
  advancedKpis: (params = {}) => fetchJson(`${FANBOX}/analytics/advanced${toQuery(params)}`),

  // ML Scores — Phase 3 CDP
  getMlScores: (fanProfileId) => fetchJson(`/api/v1/cdp/ml/scores/${fanProfileId}`),
  getMlSummary: () => fetchJson("/api/v1/cdp/ml/summary"),

  // Tracardi — Visual Segment Builder (Phase 3)
  tracardiHealth: () => fetchJson("/api/v1/cdp/tracardi/health"),
  listTracardiSegments: () => fetchJson("/api/v1/cdp/tracardi/segments"),
  getTracardiSegment: (id) => fetchJson(`/api/v1/cdp/tracardi/segments/${id}`),
  getTracardiSegmentProfiles: (id, params = {}) =>
    fetchJson(`/api/v1/cdp/tracardi/segments/${id}/profiles${toQuery(params)}`),

  // Import
  importCsv: (type, body) => fetchJson(`${FANBOX}/import/${type}`, { method: "POST", body: JSON.stringify(body) }),
  listImportJobs: (params = {}) => fetchJson(`${FANBOX}/import/jobs${toQuery(params)}`),
  getImportJob: (id) => fetchJson(`${FANBOX}/import/jobs/${id}`),
};

export { getToken, getClubId };
