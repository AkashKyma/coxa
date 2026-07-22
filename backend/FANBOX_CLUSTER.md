# FanBox module

FanBox is a **backend module** mounted at `/api/v1/fanbox`, same pattern as retail, CDP, ticketing, etc.

## Routes

| Path | Description |
|------|-------------|
| `GET /api/v1/fanbox/status` | Module enabled check |
| `POST /api/v1/fanbox/auth/login` | FanBox staff login |
| `GET /api/v1/fanbox/auth/me` | Session |
| `GET /api/v1/fanbox/staff` | User management (fanbox_admin) |
| `GET /api/v1/fanbox/analytics/*` | Dashboard & business reports |
| `GET /api/v1/fanbox/fans/*` | Single Fan View |
| `GET /api/v1/fanbox/intelligence/*` | Filters & insights |
| `GET /api/v1/fanbox/campaigns/*` | Campaigns |
| `GET /api/v1/fanbox/projects/*` | Digital projects |
| `POST /api/v1/fanbox/import/*` | CSV import |

## Code layout

```
backend/src/routes/fanbox/
  index.js          ← requireModule("fanbox"), mounts sub-routers
  auth.js
  staff.js
  analytics.js
  fans.js
  intelligence.js
  campaigns.js
  projects.js
  import.js
```

## Auth

FanBox staff use `FanboxStaff` records and JWT tokens with `accountType: "fanbox"`. See `backend/src/lib/fanboxRoles.js` for role definitions.

## Tenant config

Enable per tenant via `TenantConfig.enabledModules` — include `"fanbox"`. The seed script adds it for the demo tenant.

## Frontend

`fanbox-dashboard` (:5178) proxies `/api` → main backend (:5000), same as `club-dashboard`.

**Admin workflow & API reference:** [docs/FANBOX_ADMIN_WORKFLOW.md](../../docs/FANBOX_ADMIN_WORKFLOW.md)

## Business data (POS integration)

FanBox **Business** tabs are populated by operational writes (sales, tickets, membership, access).
There is no separate Business CSV import.

**Integrator documentation:** [POS Integration API](/api/docs) (`backend/src/openapi/openapi-pos.yaml`)

The spec includes a **FanBox Business → required write APIs** matrix for every tab
(Membership, Tickets, Access, Stores, E-Commerce, Coxa Foods, and stub tabs).
