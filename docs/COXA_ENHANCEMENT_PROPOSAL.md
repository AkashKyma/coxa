# Coxa Admin Platform — Enhancement Proposal & Development Vision

**Prepared for:** Client (Coritiba / Coxa stakeholders)
**Prepared by:** Product & Engineering
**Scope:** FanBox Admin (`club.coxa.live`) + Club Operations Dashboard — brought to feature parity
**Status:** Proposal for sign-off

---

## 1. Executive summary

This document consolidates everything discussed into a single, clear development vision. It covers:

1. **What we heard** — every request from the review, mapped to a concrete deliverable.
2. **Enhancements we have planned** — the full scope of work, in plain business language.
3. **All advanced filters** we will deliver across the platform.
4. **The complete KPI catalog** we have identified — the most important metrics per department, designed to go *beyond* what comparable platforms offer.
5. **AI, automation & onboarding** — RAG assistant, insights, BrowserUse automation, and guided learning.
6. **Roadmap & phasing.**

The guiding principle from the review: *"We want to be better, not just do what they do."* Every section below is built to that standard — deeper KPIs, filters everywhere, adjustable interactive tables, and AI-assisted insight on top.

---

## 2. What we heard → what we are delivering

Every point raised is captured and assigned. Nothing is dropped.

| # | What you asked for | What we will deliver |
|---|--------------------|----------------------|
| 1 | "Every table / KPI per department is too minimal — add more KPIs, use GPT to find advanced ones" | A config-driven **KPI catalog** (Section 6) with many more financial + operational KPIs per department, plus AI-discovered advanced metrics |
| 2 | "Filter by dates (daily / weekly / annually / custom) and by revenue source (retail vs ticketing; subscription vs non-subscription)" | **Universal filters** (Section 5) on every chart and table |
| 3 | "Adjustable tables — add filters, labels, categories; make them interactive and filterable; more tables per revenue department" | **Adjustable, interactive data tables** with saved views, column control, search, and export |
| 4 | "Store inventory, POS, TWO stores, add/edit products, KPIs per product / category / size / time / day" | **Retail depth**: two-store support, product management, inventory visibility, POS visibility, and granular retail analytics |
| 5 | "Role-based system (Administrator, Manager, Analyst, Marketer, Viewer), same in both admin accounts, with unique permissions" | **Unified, granular RBAC** with per-user permission overrides across both admin apps |
| 6 | "Fans must have a CPF number, or be labeled as foreigners" | **CPF / foreigner validation** with new completeness counters |
| 7 | "Add a scraper per social media; track all official Coritiba channels; social KPIs + summaries" | **Social media tracking** with scrapers/APIs and a social KPI dashboard |
| 8 | "Insights + a RAG model; a chatbot/guide per operator; BrowserUse; Scribe-like onboarding to improve the learning curve" | **AI suite**: RAG assistant, AI insights, BrowserUse automation, guided onboarding tours |
| 9 | "Provide all KPIs, insights, and filters per every industry" | **Per-industry configuration** so the catalog adapts by industry |
| 10 | "Continuous UX testing with the support team, coordinators, and managers" | **Structured UX testing & QA** loop |

---

## 3. Enhancements we have planned (overview)

A. **Deeper analytics** — many more KPIs per department, financial summaries, best/worst location analysis, period-over-period comparisons, and top-5 rankings.

B. **Universal filtering** — date presets + granularity, revenue/data-source filters, and rich fan/ticket/product filters everywhere.

C. **Adjustable interactive tables** — show/hide, reorder, resize columns; per-column search; multi-sort; pagination; saved views; clean export.

D. **Visual filter builder** — replaces the technical "Rules JSON" editor with a point-and-click builder (with an advanced JSON mode for power users).

E. **Retail & inventory** — two-store support, product add/edit, inventory and low-stock visibility, POS visibility, and per-store/product/category/size/time-of-day/day-of-week sales analytics.

F. **Unified granular RBAC** — five clear roles plus per-user unique permissions, enforced consistently in both admin apps and on the backend.

G. **Data quality** — CPF-or-foreigner validation on entry and import, with new base-completeness counters.

H. **Social media intelligence** — track all official Coritiba channels with followers, reach, engagement, and per-channel summaries.

I. **AI & automation** — a role-aware RAG assistant/guide, AI-generated KPI insight summaries, BrowserUse task automation, and Scribe-style guided onboarding.

J. **Per-industry configuration** — the KPI/filter/insight catalog is driven by an industry profile, extensible beyond football.

