# Coxa Fan OS — Client Feature Overview

**Events & Ticketing · Customer Data Platform (Events) · Segmentation · Personalization**

This document describes what is built today in Coxa and how these capabilities work together for the club, staff, and fans.

---

## Executive summary

Coxa connects **matchday ticketing** with a **Customer Data Platform (CDP)** so every meaningful fan action is recorded, understood, and used to deliver **relevant offers and experiences**.

| Capability | What the club gets |
|------------|-------------------|
| **Events & Ticketing** | Create matches, sell tickets, issue QR gate passes, validate entry, track attendance |
| **CDP Events** | A single, auditable stream of fan and commerce activity across the platform |
| **Segmentation** | Dynamic fan audiences based on behaviour (spend, recency, attendance, inactivity) |
| **Personalization** | Targeted “next best offers” shown to fans based on their segment membership |

These modules are **tenant-aware** (multi-club ready), **integrated by design**, and visible in both **Club Dashboard** (operations/marketing) and **Fan Dashboard** (self-service).

---

## 1. Events & Ticketing

### Purpose

Give the club end-to-end control of match events—from venue setup through ticket sales, digital passes, and gate entry—while feeding fan activity into marketing and loyalty.

### What staff can do (Club Dashboard)

- **Venues** — Configure stadiums/arenas used for matches.
- **Match events** — Create fixtures (teams, date/time, gates open, status).
- **Ticket products** — Define ticket types per event (sections, pricing, capacity/availability).
- **Reservations & issuance** — Hold and issue tickets through the admin workflow.
- **Gate operations** — Scan and validate QR passes at entry (gate scanner in Club Dashboard).
- **Membership check-in** — Support member priority windows and check-in flows tied to loyalty.

### What fans can do (Fan Dashboard)

- Browse **upcoming matches** and available ticket products.
- **Purchase tickets** online (logged-in fan account).
- View **My tickets** with match details and ticket status.
- Open a **full-screen QR gate pass** to present at entry.

### How tickets work technically

- Each issued ticket receives a unique **QR token** used at the gate.
- Gate validation checks entitlement (valid ticket, correct event, not already used).
- Successful entry can trigger downstream activity (attendance tracking, loyalty, CDP events).

### CDP events emitted by ticketing

When ticketing actions occur, Coxa publishes standardized events, including:

| Event | Meaning |
|-------|---------|
| `event.created` | Match/fixture created |
| `ticket.reserved` | Ticket held in reservation |
| `ticket.purchased` | Fan bought ticket(s) |
| `ticket.used` | Ticket scanned / admitted at gate |
| `member.checked_in` | Member check-in recorded |
| `no_show.recorded` | Fan did not attend |

These events link to the fan profile where possible, so marketing and segmentation stay in sync with matchday behaviour.

---

## 2. CDP Events (Customer Data Platform)

### Purpose

Create a **trusted, central record** of everything important that happens in the fan journey—sales, registrations, loyalty, ticketing, and more—so the club can analyze behaviour and automate engagement.

### What is an “event”?

An event is a structured record with:

- **Event name** (e.g. `sale.completed`, `ticket.purchased`)
- **Source** (POS, fan app, club admin, etc.)
- **Fan profile** (when known)
- **Timestamp** and **payload** (order total, ticket count, etc.)
- **Idempotency key** — duplicate submissions are safely ignored (no double-counting)

### How events enter the system

Events are captured automatically when domain services complete actions, for example:

- Retail/POS **sale completed** or **returned**
- Fan **registered** or profile updated
- **Loyalty points** earned, redeemed, adjusted, or reversed
- **Ticket purchased**, **used**, or **member checked in**
- Stock transfers and other operational signals

Staff can also **ingest events via API** for integrations (`POST /api/v1/cdp/events`).

### What staff see (Club Dashboard → CDP → Events)

- Searchable **event log** with fan linkage, status, and payload detail.
- Failed events can land in a **dead-letter queue (DLQ)** for review and replay.

### Why it matters for the client

- **One source of truth** for fan activity (not scattered spreadsheets or siloed apps).
- **Audit trail** for compliance and operations.
- **Foundation** for segmentation, personalization, loyalty, and future campaigns.

---

## 3. Segmentation

### Purpose

Group fans into **actionable audiences** so marketing, loyalty, and matchday teams can target the right people with the right message—without manual list exports.

### How segmentation works

1. **Events** occur (purchase, ticket buy, check-in, etc.).
2. Coxa computes **fan traits** (computed attributes per fan), such as:
   - Total retail spend
   - Recent buyer (purchase in last 30 days)
   - High-value retail buyer
   - Ticket purchase count
   - Match attendance count
   - Inactive fan (no meaningful activity in 90+ days)
