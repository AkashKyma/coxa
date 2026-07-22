/**
 * RAG Knowledge Base Seeder.
 *
 * All knowledge is inlined — no file-system dependency, safe to deploy anywhere.
 *
 * Sources:
 *  1. Inline platform guides (fan management, ticketing, retail, membership, social, AI, loyalty, RBAC)
 *  2. Inline project docs (FanBox admin workflow, approval, client features, enhancement proposal)
 *  3. KPI registry — each KPI as a searchable text chunk
 *  4. Filter field registry
 *
 * Change-detection: each source's content is SHA-256 hashed. If the hash
 * matches the stored metadata.contentHash the source is skipped — no
 * embedding API calls are made, keeping costs near-zero on repeat runs.
 *
 * Run: node backend/src/services/ai/seedKnowledgeBase.js
 * Or call seedAllKnowledge() from server startup / admin endpoint.
 */

import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { ingestDocument, RagChunk } from "./ragService.js";
import { KPI_REGISTRY } from "../../lib/kpiRegistry.js";
import { FILTER_FIELDS } from "../../lib/filterFields.js";

// ─── Change-detection helpers ─────────────────────────────────────────────────

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Ingest a source only when its content has changed since the last embed run.
 * Stores the hash in RagChunk.metadata.contentHash on every ingested chunk.
 * Returns { skipped: true } when unchanged — zero embedding API calls made.
 */
async function ingestIfChanged(source, text, opts = {}) {
  const hash = sha256(text);

  // Check if any chunk for this source already has this hash
  const existing = await RagChunk.findOne(
    { source, "metadata.contentHash": hash },
    { _id: 1 },
  ).lean().catch(() => null);

  if (existing) {
    return { source, skipped: true, reason: "content unchanged" };
  }

  return ingestDocument(source, text, {
    ...opts,
    metadata: { ...(opts.metadata ?? {}), contentHash: hash, seededAt: new Date() },
  });
}

// ─── Document sources ─────────────────────────────────────────────────────────

