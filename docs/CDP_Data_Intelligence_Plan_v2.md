# Coxa Fan OS — CDP & Data Intelligence Platform

## Development Plan v2.1 (Refined — Dashboard-Complete)

**Client:** Coritiba FC / Coxa Fan OS  
**Timeline:** 6 Weeks (4 Phases, AI-Accelerated)  
**Prepared:** July 2026  
**Stack:** All open-source, self-hosted, zero vendor lock-in  
**Development Model:** AI-Accelerated (Cursor + Claude + GPT-4o) — ~2.75 FTE  
**Dashboards in Scope:** `club-dashboard` (club operations) + `fanbox-dashboard` (fan intelligence)

---

## Executive Summary

This plan evolves Coxa from a backend-only CDP into a **multi-channel enterprise data intelligence platform** that captures fan interactions from websites, mobile apps, POS systems, and tracking pixels — unifying them into a single fan profile for intelligent personalization and automated marketing activation.

Both dashboards are explicitly in scope: the **club-dashboard** (used by club staff for operations) gains a new Club Intelligence analytics page and RudderStack event tracking; the **fanbox-dashboard** (used by marketing & analytics teams) is fully powered by the Cube semantic layer (Phase 2) and gains ML-predicted segments and AI campaign suggestions (Phases 3–4).

**Key numbers:**
- Timeline: 6 weeks (compressed from 8 via open-source tools that eliminate custom builds)
- Team: ~2.75 FTE (AI generates 80–90% of code; humans review, validate, deploy)
- All tools: open-source (Redis, ClickHouse, RudderStack, PostHog, Tracardi, Multiwoven, Cube, Dagster, XGBoost)

---

## Open-Source Technology Stack

| Tool | Stars | License | Role in Coxa |
|------|-------|---------|-------------|
| **RudderStack** | ~9,000 | AGPL-3.0 / MIT (SDKs) | Event streaming CDP — replaces custom eventBus.js; adds web + app + pixel tracking |
| **PostHog** | ~30,000+ | MIT | Product analytics + session replay + A/B testing (no custom build needed) |
| **ClickHouse** | ~48,400 | Apache-2.0 | Analytical warehouse — sub-second KPI queries over millions of events |
| **Tracardi** | ~2,500+ | Open-core | Visual segmentation + real-time profiles + workflow automation |
| **Multiwoven** | ~1,600 | AGPL-3.0 | Reverse ETL — auto-syncs segments to email, ads, CRM platforms |
| **Cube** | ~20,300 | Apache-2.0 | Semantic KPI layer — define metrics once, query everywhere |
| **Dagster** | ~15,800 | Apache-2.0 | Pipeline orchestration — schedules ML training, data refresh |
| **XGBoost** | ~27,000 | Apache-2.0 | ML models — churn, propensity, channel prediction |

---

## Dashboard Scope — What Each Dashboard Gets

### club-dashboard (Club Operations)

| Phase | What Gets Added |
|-------|----------------|
| **Phase 1** | `@coxa/analytics` SDK installed; RudderStack JS tracking on all pages; operator identity (staff ID + club) sent on login; page-view tracking on all routes; specific event tracking: `checkin_qr_validated`, `checkin_window_created`, `checkin_windows_synced`, `nbo_simulated`, `analytics_dashboard_loaded` |
| **Phase 2** | New **Club Intelligence** page (`/analytics`) — powered by Cube semantic layer: retail KPIs + top products + location revenue chart; F&B KPIs + top items; ticketing & check-in KPIs; membership health (churn rate, at-risk count, plan mix); loyalty activity (points earned/redeemed, tier upgrades); new `/api/v1/club/analytics/*` backend routes |
| **Phase 3** | Check-in Dashboard enhanced with ML fan scores — priority window suggestion engine uses `churnRisk` and `ticketPropensity` to identify priority fans |
| **Phase 4** | Personalization Dashboard upgraded to ML-ranked NBO (top-3 offers with confidence, not just first match); A/B test assignment visible per fan via PostHog feature flags |

