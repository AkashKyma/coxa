# Coxa CDP — Segmentation Strategy

**Last updated:** July 2026  
**Status:** Active implementation

---

## Overview

Coxa uses a **3-tier segmentation architecture**. Each tier serves a different purpose and operates on different data sources. They work together — segments defined in one tier can feed actions in another.

```
Tier 1: MongoDB Rule Segments    → Static audience queries (react-querybuilder)
Tier 2: PostHog Behavioural Cohorts → Event-driven behaviour (what fans DO)
Tier 3: Tracardi Real-time Segments → Live event triggers (immediate reactions)
```

---

## Tier 1 — MongoDB Rule Segments
**Tool:** Visual Segment Builder (built-in, `react-querybuilder`)  
**Where:** Fanbox Dashboard → Intelligence → Segments & Filters  
**Also:** Club Dashboard → Personalization → Visual Segment Builder

### What it does
Queries your existing MongoDB `FanProfile` and `FanScore` collections directly using AND/OR rule trees. Results are fan lists you can export, assign offers to, or use for campaign targeting.

### Available fields (27 total)

| Category | Fields |
|---|---|
| Identity | Full Name, Email, Gender, Status |
| Location | City, State, Country, Is Foreigner |
| Demographics | Age Range, Household Income Band, Has Children |
| Interests | Sports Betting Interest, Biometric Registered |
| Fan Score | Total Score, Tier (Bronze→Diamond), Attendance, Spending, Referral, Engagement |
| ML Scores | Churn Risk (0–1), Ticket Propensity (0–1), Retail Propensity (0–1), Next Best Channel |
| Dates | Member Since |

### Example segments

```
High-churn São Paulo Gold fans:
  city = "São Paulo"
  AND tier = "gold"
  AND churnRiskScore >= 0.70

Ticket buyers ready for merch upsell:
  ticketPropensity >= 0.80
  AND retailPropensity >= 0.60
  AND nextBestChannel = "whatsapp"

Dormant premium members:
  tier IN ["platinum", "diamond"]
  AND status = "active"
  AND createdAt < 2025-01-01
```

### API endpoints
```
POST /api/v1/cdp/segments/query        → returns matching fans (paginated)
POST /api/v1/cdp/segments/query/count  → returns fan count (lightweight preview)
```

---

## Tier 2 — PostHog Behavioural Cohorts
**Tool:** PostHog (self-hosted on EC2)  
**URL:** https://posthog.service.coxa.live  
**Where:** Embedded or accessed directly

### What it does
PostHog tracks **what fans do** — every event (ticket purchase, app visit, campaign click, loyalty redemption) is captured and can define cohorts. These are behaviour-based segments, not profile-based.

### Events flowing into PostHog

All these events are automatically forwarded from the backend via `cdpEventService.js`:

| Event | When triggered |
|---|---|
| `fan.registered` | New fan signs up |
| `ticket.purchased` | Fan buys a ticket |
| `ticket.used` | Fan scans in at gate |
| `membership.created` | New membership started |
| `membership.renewed` | Membership renewed |
| `membership.cancelled` | Membership cancelled |
| `sale.completed` | Retail or F&B purchase |
| `loyalty.points.earned` | Points awarded |
| `loyalty.points.redeemed` | Points redeemed for reward |
| `campaign.participated` | Fan responded to campaign |

### Example cohorts in PostHog

```
Fans who bought tickets in last 90 days
→ PostHog cohort: performed "ticket.purchased" in last 90 days

Fans who never redeemed loyalty points
→ cohort: performed "fan.registered" AND never performed "loyalty.points.redeemed"

Highly engaged fans (3+ events in last 30 days)
→ cohort: event count >= 3 in last 30 days
```

### Use cases
- **Session replay** — watch exactly what high-churn fans do before they leave
- **Feature flags** — show new features only to Gold+ tier fans
- **A/B testing** — test two different offer messages on a cohort
- **Funnels** — see the drop-off from "ticket viewed" → "ticket purchased"

---

## Tier 3 — Tracardi Real-time Segments & Workflows
**Tool:** Tracardi (self-hosted on EC2)  
**URL:** https://tracardi.service.coxa.live  
**Where:** Club Dashboard → Marketing & CDP → Automation Workflows  
**Also:** Fanbox Dashboard → Intelligence → Automation Workflows