3. **Segments** are rule-based definitions over those traits, e.g.:
   - *“Recent Buyers”* → `is_recent_buyer = true`
   - *“High Value Retail Buyers”* → `is_high_value_retail = true`
   - *“Inactive Fans”* → `is_inactive = true`
4. Segment **member counts** refresh as traits update after new events.

### Segment rules (flexible logic)

Rules support operators such as equals, greater/less than, contains, and exists—combined with **AND** logic (all rules must match).

### What staff can do (Club Dashboard → CDP)

- **Segments** — Create, edit, preview audience size, and view sample members.
- **Customer 360** — Look up any fan by email/ID and see:
  - Profile and traits
  - **Which segments they belong to**
  - Loyalty balance and recent activity
  - Personalized offer recommendation

### Demo segments (seed data)

| Segment | Business meaning |
|---------|------------------|
| High Value Retail Buyers | Top spenders in club retail |
| Recent Buyers | Purchased in the last 30 days |
| Inactive Fans | No recent activity — win-back target |

---

## 4. Personalization

### Purpose

Turn segmentation into **fan-facing value** by showing the most relevant offer for each supporter—not a generic promotion for everyone.

### How “Next Best Offer” works

1. Identify the fan (profile ID or email).
2. Resolve **which segments** they currently match.
3. Select the **first matching offer** from a prioritized offer catalog.
4. If no segment matches, show a **default welcome offer**.

### Example offers (configured in platform today)

| If fan is in… | Offer shown |
|---------------|-------------|
| High Value Retail Buyers | 10% off Home Jersey |
| Recent Buyers | Cap + Scarf bundle |
| Inactive Fans | 500 bonus loyalty points (win-back) |
| Everyone else (fallback) | Free shipping on orders over R$150 |

### Where fans see personalization

- **Fan Dashboard → Home** — “For you” promotional card with offer title, description, and link to shop.
- **Club Dashboard → Customer 360** — Same recommendation visible to staff when reviewing a fan.

### API

`GET /api/v1/personalization/next-best-offer?fanProfileId=...`

Returns offer details, matched segment name, and fan context (segments, traits, loyalty balance).

---

## 5. How it all fits together

```
Match / Retail / Loyalty action
        ↓
   CDP Event stored
        ↓
   Fan traits updated
        ↓
   Segment membership recalculated
        ↓
   Next Best Offer selected
        ↓
   Fan sees offer on Home · Staff sees it in Customer 360
```

**Example journey (demo):**

1. Fan buys merchandise at **POS** with email attached → `sale.completed` event.
2. Traits update: spend totals, “recent buyer” flag.
3. Fan joins **Recent Buyers** segment.
4. On **Fan Dashboard Home**, they see the **Cap + Scarf bundle** offer.
5. Marketing opens **Customer 360** for that fan and sees the same recommendation plus full history.

**Ticketing example:**

1. Fan buys a ticket in **Fan Dashboard** → `ticket.purchased`.
2. Traits update: ticket count, last purchase date.
3. At the stadium, staff scans **QR pass** → `ticket.used` / check-in events.
4. Attendance traits update; segments and future offers can reflect matchday engagement.

---

## 6. Applications & access

| Application | Role |
|-------------|------|
| **Club Dashboard** | Ticketing admin, gate scanner, CDP events, segments, Customer 360 |
| **Fan Dashboard** | Ticket purchase, QR passes, personalized home offers |
| **POS App** | In-stadium/retail sales linked to fan email (feeds CDP) |

Modules are enabled per club tenant (`ticketing`, `cdp`, `personalization`, `loyalty`, `retail`, etc.).

---

## 7. Current scope & future enhancements

### Delivered today (MVP)

- Full ticketing catalog, fan purchase flow, QR gate passes
- Event bus with idempotency, trait engine, rule-based segments
- Next Best Offer personalization on fan and admin UIs
- Customer 360 unified profile view
- Integration with loyalty (points on sales, check-in, rewards)

### Natural next steps (not yet productized)

- Visual campaign builder and scheduled messaging
- Admin UI to manage offer catalog (today offers are configured in code)
- Advanced segment logic (OR groups, nested rules)
- A/B testing and offer performance analytics
- Email/push delivery tied to segments

---

## 8. Summary for stakeholders

**Events & Ticketing** runs matchday commerce and entry. **CDP Events** capture every meaningful interaction in one place. **Segmentation** turns that data into live audiences. **Personalization** converts audiences into offers fans actually see—on mobile and in the tools staff use every day.

Together, this gives the club a **closed loop**: *action → insight → audience → offer → next action*, without replacing existing operations—enhancing them.

---

*Document reflects Coxa platform as implemented. For technical deployment see [HOSTING.md](./HOSTING.md) and [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md).*