### fanbox-dashboard (Fan Intelligence & Marketing)

| Phase | What Gets Added |
|-------|----------------|
| **Phase 1** | Already had `@coxa/analytics` SDK (installed in previous sprint); page-view tracking active; fan identity resolution on login already wired via backend `identifyFan()` |
| **Phase 2** | All analytics endpoints upgraded to Cube-backed `cubeAnalyticsService` (ClickHouse, sub-second queries); `InsightsPage` membership dept now calls `memberReports` endpoint (Cube-backed); `InsightsPage` loyalty dept now calls `loyaltyReports` endpoint (Cube-backed); `OverviewPage` and `EngagementPage` already pulling from Cube via same routes; Advanced KPI section on InsightsPage enriched with Fan 360 value, retention cohorts, revenue intelligence |
| **Phase 3** | `InsightsPage` Advanced KPI section gains ML score cards: Fans at Churn Risk (live count from ML model), Ticket Propensity distribution, Next Best Channel breakdown; Tracardi segments visible in FiltersPage as auto-imported filters |
| **Phase 4** | AI campaign recommendation cards on CampaignsPage: AI identifies opportunity → pre-drafts campaign → human approves; A/B test results visible in InsightsPage; Multiwoven sync status visible in audience cards (last synced to email/ads) |

---

## What Gets Replaced vs What Stays

### Replaced

| Current | Replaced By | Reason |
|---------|------------|--------|
| `eventBus.js` (synchronous) | RudderStack event streaming | Production-grade async, web/mobile/server SDKs, 200+ destinations |
| No website/app tracking | RudderStack JS + Mobile SDKs | Auto-capture pages, clicks, forms, screen views |
| No tracking pixels | RudderStack + PostHog | Cross-domain, ITP-compliant, ad attribution |
| `segmentService.js` (AND-only) | Tracardi | Visual AND/OR/NOT builder, real-time, no code |
| No reverse ETL | Multiwoven | Pre-built connectors to email, ads, CRM |
| No product analytics | PostHog | Session replay, funnels, retention, experiments |
| No A/B testing | PostHog experiments | Feature flags, statistical significance |
| Airbyte CDC (was planned) | RudderStack warehouse dest | Events stream directly to ClickHouse — no CDC needed |

### Preserved (Enhanced)

| Module | Why It Stays | Enhancement |
|--------|-------------|-------------|
| `traitCalculator.js` | Sports-specific fan trait logic | Triggered by RudderStack webhook instead of inline |
| `fanScoreService.js` | Unique 6-component scoring algorithm | Fed by richer data from multi-channel events |
| `customer360Service.js` | Aggregates 7 sources in parallel | Gains ML scores + multi-channel history |
| `personalizationService.js` | NBO logic | Upgraded to ML-ranked with Tracardi triggers |
| `kpiRegistry.js` / analytics | Presentation layer | Backed by Cube reading ClickHouse |
| `ragService.js` + AI insights | Unique AI assistant | Enriched with more CDP data |
| club-dashboard operational pages | Club staff UX | Enhanced with real-time check-in data + analytics intelligence |
| fanbox-dashboard intelligence pages | Analytics team UX | Powered by Cube for sub-second KPI queries + ML predictions |

---

## Multi-Channel Event Capture

| Channel | Technology | What Gets Captured |
|---------|-----------|-------------------|
| **Website** (fan portal, e-commerce, club site) | RudderStack JavaScript SDK | Page views, clicks, form submissions, product views, cart events, ticket browsing |
| **Mobile App** (Fan App, Stadium App) | RudderStack iOS + Android SDKs | App opens, screen views, in-app purchases, QR scans, food orders, loyalty redemptions |
| **Tracking Pixels / Cross-Domain** | RudderStack + PostHog | First-party cookies (ITP-compliant), cross-domain identity, ad attribution (Meta, Google) |
| **POS / Backend** (retail, ticketing, F&B) | RudderStack Node.js SDK | All existing sale, ticket, membership, loyalty events via unified pipeline |
| **Club Staff Actions** | RudderStack JS SDK (club-dashboard) | Gate scan results, NBO simulations, window creation, analytics views |
| **Webhooks / Third-Party** | RudderStack webhook sources | Payment confirmations, email engagement, social interactions, partner events |

