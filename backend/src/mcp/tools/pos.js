/**
 * Coxa POS MCP Tools
 * All 9 tools map 1-to-1 with the POS app's API calls.
 * They call the running Coxa backend via HTTP using native fetch.
 *
 * Base URL resolution order:
 *   1. MCP_API_URL env var (set when running against a remote server)
 *   2. http://localhost:5000 (default for local dev)
 */

const BASE = process.env.MCP_API_URL ?? "http://localhost:5000";
const TENANT_ID = process.env.MCP_TENANT_ID ?? process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";

/**
 * Internal helper — performs an authenticated HTTP request to the backend.
 * @param {string} path  - e.g. "/api/v1/retail/catalog"
 * @param {object} opts  - fetch options
 * @param {string} [token] - Bearer token (optional for public routes)
 */
async function apiCall(path, opts = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    "x-tenant-id": TENANT_ID,
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? `HTTP ${res.status} ${res.statusText}`);
  }

  return body;
}

/**
 * Each exported tool follows the MCP tool schema:
 * {
 *   name: string,
 *   description: string,
 *   inputSchema: { type, properties, required },
 *   handler: async (args) => string  // JSON string returned to the AI
 * }
 */

export const tools = [
  /* ── pos_login ──────────────────────────────── */
  {
    name: "pos_login",
    description:
      "Authenticate a POS operator with email and password. Returns a Bearer token that must be passed to all other POS tools as `token`.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Operator email address" },
        password: { type: "string", description: "Operator password" },
      },
      required: ["email", "password"],
    },
    async handler({ email, password }) {
      const data = await apiCall("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      return JSON.stringify({
        token: data.data?.token,
        user: { fullName: data.data?.user?.fullName, email: data.data?.user?.email },
        club: { name: data.data?.club?.name, id: data.data?.club?._id },
        role: data.data?.membership?.role,
      });
    },
  },

  /* ── pos_list_locations ─────────────────────── */
  {
    name: "pos_list_locations",
    description: "List all POS/retail locations available for this club tenant.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
      },
      required: ["token"],
    },
    async handler({ token }) {
      const data = await apiCall("/api/v1/retail/locations", {}, token);
      return JSON.stringify(data.data ?? []);
    },
  },

  /* ── pos_get_catalog ────────────────────────── */
  {
    name: "pos_get_catalog",
    description:
      "Fetch the product catalog for a specific location. Returns available SKUs with prices.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        locationId: {
          type: "string",
          description: "Location ID (from pos_list_locations). Omit for full catalog.",
        },
      },
      required: ["token"],
    },
    async handler({ token, locationId }) {
      const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
      const data = await apiCall(`/api/v1/retail/catalog${q}`, {}, token);
      return JSON.stringify(data.data ?? []);
    },
  },

  /* ── pos_create_sale ────────────────────────── */
  {
    name: "pos_create_sale",
    description:
      "Complete a retail sale at the POS. Deducts stock, creates a sale record, and returns the saleId for QR code retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        locationId: { type: "string", description: "POS location ID" },
        lines: {
          type: "array",
          description: "Sale lines — each line needs skuId and qty",
          items: {
            type: "object",
            properties: {
              skuId: { type: "string" },
              qty: { type: "number" },
            },
            required: ["skuId", "qty"],
          },
        },
        paymentMethod: {
          type: "string",
          enum: ["cash", "card", "pix", "voucher", "stub"],
          description: "Payment method (default: cash)",
        },
        fanEmail: {
          type: "string",
          description: "Optional fan email to link sale to fan profile",
        },
      },
      required: ["token", "locationId", "lines"],
    },
    async handler({ token, locationId, lines, paymentMethod, fanEmail }) {
      const data = await apiCall(
        "/api/v1/retail/sales",
        {
          method: "POST",
          body: JSON.stringify({ locationId, lines, paymentMethod: paymentMethod ?? "cash", fanEmail }),
        },
        token,
      );
      const sale = data.data;
      return JSON.stringify({
        saleId: sale?._id,
        saleNumber: sale?.saleNumber,
        totalCents: sale?.totalCents,
        status: sale?.status,
        lineCount: sale?.lines?.length,
      });
    },
  },

  /* ── pos_get_sale_qr_codes ──────────────────── */
  {
    name: "pos_get_sale_qr_codes",
    description:
      "Retrieve all per-unit QR tokens for a completed sale. Each physical item gets its own unique QR code for redemption.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        saleId: { type: "string", description: "Sale ID (from pos_create_sale)" },
      },
      required: ["token", "saleId"],
    },
    async handler({ token, saleId }) {
      const data = await apiCall(
        `/api/v1/retail/sales/${encodeURIComponent(saleId)}/qr-codes`,
        {},
        token,
      );
      return JSON.stringify(data.data ?? {});
    },
  },

  /* ── pos_search_fan ─────────────────────────── */
  {
    name: "pos_search_fan",
    description: "Search for a fan profile by email or name. Used to link sales and tickets to a fan.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        query: { type: "string", description: "Email address or partial name to search" },
      },
      required: ["token", "query"],
    },
    async handler({ token, query }) {
      const data = await apiCall(
        `/api/v1/cdp/profiles/search?q=${encodeURIComponent(query)}`,
        {},
        token,
      );
      return JSON.stringify(data.data ?? []);
    },
  },

  /* ── pos_list_events ────────────────────────── */
  {
    name: "pos_list_events",
    description: "List upcoming match events available for ticket sales at the box office.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
      },
      required: ["token"],
    },
    async handler({ token }) {
      const data = await apiCall("/api/v1/ticketing/events?upcoming=true", {}, token);
      return JSON.stringify(
        (data.data ?? []).map((e) => ({
          id: e._id,
          name: e.name,
          homeTeam: e.homeTeam,
          awayTeam: e.awayTeam,
          matchDate: e.matchDate,
          status: e.status,
        })),
      );
    },
  },

  /* ── pos_issue_tickets ──────────────────────── */
  {
    name: "pos_issue_tickets",
    description:
      "Issue match tickets at the box office. Supports direct issuance (no prior reservation) with a specific ticket product and quantity.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        matchEventId: { type: "string", description: "Match event ID (from pos_list_events)" },
        ticketProductId: { type: "string", description: "Ticket product / tier ID" },
        qty: { type: "number", description: "Number of tickets to issue (default 1)" },
        fanEmail: { type: "string", description: "Fan email to assign tickets to (optional)" },
        fanProfileId: { type: "string", description: "Fan profile ID (optional, alternative to fanEmail)" },
        paymentMethod: {
          type: "string",
          enum: ["cash", "card", "pix", "stub"],
          description: "Payment method at box office (default: cash)",
        },
      },
      required: ["token", "matchEventId", "ticketProductId"],
    },
    async handler({ token, matchEventId, ticketProductId, qty, fanEmail, fanProfileId, paymentMethod }) {
      const data = await apiCall(
        "/api/v1/ticketing/tickets/issue",
        {
          method: "POST",
          body: JSON.stringify({
            matchEventId,
            ticketProductId,
            qty: qty ?? 1,
            fanEmail,
            fanProfileId,
            paymentMethod: paymentMethod ?? "cash",
            channel: "box_office",
          }),
        },
        token,
      );
      return JSON.stringify({
        tickets: (data.data ?? []).map((t) => ({
          ticketId: t._id,
          qrToken: t.qrToken,
          seat: t.seat,
          status: t.status,
        })),
        duplicate: data.duplicate,
      });
    },
  },

  /* ── pos_validate_qr ────────────────────────── */
  {
    name: "pos_validate_qr",
    description:
      "Validate an entry QR token at the gate. Optionally marks it as used. Returns VALID / ALREADY_USED / INVALID.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Bearer token from pos_login" },
        qrToken: { type: "string", description: "The QR code string scanned at the gate" },
        matchEventId: { type: "string", description: "Current match event ID (for validation context)" },
        markUsed: {
          type: "boolean",
          description: "If true, marks the entitlement as used on successful validation (default: false)",
        },
        gateId: { type: "string", description: "Gate identifier (optional, for audit)" },
      },
      required: ["token", "qrToken"],
    },
    async handler({ token, qrToken, matchEventId, markUsed, gateId }) {
      const data = await apiCall(
        "/api/v1/ticketing/entitlements/validate",
        {
          method: "POST",
          body: JSON.stringify({ qrToken, matchEventId, markUsed: markUsed ?? false, gateId }),
        },
        token,
      );
      return JSON.stringify(data.data ?? {});
    },
  },
];
