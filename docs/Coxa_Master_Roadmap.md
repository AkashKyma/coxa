# Coxa Platform — Master Execution Roadmap

**Date:** July 20, 2026  
**Source:** coxa_master_gap_analysis.md + coxa_full_deliverables.zip (17 docs, ~9,900 lines)  
**Verdict from audits:** club.coxa.live ~35/100 · fan.coxa.live 1.8/10 · fanbox.coxa.live 2.8/10 · "Not production-ready"

---

## The Core Problem (one sentence)

Coxa has a sophisticated data backbone — event stream, computed traits, segments, ML scores, NBO engine — but **zero delivery layer**: no email, SMS, push, or WhatsApp exists anywhere, the journey engine (Tracardi) is offline, LGPD compliance scores 0/100, and 18 fan-portal routes are blank white pages.

---

## 5 Blocker Issues (must fix before any growth)

| # | Blocker | Impact |
|---|---|---|
| 1 | No communication channel on any surface | NBO/segments/campaigns built but never delivered |
| 2 | Journey engine (Tracardi) offline on both club + fanbox | 100% of automation non-functional |
| 3 | Zero LGPD/GDPR compliance tooling | Legal liability — ANPD enforcement risk |
| 4 | 5 unauthenticated API endpoints leaking tenant data | P0 security — already patched in last sprint |
| 5 | 18 fan portal routes render blank | Primary consumer product is materially incomplete |

---

## What Was Already Fixed (last sprint — July 16)

- SEC-P0-1: Tracardi credentials removed from UI
- SEC-P0-2: `requireAuth` added to all `/api/v1/*` routes; `/api/docs` gated
- SEC-P0-3: `sanitize-html` server-side XSS protection on Personalization
- FUNC-P1-1: CDP Workflows shows maintenance state when Tracardi offline
- FUNC-P1-2: Cancel Membership — confirmation dialog + tenant fallback fix
- FUNC-P1-3: 404/NotFoundPage + ErrorBoundary across all 3 apps
- DATA-P1-1: Points reset fix (FanDataContext cache), rewards math fix, tier threshold alignment
- SEC-M: `X-Powered-By` removed, Mongoose errors sanitized, offer 404 fixed

---

## The 6 Workstreams

| # | Workstream | Quarter | Specs |
|---|---|---|---|
| W1 | Compliance (LGPD/GDPR) | Q1 | spec_compliance.md |
| W2 | Channels (Email/SMS/Push/WhatsApp) | Q1 | spec_channels.md |
| W3 | Native Journey Engine (replace Tracardi) | Q2 | spec_journey_engine.md |
| W4 | Enhanced CDP (identity, traits, segmentation, ML) | Q2 | spec_cdp.md |
| W5 | Fan Portal Completion (20 PRDs, 18 blank routes) | Q3 | spec_fan_portal.md |
| W6 | Admin Foundation (settings, RBAC, integrations, audit) | Q4 | spec_admin.md |

---

## Q1 — Weeks 1–13: Foundations (Compliance + Channels)

**Goal:** Make the platform legally safe to operate and give every surface a delivery layer.

### Sprint 1 (Weeks 1–2): Security Hardening + LGPD Consent MVP
**Backend:**
- `ConsentRecord` model: `{ fan_id, purpose, legal_basis, status, granted_at, revoked_at, source, policy_version, ip_address, evidence_hash }`
- 11-purpose registry (marketing, analytics, personalization, third-party-sharing, push, sms, whatsapp, email, profiling, biometric, minor-protection)
- `POST /api/v1/consent/record` + `GET /api/v1/consent/fan/:fanId`
- `POST /api/v1/consent/bulk-check` — called by Universal Router before any send

**Frontend (fan-dashboard):**
- `/consent` page: purpose toggles with legal-basis labels (not blank anymore)
- Preference Center widget embedded in `/profile`

**Effort:** ~10 person-weeks