K. **Continuous UX testing & hardening** — recurring sessions with support, coordinators, and managers; automated tests; performance work.

---

## 4. Two admin surfaces — one experience

The platform has two admin surfaces and the request was to *"do the exact same things in these admin accounts."* We will keep both apps but bring them to **feature parity** by sharing the same components and APIs:

- **FanBox Admin** (`club.coxa.live`) — fan intelligence, analytics, campaigns, projects.
- **Club Operations Dashboard** — retail, F&B, ticketing, inventory, POS, membership.

Shared building blocks (KPI cards, charts, adjustable tables, filter builder, RBAC) guarantee both feel and behave identically.

---

## 5. Advanced filters catalog

Filters apply across dashboards, charts, and tables. Every analytics view supports the relevant subset below.

### 5.1 Time filters

- **Presets:** Today, Last 7 days, Last 30 days, Month-to-date, Quarter-to-date, Year-to-date, Custom range.
- **Granularity:** Daily, Weekly, Monthly, Quarterly, Annual.
- **Comparison:** Automatic period-over-period (vs previous period) on KPIs.

### 5.2 Revenue & source filters

- **Revenue source:** Retail (stores) · E-Commerce · Membership · Ticketing · F&B.
- **Ticketing kind:** Subscription (Sócio) vs Non-subscription.
- **Channel:** Box office · App · Web · Fan shop · POS.

### 5.3 Retail / product filters

- **Store / location:** Store 1, Store 2, Warehouse, Online, F&B stands.
- **Product category, product, size / variant.**
- **Time-of-day** and **day-of-week.**

### 5.4 Membership filters

- **Plan**, **status** (active / overdue / cancelled), **tenure band**, **sector**, **annual vs monthly.**

### 5.5 Fan / audience filters

- **CPF present**, **foreigner**, **city / state / country.**
- **Gender, age band, has children, household income band.**
- **Preferred channel**, **member vs non-member.**

### 5.6 Ticket / behavior filters (Single Fan View)

- **Ticket type**, **long-term ticket holder**, **subscription plan**, **category label.**
- **Spend-per-month band**, **visit-frequency-per-match band.**

### 5.7 Filter builder & saved filters

- Visual **point-and-click filter builder** (field → operator → value), with **AND/OR groups** and a **live audience preview count.**
- **Save, name, label, and categorize** filters; reuse them as insight cards or **promote to a marketing segment.**
- **Export** filtered audiences to CSV.
- **Table-level filters:** per-column search/filter and **saved table views** on every data table.

---

## 6. KPI catalog — the metrics we have identified

This is the core of the proposal: the most important KPIs per department, designed to be deeper than comparable platforms. KPIs are config-driven, each with a definition tooltip, formatting, period comparison, and drill-down. New KPIs are marked **(new)**; surfaced-but-existing are unmarked.

### 6.1 Fan base & data quality

| KPI | Definition |
|-----|------------|
| Total fans | All active fan profiles |
| With CPF | Profiles with a valid CPF |
| Foreigners **(new)** | Profiles flagged as foreign (no CPF required) |
| Without CPF & not foreigner **(new)** | Data-quality exception list |
| With email / phone / address | Contact completeness |
| New registrations (period) | New fans in the selected range |
| Cumulative fan base | Running total over time |
| Growth rate **(new)** | % change vs previous period |
| Active fans (30d) | Fans with recent activity |

### 6.2 Demographics

| KPI | Definition |
|-----|------------|
| By city / state / country | Geographic distribution |
| Gender distribution | Male / female / other / unknown |
| Age band distribution | Bucketed age ranges |
| Has children | Yes / no / unknown |
| Household income band | Bucketed income |
| Channel preference **(new)** | App / email / stadium / e-commerce |

### 6.3 Membership (Sócio Torcedor)

| KPI | Definition |
|-----|------------|
| Active memberships | Currently active members |
| New memberships (period) **(new)** | Joins in range |
| Churned / cancelled **(new)** | Cancellations in range |
| Reactivated **(new)** | Win-backs in range |
| Net member growth **(new)** | New − churned |
| Membership revenue | Revenue from plans in range |
| ARPU **(new)** | Avg revenue per member |
| Average tenure **(new)** | Avg months as member |
| Tenure bands **(new)** | <1y / 1–3y / 3y+ distribution |
| Adimplentes vs inadimplentes **(new)** | Paid vs overdue |
| Payment compliance rate **(new)** | % in good standing |
| Plan mix **(new)** | Distribution by plan |
| Sector mix **(new)** | Distribution by stadium sector |
| Renewal rate **(new)** | % renewed |
| Annual vs monthly mix **(new)** | Billing cadence split |
| Member lifetime value **(new)** | Projected LTV |