---

## Phase 1: Event Infrastructure + Multi-Channel Capture

**Timeline:** Weeks 1–2  
**Tools deployed:** RudderStack, PostHog

### Objective

Deploy RudderStack as the event backbone and PostHog for product analytics. Install tracking SDKs on all web properties — including the club-dashboard for staff operational events. Migrate existing backend events from custom `eventBus.js` to RudderStack. Achieve multi-channel event capture from day one.

### Week 1: Deploy + Instrument

- Deploy RudderStack server (Docker: `rudder-server` + `rudder-transformer` + PostgreSQL)
- Configure RudderStack control plane — define sources and destinations
- Install RudderStack JavaScript SDK + PostHog on all fan-facing apps:
  - `fan-landing`, `fan-dashboard`, `fan-auth`: auto-capture page views, form events, ticket browsing
  - `fanbox-dashboard`: marketing team session tracking, feature usage analytics
- Install `@coxa/analytics` SDK on **club-dashboard** for staff operational tracking:
  - Staff identity resolution on login (operator ID + club ID sent to RudderStack + PostHog)
  - Page view tracking across all routes (gate ops, retail, personalization, CDP)
  - Specific operational events: `checkin_qr_validated`, `checkin_window_created`, `nbo_simulated`
- Configure PostHog (self-hosted Docker) with auto-capture enabled
- Migrate all `ingestEvent()` calls in backend services to RudderStack Node.js SDK
- Configure RudderStack destinations: MongoDB (existing OLTP), PostHog (analytics)

### Week 2: Wire + Validate

- RudderStack transformations: validate events, map to Coxa CDP schema format
- Configure Coxa backend as RudderStack webhook destination (receives processed events)
- Wire `traitCalculator.js` and `fanScoreService.js` to trigger from webhook events
- Event schema enforcement in RudderStack transformations layer
- DLQ management via RudderStack built-in retry + PostgreSQL buffer
- Load test: verify 1000+ events/min sustained throughput
- PostHog: verify auto-captured web events, session replay, initial funnels
- **Club-dashboard**: verify PostHog session replay captures staff workflows (gate scan, NBO simulation)

### Testing Gate (End of Week 2)

| Test | Pass Criteria |
|------|--------------|
| Website events captured | Page views, clicks, forms visible in PostHog + RudderStack |
| Backend events flowing | POS/ticketing events route through RudderStack to MongoDB |
| Identity resolution | Anonymous visitor linked to fan profile on `identify()` |
| Event latency | Source to MongoDB < 2 seconds end-to-end |
| Trait calculation | Existing fan traits compute correctly on new event path |
| Load test | 1000 events/min sustained 30 minutes |
| Session replay | PostHog records fan portal user sessions AND club-dashboard staff sessions |
| Club staff events | `checkin_qr_validated`, `nbo_simulated` events visible in PostHog |

### Deliverable

Multi-channel event capture live. Every fan touchpoint (web, app, POS) and every staff action in the club-dashboard feeds a single unified pipeline.

---

## Phase 2: Data Warehouse + Semantic Layer + Dashboard Analytics

**Timeline:** Weeks 3–4  
**Tools deployed:** ClickHouse, Cube, Dagster

### Objective

Deploy ClickHouse as the analytical engine with RudderStack streaming events directly to the warehouse (no Airbyte/CDC needed). Layer Cube as the semantic KPI backbone so analytics never compete with transactional workload on MongoDB. Wire **both dashboards** to consume data from Cube.

### Week 3: Infrastructure

- Deploy ClickHouse (Docker or ClickHouse Cloud for production)
- Configure RudderStack ClickHouse destination — events stream directly to warehouse
- ClickHouse table schemas: `coxa_events`, `fan_360`, `coxa_sales`, `coxa_tickets`
- Deploy Cube semantic layer connected to ClickHouse
- Begin porting ~80 KPIs from `kpiRegistry.js` to Cube YAML models