const PLATFORM_GUIDES = [
  {
    source: "platform/fan-management",
    text: `
# Fan Management — Admin Guide

The Fans module lets admins view and manage all fan profiles registered on the platform.

## Fan list
- Use the search bar to find fans by name, email, phone, or CPF.
- The list shows key fields: name, email, CPF status, plan, loyalty tier, last activity.
- Click any row to open the Single Fan View with full history.

## Single Fan View
Tabs available: Profile, Tickets, Memberships, Purchases, Loyalty, Labels.
- Edit a fan's email, phone, address, date of birth, and CPF from the Profile tab.
- CPF is required for Brazilian nationals. Mark foreigners with the "Is Foreigner" toggle.

## CPF rules
- Every Brazilian fan profile must have a valid CPF (11-digit, checksum-verified).
- Foreign fans must have the "Foreigner" flag set — CPF is then optional.
- Importing fans via CSV: rows missing CPF (and not flagged as foreigner) will fail with a row-level error CSV returned.

## Filters
Use the Filters page (Intelligence → Filters) to build advanced fan segments using the visual Filter Builder.
Supported fields: age, gender, city, state, plan, loyalty tier, last purchase date, subscription status, CPF status, labels.

## Labels & tagging
Apply custom labels to fans from the Single Fan View or in bulk from the DataTable.
Labels can be used as filters and for grouping analytics.
`,
  },
  {
    source: "platform/ticketing",
    text: `
# Ticketing — Admin Guide

## Ticket overview
The ticketing module tracks issued tickets, scanned gate entries, and no-shows.

## Key KPIs
- Tickets Issued: total sold for the period.
- Tickets Used: scanned at the gate.
- Sold but Not Attended (no-show): Issued − Used. Surface this to identify empty paid seats.
- Avg Ticket Value: Revenue ÷ Issued.
- Sell-Through %: Issued ÷ Capacity.
- Member Ticket Buyers %: % of buyers who are active members.

## Filtering
Filter by date range, ticket type (match/season/subscription), sector, channel.

## Member vs non-member value
The Access KPIs section shows combined ticket + retail spend for members vs non-members attending a match.
This reveals how much more (or less) subscription fans spend compared to casual attendees.
`,
  },
  {
    source: "platform/membership",
    text: `
# Membership — Admin Guide

## Plans and statuses
Membership plans are configured per tenant. Members can be: Active, Churned, Pending, Suspended.

## Key KPIs
- Active Memberships, New, Churned, Reactivated.
- Net Member Growth = New − Churned.
- MRR / Revenue: membership transaction revenue.
- ARPU: Revenue ÷ Active members.
- Compliance Rate (Adimplentes %): % in good standing.
- Renewal Rate: % of expiring members who renewed.

## Managing members
- Upgrade/downgrade plans from the member profile.
- Process manual payments from the Payments tab.

## Sectors
Members are assigned sectors (stadium seating sectors associated with their plan).
`,
  },
  {
    source: "platform/retail",
    text: `
# Retail & Stores — Admin Guide

## Store configuration
Two physical stores are configured: Stadium Store and City Store.
Products, SKUs (with size labels), categories, and stock balances are managed in the Retail module.

## Key KPIs
- Orders, Revenue, Units Sold, Avg Order Value, Avg Items/Order.
- Best / Worst Performing Store by revenue.
- Top 5 Products and Top 5 Categories.
- Revenue by Hour-of-Day and Day-of-Week (heatmap).
- Returns Rate, Member Share of Spend.

## Backfill
Sale lines are denormalized with category, size, location, hour, and day-of-week for fast aggregations.
Run the backfill migration from Retail → Admin → Backfill Denormalization.

## Inventory
Low-stock alerts are shown on the Inventory page. Threshold is configurable per SKU.
`,
  },
  {
    source: "platform/rbac",
    text: `
# Role-Based Access Control — Admin Guide

## Roles
Five named roles exist: Administrator, Manager, Analyst, Marketer, Viewer.

| Role          | Create/Edit fans | Export | Analytics | AI Assistant | Admin settings |
|---------------|-----------------|--------|-----------|-------------|----------------|
| Administrator | ✓               | ✓      | ✓         | ✓           | ✓              |
| Manager       | ✓               | ✓      | ✓         | ✓           |                |
| Analyst       |                 | ✓      | ✓         | ✓           |                |
| Marketer      | ✓               |        | read-only |             |                |
| Viewer        |                 |        | read-only |             |                |

## Permission overrides
Each staff user can have individual permission grants or revokes on top of their role defaults.
Edit them in Users → the staff member → Permissions tab.

## Module access
Individual modules (retail, social, AI, exports) can be enabled/disabled per user independent of role.
`,
  },
  {
    source: "platform/social",
    text: `
# Social Media Tracking — Admin Guide

## Tracked channels
Coritiba's official channels are tracked: Instagram, X (Twitter), Facebook, YouTube, TikTok.

## KPIs
- Total Followers (combined across channels).
- Follower Growth (net change in period).
- Avg Engagement Rate: (likes + comments + shares) ÷ reach.
- Impressions: total post visibility.
- Top Post: highest-engagement content.

## Ingestion
Metrics are fetched automatically via official APIs (where available) or scraper adapters on a scheduled worker.
Trigger a manual ingestion from Social → Ingest Now.

## Per-channel summaries
Each channel card shows a sparkline of follower growth and the latest engagement rate.
`,
  },
  {
    source: "platform/ai-assistant",
    text: `
# AI Assistant — Admin Guide

## Overview
The AI assistant is available in both FanBox and Club dashboards via the chat widget (bottom-right corner).
It uses a Retrieval-Augmented Generation (RAG) pipeline to answer questions grounded in platform documentation and live KPI context.

## What it can do
- Answer questions about how to use platform features (fan management, ticketing, retail, membership, etc.).
- Summarize current KPI performance for a department.
- Suggest actionable next steps based on current metrics.
- Guide onboarding for new operators step-by-step.

## What it cannot do
- Access or reveal fan PII (names, emails, CPFs are never returned).
- Perform write actions (it is read-only).
- Answer questions outside the platform domain.

## Role-aware responses
The assistant adapts its tone and level of detail to the operator's role.
Admins get full technical context; Viewers get high-level summaries.

## Enabling the assistant
Set OPENAI_API_KEY in the backend .env file. Without this, the assistant returns a stub message.
`,
  },
  {
    source: "platform/loyalty",
    text: `
# Loyalty Programme — Admin Guide

## Points system
Fans earn points for: attending matches, purchasing in-store or online, completing profile, referrals.
Points can be redeemed for: discounts, merchandise, priority access.

## KPIs
- Points Issued, Points Redeemed, Redemption Rate.
- Points Liability: estimated cash value of outstanding unredeemed points.
- Tier Distribution: fan count per tier (Bronze/Silver/Gold/Platinum/Diamond).

## Tier thresholds
Configured per tenant. Moving up a tier triggers an automated notification and reward.
`,
  },
  // ─── Project documentation (inlined from docs/) ───────────────────────────
  {
    source: "docs/FANBOX_ADMIN_WORKFLOW",
    text: `# FanBox Admin — Workflow & API Reference

## Architecture
FanBox dashboard (:5178) is the English staff UI for fan intelligence and analytics.
Backend module: /api/v1/fanbox on main Coxa API (:5000).

## Auth
POST /api/v1/fanbox/auth/login — returns JWT.
All requests need: Authorization: Bearer <token>, X-Club-Id: <clubId>.
Demo: admin@coxa.local / CoxaDemo123! (fanbox_admin role).

## Roles
- fanbox_admin: all modules + staff management
- fanbox_manager: fans, business, projects, intelligence, campaigns
- fanbox_analyst: fans, intelligence, business
- fanbox_marketer: fans, intelligence, campaigns, projects
- fanbox_viewer: fans dashboard only

## Key workflows
Overview Dashboard: fan base health, growth, engagement, spend at a glance.
Fans / Single Fan View: search by email/CPF/name/phone, Customer 360, edit profile.
Business tabs (10): Membership, Tickets, Access, Stores, E-Commerce, Coxa Foods, App, OTT, Coxa Run, Manto.
Fan Intelligence / Filters: build filter rules, preview audience count, save, export CSV, promote to segment.
Insights: view saved filters as KPI cards with AI summaries.
Digital Projects: Surveys, Votes, Raffles, Contests, NPS.
Campaigns: create, schedule, send; HTML template manager.
Control Panel: staff management (fanbox_admin only), CSV import (cadastros/leads).

## Business tab API
GET /fanbox/analytics/business/:source
Source values: membership, tickets, access, stores, ecommerce, app, ott, coxa-run, coxa-foods, manto

## Filter rules operators
eq, neq, gt, gte, lt, lte, contains, exists, in

## POS Integration (write APIs that feed Business tabs)
POST /retail/sales → Stores, Coxa Foods
POST /retail/shop/orders → E-Commerce
POST /membership/join, /membership/renew → Membership
POST /ticketing/tickets/issue → Tickets
POST /ticketing/check-ins, /ticketing/entitlements/validate → Access
POST /ticketing/events/:id/record-no-shows → Access (no-shows)
`,
  },
  {
    source: "docs/FANBOX_APPROVAL",
    text: `# FanBox Parity — MVP Sign-Off

Status: APPROVED for MVP release (Engineering, 15 Jun 2026).

## Phase delivery summary
P0 (Shell & data foundation): global fan counters, counter bar, sidebar IA, branded login, profile enrichment, CSV import, FanBox staff auth — DONE.
P1 (Analytics core): growth time-series, growth chart, engagement/spend reports, Single Fan View, demographics, 10 Business report routes — DONE. App/OTT/Run/Manto stubs deferred.
P2 (Fan Intelligence++): filter builder, CSV export, save/manage filters, InsightsPage, segment bridge — DONE.
P3 (Projetos Digitais): Surveys, Votes, Raffles — DONE. Contests, NPS thin stubs.
P4 (Campanhas): campaign model, wizard, list, templates, basic stats — DONE. External ESP delivery deferred.

## Deferred post-MVP
1. App/OTT/Coxa Run external integration analytics
2. Full contest and NPS workflows
3. Drag-and-drop email builder
4. Real email/push delivery (SendGrid, FCM)
5. Route-level code splitting

## Demo login
admin@coxa.local / CoxaDemo123! — also marketing@coxa.local, loyalty@coxa.local
Tenant: coxa-club-001
`,
  },
  {
    source: "docs/CLIENT_FEATURES",
    text: `# Coxa Fan OS — Client Feature Overview

## Events & Ticketing
Staff: create matches, sell tickets, issue QR gate passes, validate entry, track attendance, manage membership check-in windows.
Fans: browse upcoming matches, purchase tickets online, view My Tickets, open QR gate pass.
CDP events emitted: event.created, ticket.reserved, ticket.purchased, ticket.used, member.checked_in, no_show.recorded.

## CDP Events
Central record of all fan activity. Each event has: name, source, fan profile link, timestamp, payload, idempotency key.
Sources: retail/POS sale, fan registration, loyalty points, ticket purchase/use, member check-in, stock transfers.
Staff can view event log and replay dead-letter queue items.

## Segmentation
Fan traits are computed after events (total spend, recent buyer, high-value retail, ticket count, attendance count, inactive).
Segments are rule-based over traits with AND logic.
Demo segments: High Value Retail Buyers, Recent Buyers, Inactive Fans.
Staff: create/edit segments, preview audience size, view sample members, Customer 360.

## Personalization — Next Best Offer
Matches fan to first qualifying offer from prioritized catalog.
Example: High Value Retail Buyers → 10% off Home Jersey; Recent Buyers → Cap + Scarf bundle; Inactive Fans → 500 bonus points; fallback → free shipping R$150+.
API: GET /api/v1/personalization/next-best-offer?fanProfileId=...
Visible in Fan Dashboard Home and Club Dashboard Customer 360.
`,
  },
  {
    source: "docs/COXA_ENHANCEMENT_PROPOSAL",
    text: `# Coxa Admin Platform — Enhancement Proposal

## Universal filters
Time presets: Today, Last 7d, Last 30d, MTD, QTD, YTD, Custom. Granularity: Daily/Weekly/Monthly/Quarterly/Annual.
Revenue source: Retail, E-Commerce, Membership, Ticketing, F&B.
Retail: store/location, product category, product, size, time-of-day, day-of-week.
Membership: plan, status, tenure band, sector, billing cadence.
Fan/audience: CPF present, foreigner, city/state, gender, age band, income band, channel preference, member vs non-member.

## KPI catalog highlights
Fan base: total fans, CPF rate, foreigner count, data quality exceptions, growth rate, active fans 30d.
Membership: active, new, churned, reactivated, net growth, MRR, ARPU, avg tenure, compliance rate, renewal rate, plan mix, LTV.
Ticketing: tickets issued, revenue, avg ticket value, sell-through %, no-show count+value, channel mix, member vs non-member buyers.
Access: total entries, unique attendees, member vs non-member entries, repeat-visit rate, attendance per match, first-time visitors.
Retail: revenue, orders, units sold, AOV, basket size, by-store, top-5 products, top-5 categories, by size, by hour, by day, returns rate.
Loyalty: points issued/redeemed, redemption rate, outstanding liability, active earners, tier distribution.
Social (per channel): followers, net growth, reach, impressions, engagement rate, top post, video views.
Financial roll-up: total revenue all sources, revenue by source, subscription vs non-subscription, revenue per fan, best/worst department.

## AI suite
RAG assistant: role-aware chatbot trained on platform docs and live KPI data.
AI insight summaries: auto-generated plain-language analysis per department.
BrowserUse automation: agentic task automation under audited permissions.
Guided onboarding: Scribe-style in-app step-by-step tours.

## RBAC — 5 roles
Administrator: full access + staff management.
Manager: operational management across modules.
Analyst: analytics and intelligence, read-focused.
Marketer: campaigns, filters, projects, audiences.
Viewer: read-only dashboards.
Per-user permission overrides on top of role defaults, enforced in UI and on API.
`,
  },
];