### 6.4 Ticketing (Ingressos)

| KPI | Definition |
|-----|------------|
| Tickets issued | Tickets sold in range |
| Ticket revenue | Total ticket revenue |
| Average ticket value per ticket **(new)** | Revenue ÷ tickets (explicitly requested) |
| Tickets per match **(new)** | Avg per fixture |
| Tickets per sector **(new)** | Distribution by sector |
| Sell-through % **(new)** | Sold ÷ capacity |
| Sold-but-not-checked-in **(new)** | Issued − used (count + value) (explicitly requested) |
| Channel mix **(new)** | Box office / app / web |
| Unique buyers | Distinct purchasers |
| Member vs non-member buyers **(new)** | Subscription split |
| Revenue per match **(new)** | Per-fixture revenue |

### 6.5 Access (Stadium entry)

| KPI | Definition |
|-----|------------|
| Total entries | Gate entries in range |
| Unique attendees | Distinct people |
| Member vs non-member entries **(new)** | Subscription split |
| Value of non-member visitors vs members **(new)** | Spend value by subscription status (explicitly requested) |
| Repeat-visit rate **(new)** | Returning attendees |
| Average attendance per match **(new)** | Mean per fixture |
| No-show rate **(new)** | Issued but not entered |
| First-time visitors **(new)** | New attendees |
| Attendance by sector **(new)** | Sector distribution |

### 6.6 Stores / Retail (two stores)

| KPI | Definition |
|-----|------------|
| Total sales revenue | Retail revenue in range |
| Orders / transactions | Count of sales |
| Units sold **(new)** | Total items |
| Average order value | Revenue ÷ orders |
| Average items per order **(new)** | Basket size |
| Sales by store **(new)** | Store 1 vs Store 2 |
| Best / worst selling location **(new)** | Ranking (explicitly requested) |
| Top-5 products **(new)** | Best sellers (explicitly requested) |
| Top-5 categories **(new)** | Best categories |
| Sales by category **(new)** | Category breakdown |
| Sales by size / variant **(new)** | Size breakdown (explicitly requested) |
| Sales by hour-of-day **(new)** | Peak hours (explicitly requested) |
| Sales by day-of-week **(new)** | Peak days (explicitly requested) |
| Spend per fan **(new)** | Avg fan spend |
| Member vs non-member spend **(new)** | Subscription split |
| Returns rate **(new)** | Returns ÷ sales |
| Gross margin **(new, if cost data)** | Profitability |

### 6.7 E-Commerce (Fan Shop)

| KPI | Definition |
|-----|------------|
| Online revenue | Fan shop revenue |
| Orders | Online order count |
| Average order value | Revenue ÷ orders |
| Top products **(new)** | Best online sellers |
| Buyers by membership plan **(new)** | Plan split |
| Repeat purchase rate **(new)** | Returning buyers |
| Pickup vs shipping mix **(new)** | Fulfilment split |

### 6.8 Coxa Foods (F&B)

| KPI | Definition |
|-----|------------|
| Items sold | F&B units |
| Revenue | F&B revenue |
| Revenue by match day **(new)** | Per-fixture F&B revenue |
| Top items **(new)** | Best-selling items |
| Sales by stand **(new)** | Per-location split |
| Average spend per attendee **(new)** | F&B per visitor |
| Wastage / expired (FEFO) **(new)** | Perishable loss |

### 6.9 Inventory & stock

| KPI | Definition |
|-----|------------|
| Stock-on-hand value **(new)** | Inventory valuation |
| Units on hand | Quantity in stock |
| Low-stock SKUs | Below reorder point |
| Out-of-stock SKUs **(new)** | Zero on hand |
| Stock turnover rate **(new)** | Sales ÷ avg inventory |
| Days of cover **(new)** | Runway at current sales |
| Shrinkage / adjustments **(new)** | Inventory loss |
| Expiring lots (F&B) | Near-expiry stock |
| Sell-through by SKU **(new)** | Velocity per SKU |

### 6.10 Loyalty

| KPI | Definition |
|-----|------------|
| Points issued | Points earned in range |
| Points redeemed | Points spent |
| Redemption rate **(new)** | Redeemed ÷ issued |
| Outstanding liability **(new)** | Unredeemed points value |
| Active loyalty members **(new)** | Engaged participants |
| Tier distribution | Bronze → Diamond split |