### Sprint 2 (Weeks 3–4): Preference Center + Email Channel
**Backend:**
- `ChannelSuppression`, `FrequencyCap`, `QuietHoursConfig` models
- Amazon SES integration: transactional pool (`mail.coxa.live`) + marketing pool (`news.coxa.live`)
- `EmailTemplate` model (MJML source, compiled HTML, A/B subject variants, locales)
- `EmailCampaign` + `EmailSend` models + send service
- SES SNS webhook consumer → bounce/complaint auto-suppression
- DKIM/SPF/DMARC DNS setup + SES domain verification

**Frontend (club-dashboard):**
- Email Campaign builder UI (template picker, audience segment, schedule, A/B config)
- Sender identity management under Settings

**Effort:** ~12 person-weeks

### Sprint 3 (Weeks 5–6): DSR Workflow + Audit Log + Cookie Banner
**Backend:**
- `dsr_requests` model: 10 Art. 18 request types, 15-day SLA tracking
- `POST /api/v1/dsr/submit` (fan-facing) + admin SLA queue (`/api/v1/admin/dsr`)
- Platform-wide immutable audit log: `{ actor_id, action, resource_type, resource_id, before, after, ip, timestamp }`
- Cookie banner config + registry API

**Frontend:**
- Admin DSR queue page with SLA countdown
- Cookie banner component (fan + club surfaces)
- Google Consent Mode v2 wiring

**Effort:** ~14 person-weeks

### Sprint 4 (Weeks 7–8): SMS + WhatsApp
**Backend:**
- Zenvia SMS: send service, STOP/PARE keyword handler, delivery receipts
- WhatsApp Business (Zenvia BSP): template submission workflow (8 pre-built sports templates), send service, 24h service-window tracking
- Interactive messages: quick-reply buttons, list messages

**Frontend (club-dashboard + fanbox):**
- WhatsApp template management UI (submit for Meta approval, track status)
- SMS campaign UI

**Effort:** ~11 person-weeks

### Sprint 5 (Weeks 9–10): Push + In-App + Universal Message Router
**Backend:**
- FCM (native push) + VAPID Web Push — unified `DeviceToken` model
- SSE-based in-app messages (modal/banner/bottom-sheet/notification bell)
- **Universal Message Router**: `SendMessage(fanId, intent, payload)` with:
  - Preference cascade (fan preferred → fallback chain)
  - Frequency cap enforcement (token-bucket in Redis)
  - Quiet hours (22:00–08:00 BRT, `matchday_critical` exempt)
  - Consent gate (calls `/consent/bulk-check` before any send)

**Frontend (fan-dashboard):**
- Notification bell + inbox
- Push permission prompt flow

**Effort:** ~9 person-weeks

### Sprint 6 (Weeks 11–13): Fan Portal — Profile, Settings, Notifications, Consent
**This sprint delivers 4 of the 18 blank routes.**

**PRD 1 — Profile Edit** (`/profile/edit`):
- Full PII form: first/last name, phone (E.164), DOB, CPF (AES-256 encrypted), gender, address (ViaCEP CEP autocomplete), favorite player, jersey size, preferred language
- Avatar + cover photo upload
- Communication consent checkboxes per channel
- `PATCH /api/v1/auth/fan/profile`

**PRD 2 — Settings** (`/settings`):
- 10 sub-sections: Account, Notifications, Privacy, Language, Payment Methods, Addresses, Data & Storage, Accessibility, Sessions, Delete Account
- Language toggle (PT-BR / EN / ES)
- LGPD Art. 18 data download request button

**PRD 3 — Notifications Center** (`/notifications`):
- Filterable inbox (All, Tickets, Rewards, Membership, Offers, System)
- Read/unread state, swipe-to-dismiss, deep-link per notification

**PRD 13 — Consent & Privacy** (`/consent`, `/privacy`):
- Granular purpose toggles with legal-basis tags
- Consent history timeline
- DSR action cards (Access, Delete, Export, Correct)
- Multi-step account deletion with 30-day cooldown

**Effort:** ~24 person-weeks

**Q1 Total: ~80 person-weeks**

---

