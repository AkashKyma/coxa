# FanBox Parity — Final Approval Sign-Off

**Date:** 15 June 2026  
**Platform:** `fanbox-dashboard` (:5178) + `backend` module `/api/v1/fanbox`  
**Reference:** [FANBOX_PARITY_TASKS.md](./FANBOX_PARITY_TASKS.md)

---

## Executive summary

FanBox parity phases **P0–P4** are implemented as a dedicated English-language dashboard with its own staff auth, mounted on the main Coxa backend (same pattern as retail/CDP). MVP fallbacks from the parity doc apply to deferred integrations (App/OTT/Coxa Run analytics, contests/NPS depth, drag-and-drop email builder).

**Recommendation: APPROVED for MVP release** with documented deferred items below.

---

## Build verification

| Check | Result |
|-------|--------|
| `npm run build --workspace=fanbox-dashboard` | **PASS** (bundle ~674 kB; code-splitting optional follow-up) |
| Backend service syntax (`node --check`) | **PASS** |
| Frontend language | **English only** — no PT-BR strings in `apps/fanbox-dashboard` |
| API smoke test (`node scripts/fanbox-smoke-test.mjs`) | **PASS** — 17/17 endpoints (15 Jun 2026) |

---

## Architecture

| Layer | Location |
|-------|----------|
| Frontend | `apps/fanbox-dashboard/` — port **5178**, proxies `/api` → `:5000` |
| API module | `backend/src/routes/fanbox/` — `/api/v1/fanbox/*` |
| Auth | `FanboxStaff` + JWT (`accountType: fanbox`, key `fanbox_token`) |
| Roles | `fanbox_admin`, `fanbox_manager`, `fanbox_analyst`, `fanbox_marketer`, `fanbox_viewer` |
| Tenant gate | `requireModule("fanbox")` — auto-enabled on dev startup + seed |

**Demo login:** `admin@coxa.local` / `CoxaDemo123!` (also `marketing@coxa.local`, `loyalty@coxa.local`)

---

## Phase sign-off matrix

### P0 — Shell & data foundation

| Task | Status | Notes |
|------|--------|-------|
| TASK-01-01 Global fan counters API | **Done** | `GET /fanbox/analytics/fan-counters` |
| TASK-01-02 Persistent counter bar | **Done** | `FanCounterBar` in layout |
| TASK-01-03 FanBox sidebar IA | **Done** | `FanboxLayout` — Dashboard, Fans, Business, Projects, Intelligence, Campaigns, Control |
| TASK-01-04 Branded login | **Done** | FanBox login page on :5178 |
| TASK-03-04 Profile enrichment schema | **Done** | `FanProfile` extended (cpf, address, gender, etc.) |
| TASK-08-02 CSV import framework | **Done** | `POST /fanbox/import/*` |
| TASK-08-03 Import types (cadastros/leads) | **Done** | MVP types |
| FanBox staff auth | **Done** | Separate from club-auth |

### P1 — Analytics core

| Task | Status | Notes |
|------|--------|-------|
| TASK-02-01 Growth time-series API | **Done** | `GET /fanbox/analytics/growth` |
| TASK-02-02 Growth chart UI | **Done** | `GrowthChart` (recharts) |
| TASK-02-03 Engagement reports | **Done** | API + `EngagementPage` |
| TASK-02-04 Spend reports | **Done** | API + dashboard blocks |
| TASK-03-01 Expanded fan search | **Done** | Customer 360 with PII reveal |
| TASK-03-02 Single Fan View | **Done** | `SingleFanViewPage` |
| TASK-03-05 Engajamento page | **Done** | `EngagementPage` |
| TASK-03-06 Demographics dashboard | **Done** | `ProfilesPage` + charts |
| TASK-04-00 Negócios shell | **Done** | `BusinessLayout` + 10 report routes |
| TASK-04-01–04-05 Business analytics | **Done** | membership, tickets, access, stores, ecommerce |
| TASK-04-06–04-11 App/OTT/Run/Foods/Manto | **Deferred (MVP)** | Stub zeros — per parity doc fallback |

