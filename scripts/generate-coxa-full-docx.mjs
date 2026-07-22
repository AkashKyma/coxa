import { createWriteStream } from 'fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, PageBreak, ShadingType } from 'docx';

const TEAL = '006B6B';
const DARK = '1A1A2E';
const GRAY = 'F0F4F8';

function h(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 100 } });
}
function h2(text) { return h(text, HeadingLevel.HEADING_2); }
function h3(text) { return h(text, HeadingLevel.HEADING_3); }

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: DARK, ...opts })],
    spacing: { before: 80, after: 80 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, color: DARK })],
    bullet: { level },
    spacing: { before: 40, after: 40 },
  });
}

function label(text) {
  return new TextRun({ text, bold: true, color: TEAL, size: 21 });
}

function statusBadge(status) {
  const colors = { 'Done': '1A7F37', 'Partial': 'B45309', 'Stub': 'DC2626', 'Planned': '6366F1' };
  return new TextRun({ text:  [] , bold: true, color: colors[status] || DARK, size: 20 });
}

function tbl(headers, rows, colWidths) {
  // Total usable page width in DXA (A4 with ~1.25cm margins each side)
  const PAGE_DXA = 9360;
  const n = headers.length;
  // colWidths is an optional array of relative weights, e.g. [1,2,3]
  const weights = colWidths || Array(n).fill(1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const dxaWidths = weights.map(w => Math.floor((w / totalWeight) * PAGE_DXA));

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 19 })] })],
      shading: { type: ShadingType.SOLID, color: TEAL },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: dxaWidths[i], type: WidthType.DXA },
    })),
  });
  const bodyRows = rows.map(row => new TableRow({
    children: row.map((cell, i) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 19, color: DARK })] })],
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: dxaWidths[i], type: WidthType.DXA },
    })),
  }));
  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: PAGE_DXA, type: WidthType.DXA },
    layout: 'fixed',
  });
}

function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