// ─── Seed KPI registry as searchable documents ────────────────────────────────

function buildKpiDocument() {
  const lines = KPI_REGISTRY.map(
    (k) =>
      `KPI: ${k.label} (key: ${k.key})\n` +
      `Department: ${k.department} | Tier: ${k.tier} | Format: ${k.format} | Unit: ${k.unit}\n` +
      `Description: ${k.description}\n` +
      `Analysis hint: ${k.analysisHint}\n` +
      `Recommended visualization: ${k.defaultViz}\n`,
  );
  return lines.join("\n---\n");
}

function buildFilterFieldsDocument() {
  const lines = FILTER_FIELDS.map(
    (f) =>
      `Filter field: ${f.label} (field: ${f.field})\n` +
      `Type: ${f.type} | Department: ${f.department ?? "all"}\n` +
      `Operators: ${(f.operators ?? []).join(", ")}\n`,
  );
  return `Available filter fields in the platform:\n\n${lines.join("\n---\n")}`;
}

// ─── Seed docs from the /docs directory ──────────────────────────────────────
// (removed — all docs are inlined into PLATFORM_GUIDES above)

// ─── Main seeder ─────────────────────────────────────────────────────────────

export async function seedAllKnowledge({ verbose = false } = {}) {
  const log = verbose ? console.log : () => {};

  // Skip entirely when no OpenAI key is configured — avoids 401 noise on startup
  if (!process.env.OPENAI_API_KEY) {
    log("[RAG seed] OPENAI_API_KEY not set — skipping embedding seed");
    return { sources: 0, totalChunks: 0, skipped: 0, reason: "no_api_key" };
  }
  const results = [];

  log("[RAG seed] Seeding platform guides + project docs...");
  for (const guide of PLATFORM_GUIDES) {
    const r = await ingestIfChanged(guide.source, guide.text, { tenantId: null });
    results.push(r);
    if (r.skipped) {
      log(`  ↩ ${guide.source} (unchanged — skipped)`);
    } else {
      log(`  ✓ ${guide.source}`, r.skipped ? "(no API key)" : `(${r.ingested ?? 0} chunks)`);
    }
  }

  log("[RAG seed] Seeding KPI registry...");
  const kpiDoc = buildKpiDocument();
  const kpiResult = await ingestIfChanged("platform/kpi-registry", kpiDoc, { tenantId: null });
  results.push(kpiResult);
  log(kpiResult.skipped ? `  ↩ kpi-registry (unchanged)` : `  ✓ kpi-registry (${kpiResult.ingested ?? 0} chunks)`);

  log("[RAG seed] Seeding filter fields...");
  const ffDoc = buildFilterFieldsDocument();
  const ffResult = await ingestIfChanged("platform/filter-fields", ffDoc, { tenantId: null });
  results.push(ffResult);
  log(ffResult.skipped ? `  ↩ filter-fields (unchanged)` : `  ✓ filter-fields (${ffResult.ingested ?? 0} chunks)`);

  const totalIngested = results.reduce((s, r) => s + (r.ingested ?? 0), 0);
  const totalSkipped = results.filter((r) => r.skipped && r.reason === "content unchanged").length;
  log(`[RAG seed] Done. ${results.length} sources — ${totalIngested} chunks ingested, ${totalSkipped} unchanged (skipped).`);

  return { sources: results.length, totalChunks: totalIngested, skipped: totalSkipped };
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  import("../../server.js").then(() => {
    // Wait a tick for mongoose to connect
    setTimeout(() => seedAllKnowledge({ verbose: true }).then(process.exit), 2000);
  });
}