### P2 — Fan Intelligence++

| Task | Status | Notes |
|------|--------|-------|
| TASK-06-01 Advanced filter builder | **Done** | Criteria JSON on filters |
| TASK-06-02 Export filtered list | **Done** | CSV export endpoint |
| TASK-06-03 Save & manage filters | **Done** | CRUD + preview |
| TASK-06-04 Meus Insights | **Done** | `InsightsPage` |
| TASK-06-05 Segment bridge | **Done** | Promote filter → segment |

### P3 — Projetos Digitais

| Task | Status | Notes |
|------|--------|-------|
| TASK-05-00 Domain model | **Done** | `DigitalProject`, `DigitalProjectResponse` |
| TASK-05-01 Surveys | **Done** | Create, publish, responses |
| TASK-05-02 Votes | **Done** | Poll projects |
| TASK-05-03 Raffles | **Done** | Draw endpoint |
| TASK-05-04 Contests | **Stub** | Project type exists; thin UI |
| TASK-05-05 NPS | **Stub** | Project type exists; thin UI |

### P4 — Campanhas

| Task | Status | Notes |
|------|--------|-------|
| TASK-07-01 Campaign domain model | **Done** | `FanboxCampaign`, `FanboxCampaignTemplate` |
| TASK-07-02 Nova Campanha wizard | **Done** | `CampaignWizardPage` |
| TASK-07-03 Campaign list | **Done** | `CampaignsPage` |
| TASK-07-04 Campaign analytics | **Done** | Basic send stats on campaign record |
| TASK-07-05 Template manager | **Done** | HTML template CRUD (no drag-and-drop) |
| TASK-07-06 Delivery services | **MVP** | Send marks sent; no external ESP integration |
| TASK-07-07 SFV quick actions | **Partial** | Campaign from filter; full quick-send deferred |

### Cross-cutting

| Task | Status | Notes |
|------|--------|-------|
| TASK-08-01 Account management | **Done** | `UsersPage` + staff API |
| TASK-X-02 API client & permissions | **Done** | `api.js` + `permissions.js` |
| TASK-X-03 i18n | **Done (EN)** | English-only frontend as requested |
| TASK-X-05 E2E test plan | **Done** | `scripts/fanbox-smoke-test.mjs` |

---

## Deferred (post-MVP)

1. **TASK-04-06–04-11** — App, OTT, Coxa Run, external integration analytics (require live data feeds)
2. **TASK-05-04/05-05** — Full contest and NPS workflows
3. **TASK-07-05** — Drag-and-drop email builder (HTML import only today)
4. **TASK-07-06** — Real email/push delivery (SendGrid, FCM, etc.)
5. **Bundle size** — Route-level code splitting for fanbox-dashboard

---

## How to verify locally

```bash
# 1. Seed database (enables fanbox module + demo staff)
npm run seed --workspace=coxa-backend

# 2. Start stack (or backend + fanbox-dashboard only)
npm run dev --workspace=coxa-backend
npm run dev --workspace=fanbox-dashboard

# 3. Open http://localhost:5178 — login admin@coxa.local / CoxaDemo123!

# 4. API smoke test
node scripts/fanbox-smoke-test.mjs
```

---

## Approval

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering | — | 2026-06-15 | **APPROVED (MVP)** |
| Product / Client | _Pending_ | | |

**Signed off by engineering:** All P0–P4 MVP scope delivered, English UI, builds pass, smoke test script provided. Deferred items documented above and align with parity doc MVP fallback clause.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [FANBOX_ADMIN_WORKFLOW.md](./FANBOX_ADMIN_WORKFLOW.md) | Admin workflows + full API catalog (FanBox + POS) |
| [FANBOX_PARITY_TASKS.md](./FANBOX_PARITY_TASKS.md) | Original parity task breakdown |
| [FANBOX_CLUSTER.md](../backend/FANBOX_CLUSTER.md) | Module mount + code layout |
| [POS Integration API](http://localhost:5000/api/docs) | External write APIs (`openapi-pos.yaml`) |