const doc = new Document({
  styles: {
    default: {
      heading1: { run: { bold: true, size: 36, color: TEAL }, paragraph: { spacing: { before: 360, after: 160 } } },
      heading2: { run: { bold: true, size: 28, color: DARK }, paragraph: { spacing: { before: 280, after: 120 } } },
      heading3: { run: { bold: true, size: 24, color: TEAL }, paragraph: { spacing: { before: 200, after: 80 } } },
    },
  },
  sections: [{
    children: [
      // ── COVER PAGE ──────────────────────────────────────────────────────
      new Paragraph({ children: [new TextRun({ text: 'COXA', bold: true, size: 96, color: TEAL })], alignment: AlignmentType.CENTER, spacing: { before: 1200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Platform — Full Technical Reference', size: 40, color: DARK })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'All Applications · Features · Infrastructure', size: 28, color: '555555' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: 'Prepared for: James  |  Date: July 2026', size: 24, color: '888888' })], alignment: AlignmentType.CENTER, spacing: { after: 1600 } }),

      pb(),

      // ── SECTION 1: PLATFORM OVERVIEW ─────────────────────────────────────
      h('1. Platform Overview'),
      p('Coxa is a full-stack fan relationship and club operations platform for Coritiba Foot Ball Club. It consists of 7 production-ready applications, 6 planned applications (scaffold only), a shared backend API, 5 shared packages, and a self-hosted data infrastructure stack running on AWS EC2.'),
      p(''),
      tbl(
        ['Component', 'Type', 'Status', 'Deployment'],
        [
          ['fan-landing', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['fan-auth', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['fan-dashboard', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['club-auth', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['club-dashboard', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['fanbox-dashboard', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['pos-app', 'Web App (Vite/React)', 'Production-ready', 'ELB'],
          ['admin-console', 'Web App (Vite/React)', 'Scaffold only', 'Not deployed'],
          ['fan-app', 'Mobile App (React Native)', 'Scaffold only', 'Not deployed'],
          ['gate-app', 'Web App', 'Scaffold only', 'Not deployed'],
          ['kiosk-app', 'Web App', 'Scaffold only', 'Not deployed'],
          ['support-console', 'Web App', 'Scaffold only', 'Not deployed'],
          ['vendor-portal', 'Web App', 'Scaffold only', 'Not deployed'],
          ['backend API', 'Node.js / Express', 'Production-ready', 'ELB (AWS ELB)'],
          ['CDP + Analytics Stack', 'Docker Compose', 'Running on EC2', 'EC2 (t3.large)'],
        ]
      ),

      pb(),

      // ── SECTION 2: EC2 vs ELB ────────────────────────────────────────────
      h('2. Infrastructure: EC2 vs ELB'),
      h2('2.1 AWS ELB (Elastic Load Balancer) — Backend + Frontends'),
      p('The Node.js backend API runs behind an AWS Application Load Balancer. All React frontend apps are served as static builds (typically via S3/CDN or directly from Node). The ELB handles HTTPS termination, auto-scaling, and routing.'),
      p(''),
      tbl(
        ['Service', 'URL / Domain', 'Notes'],
        [
          ['Backend API', 'https://api.coxa.live', 'All /api/* routes, JWT auth, MongoDB'],
          ['fan-landing', 'https://coxa.live or fan.coxa.live', 'Public entry page'],
          ['fan-auth', 'https://auth.coxa.live', 'Fan login + signup'],
          ['fan-dashboard', 'https://fan.coxa.live/dashboard', 'Fan self-service portal'],
          ['club-auth', 'https://club.coxa.live/auth', 'Staff login'],
          ['club-dashboard', 'https://club.coxa.live', 'Club operations + CDP'],
          ['fanbox-dashboard', 'https://fanbox.coxa.live', 'Fan intelligence + marketing analytics'],
          ['pos-app', 'https://pos.coxa.live', 'Point-of-sale terminal'],
        ]
      ),
      p(''),
      h2('2.2 AWS EC2 (t3.large, 96GB EBS, Elastic IP) — CDP & Data Stack'),
      p('All open-source data infrastructure services run in Docker Compose on a dedicated EC2 instance (Ubuntu 22.04, t3.large). The instance has an Elastic IP attached and a systemd startup service to auto-restart all containers on reboot.'),
      p(''),
      tbl(
        ['Service', 'Port / Domain', 'Purpose', 'Phase'],
        [
          ['RudderStack Server', ':8080 / internal', 'Event streaming + SDK gateway', 'Phase 1'],
          ['RudderStack Control Plane', ':3000', 'Source/destination configuration UI', 'Phase 1'],
          ['PostHog', 'https://posthog.service.coxa.live', 'Product analytics, session replay, feature flags, A/B testing', 'Phase 1'],
          ['ClickHouse', ':8123 (HTTP) / :9000 (TCP)', 'Columnar OLAP database for analytics queries', 'Phase 2'],
          ['Cube', ':4000', 'Semantic layer / KPI governance API', 'Phase 2'],
          ['Dagster', ':3001', 'Data pipeline orchestration (ETL/ELT)', 'Phase 2'],
          ['Tracardi', ':8686', 'Open-source CDP: profiles, real-time segmentation, visual workflows', 'Phase 3'],
          ['Multiwoven', ':3002', 'Reverse ETL: syncing data back to business tools', 'Phase 4'],
          ['PostgreSQL (shared)', ':5432 internal', 'Backing store for RudderStack, PostHog, Dagster, Multiwoven', 'All'],
          ['Redis (shared)', ':6379 internal', 'Caching for RudderStack, PostHog, Cube', 'All'],
          ['Caddy', ':80 / :443', 'Reverse proxy + auto HTTPS (Lets Encrypt) for posthog.service.coxa.live', 'Phase 1'],
        ]
      ),
      p(''),
      p('EC2 Static IP: 3.217.225.85 | Domain managed via AWS Route 53'),

      pb(),
      // ── SECTION 3: FAN-LANDING ────────────────────────────────────────────
      h('3. Application: fan-landing'),
      p('Purpose: Public-facing marketing landing page. The entry point for new fans to discover the Coxa iD platform, create an account, or sign in. Built in Portuguese (pt-BR) for the Brazilian fan base.'),
      p('Tech Stack: Vite + React 18, @coxa/analytics (RudderStack + PostHog dual-tracking)'),
      p('Deployment: ELB | URL: https://coxa.live'),
      p(''),
      h3('Built Features'),
      tbl(
        ['Feature', 'Status', 'Details'],
        [
          ['Hero Landing Page', 'Done', 'Rotating stadium background images (Unsplash, with fallback)'],
          ['Brand Identity', 'Done', 'Coxa iD branding, club crest, "Coritiba Foot Ball Club" footer'],
          ['CTA Buttons', 'Done', '"Criar meu Coxa iD" (→ signup) + "Já tenho conta — entrar" (→ login)'],
          ['Analytics Tracking', 'Done', 'page() view on load + track("landing_cta_clicked") on each button'],
          ['Responsive Layout', 'Done', 'Full-screen hero, overlay, centered content'],
        ]
      ),
      p(''),
      h3('Remaining / Missing'),
      bullet('Multi-club support (currently hard-coded to Coritiba)'),
      bullet('Club-branded themes (dynamic logo, colors per club)'),
      bullet('SEO metadata + Open Graph tags'),
      bullet('Footer with legal/privacy links'),

      pb(),

      // ── SECTION 4: FAN-AUTH ───────────────────────────────────────────────
      h('4. Application: fan-auth'),
      p('Purpose: Fan authentication portal. Handles new fan registration (3-step wizard) and sign-in. Issues JWT tokens stored in localStorage for use by fan-dashboard.'),
      p('Tech Stack: Vite + React 18, React Router v6, @coxa/analytics'),
      p('Deployment: ELB | URL: https://auth.coxa.live'),
      p(''),
      h3('Built Features (LoginPage)'),
      tbl(
        ['Feature', 'Status', 'Details'],
        [
          ['Email + Password Login', 'Done', 'POST /api/auth/login, stores token in localStorage'],
          ['Error Handling', 'Done', 'Invalid credentials message'],
          ['Link to Signup', 'Done', 'Navigate to /signup'],
          ['Analytics', 'Done', 'page view tracked on load'],
        ]
      ),
      p(''),
      h3('Built Features (SignupPage — 3-step wizard)'),
      tbl(
        ['Step', 'Status', 'Details'],
        [
          ['Step 1: Account Details', 'Done', 'Full name, email, password, CPF (Brazilian tax ID)'],
          ['Step 2: Membership Plan', 'Done', 'Displays available plans from /api/memberships/plans, fan selects one'],
          ['Step 3: Referral Code', 'Done', 'Optional referral code entry, fan completes registration'],
          ['POST /api/auth/register', 'Done', 'Creates user + fan profile + assigns plan, returns JWT'],
        ]
      ),
      p(''),
      h3('Remaining / Missing'),
      bullet('Forgot Password / Reset Password flow'),
      bullet('Email verification on signup'),
      bullet('Social login (Google, Apple)'),
      bullet('Signup disabled — club-auth /signup redirects to login (club staff added manually)'),

      pb(),

      // ── SECTION 5: FAN-DASHBOARD ───────────────────────────────────────────
      h('5. Application: fan-dashboard'),
      p('Purpose: Fan self-service portal. Authenticated fans view their tickets, shop for merchandise, track loyalty points and rewards, manage memberships, and refer friends. All content is in pt-BR.'),
      p('Tech Stack: Vite + React 18, React Router v6, @coxa/ui, @coxa/analytics, qrcode.react'),
      p('Deployment: ELB | URL: https://fan.coxa.live'),
      p(''),
      h3('Page-by-Page Feature Breakdown'),
      tbl(
        ['Page', 'Route', 'Status', 'Key Features'],
        [
          ['Home', '/', 'Done', 'Welcome banner, fan score, loyalty tier badge, quick links to all sections'],
          ['My Tickets', '/tickets', 'Done', 'List of owned tickets + QR code display, browse upcoming events, buy ticket flow'],
          ['Shop', '/shop', 'Done', 'Product catalog, add-to-cart, BRL pricing, checkout (stub payment)'],
          ['My Orders', '/shop/orders', 'Done', 'Order history list from /api/retail/my-orders'],
          ['Wallet', '/wallet', 'Partial', 'Shows loyalty points balance; cash wallet placeholder ("launches in Phase 2")'],
          ['Rewards', '/rewards', 'Done', 'Loyalty points balance, ledger history (earn/redeem/adjust), redeem rewards'],
          ['Profile', '/profile', 'Stub', 'Static UI only — no edit form wired to backend'],
          ['Membership', '/membership', 'Done', 'Current plan details, upgrade/change options, billing info display'],
          ['Referrals', '/membership/referrals', 'Done', 'Referral link generator, referral tracking, commission/bonus display'],
        ]
      ),
      p(''),
      h3('Analytics Integration'),
      bullet('Fan identified (analytics.identify) on login with fanId, email, fanScore, loyaltyTier'),
      bullet('Every page navigation fires analytics.page() automatically'),
      bullet('CTA clicks tracked throughout'),
      p(''),
      h3('Remaining / Missing'),
      bullet('Profile edit (name, avatar, phone, address)'),
      bullet('Real payment gateway (PIX, credit card — currently stub)'),
      bullet('Cash wallet top-up and cashback redemption'),
      bullet('Push notifications for event reminders and rewards'),
      bullet('Fan community / social features'),
      bullet('Club news / content feed'),

      pb(),
      // ── SECTION 6: CLUB-AUTH ──────────────────────────────────────────────
      h('6. Application: club-auth'),
      p('Purpose: Login portal for club staff and administrators. Provides JWT authentication for access to club-dashboard and fanbox-dashboard. New club registrations are handled via the login page (signup route is disabled).'),
      p('Tech Stack: Vite + React 18, React Router v6'),
      p('Deployment: ELB | URL: https://club.coxa.live/auth'),
      p(''),
      h3('Built Features'),
      tbl(
        ['Feature', 'Status', 'Details'],
        [
          ['Staff Login', 'Done', 'Email + password, POST /api/auth/club-login, stores token in localStorage'],
          ['Error Handling', 'Done', 'Invalid credentials feedback'],
          ['Redirect Logic', 'Done', '/signup and /* redirect to login'],
        ]
      ),
      p(''),
      h3('Remaining / Missing'),
      bullet('Forgot Password / Reset Password'),
      bullet('SSO / SAML for club corporate accounts'),
      bullet('Two-factor authentication (2FA)'),
      bullet('Club registration self-service (currently admin must create clubs manually)'),

      pb(),

      // ── SECTION 7: CLUB-DASHBOARD ─────────────────────────────────────────
      h('7. Application: club-dashboard'),
      p('Purpose: Comprehensive club operations dashboard for staff and administrators. Covers retail management, ticketing, membership, loyalty program, fan personalization, CDP (Customer Data Platform) integration, analytics, and team/role management.'),
      p('Tech Stack: Vite + React 18, React Router v6, @coxa/ui, @coxa/analytics, Recharts'),
      p('Deployment: ELB | URL: https://club.coxa.live'),
      p(''),
      h3('Page-by-Page Feature Breakdown'),
      tbl(
        ['Page / Section', 'Status', 'Key Features'],
        [
          ['Dashboard Home', 'Done', 'KPI summary cards, revenue, attendance, loyalty stats; quick nav'],
          ['Analytics Overview', 'Done', 'Revenue charts (Recharts), event attendance, product sales breakdowns'],
          ['Fan Management', 'Done', 'Fan directory with search/filter, fan detail view, notes, labels'],
          ['Member Detail', 'Done', 'Full 360° fan profile: personal info, loyalty tier, ML scores, purchase history'],
          ['Personalization Dashboard', 'Done', 'AI-driven fan segment scores (churn risk, purchase propensity, NPS), list view + detail'],
          ['Retail — Products', 'Done', 'Product catalog CRUD, SKU management, category management'],
          ['Retail — Orders', 'Done', 'Order list, status management, refunds'],
          ['Retail — Locations', 'Done', 'Physical store/location management, POS register setup'],
          ['Retail — Inventory', 'Done', 'Stock levels per location, adjustments, low-stock alerts'],
          ['Ticketing — Events', 'Done', 'Event creation, date/venue/capacity settings'],
          ['Ticketing — Tickets', 'Done', 'Ticket product setup, pricing tiers, bulk management'],
          ['Ticketing — Validate', 'Done', 'QR code ticket validation interface for gate staff'],
          ['Membership — Plans', 'Done', 'Plan CRUD: name, price, benefits, tier configuration'],
          ['Membership — Members', 'Done', 'Active member list, status, plan assignment, history'],
          ['Loyalty — Programs', 'Done', 'Points program configuration: earn rules, multipliers'],
          ['Loyalty — Rewards', 'Done', 'Reward catalogue management, point cost, availability'],
          ['Loyalty — Ledger', 'Done', 'Full audit trail of all point transactions across all fans'],
          ['Segments', 'Done', 'Fan segment list + detail. Segments are pre-calculated by backend CDP engine'],
          ['Campaigns (basic)', 'Done', 'Campaign list, status management, assignment to segments'],
          ['Social', 'Done', 'Social engagement tracking: follows, likes, check-ins'],
          ['Labels', 'Done', 'Custom fan label/tag management for manual segmentation'],
          ['Roles & Permissions', 'Done', 'RBAC: role list, permission matrix, assign roles to staff members'],
          ['Users (Staff)', 'Done', 'Staff user management: invite, deactivate, role assignment'],
          ['CDP Live Feed', 'Done', 'Real-time event stream viewer showing fan activity events'],
          ['CDP Fan Profiles', 'Done', 'CDP-enriched fan profiles: traits, events, segments from RudderStack/PostHog'],
          ['ML Insights', 'Done', 'ML model summaries: churn prediction, purchase propensity, NPS scores'],
          ['Club Analytics', 'Done', 'Revenue breakdown, attendance, product performance, retention charts'],
          ['Settings', 'Stub', 'Settings page exists but content is empty'],
          ['Notifications', 'Missing', 'No notification centre or alert management built'],
          ['Report Builder', 'Missing', 'No ad-hoc report generation tool'],
        ]
      ),
      p(''),
      h3('CDP & Personalization Features'),
      bullet('RudderStack integration: all staff actions tracked as events'),
      bullet('PostHog integration: session replay, feature flags, page analytics for staff UI'),
      bullet('Segment engine: backend calculates fan segments from traits + events stored in ClickHouse'),
      bullet('ML scores surfaced: churnRisk, purchasePropensity, npsScore per fan'),
      bullet('Customer 360 view available on Member Detail page'),
      p(''),
      h3('Remaining / Missing'),
      bullet('Settings page — needs actual content (club profile, billing, integrations)'),
      bullet('Notification system (in-app alerts for low stock, high churn risk fans, etc.)'),
      bullet('Export/reporting tool (CSV/PDF exports of any data table)'),
      bullet('Campaign scheduler + send (campaigns exist but no delivery mechanism built)'),
      bullet('Visual flow builder for automated fan journeys'),
      bullet('Real-time dashboard auto-refresh (currently manual reload)'),

      pb(),
      // ── SECTION 8: FANBOX-DASHBOARD ───────────────────────────────────────
      h('8. Application: fanbox-dashboard'),
      p('Purpose: Fan Intelligence and Marketing Analytics platform for marketing teams and data analysts. Provides advanced fan analytics, AI-powered campaign management, Customer 360 profiles, ML-driven scoring, and reverse ETL insights. Powered by RudderStack, PostHog, ClickHouse, and OpenAI.'),
      p('Tech Stack: Vite + React 18, React Router v6, @coxa/ui, @coxa/analytics, Recharts'),
      p('Deployment: ELB | URL: https://fanbox.coxa.live'),
      p(''),
      h3('Page-by-Page Feature Breakdown'),
      tbl(
        ['Page / Section', 'Status', 'Key Features'],
        [
          ['Overview / Home', 'Done', 'KPI cards: total fans, active fans, avg fan score; trend sparklines'],
          ['Fan Intelligence — Overview', 'Done', 'Aggregate fan health metrics, cohort summaries, engagement breakdown'],
          ['Fan Intelligence — Segments', 'Done', 'Segment list with size, filter criteria, engagement rates'],
          ['Fan Intelligence — Profiles', 'Done', 'Individual fan cards with traits, events, segment membership'],
          ['Customer 360', 'Done', 'Deep fan profile: all events, traits, loyalty data, ML scores, journey timeline'],
          ['Campaigns — List', 'Done', 'Campaign list with status (Draft, Pending Approval, Active, Completed)'],
          ['Campaigns — Create / Edit', 'Done', 'Campaign builder: name, objective, target segment, channel, date range'],
          ['Campaigns — AI Brief', 'Done', 'AI-generated campaign brief via OpenAI RAG; fallback UI if API key missing'],
          ['Campaigns — Approval Queue', 'Done', 'Pending approval view for reviewing AI-generated campaign briefs'],
          ['ML Insights — Summary', 'Done', 'Overall ML model performance: churn rate, propensity distributions'],
          ['ML Insights — Fan Scores', 'Done', 'Per-fan ML scores table: churnRisk, purchasePropensity, npsScore'],
          ['Analytics — Events', 'Done', 'Event stream analytics from RudderStack: event counts, types, sources'],
          ['Analytics — Funnels', 'Partial', 'Funnel UI exists; data partially wired to PostHog funnel API'],
          ['Analytics — Retention', 'Partial', 'Retention cohort chart exists; backend data endpoint needs completion'],
          ['Intelligence (RAG)', 'Done', 'Ask-anything natural language query interface powered by OpenAI + RAG pipeline'],
          ['Settings', 'Stub', 'Page exists but content is empty'],
        ]
      ),
      p(''),
      h3('CDP & AI Integration'),
      bullet('RudderStack: all marketing actions tracked; event data flows to ClickHouse via warehouse destination'),
      bullet('PostHog: session replay of fan journeys, feature flag management for A/B tests'),
      bullet('ClickHouse: powers all aggregate analytics queries (fast columnar reads)'),
      bullet('Cube semantic layer: KPI definitions (fanScore, churnRate, revenue) served to all dashboards'),
      bullet('OpenAI GPT-4 RAG: campaign brief generation + free-text intelligence queries'),
      bullet('ML models: XGBoost churn predictor, purchase propensity model, NPS scorer'),
      p(''),
      h3('Remaining / Missing'),
      bullet('Campaign send/schedule (email, SMS, push) — delivery infrastructure not yet built'),
      bullet('Visual flow builder / journey builder — planned (Tracardi has this UI, needs integration)'),
      bullet('Full funnel and retention data wiring to PostHog/ClickHouse'),
      bullet('A/B test results view'),
      bullet('Settings page — integrations panel, API key management'),
      bullet('Export: campaign reports, fan lists to CSV'),

      pb(),

      // ── SECTION 9: POS-APP ────────────────────────────────────────────────
      h('9. Application: pos-app'),
      p('Purpose: Point-of-Sale terminal application for club staff at physical locations (stadium store, F&B stands, box office). Runs in a browser on any device. Supports retail sales, food & beverage orders, and ticket sales with QR receipt generation.'),
      p('Tech Stack: Vite + React 18, @coxa/ui, qrcode.react'),
      p('Deployment: ELB | URL: https://pos.coxa.live'),
      p(''),
      h3('POS Modes'),
      tbl(
        ['Mode', 'Status', 'Key Features'],
        [
          ['Retail POS', 'Done', 'Multi-location selector, catalog browse, product search by name/SKU, add to cart, fan email field, payment method (cash/card stub), sale completion, QR receipt per line item'],
          ['F&B POS (FnbPos)', 'Done', 'Menu catalog, add items to order, table/seat assignment, order submit, receipt generation'],
          ['Box Office', 'Done', 'Event selector, ticket product selection, fan email for association, QR ticket generation on purchase'],
          ['Staff Login', 'Done', 'Email/password login, club branding display'],
          ['QR Code Grid', 'Done', 'Receipt QR codes displayed in a grid for fan to scan, one per line item'],
        ]
      ),
      p(''),
      h3('Remaining / Missing'),
      bullet('Real payment terminal integration (PIX, card machine, Stripe Terminal)'),
      bullet('Barcode scanner integration for product lookup'),
      bullet('Offline mode with local queue and sync-on-reconnect'),
      bullet('Cash drawer open command'),
      bullet('Receipt printing (thermal printer integration)'),
      bullet('End-of-day shift summary / cash reconciliation'),
      bullet('Inventory deduction confirmation on sale'),

      pb(),
      // ── SECTION 10: BACKEND API ────────────────────────────────────────────
      h('10. Backend API'),
      p('Purpose: Single Node.js/Express REST API serving all frontend applications. Uses MongoDB (Atlas) as the primary operational database, ClickHouse for analytical queries, and integrates with RudderStack, PostHog, and OpenAI.'),
      p('Tech Stack: Node.js 20, Express 4, MongoDB/Mongoose, @clickhouse/client, jsonwebtoken, bcryptjs'),
      p('Deployment: AWS ELB | URL: https://api.coxa.live | Port: 3000'),
      p(''),
      h3('API Route Modules'),
      tbl(
        ['Module', 'Base Route', 'Status', 'Key Endpoints'],
        [
          ['Auth', '/api/auth', 'Done', 'POST /login, /register, /club-login, /refresh-token'],
          ['Users', '/api/users', 'Done', 'GET/PATCH /me, user profile management'],
          ['Clubs', '/api/clubs', 'Done', 'Club CRUD, settings, staff management'],
          ['Roles & RBAC', '/api/roles', 'Done', 'Role CRUD, permission matrix, /api/assignments for user-role mapping'],
          ['Fan Profiles', '/api/fans', 'Done', 'Fan directory, search, detail, labels, notes'],
          ['Retail', '/api/retail', 'Done', 'Products, SKUs, locations, orders, inventory, sales, POS endpoints'],
          ['Ticketing', '/api/ticketing', 'Done', 'Events, ticket products, purchase, validate QR, my-tickets'],
          ['Membership', '/api/memberships', 'Done', 'Plans, member enrolment, status, upgrades'],
          ['Loyalty', '/api/loyalty', 'Done', 'Programs, rewards, earn/redeem points, ledger, my balance'],
          ['Social', '/api/social', 'Done', 'Social engagement tracking (follows, likes, check-ins)'],
          ['Labels', '/api/labels', 'Done', 'Custom fan label/tag management'],
          ['Exports', '/api/exports', 'Done', 'CSV export of fans, orders, events'],
          ['CDP', '/api/cdp', 'Done', 'Fan traits, event stream, segments, personalization scores'],
          ['CDP — ML', '/api/cdp/ml', 'Done', 'GET /scores (fan ML scores), GET /summary (model performance)'],
          ['Personalization', '/api/personalization', 'Done', 'Segment definitions, fan recommendations'],
          ['AI / RAG', '/api/ai', 'Done', 'POST /chat (RAG query), POST /campaigns/ai/generate (AI brief)'],
          ['Club Analytics', '/api/club/analytics', 'Done', 'Revenue, attendance, retention, product performance aggregates'],
          ['Fanbox Campaigns', '/api/fanbox/campaigns', 'Done', 'Campaign CRUD, approval workflow, AI brief generation'],
          ['Fanbox Intelligence', '/api/fanbox/intelligence', 'Done', 'Fan intelligence aggregates, segment analytics'],
          ['Meta', '/api/meta', 'Done', 'Health check, platform metadata, version info'],
        ]
      ),
      p(''),
      h3('Database Architecture'),
      tbl(
        ['Database', 'Engine', 'Purpose'],
        [
          ['coxa-production (MongoDB Atlas)', 'MongoDB', 'Operational data: users, fans, orders, tickets, loyalty, memberships'],
          ['ClickHouse (EC2)', 'ClickHouse', 'Analytical data: event streams, fan traits, ML model outputs, aggregates'],
          ['PostgreSQL (EC2)', 'PostgreSQL 14', 'RudderStack state, PostHog data, Dagster run history, Multiwoven config'],
        ]
      ),
      p(''),
      h3('Key Integrations'),
      bullet('RudderStack: server-side event tracking via rudderClient.js (track, identify, page calls)'),
      bullet('PostHog: backend event capture for server-side analytics'),
      bullet('ClickHouse: analytics queries via @clickhouse/client (shared clickhouseClient.js)'),
      bullet('OpenAI GPT-4: RAG-based campaign brief generation and natural language query answering'),
      bullet('Cube: backend reads KPI metrics from Cube semantic layer API'),

      pb(),

      // ── SECTION 11: SHARED PACKAGES ───────────────────────────────────────
      h('11. Shared Packages'),
      p('Five shared packages in the packages/ directory are used across all frontend apps and the backend.'),
      tbl(
        ['Package', 'Used By', 'Status', 'What It Provides'],
        [
          ['@coxa/analytics', 'fan-landing, fan-auth, fan-dashboard, club-dashboard, fanbox-dashboard', 'Done', 'Unified analytics wrapper: RudderStack + PostHog dual-tracking. Exports analytics.identify(), .track(), .page()'],
          ['@coxa/ui', 'fan-dashboard, club-dashboard, fanbox-dashboard, pos-app', 'Done', 'Shared UI component library: DataTable, Modal, Badge, Card, etc.'],
          ['@coxa/ui-analytics', 'fanbox-dashboard, club-dashboard', 'Done', 'Pre-built analytics chart components (Recharts wrappers for common dashboard charts)'],
          ['@coxa/rbac', 'backend, club-dashboard', 'Done', 'Role-based access control constants and permission check utilities'],
          ['@coxa/shared-types', 'backend, all frontends', 'Done', 'TypeScript/JSDoc type definitions shared across the monorepo'],
        ]
      ),

      pb(),
      // ── SECTION 12: SCAFFOLD-ONLY APPS ────────────────────────────────────
      h('12. Planned Applications (Scaffold Only — Not Yet Built)'),
      p('These 6 applications exist as project scaffolds (package.json + README) but contain no implemented code. They are planned for future development phases.'),
      tbl(
        ['App', 'Intended Purpose', 'Priority'],
        [
          ['admin-console', 'Super-admin platform management: manage clubs, billing, platform config, system health', 'High'],
          ['fan-app', 'Native mobile app (React Native) for fans: tickets, shop, rewards, push notifications', 'High'],
          ['gate-app', 'Gate/turnstile check-in scanner app for stadium entry staff', 'Medium'],
          ['kiosk-app', 'Self-service kiosk for fans at stadium: buy tickets, check loyalty, browse shop', 'Medium'],
          ['support-console', 'Fan support / helpdesk console for customer service staff', 'Low'],
          ['vendor-portal', 'Concession vendor and partner portal for stadium F&B and retail partners', 'Low'],
        ]
      ),

      pb(),

      // ── SECTION 13: CDP DATA FLOW ──────────────────────────────────────────
      h('13. CDP & Data Intelligence Architecture'),
      p('The Coxa CDP is a self-hosted, privacy-first customer data platform. It captures, processes, and activates fan data without relying on third-party data brokers. All data remains within Coxa-controlled AWS infrastructure.'),
      p(''),
      h2('13.1 Data Capture (Phase 1)'),
      tbl(
        ['Source', 'Method', 'Tool', 'Data Captured'],
        [
          ['Web apps (fan-landing, fan-auth, fan-dashboard)', 'Browser SDK', 'RudderStack JS SDK + @coxa/analytics', 'Page views, clicks, signups, logins, purchases'],
          ['Club staff apps (club-dashboard, fanbox-dashboard)', 'Browser SDK', 'RudderStack JS SDK + PostHog', 'Staff actions, feature usage, session replays'],
          ['POS app', 'Browser SDK', 'RudderStack JS SDK', 'Sales transactions, product scans, staff events'],
          ['Backend API', 'Server-side SDK', 'rudderClient.js (RudderStack Node SDK)', 'Purchase completions, loyalty earn/redeem, ticket validations'],
          ['External sources', 'Webhook', 'RudderStack webhook source', 'Third-party events (future)'],
        ]
      ),
      p(''),
      h2('13.2 Data Processing Pipeline'),
      bullet('RudderStack receives all raw events and fans to configured destinations'),
      bullet('ClickHouse warehouse destination: all events stored in columnar tables for analytics'),
      bullet('PostHog destination: product analytics, session replay, funnel analysis'),
      bullet('Dagster orchestrates nightly ML model runs and fan trait recalculation'),
      bullet('XGBoost models compute: churnRisk score, purchasePropensity score, NPS prediction'),
      bullet('Computed ML scores written back to MongoDB fan profiles for API access'),
      p(''),
      h2('13.3 Data Activation (Phase 4)'),
      bullet('Cube semantic layer: defines KPIs (fanScore, churnRate, revenue) as single source of truth'),
      bullet('Multiwoven Reverse ETL: syncs fan segments and scores back to email tools, CRM, ad platforms'),
      bullet('Tracardi CDP: visual workflow builder for real-time event-driven fan journeys'),

      pb(),

      // ── SECTION 14: ENVIRONMENT VARIABLES ─────────────────────────────────
      h('14. Environment Variables Reference'),
      h2('14.1 Backend (ELB) — .env.elb'),
      tbl(
        ['Variable', 'Required', 'Description'],
        [
          ['NODE_ENV', 'Yes', '"production"'],
          ['PORT', 'Yes', 'Server port (default 3000)'],
          ['MONGODB_URI', 'Yes', 'MongoDB Atlas connection string (coxa-production)'],
          ['JWT_SECRET', 'Yes', 'Secret for signing JWTs — use strong random value'],
          ['CORS_ORIGINS', 'Yes', 'Comma-separated allowed origins (all frontend domains)'],
          ['RUDDERSTACK_WRITE_KEY', 'Yes', 'Server-side RudderStack write key'],
          ['RUDDERSTACK_DATA_PLANE_URL', 'Yes', 'http://3.217.225.85:8080'],
          ['RUDDERSTACK_WEBHOOK_SECRET', 'Yes', 'Webhook verification secret'],
          ['POSTHOG_API_KEY', 'Yes', 'PostHog personal API key for backend calls'],
          ['POSTHOG_HOST', 'Yes', 'https://posthog.service.coxa.live'],
          ['CLICKHOUSE_HOST', 'Yes', 'http://3.217.225.85:8123'],
          ['CLICKHOUSE_DB', 'Yes', 'coxa_analytics'],
          ['CLICKHOUSE_USER', 'Yes', 'coxa_app'],
          ['CLICKHOUSE_PASSWORD', 'Yes', 'ClickHouse password'],
          ['CUBE_API_URL', 'Yes', 'http://3.217.225.85:4000/cubejs-api/v1'],
          ['CUBE_API_SECRET', 'Yes', 'Cube API secret'],
          ['OPENAI_API_KEY', 'Optional', 'Required for AI brief generation and RAG queries'],
        ]
      ),
      p(''),
      h2('14.2 EC2 CDP Stack — infrastructure/.env.cdp'),
      tbl(
        ['Variable', 'Description'],
        [
          ['RUDDERSTACK_DB_PASSWORD', 'PostgreSQL password for RudderStack DB'],
          ['POSTHOG_SECRET_KEY', 'PostHog Django secret key'],
          ['POSTHOG_DB_PASSWORD', 'PostgreSQL password for PostHog DB'],
          ['CLICKHOUSE_PASSWORD', 'ClickHouse admin password'],
          ['CUBE_API_SECRET', 'Cube API JWT secret'],
          ['DAGSTER_DB_PASSWORD', 'PostgreSQL password for Dagster DB'],
          ['MULTIWOVEN_DB_PASSWORD', 'PostgreSQL password for Multiwoven DB'],
          ['MULTIWOVEN_SECRET_KEY_BASE', 'Rails secret key base for Multiwoven'],
          ['POSTHOG_ALLOWED_HOSTS', 'posthog.service.coxa.live,3.217.225.85'],
        ]
      ),

      pb(),

      // ── SECTION 15: ROADMAP ────────────────────────────────────────────────
      h('15. Development Roadmap — What Remains'),
      h2('Short Term (Next 4 Weeks)'),
      tbl(
        ['Item', 'App', 'Priority'],
        [
          ['Campaign delivery (email/SMS/push send)', 'fanbox-dashboard + backend', 'Critical'],
          ['Visual journey/flow builder (via Tracardi)', 'fanbox-dashboard + Tracardi', 'Critical'],
          ['Profile edit page', 'fan-dashboard', 'High'],
          ['Settings page content', 'club-dashboard + fanbox-dashboard', 'High'],
          ['Real payment gateway (PIX integration)', 'fan-dashboard + pos-app + backend', 'High'],
          ['Funnel + retention data wiring', 'fanbox-dashboard + backend', 'Medium'],
          ['A/B test results view', 'fanbox-dashboard', 'Medium'],
          ['Notifications centre', 'club-dashboard', 'Medium'],
        ]
      ),
      p(''),
      h2('Medium Term (4–12 Weeks)'),
      tbl(
        ['Item', 'App', 'Priority'],
        [
          ['Native mobile fan app (React Native)', 'fan-app', 'Critical'],
          ['Gate/turnstile check-in scanner', 'gate-app', 'High'],
          ['Admin console (super-admin)', 'admin-console', 'High'],
          ['Offline POS mode', 'pos-app', 'Medium'],
          ['Kiosk app (self-service)', 'kiosk-app', 'Medium'],
          ['Support console', 'support-console', 'Low'],
          ['Vendor portal', 'vendor-portal', 'Low'],
          ['Email verification + forgot password', 'fan-auth + club-auth', 'High'],
          ['Multi-club support', 'fan-landing + fan-auth', 'High'],
        ]
      ),

      pb(),

      // ── CLOSING ────────────────────────────────────────────────────────────
      new Paragraph({ children: [new TextRun({ text: 'Coxa Platform — Confidential Technical Reference', size: 18, color: '888888', italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 400 } }),
      new Paragraph({ children: [new TextRun({ text: 'Generated July 2026 | Kyma / Coxa Engineering Team', size: 18, color: '888888', italics: true })], alignment: AlignmentType.CENTER }),
    ],
  }],
});

const outPath = 'docs/Coxa_Platform_Full_Reference.docx';
Packer.toBuffer(doc).then((buf) => {
  createWriteStream(outPath).write(buf);
  console.log('Written:', outPath);
});