### Week 4: Dashboard Integration + Validation

- Complete Cube KPI migration — all department metrics as semantic models
- Deploy Dagster for pipeline orchestration (ML scheduling, MV refresh)
- Create `cubeClient.js` — Cube REST API wrapper for the backend
- **fanbox-dashboard analytics upgrade:**
  - All `fanboxAnalyticsService` endpoints now served by `cubeAnalyticsService` (ClickHouse, sub-second)
  - `InsightsPage` membership + loyalty sections call dedicated Cube-backed endpoints
  - `OverviewPage` fan counters and growth chart from Cube
  - `BusinessReportPage` all 11 business sources from Cube (MongoDB fallback retained)
  - Advanced KPI section: Fan 360 value, revenue intelligence, retention cohorts from `fan_360` materialized view
- **club-dashboard analytics upgrade:**
  - New **Club Intelligence page** (`/analytics`) added to sidebar navigation
  - Powered by new `/api/v1/club/analytics/*` backend routes
  - Retail section: POS revenue KPIs + top products table + location revenue bar chart
  - F&B section: F&B stand revenue + top menu items table
  - Ticketing section: attendance, tickets issued/used, use rate, no-show counts
  - Membership section: active members, new/renewed/cancelled, churn rate %, plan mix pie chart
  - Loyalty section: points earned/redeemed, active earner %, tier upgrade rate, burn rate
  - All sections with date-range filter (today / 7d / 30d / 90d / custom)
- Validate KPI parity: old MongoDB aggregations vs new Cube responses
- Create ClickHouse materialized views for high-traffic queries (`daily_sales_mv`, `weekly_attendance_mv`, `fan_360`)

### Why No Airbyte Needed

RudderStack eliminates Airbyte entirely. Instead of:

```
MongoDB → Airbyte (CDC, 15-min lag) → ClickHouse
```

We get:

```
Source → RudderStack → MongoDB AND ClickHouse simultaneously (real-time, zero lag)
```

This saves 1 week of infrastructure setup and removes a failure point.

### Testing Gate (End of Week 4)

| Test | Pass Criteria |
|------|--------------|
| Data freshness | ClickHouse data arrives real-time from RudderStack (no lag) |
| fanbox-dashboard parity | All 8 department KPIs match old vs new path |
| club-dashboard analytics | Club Intelligence page loads all 5 sections in < 500ms |
| Performance | Both dashboards respond < 500ms for 1-year date range |
| Pre-aggregations | Materialized views refresh on Dagster schedule |
| Cube API | Ad-hoc dimension/measure queries return correct results |
| Fallback | MongoDB path still works if ClickHouse is down |

### Deliverable

Sub-second analytics in both dashboards. 80 KPIs governed in one semantic layer. Club staff see retail, F&B, ticketing, membership, and loyalty KPIs in one screen. Marketing team's InsightsPage loads instantly from ClickHouse.

---

## Phase 3: Advanced Segmentation + ML Scoring

**Timeline:** Weeks 4–5 (overlaps Phase 2 by 1 week)  
**Tools deployed:** Tracardi, XGBoost (via Dagster)

### Objective

Deploy Tracardi for visual segment building with real-time profile updates. Marketing teams create segments without engineering. Begin ML scoring pipeline for predictive fan intelligence. Surface ML predictions in both dashboards.

### Segmentation via Tracardi

- Deploy Tracardi (Docker: API + GUI + background workers + Elasticsearch)
- Configure Tracardi event source receiving from RudderStack (webhook bridge)
- Migrate existing segment definitions from `segmentService.js` to Tracardi
- Tracardi provides out-of-the-box:
  - Visual AND/OR/NOT rule builder with drag-and-drop nesting
  - Live audience counter as rules change (real-time query)
  - Segment comparison and overlap analysis
  - Workflow automation: trigger actions when fans enter/exit segments
  - Profile merging and identity resolution
