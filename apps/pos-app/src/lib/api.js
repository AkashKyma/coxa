const BASE = import.meta.env.VITE_API_URL ?? "";
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? "coxa-club-001";
const TOKEN_KEY = "coxa_pos_token";
const CLUB_KEY = "coxa_pos_club_id";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  const clubId = localStorage.getItem(CLUB_KEY);
  return {
    "Content-Type": "application/json",
    "x-tenant-id": TENANT_ID,
    "x-module-code": "retail",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(clubId && { "X-Club-Id": clubId }),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new Error("Session expired — sign in again");
  }
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function fetchCatalog(locationId) {
  const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return request(`/api/v1/retail/catalog${q}`);
}

export async function listLocations() {
  return request("/api/v1/retail/locations");
}

export async function createSale(body) {
  return request("/api/v1/retail/sales", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSaleQrCodes(saleId) {
  return request(`/api/v1/retail/sales/${encodeURIComponent(saleId)}/qr-codes`);
}

export async function listTicketingEvents() {
  return request("/api/v1/ticketing/events?upcoming=true");
}

export async function getEventDetail(eventId) {
  return request(`/api/v1/ticketing/events/${eventId}`);
}

export async function issueTickets(body) {
  return request("/api/v1/ticketing/tickets/issue", {
    method: "POST",
    body: JSON.stringify({ ...body, channel: "box_office", paymentMethod: "cash" }),
  });
}

export async function searchFan(email) {
  return request(`/api/v1/cdp/profiles/search?q=${encodeURIComponent(email)}`);
}

export function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}