## Q2 — Weeks 14–26: Journey Engine + Enhanced CDP

**Goal:** Replace Tracardi with a native engine and build the identity + segmentation infrastructure that makes all personalization defensible.

### Sprint 7 (Weeks 14–16): Journey Engine Core
**Backend:**
- Data models: `journeys`, `fan_in_journeys` (FIJ), `journey_events`
- BullMQ execution engine: delayed jobs, idempotency keys, exponential-backoff retries, circuit breaker
- 5 bootstrap node types: `entry_segment`, `wait_duration`, `action_send_email`, `goal`, `exit`
- `POST /api/v1/journeys` + `POST /api/v1/journeys/:id/publish`

### Sprint 8 (Weeks 17–18): Journey Canvas (React Flow)
**Frontend (club-dashboard + fanbox):**
- React Flow visual canvas with node palette (drag + drop)
- Config panel per node type
- Real-time validation: orphan nodes, cycles, missing required config
- Draft → Review → Publish governance, version history + rollback

### Sprint 9 (Weeks 19–20): 15 Sports Templates + A/B Testing
- All 26 node types implemented
- 15 pre-built templates: Sócio renewal 30/7/1-day, post-match MOTM voting, abandoned cart, birthday, loyalty tier upgrade, points-expiry warning, win-back, welcome series, etc.
- A/B/n testing: sticky variant assignment, two-proportion z-test, guardrail metrics (auto-pause on complaint-rate breach)
- Journey holdout groups (journey-level + global platform holdout)

### Sprint 10 (Weeks 21–22): Identity Resolution + Event Schema Registry
**Backend (CDP):**
- `FanIdentityGraph`: identifiers[] with type/value_hash/confidence/verified, household_id
- `IdentityMergeLog`: merge_type, surviving/merged fan_id, match_key, field_resolutions[]
- Deterministic merge: CPF/email/phone exact match → auto-merge
- Probabilistic merge: device+IP+behavioral fingerprint, confidence-scored, steward-reviewed above 0.85
- 54-event schema registry (8 domains: Identity, Ticketing, Retail, Membership, Loyalty, Content, Communication, Session) + dead-letter queue

### Sprint 11 (Weeks 23–24): Computed Traits + Segmentation v2
**Backend:**
- General-purpose trait engine (aggregate/latest/first/list/boolean types, formula definitions)
- Unified segmentation: 6 segment types (rule/SQL/cohort/look-alike/behavioral/predictive)
- 30+ operators: comparison, list, string, time, frequency, sequence, existence, set
- Live count preview (Redis-cached), overlap analysis
- Replaces today's 5-trait/4-operator/single-condition segment builder

### Sprint 12 (Weeks 25–26): Tracardi Migration + Cutover
- Extract journey graphs from Tracardi via direct Mongo access (API is unreachable)
- Manual remap to native node graph format
- Shadow-mode dry run for one full production cycle
- Phased cutover: low-risk templates first, then all journeys
- Remove Tracardi iframe from club-dashboard + fanbox
- Decommission `tracardi.service.coxa.live`

**Q2 Total: ~59 person-weeks**

---

## Q3 — Weeks 27–39: Fan Experience + Content

**Goal:** Complete the fan portal. Ship the 14 remaining blank routes and all engagement mechanics.

### Sprint 13 (Weeks 27–28): News + Match Center
**PRD 4 — News** (`/news`): CMS-backed article feed, personalized by favorite player, reactions + comments, WhatsApp-first sharing  
**PRD 5 — Match Center** (`/matches`): Live scores, lineups (formation + list), xG/possession/shots stats, live text commentary, standings, attendance history. Requires Opta or Sportradar data feed integration.

### Sprint 14 (Weeks 29–30): Players + Videos
**PRD 6 — Players** (`/players`): Squad grid by position, player detail with bio/stats/history/fan ratings, favoriting feeding News personalization  
**PRD 7 — Videos** (`/videos`): Highlights/interviews/behind-the-scenes, HLS adaptive bitrate, timestamped WhatsApp sharing