- **fanbox-dashboard**: Tracardi segments auto-imported as saved filters in FiltersPage
- **club-dashboard**: Personalization dashboard segment list sourced from Tracardi

### ML Scoring Pipeline

| Model | Type | Output | Use Case |
|-------|------|--------|----------|
| Churn prediction | XGBoost binary | 0–1 probability | Win-back campaigns when > 0.7 |
| Ticket purchase propensity | XGBoost binary | 0–1 per fan per event | Target high-propensity fans |
| Retail purchase propensity | XGBoost binary | 0–1 probability | Product recommendations |
| Next-best-channel | Multi-class | Channel ranking | Send via preferred channel |

### ML Architecture

- **Feature store:** ClickHouse materialized view (`fan_features`) with 50+ computed columns
- **Training:** Python/XGBoost orchestrated by Dagster, weekly retrain
- **Scoring:** Batch nightly — scores all active fans, writes to MongoDB `FanProfile` + Tracardi profiles
- **Integration:** Tracardi segments can reference ML scores (e.g., `churn_risk > 0.7 AND inactive_90d`)

### Dashboard Upgrades (Phase 3)

**fanbox-dashboard:**
- `InsightsPage` Advanced KPI section gains ML intelligence cards:
  - Fans at Churn Risk (live count, threshold configurable)
  - Ticket Propensity distribution chart (% of fans by propensity tier)
  - Next Best Channel breakdown bar chart (email vs push vs WhatsApp vs SMS)
- `FiltersPage` auto-imports Tracardi segments as saved audiences with live counts
- `SingleFanViewPage` shows ML scores: churn risk, ticket propensity, predicted channel