### 6.11 Fan Score & engagement

| KPI | Definition |
|-----|------------|
| Average fan score | Mean 0–100,000 score |
| Score distribution by tier | Tier breakdown |
| Attendance / tenure / spend / referral / engagement / donation factors | The six weighted score components |
| Campaign participation | Engagement events |

### 6.12 Campaigns

| KPI | Definition |
|-----|------------|
| Sent / delivered | Volume |
| Open rate / click rate **(new)** | Engagement |
| Bounce / unsubscribe **(new)** | Deliverability & opt-out |
| Conversions / attributed revenue **(new)** | Outcome |

### 6.13 Digital projects

| KPI | Definition |
|-----|------------|
| Survey responses & completion rate | Survey engagement |
| Vote participation | Votes cast |
| Raffle entries | Entrants |
| Contest submissions | Entries |
| NPS score & distribution **(new)** | Net Promoter Score |

### 6.14 Social media (per channel: Instagram, X, Facebook, YouTube, TikTok)

| KPI | Definition |
|-----|------------|
| Followers **(new)** | Current audience |
| Net follower growth **(new)** | Change in range |
| Reach / impressions **(new)** | Exposure |
| Engagement rate **(new)** | Interactions ÷ reach |
| Posts published **(new)** | Output volume |
| Top post **(new)** | Best performer |
| Video views / avg watch time **(new)** | Video performance |
| Mentions / hashtag volume **(new)** | Brand conversation |
| Per-channel summary **(new)** | AI-written key-point summary (explicitly requested) |

### 6.15 Financial roll-up (cross-cutting)

| KPI | Definition |
|-----|------------|
| Total revenue (all sources) **(new)** | Consolidated revenue |
| Revenue by source **(new)** | Retail / ticketing / membership / F&B / e-commerce |
| Subscription vs non-subscription revenue **(new)** | Recurring vs one-off |
| Revenue per fan **(new)** | Monetization |
| Best / worst performing department **(new)** | Ranking + AI analysis |
| Period-over-period delta **(new)** | Growth tracking |

---

## 7. AI, automation & onboarding

- **RAG assistant & operator guide** — a role-aware chatbot trained on platform docs and live data, so each operator gets contextual help and answers ("a guide and LLM RAG model trained per operator").
- **AI insight summaries** — every department report gets an automatically generated plain-language analysis ("add some analysis to this"), highlighting trends, best/worst performers, and anomalies.
- **BrowserUse automation** — agentic task automation for repetitive cross-system operator actions, executed under strict, audited permissions.
- **Guided onboarding (Scribe-style)** — in-app step-by-step walkthroughs/tours to flatten the learning curve for new staff.

---

## 8. Roles & permissions

Five clear roles, consistent in both admin apps, with the ability to grant **unique per-user permissions** on top of a role:

- **Administrator** — full access, manages staff and permissions.
- **Manager** — operational management across modules.
- **Analyst** — analytics and intelligence, read-focused.
- **Marketer** — campaigns, filters, projects, audiences.
- **Viewer** — read-only dashboards.

Permissions are enforced both in the UI (what you can see/do) and on the backend (API-level), with per-user overrides for exceptions.

---

## 9. Roadmap & phasing

- **Phase A — Foundations & quick wins:** shared component library, universal date/source filters, adjustable tables, CPF validation, first wave of expanded KPIs.
- **Phase B — Retail depth & RBAC:** two-store analytics, inventory/POS/product parity, granular roles & permissions.
- **Phase C — Intelligence & AI:** AI insight summaries, RAG assistant, guided onboarding, social media tracking.
- **Phase D — Automation, per-industry & hardening:** BrowserUse automation, per-industry configuration, continuous UX testing, performance and test coverage.

---

## 10. How this exceeds comparable platforms

- **Filters everywhere**, not just on a few screens — including time, revenue source, store, category, size, and behavior.
- **Deeper financial and operational KPIs** per department, with best/worst analysis and period comparison.
- **Adjustable, savable tables** instead of fixed minimal ones.
- **AI on top** — automatic insight summaries and an operator assistant, not just raw numbers.
- **Per-industry configurable**, so the same engine serves multiple verticals.

---

*This document is the single source of truth for the enhancement vision. A formatted DOCX version can be generated for distribution (see `scripts/` doc-generation pattern). Detailed engineering tasks are tracked separately in the internal delivery plan.*