### Sprint 15 (Weeks 31–32): Predictions + Polls + Leaderboards
**PRD 8 — Predictions** (`/predictions`): Exact-score/1X2/bonus-question "Bolão Coxa," private/public leagues, achievement badges  
**PRD 9 — Polls & Votes** (`/polls`, `/votes`): MOTM voting (opens at 60'), goal-of-month, best-celebration polls, server-side result-hiding until vote cast  
**PRD 16 — Leaderboards**: Weekly/season/all-time/friends/league scopes

### Sprint 16 (Weeks 33–34): Wallet + PIX + Sócio Wallet Pass
**PRD 15 — Wallet** (`/wallet`): PIX/card/boleto top-up, auto-recharge, withdraw-to-PIX, transaction history. Mercado Pago as unified processor.  
**PRD 19 — Sócio Card in Apple/Google Wallet**: Native `.pkpass`/Google Wallet JWT, auto-updates on tier change/renewal  
Product: Jersey customization (`is_customizable` flag + `customization_rules` on Product model)

### Sprint 17 (Weeks 35–36): Community + Friends + Check-in + F&B
**PRD 10 — Community** (`/community`): Fan wall, threaded discussions, regional/interest groups, watch-party RSVP  
**PRD 11 — Friends** (`/friends`): Contact/Instagram hash-match, attendance-intent sharing, group ticket purchase with split PIX  
**PRD 17 — Match Check-in**: GPS+BLE geofence, +50 pts award, friends-at-this-match, QR-rescan fallback  
**PRD 18 — F&B to Seat**: iFood-familiar menu, seat-delivery vs. pickup, wallet-first payment, live order status

### Sprint 18 (Weeks 37–39): Support + Language + Onboarding
**PRD 12 — Support/Help/FAQ** (`/support`, `/help`, `/faq`): Searchable FAQ, bot-first live chat, ticket tracking, refund + bug-report flows  
**PRD 14 — Language Switcher** (`/language`): PT-BR/EN/ES with live date/time/currency-format preview  
**PRD 20 — Fan Onboarding Flow**: 7-step wizard (Welcome→Identity→Interests→Notifications→Language→Payment→Tour), <90 seconds, gamified completion reward

**Q3 Total: ~91 person-weeks**

---

## Q4 — Weeks 40–52: Enterprise + Analytics

**Goal:** Make the platform configurable, auditable, and sellable to enterprise clubs.

### Sprint 19 (Weeks 40–41): Admin Settings + Integration Marketplace
- Full Settings page (General, Fiscal/CNPJ/PIX, Email Domain DKIM/SPF/DMARC, Branding Kit, Season Config, Feature Flags, API Keys, Webhooks)
- Integration marketplace: 12 categories, 40+ connectors — Analytics/BI (GA4, Snowflake, BigQuery), Advertising Audiences (Meta/Google/TikTok), Payments (Mercado Pago, PagSeguro, Stripe), Ticketing (Ingresse, Sympla), CRM (Salesforce, HubSpot), Football Data (Opta, Sportradar), Communications (SES, Zenvia)

### Sprint 20 (Weeks 42–43): RBAC v2 + SSO/SAML + 2FA
- Three-tier role model (Global/Domain/Custom) + resource×action×scope permissions matrix
- SAML 2.0/OIDC with JIT provisioning + group-to-role mapping
- SCIM 2.0 auto-provisioning endpoints
- TOTP/WebAuthn/SMS 2FA with recovery codes

### Sprint 21 (Weeks 44–45): Audit Log + DPO Console
- Platform-wide immutable audit log: append-only, before/after diff, anomaly alerts
- 5-year retention for financial/tax records
- DPO console: consent health, DSR queue, retention job status, breach status, one-click ANPD audit report

### Sprint 22 (Weeks 46–47): 9 Pre-Built Dashboards + Custom Builder
- 9 dashboards: Executive Summary, Marketing Performance, Sócio Funnel, Ticketing, Retail, F&B, Loyalty, Fan Lifecycle, LGPD Compliance
- Drag-drop custom dashboard builder over a shared metrics catalog
- Retail POS infinite-spinner fix (data pipeline investigation)

### Sprint 23 (Weeks 48–49): ML Models
- Feature store + training pipeline
- Churn model (XGBoost) — productionized
- CLV prediction (RFM+tenure+category regression) — net-new
- Ticket + retail propensity models
- NBO upgraded from static single-offer matching to contextual bandit
- Send-time optimization model
- SHAP explainability surfaced in fan profile UI

### Sprint 24 (Weeks 50–52): Advanced Analytics
- 7-model attribution selector (first-touch, last-touch, linear, time-decay, U-shaped, data-driven, custom)
- Funnel + cohort + path analysis
- Anomaly detection + revenue/count forecasting (MAPE-tracked)

**Q4 Total: ~72 person-weeks**

---

## Parallel Tracks (run alongside main sprints)

| Track | When | Key deliverables |
|---|---|---|
| Admin CMS (articles, roster, fixtures) | Q2–Q3 | Rich-text editor with match-embed blocks, media library, squad CRUD, fixture calendar |
| Financial Ops (refunds, PIX payouts) | Q2–Q3 | Unified refund drawer with approval chain, batch PIX payouts, cross-module revenue reports |
| Sponsor Portal | Q3–Q4 | Scoped sponsor login, k-anonymity audience insights, redemption reports |
| Matchday Ops Console | Q3–Q4 | WebSocket gate-scan feed, turnstile-fault alerting, F&B stand performance, incident log |
| Developer Portal | Q4 | OpenAPI docs, webhook explorer, JS/Python SDKs, status page |
| Environments (sandbox/staging/prod) | Q1–Q2 | Separate logical schema per env, env-scoped API keys, `is_test_account` flag |
| Rate Limits + Quotas | Q4 | Per-key/IP/tenant tiers, usage dashboard, `429`/`Retry-After` headers |

---

## Full Effort Summary

| Quarter | Sprints | Person-weeks |
|---|---|---|
| Q1 (Compliance + Channels) | 6 sprints | ~80 |
| Q2 (Journey Engine + CDP) | 6 sprints | ~59 |
| Q3 (Fan Experience) | 6 sprints | ~91 |
| Q4 (Enterprise + Analytics) | 6 sprints | ~72 |
| **Total headline delivery** | | **~302** |
| + parallel tracks + support workstreams | | ~650–750 |
| **Full program total** | | **~950–1,050 person-weeks** |

---

## Recommended Team (Balanced — 18–22 FTEs)

| Role | Count | Primary workstreams |
|---|---|---|
| Product Managers | 2 | PM1: Compliance+Channels+Journey; PM2: Fan Portal+Admin |
| Backend engineers | 6–7 | Channels, Journey Engine, CDP/ML, Admin APIs |
| Frontend engineers | 4–5 | Fan Portal (React/PWA), Admin console, Journey Canvas (React Flow) |
| Mobile/PWA specialist | 1 | Offline mode, push/deep-links, wallet-pass |
| Data/ML engineer | 1–2 | Feature store, training pipeline, SHAP explainability |
| DevOps/SRE | 1–2 | BullMQ/Redis, SES/Zenvia, environments, rate limits |
| Designer | 2 | Fan Portal design system + 20 PRDs; Admin UI |
| DPO / Compliance lead | 1 | Owns all LGPD work end-to-end |
| QA/Test engineer | 1–2 | Regression baseline + cross-surface integration |

**Quarterly ramp:**

| Quarter | FTEs |
|---|---|
| Q1 | ~15 (compliance + channels — more review-bound than throughput-bound) |
| Q2 | ~18 |
| Q3 | ~19 |
| Q4 | ~19 |

---

## Buy vs. Build Decisions

| Capability | Decision | Rationale |
|---|---|---|
| Email delivery | **Buy infra (Amazon SES), build template layer** | Cheapest at scale (~$200/mo vs $400+ SendGrid); build MJML editor in-house |
| SMS + WhatsApp | **Buy — Zenvia BSP** | Unified Brazilian provider for both; handles ANPD-required STOP/PARE |
| Push | **Buy — Firebase Cloud Messaging (FCM)** | Free, battle-tested, handles iOS APNs relay |
| Journey Engine | **Build natively on MERN** | Tracardi proved third-party orchestration is a single point of failure |
| Support/CX ticketing | **Buy (Zendesk/Intercom/Movidesk)** | Drops admin effort from XL to M; build only the fan-context sidebar |
| Status page | **Buy (Statuspage.io/Instatus)** | ~$30/mo vs weeks of engineering |
| Sports data feeds | **Buy — Opta or Sportradar** | No feasible in-house alternative for live match data |
| Payments | **Buy — Mercado Pago** | Unifies PIX + card + boleto in one integration (3 separate processors otherwise) |

---

## Key Risks

| Risk | Mitigation |
|---|---|
| **LGPD enforcement before compliance ships** | Sprint 1 starts immediately; DPO hired before Sprint 1; no marketing sends until consent infra is live |
| **Tracardi outage re-creates itself (new vendor lock-in)** | Journey Engine built natively on MERN; no iframe embedding for any critical capability going forward |
| **WhatsApp template Meta review delay (1–3 days)** | Submit all 8 templates in Week 3 (Sprint 4) in parallel with development |
| **Opta/Sportradar contract blocking Match Center** | Begin commercial discussions in Q1 alongside fan portal Sprint 6; Match Center is Q3 |
| **ML model quality (churn/CLV)** | Use historical ledger data to train offline first; shadow mode before production; SHAP for interpretability |
| **Coordinating 18+ FTEs across 6 workstreams** | Two PMs owning clearly separate surfaces; weekly cross-workstream sync on shared models (ConsentRecord, FanProfile, ChannelSuppression) |

---

## North Star KPIs

| Metric | Baseline | 12-Month Target |
|---|---|---|
| P0 security vulnerabilities | 5 (all patched) | 0 |
| LGPD compliance score | 0/100 | Passing ANPD audit |
| Communication channels live | 0 | 6 (Email/SMS/Push/WhatsApp/In-app/Web Push) |
| Journey engine uptime | 0% (Tracardi offline) | 99.9%+ |
| Fan portal maturity | 1.8/10 | 8+/10 |
| Admin maturity | ~35/100 | ~85/100 |
| FanBox maturity | 2.8/10 | 8+/10 |
| Monthly Active Fans | Not tracked | +150% by Q4 |
| Sócio churn rate | No intervention | Measurable reduction via journey templates |

---

## Regression Baseline (must not break)

Per the QA report — these 9 flows work today and must be protected through every sprint:
1. Login/logout on club + fan portals
2. XSS escaping in React views
3. `.env` / `.git` paths return 404
4. SPA routing fallback on unknown top-level paths
5. NBO Simulator input validation (rejects XSS/SQL)
6. Offer CRUD (create/edit/archive/restore) with negative-value rejection
7. Ticket QR display on fan portal
8. Personalization segment-mapping table
9. FanBox dashboard rendering for authorized admin

---

## Spec Reference (all 6 engineering specs in deliverables)

| Spec file | Lines | Read when you need... |
|---|---|---|
| spec_compliance.md | 779 | LGPD Art.7/18/48 legal detail, ConsentRecord schema, DSR workflow, breach playbook, DPO console |
| spec_channels.md | 808 | Email/SMS/Push/WhatsApp provider selection, Universal Router, template registry, A/B testing |
| spec_journey_engine.md | 658 | 26 node types, BullMQ execution, 15 sports templates, Tracardi migration plan |
| spec_cdp.md | 815 | Fan profile 120 fields, identity resolution, 54-event schema, ML model catalog |
| spec_fan_portal.md | 1,271 | All 20 fan-portal PRDs — wireframes, data models, API contracts, empty states |
| spec_admin.md | 1,039 | Settings, RBAC matrix, integrations marketplace, audit log, analytics dashboards |