**club-dashboard:**
- `CheckInDashboardPage` shows fan score tier distribution for the event (who's coming)
- `PersonalizationDashboardPage` NBO result shows ML propensity score alongside offer match
- `MemberDetailPage` shows churn risk and propensity scores for individual members

### FanProfile Schema Extensions

```
churnRiskScore: Number (0–1)
ticketPropensity: Number (0–1)
retailPropensity: Number (0–1)
nextBestChannel: String (push/email/whatsapp/sms)
mlScoresUpdatedAt: Date
```

### Testing Gate (End of Week 5)

| Test | Pass Criteria |
|------|--------------|
| Backward compatibility | Existing segment audiences identical after Tracardi migration |
| Visual builder | Non-engineer creates AND/OR/NOT segment in Tracardi GUI |
| Real-time updates | Fan enters segment within seconds of qualifying event |
| Churn model AUC | > 0.70 on held-out test set |
| Propensity model AUC | > 0.65 on held-out test set |
| ML scores visible | customer-360 shows churn risk, propensity, best channel |
| fanbox InsightsPage | Churn risk count card shows live ML data |
| club PersonalizationPage | NBO result shows propensity score |

### Deliverable

Marketing creates segments visually (no engineering tickets). ML predicts which fans will churn, buy tickets, or prefer WhatsApp over email. Both dashboards surface these predictions where staff and marketers need them most.

---

## Phase 4: Personalization + Activation

**Timeline:** Weeks 5–6  
**Tools deployed:** Multiwoven, PostHog Experiments (feature flags)

### Objective

Deploy Multiwoven to auto-sync segments to marketing tools. Upgrade personalization to ML-ranked multi-offer. Add AI campaign generation with human approval. Surface activation results in both dashboards.

### Multiwoven Reverse ETL (Auto-Activation)

- Deploy Multiwoven (Docker: server + React UI + integrations gem)
- Connect source: ClickHouse (`fan_360` table with segments + scores)
- Configure destinations: SendGrid/Brevo (email), WhatsApp Business API, Meta Ads, Google Ads
- Define sync models: high-value segment → email list, churn-risk → win-back campaign
- Scheduled syncs: every 6 hours, segments auto-pushed to all connected tools
- **No more manual CSV exports** — marketing tools always have fresh audience data
- **fanbox-dashboard**: Audience cards in FiltersPage show last Multiwoven sync time + destination count

### ML-Ranked Personalization

- Upgrade `personalizationService.js` to ML-ranked NBO (top-3 offers with confidence)
- Scoring function: segment match + ML propensity + recency penalty + historical conversion
- Frequency capping:
  - Max 3 impressions per offer per fan per 7 days
  - Max 1 push notification per fan per day
  - Max 5 email offers per fan per week
  - 48-hour suppression after conversion
- A/B testing via PostHog feature flags (deterministic hash assignment)
- **club-dashboard**: PersonalizationDashboardPage NBO simulator returns top-3 ranked offers (not just first match)

### AI Campaign Recommendation Engine

- LLM analyzes current segments + ML scores + business KPIs from Cube
- Identifies opportunities (e.g., "342 high-churn fans inactive 60+ days")
- Drafts campaign: target segment, channel, timing, offer, LLM-generated copy
- Human approval queue (auto-launch below risk/spend threshold)
- Results tracked via PostHog experiments and fed back for improvement
- **fanbox-dashboard**: AI recommendation cards appear on CampaignsPage above the campaign list

### Dashboard Upgrades (Phase 4)

**fanbox-dashboard:**
- `CampaignsPage`: AI recommendation strip — top-3 suggested campaigns with estimated reach and predicted open rate
- `InsightsPage`: A/B test results section — running experiments, variant performance, statistical significance
- `FiltersPage`: Audience cards now show Multiwoven sync status (last synced, destination list)
- `OverviewPage`: New "Activation" KPI strip — campaigns sent this week, emails delivered, Multiwoven sync health

**club-dashboard:**
- `PersonalizationDashboardPage`: NBO simulator upgraded to show top-3 ranked offers with confidence percentages and ML propensity backing
- `OverviewPage`: New activation card — showing how many fans were targeted by automated campaigns this week

### Testing Gate (End of Week 6)

| Test | Pass Criteria |
|------|--------------|
| Multiwoven sync | Segments appear in email platform within 6 hours |
| NBO ranking | Returns 3 ranked offers with confidence (not just first match) |
| Frequency cap | Same offer not shown > 3 times in 7 days |
| A/B testing | PostHog shows variant assignment + statistical significance |
| AI campaign draft | Generates coherent campaign with real Tracardi segment |
| fanbox-dashboard | AI recommendation cards appear with real segment data |
| club-dashboard | NBO simulator shows top-3 ranked offers |
| End-to-end | Website event → trait → score → segment → offer < 3 minutes |

### Deliverable

Automated multi-offer personalization. Segments sync to email/ads/CRM without manual work. AI suggests campaigns. A/B tests run automatically. Both dashboards show the full loop — from event capture to activation result.

---

## 6-Week Timeline

| Week | Phase | Delivers | Human Validates | Milestone |
|------|-------|----------|----------------|-----------|
| 1 | Phase 1 | RudderStack deployed, JS SDK on all 5 apps (fan + club + fanbox), PostHog live, backend migrated | Multi-channel events flowing | Ingestion live |
| 2 | Phase 1 | Event routing, DLQ, load testing, identity resolution, club-dashboard operator tracking | Load test + regression | **PHASE 1 COMPLETE** |
| 3 | Phase 2 | ClickHouse + Cube deployed, RudderStack warehouse streaming, club/fanbox analytics routes | Data freshness validation | Warehouse live |
| 4 | Phase 2+3 | KPI parity validated, both dashboards on Cube, Club Intelligence page live, Tracardi deployed | Phase 2 sign-off + club analytics demo | **PHASE 2 COMPLETE** |
| 5 | Phase 3+4 | ML models trained, Tracardi live, Multiwoven deployed, NBO v2 top-3 | Phase 3 sign-off + ML predictions in dashboards | **PHASE 3 COMPLETE** |
| 6 | Phase 4 | Multiwoven syncs active, A/B testing, AI campaigns in fanbox, top-3 NBO in club, e2e validation | Stakeholder demo (both dashboards) | **PHASE 4 COMPLETE** |

---

## Infrastructure (All Docker)

| Component | Image | Resources | Purpose |
|-----------|-------|-----------|---------|
| RudderStack Server | `rudderlabs/rudder-server` | 2 CPU, 4GB | Event ingestion + routing |
| RudderStack Transformer | `rudderlabs/rudder-transformer` | 1 CPU, 2GB | JS event transformations |
| PostgreSQL (RudderStack) | `postgres:15` | 1 CPU, 2GB | Event buffer + retry |
| PostHog | `posthog/posthog` | 2 CPU, 4GB | Analytics, replay, A/B |
| ClickHouse | `clickhouse/clickhouse-server` | 4 CPU, 8GB | Analytical warehouse |
| Cube | `cubejs/cube` | 1 CPU, 2GB | Semantic KPI layer |
| Tracardi API | `tracardi/tracardi-api` | 2 CPU, 4GB | Profiles + segmentation |
| Tracardi GUI | `tracardi/tracardi-gui` | 0.5 CPU, 1GB | Visual segment builder |
| Multiwoven | `multiwoven/multiwoven` | 1 CPU, 2GB | Reverse ETL activation |
| Dagster | `dagster/dagster` | 1 CPU, 2GB | ML + refresh orchestration |

**Total: ~15 CPU, 30GB RAM** (one AWS m6i.4xlarge or equivalent)

---

## Risk Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| RudderStack complexity | Adds Go + PostgreSQL | Docker one-command deploy; team only configures YAML |
| Tracardi maturity | Smaller community | Keep Coxa segment service as fallback; gradual migration |
| Too many tools at once | Operational burden | Deploy sequentially per phase; max 2 tools per phase |
| Data duplication | Storage cost | ClickHouse compresses 10–20x; only events duplicated |
| PostHog volume | Free tier = 1M events/mo | Self-host (MIT license = unlimited, no fees) |
| Identity resolution | Merge complexity | RudderStack `identify()` + Tracardi profile merging |
| ML model accuracy | Bad recommendations | High thresholds; human approval for AI campaigns |
| LGPD compliance | Brazilian data law | All self-hosted; PII masked in warehouse |
| Club-dashboard analytics load | Operational DB pressure | Cube serves analytics; MongoDB untouched |

---

## Team Requirements

| Role | Responsibility | FTE | Phases |
|------|---------------|-----|--------|
| Senior Backend Lead | Architecture, code review, integration testing | 1.0 | All |
| Data Engineer | ClickHouse + Cube + Dagster deployment | 0.5 | 2–4 |
| ML Engineer | Model evaluation, tuning, validation | 0.5 | 3–4 |
| Frontend Developer | SDK install, dashboard enhancements (both dashboards) | 0.5 | 1, 3–4 |
| DevOps | Docker infra, CI/CD, monitoring | 0.25 | All |

**Total: ~2.75 FTE over 6 weeks**

---

## Value Per Phase

| Phase | fanbox-dashboard Gets | club-dashboard Gets |
|-------|----------------------|--------------------|
| **Phase 1** (Week 2) | PostHog session replay on marketing team; campaign usage tracking | Operator identity tracking; gate scan events; NBO usage analytics in PostHog |
| **Phase 2** (Week 4) | Sub-second analytics (was 3–8s); 80 KPIs from Cube; InsightsPage loads instantly | New Club Intelligence page: retail + F&B + ticketing + membership + loyalty in one screen, < 500ms |
| **Phase 3** (Week 5) | ML churn risk + propensity in InsightsPage; Tracardi segments as saved audiences | ML scores on member detail; propensity-backed NBO; fan score distribution on check-in dashboard |
| **Phase 4** (Week 6) | AI campaign suggestions; A/B test results; Multiwoven sync status on audiences | Top-3 ranked NBO in simulator; activation KPI strip on overview |

---

*Prepared by: Coxa Engineering — July 2026*  
*Plan version: v2.1 — Dashboard-Complete (club-dashboard + fanbox-dashboard explicit scope)*  
*Next review: End of Phase 2 (Week 4)*