### What it does
Tracardi receives events in **real-time** from RudderStack via the webhook bridge (`POST /api/v1/cdp/tracardi-bridge`) and:
1. Builds **live fan profiles** as events arrive
2. Assigns fans to **real-time segments** based on event conditions
3. Triggers **workflow automations** (send message, update trait, escalate, wait, branch)

### How events reach Tracardi
```
Fan action on app
    ↓
Backend → cdpEventService.publishEvent()
    ↓
RudderStack (event streaming)
    ↓
Webhook destination → POST /api/v1/cdp/tracardi-bridge
    ↓
Tracardi API /track
    ↓
Profile built + segment assigned + workflow triggered
```

### Visual Workflow Builder — what you can build

Open the workflow canvas at **Club Dashboard → Automation Workflows → Workflow Builder tab**.

**Example: Welcome journey**
```
[Trigger: fan-registered event]
    ↓
[Delay: 10 minutes]
    ↓
[Check: membership_tier exists?]
    ↙              ↘
  Yes                No
[Send WhatsApp:    [Send Email:
 "Welcome member!"] "Complete your profile"]
    ↓
[Add to segment: "Onboarded Fans"]
```

**Example: Churn prevention**
```
[Trigger: no activity for 60 days]
    ↓
[Check: tier = platinum or diamond?]
    ↙              ↘
  Yes                No
[Alert: club staff]  [Send push: "We miss you!"]
[Add tag: at-risk]
```

**Example: Post-match engagement**
```
[Trigger: ticket-used event]
    ↓
[Wait: 2 hours]
    ↓
[Send push: "How was the match? Rate your experience"]
    ↓
[Delay: 24 hours]
    ↓
[Offer: match photo pack if attended 3+ games]
```

### Tracardi source setup
The source `coxa-rudderstack-bridge` is auto-created on backend startup. No manual config needed.

---

## How the tiers work together

```
Fan Data in MongoDB
        │
        ▼
Tier 1: Visual Builder ─────────► Export CSV / Assign offer / Campaign list
        │
        ▼
RudderStack events ──────────────► Tier 2: PostHog cohorts (behaviour)
        │                                        │
        │                                        ▼
        │                              Feature flags / A/B tests / Replays
        │
        ▼
Tracardi bridge ─────────────────► Tier 3: Real-time workflows
                                             │
                                             ▼
                              Auto-send WhatsApp / push / email
                              Auto-update fan segments
                              Alert club staff on high-value at-risk fans
```

---

## Segment → Offer mapping

Segments from **Tier 1** are stored in MongoDB and mapped to personalization offers in the Club Dashboard → Personalization page. The NBO (Next Best Offer) engine uses these mappings to serve personalised offers when fans log in.

| Segment | Offer type |
|---|---|
| High-churn Gold fans | Retention discount (15% off season pass renewal) |
| High ticket propensity | Early access ticket offer |
| High retail propensity | Exclusive merchandise bundle |
| WhatsApp channel preference | WhatsApp-delivered exclusive offer |
| Diamond tier | VIP event invitation |

---

## ML Scores (Tier 1 enhancement)

ML scores are calculated nightly by Dagster pipelines and written back to `FanProfile` fields. They power Tier 1 segment rules:

| Score field | What it means | How it's used |
|---|---|---|
| `churnRiskScore` | 0–1 probability fan will churn in 30 days | Target retention campaigns at > 0.65 |
| `ticketPropensity` | 0–1 likelihood to buy tickets | Prioritise ticket promotions at > 0.70 |
| `retailPropensity` | 0–1 likelihood to buy merchandise | Prioritise merchandise offers at > 0.60 |
| `nextBestChannel` | push / email / whatsapp / sms | Route messages via the highest-response channel |

---

## Quick reference

| Need | Use |
|---|---|
| "Show me all fans matching X criteria" | Tier 1 — Visual Segment Builder |
| "How many fans did Y in the last 30 days?" | Tier 2 — PostHog cohorts |
| "When a fan does X, immediately do Y" | Tier 3 — Tracardi workflow |
| "Send this offer to a specific audience" | Tier 1 segment → Club Dashboard → Personalization |
| "Test which message works better" | Tier 2 — PostHog A/B test on cohort |
| "Track which fans are about to churn" | Tier 1 `churnRiskScore >= 0.65` OR Tier 3 inactivity trigger |
