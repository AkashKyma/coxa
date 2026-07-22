# COXA Platform  --  Backend Developer Guide

**Version:** 1.1 | **Date:** 2026-07-16  
**Stack:** Node.js 20  .  Express 4  .  MongoDB (Mongoose 8)  .  JWT Auth  
**Base URL:** `http://localhost:5000` (dev)  
**Live API Docs:** `GET /api/docs` (POS)  .  `GET /api/docs/full` (all modules)  
> **v1.1 changes:** Added Push Notifications module, Fan Self-Service Profile, Activation/Multiwoven sync, Personalization V2 (top-N + A/B + frequency cap), Tracardi Webhook Bridge, ML Scoring Service, Trait Calculator. Updated environment variables, data models, and error codes.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How to Start the Backend](#2-how-to-start-the-backend)
3. [Environment Variables](#3-environment-variables)
4. [Authentication & JWT](#4-authentication--jwt)
5. [Multi-Tenancy](#5-multi-tenancy)
6. [Module: Auth](#6-module-auth)
7. [Module: Users, Roles & Assignments](#7-module-users-roles--assignments)
8. [Module: Clubs & Staff](#8-module-clubs--staff)
9. [Module: Fan Profiles](#9-module-fan-profiles)
10. [Module: Membership](#10-module-membership)
11. [Module: Loyalty](#11-module-loyalty)
12. [Module: Retail / POS](#12-module-retail--pos)
13. [Module: Ticketing](#13-module-ticketing)
14. [Module: CDP  --  Customer Data Platform](#14-module-cdp)
15. [Module: Fanbox Dashboard](#15-module-fanbox-dashboard)
16. [Module: AI & Insights](#16-module-ai--insights)
17. [Module: Personalization](#17-module-personalization)
18. [Module: Social Ingestion](#18-module-social-ingestion)
19. [Module: Analytics](#19-module-analytics)
20. [Module: Labels & Exports](#20-module-labels--exports)
21. [Module: MCP Server (AI Agent Integration)](#21-module-mcp-server)
22. [Module: Push Notifications](#22-module-push-notifications)
23. [Module: Fan Self-Service Profile](#23-module-fan-self-service-profile)
24. [Module: Activation / Multiwoven Sync](#24-module-activation--multiwoven-sync)
25. [Personalization V2  --  Top-N Offers & A/B Testing](#25-personalization-v2--top-n-offers--ab-testing)
26. [CDP: Tracardi Webhook Bridge](#26-cdp-tracardi-webhook-bridge)
27. [ML Scoring Service](#27-ml-scoring-service)
28. [Trait Calculator](#28-trait-calculator)
29. [Data Models Reference](#29-data-models-reference)
30. [Error Codes Reference](#30-error-codes-reference)
31. [Demo Credentials & Seed Data](#31-demo-credentials--seed-data)

---

## 1. Architecture Overview

```
+---------------------------------------------------------------------+
|                          Frontend Apps                              |
|   club-auth :5173  club-dashboard :5174  fan-auth :5175             |
|   fan-dashboard :5176  pos-app :5177  fanbox-dashboard :5178        |
|   fan-landing :5179                                                 |
+------------------------------+--------------------------------------+
                               |  HTTP REST  (Authorization: Bearer JWT)
                               |  Headers: X-Club-Id  X-Tenant-Id
                               v
+---------------------------------------------------------------------+
|              Express Backend  (default :5000)                       |
|                                                                     |
|  Global middleware:                                                 |
|    requestContext -> optionalAuth -> resolveTenantContext            |
|                                                                     |
|  Route namespace  /api/v1/*                                         |
|    auth  .  users  .  roles  .  assignments  .  clubs               |
|    retail  .  membership  .  loyalty  .  ticketing                  |
|    cdp  .  fanbox  .  ai  .  social  .  personalization             |
|    meta  .  exports  .  labels  .  club/analytics                   |
|    push  .  fanprofile  .  activation                               |
|                                                                     |
|  Services layer (pure business logic, no HTTP):                     |
|    saleService  loyaltyService  fanScoreService  segmentService      |
|    cdpEventService  aiInsightsService  ragService                    |
|    mlScoringService  traitCalculator  pushService                    |
|    personalizationServiceV2  fanboxImportService  ...                |
+-------------------+-----------------------+-------------------------+
                    |                       |
          +---------v----------+  +---------v----------------------+
          |   MongoDB Atlas    |  |  CDP Infrastructure            |
          |  (coxa-staging)    |  |  RudderStack (events)          |
          |  65+ collections   |  |  PostHog (analytics)           |
          +--------------------+  |  ClickHouse (OLAP + ML scores) |
                                  |  Cube (KPI layer)              |
          +---------------------+ |  Tracardi (journey engine)     |
          |  Redis (optional)   | |  Multiwoven (data activation)  |
          |  BullMQ queues      | +--------------------------------+
          +---------------------+
```


### Key design decisions

| Decision | Detail |
|---|---|
| Single Express app | One backend serves all 7 frontend apps via CORS allowlist |
| Multi-tenant | Every resource has `tenantId`; resolved from `X-Club-Id` header |
| Dual-write CDP | All domain events go to MongoDB AND RudderStack simultaneously |
| Idempotency | Every mutation accepts `idempotencyKey` to prevent duplicate processing |
| Cluster-ready | `src/cluster.js` spawns one worker per CPU in production |
| Background seed | Demo data auto-seeded every 12 h after boot (non-fatal if it fails) |
| Graceful shutdown | SIGTERM drains in-flight requests, flushes CDP clients, disconnects MongoDB |

---

## 2. How to Start the Backend

### Development
```bash
# From the monorepo root:
npm run dev:backend

# Or directly:
cd backend && npm run dev
# -> nodemon src/server.js, hot-reload on file change
# -> Listening on http://localhost:5000
# -> API docs: http://localhost:5000/api/docs/full
```

### Production (clustered)
```bash
cd backend
npm start
# -> src/cluster.js forks one worker per CPU
# -> Primary handles SIGTERM -> broadcasts "shutdown" to workers
```

### Seed scripts
```bash
npm run seed        # Creates admin user + club + TenantConfig
npm run seed:demo   # Generates fans, sales, tickets, loyalty, campaigns
# Both are idempotent  --  safe to re-run
```

### Environment setup
```bash
# The backend reads .env from TWO levels up (../../.env relative to server.js)
# That means /home/ubuntu/coxa-1touch/.env
# A symlink from root .env -> backend/.env was created:
ln -sf /home/ubuntu/coxa-1touch/backend/.env /home/ubuntu/coxa-1touch/.env
```

---

## 3. Environment Variables

### Core (required)
| Variable | Example | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster/coxa-staging` | Primary database |
| `JWT_SECRET` | `coxa_dev_secret_change_in_production` | Signs JWT tokens  --  **change this in prod** |
| `JWT_EXPIRES_IN` | `7d` | Token TTL |
| `DEFAULT_TENANT_ID` | `coxa-club-001` | Fallback when no tenant header |

### Server
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port (AWS EB sets to 8080) |
| `NODE_ENV` | `development` | Disables seed endpoint in production |
| `WEB_CONCURRENCY` | CPU count | Cluster worker count |
| `LOG_LEVEL` | `info` | Pino log level |

### CORS  --  Frontend URLs
| Variable | Default |
|---|---|
| `CLUB_AUTH_URL` | `http://localhost:5173` |
| `CLUB_DASHBOARD_URL` | `http://localhost:5174` |
| `FAN_AUTH_URL` | `http://localhost:5175` |
| `FAN_DASHBOARD_URL` | `http://localhost:5176` |
| `POS_APP_URL` | `http://localhost:5177` |
| `FANBOX_DASHBOARD_URL` | `http://localhost:5178` |

### CDP
| Variable | Purpose |
|---|---|
| `RUDDERSTACK_DATA_PLANE_URL` | RudderStack data plane (e.g. `http://54.80.18.68:8080`) |
| `RUDDERSTACK_BACKEND_WRITE_KEY` | Node SDK write key |
| `RUDDERSTACK_WEBHOOK_SECRET` | Validates incoming RudderStack webhook callbacks |
| `POSTHOG_HOST` | PostHog instance URL |
| `POSTHOG_PROJECT_API_KEY` | PostHog API key (`phc_...`) |

### AI
| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` |  --  | Required for AI insights + RAG chatbot |
| `AI_MODEL` | `gpt-4o` | LLM generation model |
| `AI_EMBED_MODEL` | `text-embedding-3-large` | Embedding model for RAG |
| `AI_EMBED_DIMS` | `3072` | Embedding dimensions |

### Analytics (Cube + ClickHouse)
| Variable | Purpose |
|---|---|
| `CUBE_API_URL` | Cube semantic layer API URL |
| `CUBE_API_SECRET` | Cube JWT secret |
| `CLICKHOUSE_HOST` | ClickHouse host |
| `CLICKHOUSE_USER` | ClickHouse user |
| `CLICKHOUSE_PASSWORD` | ClickHouse password |

### Social
| Variable | Purpose |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Instagram Graph API long-lived token |
| `TWITTER_BEARER_TOKEN` | Twitter/X API v2 bearer token |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |

### Optional
| Variable | Purpose |
|---|---|
| `REDIS_URL` | Redis for BullMQ job queues |
| `MCP_ENABLED` | `true` to run MCP sidecar |
| `MCP_PORT` | Port for HTTP transport (default 3100) |

### Push Notifications
| Variable | Purpose |
|---|---|
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (generate with `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `VAPID_EMAIL` | VAPID contact email (default `mailto:noreply@coxa.live`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK JSON string for FCM mobile push |

### Tracardi CDP Journey Engine
| Variable | Purpose |
|---|---|
| `TRACARDI_HOST` | Tracardi API host (default `https://tracardi-api.service.coxa.live`) |
| `TRACARDI_SOURCE_ID` | Tracardi event source ID (default `coxa-rudderstack-bridge`) |
| `TRACARDI_USERNAME` | Tracardi admin username |
| `TRACARDI_PASSWORD` | Tracardi admin password |

### Activation  --  Multiwoven
| Variable | Purpose |
|---|---|
| `MULTIWOVEN_HOST` | Multiwoven API host (default `https://multiwoven.service.coxa.live`) |
| `MULTIWOVEN_API_KEY` | Multiwoven API key (Bearer token) |


---

## 4. Authentication & JWT

### Middleware chain (every request)

```
requestContext -> optionalAuth -> resolveTenantContext -> [route handler]
```

**`requestContext`**  --  attaches `req.ctx = { tenantId, clubId, userId, requestId }`  
**`optionalAuth`**  --  decodes Bearer token if present, attaches `req.user` (never blocks)  
**`resolveTenantContext`**  --  resolves `tenantId` from X-Club-Id -> DB -> fallback env var  
**`requireAuth`**  --  hard gate; returns `401` if no valid token; adds `req.membership`, `req.clubId`  
**`requireFanboxAuth`**  --  same as requireAuth but validates FanboxStaff membership  
**`requireModule(name)`**  --  returns `403` if module not in `TenantConfig.enabledModules`  
**`requirePermission(scope)`**  --  RBAC permission check against role definition  

### JWT Token Payloads

**Club staff token** (login via `/api/v1/auth/login`):
```json
{
  "userId": "64abc123def456",
  "clubId": "64def789abc012",
  "iat": 1721000000,
  "exp": 1721604800
}
```

**Fan token** (login via `/api/v1/auth/fan/login`):
```json
{
  "userId": "64abc123def456",
  "accountType": "fan",
  "iat": 1721000000,
  "exp": 1721604800
}
```

**How tokens are used by frontends:**
- Stored in `localStorage` as `coxa_token`
- Sent as `Authorization: Bearer <token>` on every API request
- On club-auth login -> token passed as URL param to club-dashboard: `?token=<token>`

### Request Headers Reference

| Header | Used by | Purpose |
|---|---|---|
| `Authorization` | All apps | `Bearer <jwt>` |
| `X-Club-Id` | Club dashboard, Fanbox | Switch active club without re-login |
| `X-Tenant-Id` | Fan apps, POS | Resolve tenant when no club context |

### Club context switching

The `X-Club-Id` header overrides the `clubId` embedded in the JWT. This lets staff switch between clubs they manage without logging out.

```
GET /api/v1/auth/me
X-Club-Id: 64def789abc012     <- new club
Authorization: Bearer eyJ...  <- same token from original login
```

---

## 5. Multi-Tenancy

Every MongoDB document that is fan/club-specific has a `tenantId` field. All queries are always scoped: `{ tenantId: req.ctx.tenantId }`.

### Resolution order

1. `X-Club-Id` header -> look up `Club` -> `club.tenantId`
2. `X-Tenant-Id` header
3. `DEFAULT_TENANT_ID` env var (default: `coxa-club-001`)

### TenantConfig document

Controls which modules are active per club:

```json
{
  "tenantId": "coxa-club-001",
  "clubName": "Coxa Branca",
  "enabledModules": ["retail", "loyalty", "membership", "ticketing", "cdp", "fanbox"],
  "currency": "BRL",
  "timezone": "America/Sao_Paulo"
}
```

If a module is not listed in `enabledModules`, the `requireModule()` middleware returns `403 MODULE_DISABLED`.

---

## 6. Module: Auth

**Base path:** `/api/v1/auth`  
**Protected routes:** `GET /me`, `GET /fan/me` require Bearer token

### `POST /api/v1/auth/signup`

Creates: User + Club + ClubMembership (role = `owner`) in one transaction.

```json
// Request body
{
  "fullName": "Harsh Patel",
  "email": "harsh@coxa.live",
  "password": "StrongPass8!",
  "phone": "+5541999990000",        // optional
  "jobTitle": "Marketing Director", // optional
  "clubName": "Coxa Branca FC",
  "country": "Brazil",
  "city": "Curitiba",
  "sport": "Football",              // optional, default Football
  "stadiumName": "Couto Pereira",   // optional
  "website": "https://coxabranca.com.br", // optional
  "size": "professional"            // small|medium|large|professional
}
```

```json
// Response 201
{
  "data": {
    "user": { "id": "...", "fullName": "Harsh Patel", "email": "harsh@coxa.live" },
    "club": { "id": "...", "name": "Coxa Branca FC", "slug": "coxa-branca-fc" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Account and club created"
}
```

Slug is auto-generated from `clubName` and made unique if taken (e.g. `coxa-branca-fc-2`).

---

### `POST /api/v1/auth/login`

Staff login. Returns token + club context.

```json
// Request
{ "email": "harsh@coxa.live", "password": "StrongPass8!" }
```

```json
// Response 200
{
  "data": {
    "user": { "id": "...", "fullName": "Harsh Patel", "email": "harsh@coxa.live" },
    "club": { "id": "...", "name": "Coxa Branca FC", "slug": "coxa-branca-fc" },
    "membership": { "role": "owner", "moduleAccess": [] },
    "token": "eyJ..."
  }
}
```

**Error codes:**
| Code | HTTP | Cause |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing email or password |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_INACTIVE` | 403 | User status is suspended/inactive |
| `NO_CLUB` | 403 | User has no active club membership |

---

### `POST /api/v1/auth/fan/signup`

Fan self-registration. Creates User + FanProfile. Optionally joins a plan and redeems a referral.

```json
// Request
{
  "fullName": "Joao Silva",
  "email": "joao@email.com",
  "password": "FanPass123!",
  "phone": "+5541988880000",            // optional
  "memberId": "MBR-2024-001",           // optional existing member number
  "onboardingPlanCode": "socio-torcedor", // optional, auto-creates membership
  "referralCode": "REF-ABCDE"           // optional, credits referrer
}
```

**Header required:** `X-Tenant-Id: coxa-club-001`

**CDP events fired automatically:**
- `fan.registered` -> sent to RudderStack + PostHog + MongoDB

---

### `POST /api/v1/auth/fan/login`

```json
// Request (with X-Tenant-Id header)
{ "email": "joao@email.com", "password": "FanPass123!" }
```

```json
// Response 200
{
  "data": {
    "user": { "id": "...", "email": "joao@email.com" },
    "fanProfile": { "id": "...", "fullName": "Joao Silva", "memberId": "MBR-2024-001" },
    "token": "eyJ..."
  }
}
```

Also fires `identifyFan()` to update RudderStack trait profile.

---

### `GET /api/v1/auth/me` _(requireAuth)_

Returns authenticated staff user + all club memberships.

```json
{
  "data": {
    "user": { "id": "...", "fullName": "Harsh Patel" },
    "memberships": [
      { "club": { "id": "...", "name": "Coxa Branca FC" }, "role": "owner", "moduleAccess": [] }
    ]
  }
}
```

### `GET /api/v1/auth/fan/me` _(requireAuth)_

Returns authenticated fan user + fan profile.

---

## 7. Module: Users, Roles & Assignments

### Users

**Base path:** `/api/v1/users` _(requireAuth)_

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all users |
| GET | `/:id` | Get single user |
| POST | `/` | Create user (admin) |

**User schema fields:**
| Field | Type | Notes |
|---|---|---|
| `fullName` | String | Required |
| `email` | String | Required, unique, lowercase |
| `passwordHash` | String | Never returned in responses |
| `phone` | String | Optional |
| `jobTitle` | String | Optional |
| `status` | Enum | `active \| inactive \| suspended` |

---

### Roles

**Base path:** `/api/v1/roles`

| Method | Path | Description |
|---|---|---|
| GET | `/` | All roles |
| GET | `/staff` | Roles usable for club staff |
| GET | `/meta/scopes` | Permission scope catalog |
| GET | `/meta/categories` | Role categories |
| GET | `/:code` | Single role by code |
| GET | `/seed` | Seed roles into DB |

**Club staff role codes (`@coxa/rbac`):**

| Role Code | Description |
|---|---|
| `owner` | Full access; set on club creation |
| `admin` | Same as owner except ownership transfer |
| `club_admin` | Club-level admin via RBAC |
| `marketing_manager` | Campaigns, fans, analytics |
| `retail_manager` | POS, stock, products, analytics |
| `ticketing_manager` | Events, tickets, check-ins |
| `loyalty_manager` | Points, rewards, rules |
| `executive_viewer` | Read-only on all dashboards |
| `pos_operator` | POS sales only (pos-app) |
| `fanbox_admin` | Full FanBox access |
| `fanbox_manager` | Campaigns, fans, projects, intelligence |
| `fanbox_analyst` | Fans, intelligence, business analytics |
| `fanbox_marketer` | Campaigns, projects, segmentation |
| `fanbox_viewer` | Read-only FanBox |

---

### Assignments

**Base path:** `/api/v1/assignments` _(requireAuth)_

| Method | Path | Description |
|---|---|---|
| GET | `/users/:userId/roles` | List user's role assignments |
| POST | `/users/:userId/roles` | Assign a role |
| DELETE | `/users/:userId/roles/:assignmentId` | Remove a role |

```json
// POST body to assign a role
{
  "roleCode": "marketing_manager",
  "clubId": "64def789abc012"
}
```

---

## 8. Module: Clubs & Staff

**Base path:** `/api/v1/clubs` _(requireAuth)_

| Method | Path | Description |
|---|---|---|
| GET | `/` | List clubs the current user belongs to |
| POST | `/` | Create a new club |
| GET | `/:clubId/members` | List all staff for a club |
| POST | `/:clubId/members` | Invite a staff member |
| PATCH | `/:clubId/members/:membershipId` | Update staff role |
| DELETE | `/:clubId/members/:membershipId` | Remove staff member |

### Create club
```json
{
  "name": "Sport Club Recife",
  "slug": "sport-recife",
  "country": "Brazil",
  "city": "Recife",
  "sport": "Football",
  "stadiumName": "Ilha do Retiro",
  "size": "professional"
}
```

### Invite staff
```json
// POST /api/v1/clubs/:clubId/members
{
  "email": "staff@club.com",
  "role": "marketing_manager",
  "moduleAccess": ["retail", "loyalty"]
}
```

`moduleAccess` restricts which sidebar modules the staff member can see (empty = role defaults).

**ClubMembership schema:**
| Field | Type | Notes |
|---|---|---|
| `clubId` | ObjectId | References Club |
| `userId` | ObjectId | References User |
| `role` | String | Role code from `@coxa/rbac` |
| `moduleAccess` | String[] | Per-user module override |
| `permissionOverrides` | Object | `{ allow: [], deny: [] }` |
| `status` | Enum | `active \| invited \| suspended \| removed` |


---

## 9. Module: Fan Profiles

Fan profiles are the central identity record for every fan. They are accessed via Fanbox routes.

**Base path:** `/api/v1/fanbox/fans` _(requireFanboxAuth)_  
**Header required:** `X-Club-Id: <clubId>`

| Method | Path | Description |
|---|---|---|
| GET | `/search` | Text search over fan profiles |
| GET | `/customer-360` | Summary 360 view for all fans |
| GET | `/customer-360/:id` | Full 360 view for one fan |
| GET | `/:id` | Single fan profile |
| PATCH | `/:id` | Update fan profile fields |

### Search fans

```
GET /api/v1/fanbox/fans/search?q=joao&status=active&page=1&limit=20
```

**Query params:**
| Param | Type | Description |
|---|---|---|
| `q` | String | Search text (name, email, CPF) |
| `status` | Enum | `active \| inactive \| merged \| lead` |
| `page` | Number | Page number (default 1) |
| `limit` | Number | Results per page (default 20) |

### Customer 360

```
GET /api/v1/fanbox/fans/customer-360/64abc...
```

Returns a complete fan record aggregated across all modules:
```json
{
  "profile": { "id": "...", "fullName": "Joao Silva", "email": "joao@email.com", ... },
  "membership": { "status": "active", "planCode": "socio-torcedor", "renewalDate": "..." },
  "loyalty": { "balance": 1450, "lifetimeEarned": 2300, "tier": "silver" },
  "tickets": [{ "ticketNumber": "TKT-...", "status": "used", "eventName": "..." }],
  "recentSales": [{ "saleNumber": "...", "totalCents": 4500, "channel": "pos" }],
  "traits": { "match_attendance_count": 12, "no_show_count": 1 },
  "segments": [{ "name": "High Spenders", "id": "..." }],
  "fanScore": 18500,
  "fanTier": "gold"
}
```

### Update fan profile

```json
// PATCH /api/v1/fanbox/fans/:id
{
  "fullName": "Joao Atualizado",
  "phone": "+5541999999999",
  "gender": "male",
  "birthDate": "1995-03-15",
  "cpf": "123.456.789-09",
  "isForeigner": false,
  "hasChildren": "yes",
  "ageRange": "26-35",
  "householdIncomeBand": "C1",
  "sportsBetting": false,
  "biometricRegistered": true,
  "primaryInteractionChannels": ["app", "email"],
  "address": {
    "street": "Rua das Flores, 123",
    "city": "Curitiba",
    "state": "PR",
    "postalCode": "80000-000",
    "country": "BR"
  }
}
```

### FanProfile schema fields

| Field | Type | Description |
|---|---|---|
| `tenantId` | String | Tenant scope |
| `fanId` | String | Unique fan identifier within tenant |
| `fullName` | String | Display name |
| `email` | String | Primary email (unique per tenant) |
| `phone` | String | Phone number |
| `cpf` | String | Brazilian CPF (fiscal ID) |
| `passport` | String | Passport number (foreigners) |
| `isForeigner` | Boolean | Not a Brazilian resident (CPF not required) |
| `gender` | Enum | `male \| female \| other \| unknown` |
| `birthDate` | Date | Date of birth |
| `address` | Object | `{ street, city, state, postalCode, country }` |
| `hasChildren` | Enum | `yes \| no \| unknown` |
| `ageRange` | String | e.g. `"26-35"` |
| `householdIncomeBand` | String | e.g. `"C1"`, `"B2"` |
| `preferredSocialNetwork` | String | e.g. `"instagram"` |
| `sportsBetting` | Boolean | Fan is a sports bettor |
| `affinityClubId` | String | Secondary club affinity |
| `biometricRegistered` | Boolean | Enrolled in stadium biometric |
| `primaryInteractionChannels` | String[] | `app \| email \| sms \| whatsapp` |
| `memberId` | String | External member number |
| `status` | Enum | `active \| inactive \| merged \| lead` |

---

## 10. Module: Membership

**Base path:** `/api/v1/membership`  
Fan-facing routes need fan token; admin routes need club staff token.

### Membership Plans

**`GET /api/v1/membership/plans`**  --  list all active plans
```json
// Response item
{
  "id": "64...",
  "planCode": "socio-torcedor",
  "name": "SA3cio Torcedor",
  "tierLevel": 1,
  "description": "Basic supporter membership",
  "benefits": ["Discount on merchandise", "Priority ticket access"],
  "monthlyPriceCents": 2990,
  "annualPriceCents": 29900,
  "seatType": "general",
  "sectorCode": "Norte",
  "priorityBase": 100,
  "status": "active"
}
```

**`GET /api/v1/membership/plans/:planCode`**  --  single plan  

**`POST /api/v1/membership/plans`** _(staff)_  --  create plan
```json
{
  "planCode": "socio-premium",
  "name": "SA3cio Premium",
  "tierLevel": 3,
  "monthlyPriceCents": 9900,
  "annualPriceCents": 99000,
  "seatType": "vip",
  "sectorCode": "Camarote",
  "priorityBase": 500,
  "benefits": ["VIP lounge", "Free parking", "Meet & greet tickets"]
}
```

`seatType` enum: `none | general | assigned | vip`

**`PUT /api/v1/membership/plans/:planCode`**  --  update plan

**`GET /api/v1/membership/tiers`**  --  tier thresholds by fan score:
```json
{ "bronze": 0, "silver": 5001, "gold": 15001, "platinum": 35001, "diamond": 60001 }
```

---

### Fan Membership Actions

**`POST /api/v1/membership/join`**  --  fan joins a plan _(fan token)_
```json
{
  "planCode": "socio-torcedor",
  "paymentFrequency": "monthly",
  "paymentMethod": "pix",
  "idempotencyKey": "join-fan123-2024-01-15"
}
```
`paymentFrequency`: `monthly | annual`  
`paymentMethod`: `pix | card | cash | stub`  
CDP event fired: `membership.created`

---

**`POST /api/v1/membership/renew`** _(fan token)_
```json
{
  "paymentMethod": "card",
  "idempotencyKey": "renew-fan123-2024-06-01"
}
```
CDP event: `membership.renewed`  
Loyalty points earned from `earn_annual_renewal` rule (annual renewals only)

---

**`POST /api/v1/membership/upgrade`** _(fan token)_
```json
{ "newPlanCode": "socio-premium", "idempotencyKey": "upgrade-fan123-premium-2024" }
```
CDP event: `membership.upgraded`

---

**`POST /api/v1/membership/cancel`** _(fan token)_
```json
{ "reason": "Moving abroad" }
```
CDP event: `membership.cancelled`

---

**`GET /api/v1/membership/me`** _(fan token)_  --  current membership  
**`GET /api/v1/membership/me/score`** _(fan token)_  --  fan score + tier

---

### Referrals

**`GET /api/v1/membership/referrals/code`**  --  get fan's referral code  
**`POST /api/v1/membership/referrals/redeem`**  --  redeem a referral code
```json
{ "code": "REF-ABCDE" }
```
CDP event: `referral.confirmed` -> earns loyalty points for both parties

**`GET /api/v1/membership/referrals`**  --  list fan's referrals

---

## 11. Module: Loyalty

**Base path:** `/api/v1/loyalty`

The loyalty system is a **double-entry ledger**  --  every point change creates an immutable `LoyaltyLedgerEntry` with running balance. Idempotency keys prevent duplicate entries.

### Rules

**`GET /api/v1/loyalty/rules`**  --  list all rules

**`POST /api/v1/loyalty/rules`**  --  create a rule
```json
{
  "name": "Retail Purchase Points",
  "ruleType": "earn_retail",
  "pointsPerReal": 2,
  "minAmountCents": 1000,
  "description": "2 points per BRL on retail purchases >= R$10"
}
```

**`ruleType` values and their triggers:**

| Rule Type | Triggered By |
|---|---|
| `earn_retail` | POS sale completion |
| `earn_fan_shop` | Fan online shop order |
| `earn_ticket` | Ticket purchase |
| `earn_attendance` | Stadium gate check-in |
| `earn_merchandise` | Merchandise purchase |
| `earn_fnb` | Food & beverage purchase |
| `earn_referral` | Successful referral |
| `earn_annual_renewal` | Annual membership renewal |
| `earn_away_match` | Away game attendance |
| `earn_community_event` | Community event participation |
| `earn_donation` | Donation |
| `redeem_reward` | Reward redemption (deduction) |

**Points per Real or Flat:**
- `pointsPerReal`  --  earn X points per R$1.00 spent (used for transaction-based rules)
- `pointsFlat`  --  earn X flat points regardless of spend amount
- `minAmountCents`  --  minimum sale amount to qualify

---

### Rewards

**`GET /api/v1/loyalty/rewards`**  --  list all rewards

**`POST /api/v1/loyalty/rewards`**  --  create a reward
```json
{
  "name": "10% off merchandise",
  "pointsCost": 500,
  "rewardType": "discount",
  "description": "Redeem for 10% discount on next purchase"
}
```

---

### Fan Balance & History

**`GET /api/v1/loyalty/balance/:fanProfileId`**  --  current balance (single number)

**`GET /api/v1/loyalty/ledger/:fanProfileId`**  --  transaction history
```json
// Response item
{
  "id": "64...",
  "entryType": "earn",
  "pointsDelta": 120,
  "balanceAfter": 1450,
  "referenceType": "sale",
  "referenceId": "SALE-20240716-0001",
  "note": "POS sale",
  "createdAt": "2024-07-16T10:30:00Z"
}
```

`entryType` values: `earn | redeem | adjust | expire | reverse`

---

### Fan Self-Service

**`GET /api/v1/loyalty/me`** _(fan token)_  --  balance summary:
```json
{
  "balance": 1450,
  "lifetimeEarned": 2300,
  "lifetimeRedeemed": 500,
  "lifetimeReversed": 0,
  "lifetimeAdjusted": 0,
  "entryCount": 12
}
```

**`POST /api/v1/loyalty/me/redeem-reward`** _(fan token)_
```json
{
  "rewardId": "64abc...",
  "idempotencyKey": "redeem-fan123-reward456-2024-07"
}
```

---

### Admin Controls

**`POST /api/v1/loyalty/adjust`**  --  manual adjustment
```json
{
  "fanProfileId": "64abc...",
  "pointsDelta": -200,
  "note": "Correction for duplicate entry",
  "idempotencyKey": "adjust-admin-20240716-001",
  "createdBy": "admin@club.com"
}
```

**`POST /api/v1/loyalty/redeem`**  --  admin redeems on behalf of fan

---

### Fan Score Engine

Fan score (0--100,000) is computed by `services/fanScoreService.js`:

```
totalScore = round(
  attendanceScore  x 0.40   <- matches attended + streak + no-show rate
  tenureScore      x 0.20   <- months as active member
  spendingScore    x 0.15   <- cumulative spend across all channels
  referralScore    x 0.10   <- successful referrals made
  engagementScore  x 0.10   <- campaigns/projects interacted with
  donationScore    x 0.05   <- donation amount
)
```

| Tier | Score Range |
|---|---|
| Bronze | 0 -- 5,000 |
| Silver | 5,001 -- 15,000 |
| Gold | 15,001 -- 35,000 |
| Platinum | 35,001 -- 60,000 |
| Diamond | 60,001+ |


---

## 12. Module: Retail / POS

**Base path:** `/api/v1/retail`  
Requires `retail` in `TenantConfig.enabledModules`.

### Sub-modules overview

| Sub-router | Mounted at | Purpose |
|---|---|---|
| products | `/retail/products` | Product catalog management |
| categories | `/retail/categories` | Product categories |
| locations | `/retail/locations` | Store/kiosk locations |
| stock | `/retail/stock` | Inventory control |
| lots | `/retail/lots` | Food/beverage batch tracking |
| sales | `/retail/sales` | POS transactions |
| returns | `/retail/returns` | Return/refund processing |
| transfers | `/retail/transfers` | Inter-location stock moves |
| shop | `/retail/shop` | Fan-facing online store |
| alerts | `/retail/alerts` | Low-stock alerts |
| saleQr | `/retail/sales/:id/qr-codes` | QR code for sale receipts |
| analytics | `/retail/analytics` | Sales analytics |

---

### Products

**`GET /api/v1/retail/products`**  --  catalog list
**`GET /api/v1/retail/products/:id`**  --  single product
**`POST /api/v1/retail/products`**  --  create product
```json
{
  "name": "Club Jersey 2024",
  "categoryId": "64abc...",
  "description": "Official home jersey",
  "imageUrl": "https://...",
  "skus": [
    { "skuCode": "JERSEY-S-RED", "sizeLabel": "S", "colorLabel": "Red", "priceCents": 15000, "initialStock": 50 },
    { "skuCode": "JERSEY-M-RED", "sizeLabel": "M", "colorLabel": "Red", "priceCents": 15000, "initialStock": 100 }
  ]
}
```

**`PATCH /api/v1/retail/products/:id`**  --  update product  
**`PATCH /api/v1/retail/skus/:skuId`**  --  update single SKU (price, status)

---

### Categories

**`GET /api/v1/retail/categories`**  --  list categories  
**`POST /api/v1/retail/categories`**  --  create category  
**`PATCH /api/v1/retail/categories/:id`**  --  update

```json
{ "name": "Jerseys", "description": "Official match jerseys" }
```

---

### Locations (stores/kiosks)

**`GET /api/v1/retail/locations`**  --  list  
**`POST /api/v1/retail/locations`**  --  create
```json
{
  "name": "Main Stadium Store",
  "type": "store",
  "address": "Gate A, Couto Pereira Stadium"
}
```

---

### Stock

**`GET /api/v1/retail/stock`**  --  current stock balances by SKU  
**`POST /api/v1/retail/stock/receive`**  --  receive stock
```json
{
  "locationId": "64abc...",
  "lines": [
    { "skuId": "64def...", "qty": 50, "unitCostCents": 5000, "batchRef": "BATCH-2024-07" }
  ]
}
```
**`POST /api/v1/retail/stock/adjustments`**  --  manual adjustment (shrinkage, damage)  
**`POST /api/v1/retail/stock/sync-catalog`**  --  sync catalog from seed data

---

### Sales (POS Transactions)

**`GET /api/v1/retail/sales`**  --  list sales

**Query params:**
| Param | Description |
|---|---|
| `today=true` | Filter to today's sales only |
| `locationId` | Filter by location |
| `channel` | `pos \| fan_shop` |

**`GET /api/v1/retail/sales/:id`**  --  single sale with location detail

**`POST /api/v1/retail/sales`**  --  create a sale (POS checkout)
```json
{
  "locationId": "64abc...",
  "lines": [
    { "skuId": "64def...", "qty": 2 },
    { "skuId": "64ghi...", "qty": 1 }
  ],
  "paymentMethod": "pix",
  "fanProfileId": "64jkl...",
  "fanEmail": "joao@email.com",
  "cashierUserId": "64mno...",
  "channel": "pos"
}
```

The service:
1. Validates SKUs + stock
2. Calculates totals from current prices
3. Deducts stock
4. Creates `Sale` document with denormalized analytics fields
5. Fires `sale.completed` CDP event
6. Calculates and credits loyalty points (from `earn_retail` or `earn_fan_shop` rule)

**paymentMethod:** `cash | card | pix | stub`  
**channel:** `pos | fan_shop`

**Sale schema key fields:**
| Field | Description |
|---|---|
| `saleNumber` | Auto-generated `SALE-YYYYMMDD-NNNN` |
| `lines[]` | Line items with skuId, qty, price, denormalized category/location/time |
| `subtotalCents` | Pre-discount total |
| `totalCents` | Final amount charged |
| `paymentStatus` | `pending \| paid \| failed \| refunded` |
| `channel` | `pos \| fan_shop` |

---

### Returns & Refunds

**`GET /api/v1/retail/returns`**  --  list returns  
**`POST /api/v1/retail/returns`**  --  create return
```json
{
  "saleId": "64abc...",
  "lines": [
    { "skuId": "64def...", "qty": 1, "reason": "wrong_size" }
  ],
  "refundMethod": "pix",
  "idempotencyKey": "return-sale123-sku456-2024-07"
}
```

Fires `sale.returned` CDP event and reverses loyalty points.

---

### Stock Transfers

**`GET /api/v1/retail/transfers`**  --  list  
**`POST /api/v1/retail/transfers`**  --  transfer stock between locations
```json
{
  "fromLocationId": "64abc...",
  "toLocationId": "64def...",
  "lines": [{ "skuId": "64ghi...", "qty": 20 }],
  "notes": "Pre-match restock"
}
```

---

### Food & Beverage Lots

**`GET /api/v1/retail/lots`**  --  list lots  
**`POST /api/v1/retail/lots/receive`**  --  receive F&B batch  
**`POST /api/v1/retail/lots/:lotId/wastage`**  --  record wastage  
**`POST /api/v1/retail/lots/mark-expired`**  --  bulk mark expired

---

### Fan Shop (Online Store)

**`GET /api/v1/retail/shop/catalog`**  --  public product catalog (no auth needed)  
**`POST /api/v1/retail/shop/orders`** _(fan token)_  --  place online order  
**`GET /api/v1/retail/shop/orders`** _(fan token)_  --  fan's order history

---

### Sale QR Codes

**`GET /api/v1/retail/sales/:saleId/qr-codes`**  --  get QR codes for a sale  
**`POST /api/v1/retail/sale-qr/redeem`**  --  redeem a sale QR code at gate

---

### Low-Stock Alerts

**`GET /api/v1/retail/alerts/low-stock`**  --  SKUs below threshold

---

### Retail Analytics

**`GET /api/v1/retail/analytics/summary`**  --  revenue + units in period  
**`GET /api/v1/retail/analytics/top-products`**  --  ranked by revenue  
**`GET /api/v1/retail/analytics/by-location`**  --  breakdown per store  
**`POST /api/v1/retail/analytics/admin/backfill-denorm`**  --  backfill denormalized fields

**Query params for analytics:** `from=2024-01-01&to=2024-12-31&preset=last_30_days`

Also available via Club Analytics:  
**`GET /api/v1/club/analytics/retail`**  --  club-level retail KPIs  
**`GET /api/v1/club/analytics/retail/top-products`**  
**`GET /api/v1/club/analytics/retail/by-location`**


---

## 13. Module: Ticketing

**Base path:** `/api/v1/ticketing`  
Requires `ticketing` in `TenantConfig.enabledModules`.

### Public (fan-facing, no auth needed)

**`GET /api/v1/ticketing/status`**  --  module health  
**`GET /api/v1/ticketing/shop/events`**  --  upcoming events with ticket products  
**`POST /api/v1/ticketing/shop/purchase`**  --  purchase tickets directly

```json
// POST /api/v1/ticketing/shop/purchase
{
  "matchEventId": "64abc...",
  "ticketProductId": "64def...",
  "qty": 2,
  "paymentMethod": "pix",
  "fanProfileId": "64ghi...",
  "idempotencyKey": "purchase-fan123-event456-2024-07"
}
```

CDP event: `ticket.purchased`  
Loyalty points: credited from `earn_ticket` rule

---

### Venues

**`GET /api/v1/ticketing/venues`**  --  list venues  
**`GET /api/v1/ticketing/venues/:id`**  --  single venue  
**`POST /api/v1/ticketing/venues`**  --  create venue
```json
{
  "name": "Couto Pereira",
  "city": "Curitiba",
  "state": "PR",
  "country": "BR",
  "totalCapacity": 32000,
  "sectors": [
    { "code": "Norte", "name": "Norte Sector", "capacity": 5000 },
    { "code": "Sul", "name": "Sul Sector", "capacity": 5000 }
  ]
}
```
**`PATCH /api/v1/ticketing/venues/:id`**  --  update  
**`DELETE /api/v1/ticketing/venues/:id`**  --  soft-delete

---

### Match Events

**`GET /api/v1/ticketing/events`**  --  list events  
**`GET /api/v1/ticketing/events/:id`**  --  single event  
**`POST /api/v1/ticketing/events`**  --  create event
```json
{
  "name": "Coritiba vs Athletico",
  "homeTeam": "Coritiba",
  "awayTeam": "Athletico Paranaense",
  "matchDate": "2024-08-15T20:00:00Z",
  "venueId": "64abc...",
  "status": "on_sale",
  "competitionName": "Brasileirao Serie A"
}
```
**`PATCH /api/v1/ticketing/events/:id/status`**  --  update event status  
Event status values: `draft | on_sale | sold_out | postponed | cancelled | completed`

**`GET /api/v1/ticketing/events/:id/ticket-products`**  --  list products for event  
**`POST /api/v1/ticketing/events/:id/ticket-products`**  --  create ticket product
```json
{
  "name": "General Admission - Norte",
  "sectionCode": "Norte",
  "priceCents": 4000,
  "capacity": 2000,
  "memberOnly": false
}
```

**`POST /api/v1/ticketing/events/:id/record-no-shows`**  --  mark unchecked tickets as no-show  
**`GET|POST /api/v1/ticketing/events/:id/check-in-windows`**  --  manage check-in windows

---

### Tickets

**`GET /api/v1/ticketing/tickets`**  --  list tickets  
**`POST /api/v1/ticketing/tickets/issue`**  --  issue tickets (admin/staff)
```json
{
  "matchEventId": "64abc...",
  "ticketProductId": "64def...",
  "fanProfileId": "64ghi...",
  "qty": 1,
  "channel": "box_office",
  "paymentMethod": "cash",
  "idempotencyKey": "issue-staff-fan123-event456"
}
```
**`POST /api/v1/ticketing/tickets/:id/cancel`**  --  cancel a ticket

**Ticket schema key fields:**
| Field | Type | Description |
|---|---|---|
| `ticketNumber` | String | Auto-generated `TKT-YYYYMMDD-XXXX` |
| `qrToken` | String | 32-char hex used for gate scan |
| `status` | Enum | `issued \| used \| cancelled \| transferred` |
| `channel` | Enum | `fan_app \| box_office \| admin` |
| `paymentMethod` | Enum | `pix \| card \| cash \| stub` |
| `idempotencyKey` | String | Prevents double-issuance |

---

### Reservations

**`POST /api/v1/ticketing/reservations`**  --  create seat reservation  
**`GET /api/v1/ticketing/reservations/:id`**  --  get reservation  
**`POST /api/v1/ticketing/reservations/:id/cancel`**  --  cancel reservation

---

### Entitlements

**`GET /api/v1/ticketing/entitlements/validate`**  --  check fan entitlement  
**`POST /api/v1/ticketing/entitlements/validate`**  --  validate QR token at gate  
**`POST /api/v1/ticketing/entitlements/override`**  --  manual override (security staff)

---

### Check-Ins

**`GET /api/v1/ticketing/check-ins/plans`**  --  membership check-in plans  
**`POST /api/v1/ticketing/check-ins/plans`**  --  create plan  
**`GET /api/v1/ticketing/check-ins/windows/:matchEventId`**  --  check-in windows for event  
**`POST /api/v1/ticketing/check-ins/windows`**  --  create window
```json
{
  "matchEventId": "64abc...",
  "planCode": "socio-torcedor",
  "opensAt": "2024-08-15T18:00:00Z",
  "closesAt": "2024-08-15T21:30:00Z"
}
```
**`GET /api/v1/ticketing/check-ins/windows/:matchEventId/eligible`**  --  eligible members for window  
**`POST /api/v1/ticketing/check-ins/windows/:matchEventId/sync`**  --  sync attendance records  
**`POST /api/v1/ticketing/check-ins`**  --  record a check-in

CDP event: `member.checked_in`  
Loyalty points: credited from `earn_attendance` rule

---

## 14. Module: CDP

**Base path:** `/api/v1/cdp`  
Requires `cdp` in `TenantConfig.enabledModules`.

The CDP module is the **data backbone** of the platform. All domain events from retail, ticketing, membership, and loyalty flow through here into:
1. **MongoDB**  --  local audit trail + DLQ for failed events
2. **RudderStack**  --  event streaming to downstream destinations (PostHog, ClickHouse, Dagster)
3. **PostHog**  --  product analytics + session replay + feature flags

### Events

**`GET /api/v1/cdp/events`** _(requireAuth)_  --  list events
**Query params:** `eventName`, `fanProfileId`, `status`, `limit`

**`POST /api/v1/cdp/events`**  --  publish an event
```json
{
  "tenantId": "coxa-club-001",
  "eventName": "sale.completed",
  "source": "retail_pos",
  "fanProfileId": "64abc...",
  "idempotencyKey": "sale-SALE-20240716-0001",
  "payload": {
    "saleId": "64abc...",
    "saleNumber": "SALE-20240716-0001",
    "totalCents": 15000,
    "lineCount": 2,
    "paymentMethod": "pix",
    "channel": "pos"
  }
}
```

**`POST /api/v1/cdp/events/:id/replay`** _(requireAuth)_  --  replay a failed/DLQ event

---

### All Tracked Event Types

| Event Name | Trigger | Has Fan Profile |
|---|---|---|
| `sale.completed` | POS or fan shop checkout | yes |
| `sale.returned` | Return processed | yes |
| `stock.transferred` | Stock transfer completed | no |
| `wastage.recorded` | F&B lot wastage | no |
| `fan.registered` | Fan signup | yes |
| `fan.updated` | Profile fields updated | yes |
| `loyalty.points.earned` | Points credited | yes |
| `loyalty.points.redeemed` | Points used | yes |
| `loyalty.points.reversed` | Points reversed/expired | yes |
| `loyalty.points.adjusted` | Admin manual adjustment | yes |
| `loyalty.reward.redeemed` | Reward redeemed | yes |
| `membership.created` | Fan joined a plan | yes |
| `membership.renewed` | Membership renewed | yes |
| `membership.upgraded` | Plan upgrade | yes |
| `membership.cancelled` | Membership cancelled | yes |
| `ticket.purchased` | Ticket bought | yes |
| `ticket.used` | Ticket scanned at gate | yes |
| `member.checked_in` | Stadium gate check-in | yes |
| `referral.confirmed` | Referral code redeemed | yes |
| `campaign.message.sent` | Campaign delivered | yes |
| `campaign.participated` | Fan responded to campaign | yes |

---

### Fan Profile Search

**`GET /api/v1/cdp/profiles/search?q=joao`** _(requireAuth)_  
Searches across name, email, CPF.

---

### Customer 360

**`GET /api/v1/cdp/customer-360?q=joao@email.com`** _(requireAuth)_

Lookup by email, CPF, name, or fanProfileId. Returns aggregated view.

**`GET /api/v1/cdp/customer-360/:fanProfileId`** _(requireAuth)_

**Query params:** `revealPii=true` to include masked CPF/passport in plain text.

---

### Segments

Segments are rule-based groups of fans. Each rule evaluates a trait or profile field.

**`GET /api/v1/cdp/segments`** _(requireAuth)_  --  list segments  
**`GET /api/v1/cdp/segments/:id`**  --  single segment  

**`POST /api/v1/cdp/segments`** _(requireAuth)_  --  create segment
```json
{
  "name": "High Spenders",
  "description": "Fans who spent over R$500 in last 30 days",
  "rules": [
    { "traitKey": "spend.last30DaysCents", "operator": "gte", "value": 50000 }
  ]
}
```

**Segment rule operators:** `eq | neq | gt | gte | lt | lte | contains | exists`

**Trait keys available for segmentation:**
- Profile: `gender`, `ageRange`, `address.city`, `address.state`, `hasChildren`, `biometricRegistered`
- Membership: `membership.status`, `membership.planCode`, `membership.tenureMonths`
- Spend: `spend.last30DaysCents`, `spend.last365DaysCents`
- Tickets: `ticket.type`, `ticket.status`, `ticket.isLongTermHolder`
- Attendance: `match_attendance_count`, `no_show_count`, `consecutive_match_count`

**`PATCH /api/v1/cdp/segments/:id`**  --  update segment  
**`POST /api/v1/cdp/segments/preview`**  --  preview matching fans (no save)
```json
{
  "rules": [
    { "traitKey": "membership.planCode", "operator": "eq", "value": "socio-premium" },
    { "traitKey": "address.city", "operator": "eq", "value": "Curitiba" }
  ]
}
```

---

### RudderStack Webhook

**`POST /api/v1/cdp/rudderstack-webhook`**  --  receives events from RudderStack data plane

This endpoint receives transformed + delivered events back from RudderStack (Phase 2 single-write path). Validates the `X-Rudderstack-Signature` header against `RUDDERSTACK_WEBHOOK_SECRET`.

---

### CDP Data Flow (detailed)

```
1. Domain action (e.g., POS sale)
         |
2. Service calls publishEvent() in cdpEventService.js
         |
3a. RudderStack track() <- fire-and-forget, non-blocking
         |
   RudderStack data plane -> transformer -> PostHog destination (http://posthog-capture:3000)
                                        -> ClickHouse destination (for OLAP)
                                        -> Webhook back to /api/v1/cdp/rudderstack-webhook
         |
3b. Legacy eventBus.ingestEvent() -> CdpEvent MongoDB document (local audit log)
         |
4. PostHog ingests event -> Kafka queue -> ClickHouse ingestion
         |
5. Dagster pipeline reads ClickHouse -> builds fan traits -> updates FanTrait collection
         |
6. Cube semantic layer exposes aggregated KPIs from ClickHouse
```


---

## 15. Module: Fanbox Dashboard

**Base path:** `/api/v1/fanbox`  
Requires `fanbox` in `TenantConfig.enabledModules`.  
All routes (except `/auth` and `/status`) require `requireFanboxAuth`  --  a valid JWT + active FanboxStaff record.

### Fanbox Auth

**`POST /api/v1/fanbox/auth/login`**
```json
{ "email": "staff@club.com", "password": "StrongPass8!" }
```

Returns token + FanboxStaff record + list of clubs the staff belongs to.

**`GET /api/v1/fanbox/auth/me`** _(fanbox token)_  --  current staff user  
**`GET /api/v1/fanbox/auth/clubs`** _(fanbox token)_  --  clubs accessible to this staff

---

### Fanbox Staff Management

**Base path:** `/api/v1/fanbox/staff`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all staff for the club |
| POST | `/` | Invite staff |
| PATCH | `/:staffId` | Update staff role/access |
| DELETE | `/:staffId` | Remove staff |

```json
// POST body to invite staff
{
  "email": "analyst@club.com",
  "role": "fanbox_analyst",
  "moduleAccess": ["fans", "intelligence"]
}
```

**Fanbox roles:**
| Role | Modules |
|---|---|
| `fanbox_admin` | All modules, can manage staff |
| `fanbox_manager` | fans, business, projects, intelligence, campaigns |
| `fanbox_analyst` | fans, intelligence, business |
| `fanbox_marketer` | fans, intelligence, campaigns, projects |
| `fanbox_viewer` | fans (read-only) |

---

### Fanbox Analytics

**Base path:** `/api/v1/fanbox/analytics`

| Endpoint | Description |
|---|---|
| `GET /fan-counters` | Total fans, new, active counts |
| `GET /fan-growth` | Fan growth over time |
| `GET /fan-demographics` | Age, gender, city breakdown |
| `GET /engagement-reports` | Campaign open/click rates |
| `GET /spend-reports` | Spend by category/period |
| `GET /member-reports` | Membership plan distribution |
| `GET /loyalty-reports` | Points earned/redeemed |
| `GET /retail-summary` | Retail revenue summary |
| `GET /top-products` | Top selling products |
| `GET /revenue-by-location` | Revenue per store |
| `GET /business/:source` | Specific business source analytics |
| `GET /advanced` | Advanced KPI analytics via Cube |

**Query params (all):** `from=YYYY-MM-DD`, `to=YYYY-MM-DD`, `preset=last_30_days`

---

### Intelligence  --  Filters & Segments

**Base path:** `/api/v1/fanbox/intelligence`

Saved Filters are named queries that can be previewed, exported, and promoted to CDP Segments.

**`GET /api/v1/fanbox/intelligence/filters`**  --  list saved filters

**`POST /api/v1/fanbox/intelligence/filters`**  --  create filter
```json
{
  "name": "Curitibanos Premium",
  "rules": [
    { "field": "address.city", "operator": "eq", "value": "Curitiba" },
    { "field": "membership.planCode", "operator": "eq", "value": "socio-premium" }
  ]
}
```

**`PATCH /api/v1/fanbox/intelligence/filters/:id`**  --  update filter  
**`DELETE /api/v1/fanbox/intelligence/filters/:id`**  --  delete filter

**`POST /api/v1/fanbox/intelligence/filters/preview`**  --  preview matching fans (no save)
```json
{
  "rules": [
    { "field": "spend.last30DaysCents", "operator": "gte", "value": 50000 }
  ]
}
```
Returns: `{ data: [fanProfile, ...], total: 42 }`

**`POST /api/v1/fanbox/intelligence/filters/:id/export`**  --  export fan list as CSV

**`POST /api/v1/fanbox/intelligence/filters/:id/promote`**  --  promote filter to CDP Segment  
This creates a Segment in the CDP module from the filter's rules, making it available for personalization and campaign targeting.

**Filter field operators:**
| Operator | Description |
|---|---|
| `eq` | Equals |
| `neq` | Not equals |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `contains` | String contains |
| `in` | Value is in array |
| `exists` | Field exists and is not null |

---

### Campaigns

**Base path:** `/api/v1/fanbox/campaigns`

Campaigns send messages (email/SMS/push) to a filtered segment of fans.

**`GET /api/v1/fanbox/campaigns`**  --  list all campaigns  
**`GET /api/v1/fanbox/campaigns/:id`**  --  single campaign

**`POST /api/v1/fanbox/campaigns`**  --  create campaign
```json
{
  "name": "July Renewal Drive",
  "type": "email",
  "subject": "Renew your membership and earn 500 bonus points!",
  "bodyHtml": "<h1>Hello {{name}}</h1><p>Your membership expires soon...</p>",
  "savedFilterId": "64abc...",
  "segmentId": "64def..."
}
```
`type`: `email | sms | push`

**`PATCH /api/v1/fanbox/campaigns/:id`**  --  update  
**`DELETE /api/v1/fanbox/campaigns/:id`**  --  delete  
**`POST /api/v1/fanbox/campaigns/:id/schedule`**  --  schedule delivery
```json
{ "scheduledAt": "2024-07-20T09:00:00Z" }
```
**`POST /api/v1/fanbox/campaigns/:id/send`**  --  send immediately

---

### Campaign Templates

**`GET /api/v1/fanbox/campaigns/templates`**  --  list templates  
**`POST /api/v1/fanbox/campaigns/templates`**  --  create template
```json
{
  "name": "Welcome Email",
  "type": "email",
  "subject": "Welcome to Coxa Branca!",
  "bodyHtml": "<h1>Welcome {{name}}!</h1>..."
}
```
**`PATCH /api/v1/fanbox/campaigns/templates/:id`**  --  update  
**`DELETE /api/v1/fanbox/campaigns/templates/:id`**  --  delete

---

### Digital Projects

**Base path:** `/api/v1/fanbox/projects`

Projects are surveys, polls, sweepstakes, and quizzes sent to fans.

**`GET /api/v1/fanbox/projects`**  --  list projects  
**`GET /api/v1/fanbox/projects/:id`**  --  single project  
**`POST /api/v1/fanbox/projects`**  --  create project
```json
{
  "title": "Fan Survey July 2024",
  "type": "survey",
  "questions": [
    { "id": "q1", "text": "How satisfied are you?", "type": "scale", "min": 1, "max": 10 },
    { "id": "q2", "text": "What can we improve?", "type": "text" }
  ],
  "savedFilterId": "64abc..."
}
```
**`PATCH /api/v1/fanbox/projects/:id`**  --  update  
**`POST /api/v1/fanbox/projects/:id/close`**  --  close project (no more responses)  
**`GET /api/v1/fanbox/projects/:id/responses`**  --  list responses  
**`POST /api/v1/fanbox/projects/:id/responses`**  --  submit a fan response  
**`POST /api/v1/fanbox/projects/:id/draw-winner`**  --  random winner draw (sweepstakes)

---

### Fan Import

**Base path:** `/api/v1/fanbox/import`

Bulk import fans from CSV or JSON.

**`POST /api/v1/fanbox/import/:type`**  --  start import job  
Types: `csv | json | members`

**`GET /api/v1/fanbox/import/jobs`**  --  list import jobs  
**`GET /api/v1/fanbox/import/jobs/:id`**  --  job status + error report

---

### Fanbox AI Assistant

**Base path:** `/api/v1/fanbox/ai`

Same as the main AI module but scoped to Fanbox context:

**`POST /api/v1/fanbox/ai/assistant`**  --  RAG chat (Fanbox context)  
**`POST /api/v1/fanbox/ai/insights`**  --  KPI insights generation  
**`GET /api/v1/fanbox/ai/knowledge-status`**  --  RAG knowledge base status  
**`GET /api/v1/fanbox/ai/search`**  --  semantic search over knowledge base  
**`POST /api/v1/fanbox/ai/seed-knowledge`**  --  seed/refresh knowledge base


---

## 16. Module: AI & Insights

**Base path:** `/api/v1/ai`  
_(requireAuth)_

All AI features require a valid `OPENAI_API_KEY`. The backend uses two pipelines:

1. **Simple LLM call**  --  `chatWithContext()` for quick answers
2. **RAG pipeline**  --  `ragChat()` embeds the query, retrieves relevant chunks from the knowledge base, then generates a grounded answer

### `POST /api/v1/ai/assistant`

Primary RAG endpoint. Used by `AiChatWidget` in both club-dashboard and fanbox-dashboard.

```json
// Request
{
  "messages": [
    { "role": "user", "content": "Which fans attended the most games last month?" }
  ],
  "kpiContext": {
    "active_memberships": 12450,
    "ticket_revenue_cents": 4500000
  }
}
```

```json
// Response
{
  "data": {
    "content": "Based on your attendance data, the top 5 fans by match attendance last month were...",
    "sources": [
      { "title": "FanScore attendance component", "relevance": 0.92 }
    ],
    "usage": { "prompt_tokens": 450, "completion_tokens": 180 }
  }
}
```

---

### `POST /api/v1/ai/insights`

Generates natural-language insights for a set of KPIs.

```json
// Request
{
  "kpis": [
    { "key": "active_memberships", "label": "Active Memberships", "value": 12450, "unit": "count" },
    { "key": "churned_memberships", "label": "Churned", "value": 320, "unit": "count" }
  ],
  "from": "2024-06-01",
  "to": "2024-06-30"
}
```

Returns bullet-point insights like "Churn rate of 2.6% is above average for June  --  consider a win-back campaign."

---

### `POST /api/v1/ai/chat`

Legacy alias for the assistant endpoint, without RAG. Uses `chatWithContext()`.

---

### `POST /api/v1/ai/discover-kpis`

AI-powered KPI discovery  --  suggests additional metrics for a department.

```json
// Request
{
  "department": "loyalty",
  "industry": "football_club",
  "existingKeys": ["active_memberships", "loyalty_balance_total"]
}
```

---

### `GET /api/v1/ai/knowledge-status`

Reports how many knowledge chunks are indexed in the RAG vector store.

### `POST /api/v1/ai/seed-knowledge`

Seeds/refreshes the RAG knowledge base from:
- Platform documentation
- KPI definitions
- Filter field catalog
- Module descriptions

### `GET /api/v1/ai/search?q=loyalty+points`

Semantic search over the knowledge base  --  returns top matching chunks.

---

### How RAG Works Internally

```
User query
    |
services/ai/ragService.js
    |
1. Embed query with text-embedding-3-large (3072 dims)
    |
2. Cosine similarity search over in-memory vector store
   (seeded from docs/ and lib/kpiRegistry.js etc.)
    |
3. Retrieve top-5 relevant chunks
    |
4. Build system prompt with tenant context + role
    |
5. Call GPT-4o with retrieved chunks as context
    |
6. Return answer + source attributions
```

---

## 17. Module: Personalization

**Base path:** `/api/v1/personalization`  
_(requires auth, requires `personalization` module or falls back to `cdp`)_

Delivers the **Next Best Offer** to fans based on their segment membership, loyalty balance, and profile traits.

### Offers

**`GET /api/v1/personalization/offers`**  --  list all offers

**`POST /api/v1/personalization/offers`**  --  create offer
```json
{
  "title": "Premium Members: 15% off jerseys",
  "description": "Exclusive for SA3cio Premium members",
  "offerType": "discount_percent",
  "value": 15,
  "segmentId": "64abc...",
  "segmentName": "Premium Members",
  "minPoints": 1000,
  "priority": 10,
  "validFrom": "2024-07-01T00:00:00Z",
  "validUntil": "2024-07-31T23:59:59Z"
}
```

**offerType values:**
| Type | Description |
|---|---|
| `discount_percent` | Percentage off (value = % e.g. 15) |
| `discount_fixed` | Fixed amount off in cents |
| `bundle` | Buy X get Y offer |
| `bonus_points` | Extra loyalty points |
| `free_shipping` | Free shipping on fan shop |
| `voucher` | Voucher code |

**`PUT /api/v1/personalization/offers/:id`**  --  update offer  
**`DELETE /api/v1/personalization/offers/:id`**  --  delete (sets status=archived)

---

### Next Best Offer Engine

**`GET /api/v1/personalization/next-best-offer?fanProfileId=64abc...`**

Evaluates all active offers in priority order:
1. Filters by `validFrom/validUntil` date range
2. Filters by `minPoints` balance requirement
3. Matches against fan's current segments
4. Returns the **first** offer whose segment matches the fan
5. Falls back to the first offer with no segment (global default)

Also supports lookup by email: `?email=fan@example.com` or `?fanProfileId=fan@example.com`.

```json
// Response
{
  "data": {
    "offer": {
      "id": "64...",
      "title": "Premium Members: 15% off jerseys",
      "offerType": "discount_percent",
      "value": 15
    },
    "matchedSegment": "Premium Members",
    "fanContext": {
      "balance": 1450,
      "segmentNames": ["Premium Members", "High Spenders"],
      "traits": { "address.city": "Curitiba" }
    },
    "fallback": false
  }
}
```

**`GET /api/v1/personalization/next-best-offers`**  --  V2 endpoint, returns top-3 offers with A/B variants and frequency capping. See [Personalization V2](#25-personalization-v2--top-n-offers--ab-testing).

**`POST /api/v1/personalization/offers/:id/convert`**  --  record a conversion on an offer impression.
```json
{ "fanProfileId": "64abc...", "revenueCents": 4500 }
```

**`GET /api/v1/personalization/offers/:id/ab-results`**  --  get A/B test aggregated results for an offer. See [Personalization V2](#25-personalization-v2--top-n-offers--ab-testing).

---

## 18. Module: Social Ingestion

**Base path:** `/api/v1/social`  
_(requireAuth)_

Ingests and aggregates social media metrics from Instagram, Twitter/X, and YouTube.

### Channels

**`GET /api/v1/social/channels`**  --  list connected channels  
**`POST /api/v1/social/channels`**  --  connect a channel
```json
{
  "source": "instagram",
  "channelHandle": "@coxabrancafc",
  "channelId": "17841400000000001",
  "displayName": "Coritiba Foot Ball Club"
}
```
`source`: `instagram | twitter | youtube`

**`DELETE /api/v1/social/channels/:id`**  --  disconnect channel (soft-delete)

---

### KPIs

**`GET /api/v1/social/kpis?preset=last_30_days`**

Returns aggregated social metrics:
```json
{
  "data": {
    "followers": 125000,
    "followersGrowth": 2.4,
    "engagementRate": 3.8,
    "totalPosts": 24,
    "totalImpressions": 1800000,
    "totalEngagements": 68000,
    "bySource": {
      "instagram": { "followers": 85000, "engagementRate": 4.2 },
      "twitter": { "followers": 30000, "engagementRate": 2.1 }
    }
  }
}
```

**Query params:** `from`, `to`, `preset`

---

### Manual Ingestion

**`POST /api/v1/social/ingest`**  --  trigger manual data pull for all connected channels

This calls each platform's API (using env var tokens) and upserts KPI snapshots into MongoDB.

---

## 19. Module: Analytics

### Club-Level Analytics

**Base path:** `/api/v1/club/analytics`  
_(requireAuth)_

| Endpoint | Description |
|---|---|
| `GET /retail` | Retail KPIs for the period |
| `GET /retail/top-products` | Top-selling products |
| `GET /retail/by-location` | Revenue per store location |
| `GET /fnb` | Food & beverage KPIs |
| `GET /fnb/top-products` | Top F&B items |
| `GET /ticketing` | Ticketing KPIs |
| `GET /membership` | Membership KPIs |
| `GET /loyalty` | Loyalty program KPIs |
| `GET /overview` | Cross-module dashboard overview |

**Query params (all):** `from`, `to`, `preset`  
**Preset values:** `today | yesterday | last_7_days | last_30_days | last_90_days | this_month | last_month | this_year`

---

### Meta / KPI Catalog

**Base path:** `/api/v1/meta`

**`GET /api/v1/meta/kpis`**  --  all KPIs in the registry
**Query params:** `department`, `tier` (`essential|advanced`), `industry`

```json
// Single KPI definition
{
  "key": "active_memberships",
  "label": "Active Memberships",
  "unit": "count",
  "format": "number",
  "tier": "essential",
  "department": "membership",
  "industry": ["football_club"],
  "description": "Members with active status.",
  "analysisHint": "Core subscriber base.",
  "defaultViz": "kpi_card"
}
```

**`GET /api/v1/meta/filter-fields`**  --  all filterable fields
**Query params:** `department`, `industry`

**`GET /api/v1/meta/industry-profiles`**  --  all industry profiles

**`GET /api/v1/meta/industry-profiles/:code`**  --  profile with KPIs + filter fields
```json
// industry_profiles/:code response
{
  "data": {
    "profile": { "code": "football_club", "label": "Professional Football Club" },
    "kpis": [ ... ],
    "filterFields": [ ... ]
  }
}
```

**Industry codes:** `football_club | basketball_club | concert_venue`

---

## 20. Module: Labels & Exports

### Labels

**Base path:** `/api/v1/labels`  
_(requireAuth)_

Labels are tags that can be applied to any entity (fan profiles, sales, campaigns, etc.).

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all labels |
| POST | `/` | Create label |
| PUT | `/:id` | Update label |
| DELETE | `/:id` | Delete label |
| GET | `/entity/:entityType/:entityId` | Labels on a specific entity |
| POST | `/entity/:entityType/:entityId` | Apply label to entity |
| DELETE | `/entity/:entityType/:entityId/:labelId` | Remove label from entity |
| POST | `/bulk-apply` | Apply label to multiple entities |

```json
// Create label
{ "name": "VIP", "color": "#gold", "category": "fan" }

// Apply label to entity
// POST /api/v1/labels/entity/fan_profile/64abc...
{ "labelId": "64def..." }

// Bulk apply
{
  "labelId": "64def...",
  "entityType": "fan_profile",
  "entityIds": ["64abc...", "64ghi..."]
}
```

Fans can be filtered by label using the `labels` field in Segment/Filter rules.

---

### Exports

**Base path:** `/api/v1/exports`  
_(requireAuth)_

**`POST /api/v1/exports/fans`**  --  export fan list as CSV

```json
{
  "rules": [
    { "field": "address.city", "operator": "eq", "value": "Curitiba" }
  ],
  "fields": ["fullName", "email", "phone", "membership.planCode"]
}
```

Returns a CSV file download with the matching fans and selected fields.


---

## 21. Module: MCP Server

**Entry point:** `backend/src/mcp/server.js`  
**Start:** `npm run start:mcp`

The **Model Context Protocol (MCP)** server exposes Coxa backend tools to AI agents  --  Cursor IDE, Claude Desktop, or any MCP-compatible client. This lets you query POS data, look up fans, process sales, and issue tickets directly from an AI chat interface.

### Transport modes

| Mode | Config | Usage |
|---|---|---|
| **stdio** (default) | No env needed | Cursor IDE / Claude Desktop |
| **HTTP/SSE** | `MCP_TRANSPORT=http MCP_PORT=3100` | Server-to-server agent integrations |

### Cursor IDE configuration (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "coxa-pos": {
      "command": "node",
      "args": ["/home/ubuntu/coxa-1touch/backend/src/mcp/server.js"],
      "env": {
        "MONGODB_URI": "...",
        "JWT_SECRET": "...",
        "DEFAULT_TENANT_ID": "coxa-club-001"
      }
    }
  }
}
```

### Available MCP Tools

All tools are defined in `backend/src/mcp/tools/pos.js`:

| Tool | Description |
|---|---|
| `lookup_fan` | Find a fan by email, CPF, or name |
| `get_fan_balance` | Get loyalty balance for a fan |
| `process_sale` | Create a POS sale transaction |
| `list_products` | List available products for a location |
| `get_sale` | Look up a specific sale by number |
| `issue_ticket` | Issue a ticket to a fan |
| `validate_entitlement` | Check if a QR token is valid at gate |
| `list_events` | List upcoming match events |
| `get_analytics_summary` | Get retail analytics summary |

### Example MCP interaction (from Cursor chat)

```
You: Look up fan joao@email.com and check their loyalty balance

MCP -> lookup_fan({ email: "joao@email.com" })
    <- { id: "64abc...", fullName: "Joao Silva", memberId: "MBR-001" }

MCP -> get_fan_balance({ fanProfileId: "64abc..." })
    <- { balance: 1450, tier: "silver" }
```

---

## 22. Module: Push Notifications

**Base path:** `/api/v1/push`

Handles Web Push (browser VAPID) and FCM (Firebase mobile) notifications. Device tokens are stored on the fan's profile (`pushTokens[]`).

**Required env vars:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` (web push) . `FIREBASE_SERVICE_ACCOUNT_JSON` (FCM)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vapid-key` | none | Returns VAPID public key + whether web push is enabled |
| POST | `/register` | fan token + X-Tenant-Id | Register a device push token |
| DELETE | `/token` | fan token + X-Tenant-Id | Remove a device push token |

### `GET /api/v1/push/vapid-key`

```json
{ "vapidPublicKey": "BFoo...", "enabled": true }
```

Returns `enabled: false` and `vapidPublicKey: null` when VAPID keys are not configured.

### `POST /api/v1/push/register`

```json
{
  "token": "{ \"endpoint\": \"https://...\", \"keys\": { \"auth\": \"...\", \"p256dh\": \"...\" } }",
  "type": "web",
  "userAgent": "Mozilla/5.0 ..."
}
```

`type` values: `web | android | ios`  
For web push, `token` is the JSON-serialised `PushSubscription` object.  
For FCM, `token` is the plain FCM registration token string.  
The service deduplicates -- registering an existing token replaces it instead of creating a second entry.

### `DELETE /api/v1/push/token`

```json
{ "token": "<token string to remove>" }
```

### Internal: `sendPushToFan()` / `sendCampaignPush()`

`pushService.js` exports two functions used by campaign dispatch:

```js
// single fan
await sendPushToFan({ fanProfileId, title, body, data: { campaignId }, url });
// -> { sent: N, failures: [...] }

// bulk campaign
await sendCampaignPush({ fanProfileIds: [...], title, body, url, campaignId });
// -> { totalSent: N }
```

---

## 23. Module: Fan Self-Service Profile

**Base path:** `/api/v1/fanprofile`

Fan-facing self-service endpoints. Fans can read/update their own profile and unsubscribe from marketing email.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | fan token + X-Tenant-Id | Get own fan profile |
| PATCH | `/me` | fan token + X-Tenant-Id | Update own fan profile (restricted fields) |
| POST | `/unsubscribe` | none | Email unsubscribe (called from email links) |

### `PATCH /api/v1/fanprofile/me`

Only these fields are writable by the fan themselves (others require staff via `/api/v1/fanbox/fans/:id`):

```json
{
  "fullName": "Joao Atualizado",
  "phone": "+5541999999999",
  "gender": "male",
  "birthDate": "1995-03-15",
  "address": { "street": "...", "city": "...", "state": "PR", "postalCode": "80000-000", "country": "BR" },
  "preferredSocialNetwork": "instagram"
}
```

### `POST /api/v1/fanprofile/unsubscribe` _(no auth)_

Called from the one-click unsubscribe link in campaign emails.

**Query params:** `?fan=<fanProfileId>&campaign=<campaignId>`

Sets `emailOptOut: true` and `emailOptOutAt: <now>`. Always returns 200.

---

## 24. Module: Activation / Multiwoven Sync

**Base path:** `/api/v1/activation`  
_(requireAuth)_

Proxies Multiwoven sync status so the fanbox-dashboard can show per-segment activation badges without direct browser access to Multiwoven's API.

**`GET /api/v1/activation/sync-status`**

```json
{
  "syncs": [
    {
      "segmentId": "High Spenders",
      "segmentName": "High Spenders",
      "status": "success",
      "lastSyncAt": "2024-07-16T02:30:00Z",
      "destinationCount": 1,
      "connectorName": "Meta Ads"
    }
  ],
  "source": "multiwoven"
}
```

`status` values: `success | failed | pending`

If Multiwoven is unreachable, returns `{ syncs: [], source: "multiwoven", error: "..." }` -- never throws a 5xx.

**Required env vars:** `MULTIWOVEN_HOST`, `MULTIWOVEN_API_KEY`

---

## 25. Personalization V2 -- Top-N Offers & A/B Testing

**Service:** `backend/src/services/personalizationServiceV2.js`

Upgrades over the V1 NBO engine with: top-3 offers, frequency capping, deterministic A/B variants, and ML propensity boosts.

### New Endpoints (added to `/api/v1/personalization`)

| Endpoint | Description |
|---|---|
| `GET /next-best-offers` | Top-3 offers with A/B variants + frequency capping |
| `POST /offers/:id/convert` | Record a fan conversion on an offer |
| `GET /offers/:id/ab-results` | Aggregate CTR + CVR per A/B variant |

### `GET /api/v1/personalization/next-best-offers`

```
GET /api/v1/personalization/next-best-offers?fanProfileId=64abc...&channel=fan_app&record=true
```

| Param | Default | Description |
|---|---|---|
| `fanProfileId` | required | Fan profile ID or email address |
| `email` | -- | Alternative lookup by email |
| `channel` | `fan_app` | Impression channel: `fan_app \| email \| push \| sms \| checkin_kiosk` |
| `record` | `true` | `false` to skip recording impressions (preview/debug) |

```json
{
  "data": {
    "offers": [
      {
        "offer": { "id": "64...", "title": "Premium 15% off jerseys", "offerType": "discount_percent", "value": 15 },
        "matchedSegment": "Premium Members",
        "fallback": false,
        "variant": "A",
        "impressionCount": 1
      }
    ],
    "fanContext": {
      "balance": 1450,
      "segmentNames": ["Premium Members", "High Spenders"],
      "mlScores": { "churnRiskScore": 0.12, "ticketPropensity": 0.74 }
    },
    "totalActive": 5
  }
}
```

### V2 Ranking Logic

1. **Date filter** -- `validFrom/validUntil`
2. **Points filter** -- `minPoints <= fan.balance`
3. **ML boost** -- effective priority adjusted by ML scores (ClickHouse -> MongoDB fallback):
   - `retailPropensity > 0.6` -> retail discount offers move up
   - `ticketPropensity > 0.6` -> ticket offers move up
   - `churnRiskScore > 0.7` -> retention offers move up
4. **Frequency cap** -- skip offers shown ? 3x in last 7 days
5. **Segment match** -- targeted > fallback
6. **Return top 3**, record `OfferImpression` per shown offer

### A/B Variant Assignment (deterministic)

```
SHA-256(fanProfileId + ":" + offerId) -> bucket -> "A" or "B" (50/50)
```

Same fan always gets the same variant for the same offer -- no DB lookup needed.

### `POST /api/v1/personalization/offers/:id/convert`

```json
{ "fanProfileId": "64abc...", "revenueCents": 4500 }
```

Updates the most recent un-converted `OfferImpression` for that fan+offer pair.

### `GET /api/v1/personalization/offers/:id/ab-results`

```json
{
  "data": [
    { "variant": "A", "impressions": 120, "clicks": 30, "conversions": 12, "revenueCents": 54000, "ctr": 0.25, "cvr": 0.10 },
    { "variant": "B", "impressions": 118, "clicks": 22, "conversions": 8,  "revenueCents": 36000, "ctr": 0.19, "cvr": 0.068 }
  ]
}
```

### OfferImpression Schema

| Field | Type | Description |
|---|---|---|
| `tenantId` | String | Tenant scope |
| `fanProfileId` | ObjectId | Fan who saw the offer |
| `offerId` | ObjectId | The offer shown |
| `variant` | String | `"A"` or `"B"` |
| `channel` | String | Surface where shown |
| `clicked` | Boolean | Fan clicked the offer |
| `converted` | Boolean | Fan completed conversion |
| `shownAt` | Date | When offer was displayed |
| `convertedAt` | Date | When conversion was recorded |
| `attributedRevenueCents` | Number | Revenue attributed to impression |

---

## 26. CDP: Tracardi Webhook Bridge

**Route:** `POST /api/v1/cdp/tracardi-bridge`  
**Service:** `backend/src/routes/cdp/tracardiWebhookBridge.js`

This bridge sits between RudderStack and Tracardi (customer journey engine). RudderStack delivers processed events here via its "Webhook" destination. The bridge validates the secret, translates events to Tracardi format, and forwards them fire-and-forget.

| Env Var | Default | Purpose |
|---|---|---|
| `TRACARDI_HOST` | `https://tracardi-api.service.coxa.live` | Tracardi API URL |
| `TRACARDI_SOURCE_ID` | `coxa-rudderstack-bridge` | Source ID in Tracardi |
| `TRACARDI_USERNAME` | `admin@coxa.live` | Auth username |
| `TRACARDI_PASSWORD` | `admin` | Auth password |

### Request

Accepts a single event or a batch:

```json
{ "batch": [ { "type": "track", "userId": "...", "event": "sale.completed", "properties": { ... } } ] }
```

### Event type mapping

| RudderStack `type` | Tracardi `eventType` |
|---|---|
| `identify` | `profile-update` |
| `page` | `page-visit` |
| `track` | Event name with `.`/`_` -> `-` (e.g. `sale-completed`) |

### Response

Always `200` -- ensures no events are lost in RudderStack's retry queue:

```json
{ "received": 3, "forwarded": 3 }
```

On startup, `ensureTracardiSource()` auto-creates the source in Tracardi if it doesn't exist (non-blocking).

---

## 27. ML Scoring Service

**Service:** `backend/src/services/mlScoringService.js`

Reads ML scores written nightly (02:00) by the **Dagster `ml_scoring_job`** to ClickHouse `coxa.fan_360`. Falls back to MongoDB `FanProfile` when ClickHouse is unavailable.

### ML Score Fields

| Field | Range | Description |
|---|---|---|
| `churnRiskScore` | 0?1 | Churn probability in next 30 days. `>= 0.7` = high risk |
| `ticketPropensity` | 0?1 | Likelihood to buy a ticket |
| `retailPropensity` | 0?1 | Likelihood to buy from fan shop |
| `nextBestChannel` | String | Best channel: `email \| sms \| push \| whatsapp` |
| `mlScoresUpdatedAt` | DateTime | Last Dagster scoring run |

### Functions

| Function | Description |
|---|---|
| `getFanMlScores(tenantId, fanProfileId)` | Single fan -- used by personalizationServiceV2 |
| `getBatchMlScores(tenantId, { limit, offset })` | Paginated tenant scores, ordered by `churnRiskScore DESC` |
| `getChurnRiskSummary(tenantId)` | Tenant-level summary for InsightsPage ML cards |
| `getChannelDistribution(tenantId)` | Fan count per recommended channel |

### `getChurnRiskSummary` response

```json
{
  "high_risk_fans": 142,
  "medium_risk_fans": 890,
  "low_risk_fans": 11418,
  "avg_churn_score": 0.18,
  "avg_ticket_propensity": 0.42,
  "avg_retail_propensity": 0.35,
  "last_scored_at": "2024-07-16T02:14:00Z"
}
```

---

## 28. Trait Calculator

**Service:** `backend/src/services/traitCalculator.js`

Real-time fan trait computation. `eventBus.js` calls `handleTraitUpdate(event)` after every `ingestEvent()`, so traits are updated immediately -- no waiting for the nightly Dagster batch.

### Traits updated per CDP event

| CDP Event | Traits Updated |
|---|---|
| `fan.registered` | Initializes all traits to 0/false: `fan_since`, `retail_purchase_count`, `total_retail_spend_cents`, `is_recent_buyer`, `is_inactive`, `ticket_purchase_count`, `match_attendance_count`, `consecutive_match_count`, `referral_count`, `campaign_count` |
| `sale.completed` | `retail_purchase_count` (+1), `total_retail_spend_cents` (+totalCents), `last_purchase_at`, `is_recent_buyer` |
| `membership.created/renewed/upgraded` | `membership_status`, `membership_plan`, `membership_since`, `membership_tenure_months` |
| `membership.cancelled` | `membership_status = cancelled` |
| `ticket.purchased` | `ticket_purchase_count` (+1), `last_ticket_at` |
| `member.checked_in` | `match_attendance_count` (+1), `last_checkin_at`, `consecutive_match_count` |
| `referral.confirmed` | `referral_count` (+1) |
| `campaign.participated` | `campaign_count` (+1) |

After every trait update, `refreshSegmentMemberCounts()` is called to keep CDP segment fan counts accurate.

### `FanTrait` schema

| Field | Description |
|---|---|
| `tenantId` | Tenant scope |
| `fanProfileId` | References FanProfile |
| `traitKey` | e.g. `retail_purchase_count`, `membership_status`, `is_recent_buyer` |
| `value` | Any JSON value (Number, String, Boolean, Date string) |
| `computedAt` | Last upsert timestamp |

Each `traitKey` has exactly one current value per fan (upserted, not appended).

---

## 29. Data Models Reference

### Complete Model List

| Model | Collection | Purpose |
|---|---|---|
| `User` | users | Staff and fan accounts |
| `Club` | clubs | Club/organization records |
| `ClubMembership` | clubmemberships | Staff-to-club relationship + role |
| `FanboxStaff` | fanboxstaffs | Fanbox-specific staff records |
| `TenantConfig` | tenantconfigs | Module flags + settings per club |
| `FanProfile` | fanprofiles | Core fan identity |
| `FanScore` | fanscores | Current fan score snapshot |
| `FanScoreHistory` | fanscorehistories | Score change log |
| `FanTrait` | fantraits | Computed traits (from Dagster) |
| `FanMembership` | fanmemberships | Fan subscription to a plan |
| `MembershipPlan` | membershipplans | Plan catalog |
| `MembershipTransaction` | membershiptransactions | Payment records |
| `LoyaltyRule` | loyaltyrules | Point earn/redeem rules |
| `LoyaltyReward` | loyaltyrewards | Redeemable rewards catalog |
| `LoyaltyLedgerEntry` | loyaltyledgerentries | Immutable point ledger |
| `Referral` | referrals | Referral records |
| `Product` | products | Retail products |
| `Sku` | skus | Stock keeping units (size/color variants) |
| `Category` | categories | Product categories |
| `Location` | locations | Stores/kiosks |
| `StockBalance` | stockbalances | Current stock per SKU per location |
| `StockLedgerEntry` | stockledgerentries | Stock movement audit |
| `StockLot` | stocklots | F&B batch lots |
| `StockTransfer` | stocktransfers | Inter-location transfers |
| `Sale` | sales | POS and fan shop transactions |
| `RetailReturn` | retailreturns | Return/refund records |
| `SaleLineQr` | salelineqrs | QR codes for sale line items |
| `MatchEvent` | matchevents | Football matches |
| `TicketProduct` | ticketproducts | Ticket categories per event |
| `Ticket` | tickets | Individual issued tickets |
| `TicketReservation` | ticketreservations | Seat reservations |
| `Entitlement` | entitlements | Access rights |
| `CheckInWindow` | checkinwindows | Member check-in time windows |
| `AttendanceRecord` | attendancerecords | Gate entry records |
| `Venue` | venues | Stadium/venue definitions |
| `Segment` | segments | CDP rule-based fan segments |
| `CdpEvent` | cdpevents | CDP event audit log |
| `SavedFilter` | savedfilters | Named fanbox filters |
| `FanboxCampaign` | fanboxcampaigns | Campaign records |
| `FanboxCampaignTemplate` | fanboxcampaigntemplates | Reusable templates |
| `DigitalProject` | digitalprojects | Surveys/polls/sweepstakes |
| `DigitalProjectResponse` | digitalprojectresponses | Fan responses |
| `ImportJob` | importjobs | Fan import job tracking |
| `Offer` | offers | Personalization offers |
| `Label` | labels | Entity tags |
| `RoleAssignment` | roleassignments | RBAC role assignments |
| `Social` | socialchannels | Connected social accounts |
| `CampaignParticipation` | campaignparticipations | Fan campaign interactions |

---

## 30. Error Codes Reference

All errors return JSON: `{ "code": "ERROR_CODE", "message": "Human description" }`

### Auth Errors (4xx)

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or invalid request parameters |
| `UNAUTHORIZED` | 401 | No auth token or header missing |
| `TOKEN_INVALID` | 401 | JWT is malformed or expired |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `ACCOUNT_INACTIVE` | 403 | User account is suspended/inactive |
| `NO_CLUB` | 403 | User has no active club membership |
| `MODULE_DISABLED` | 403 | Module not in tenant's enabledModules |
| `EMAIL_TAKEN` | 409 | Email address already registered |
| `FAN_PROFILE_NOT_FOUND` | 403 | No fan profile linked to account |

### Resource Errors

| Code | HTTP | Description |
|---|---|---|
| `NOT_FOUND` | 404 | Resource does not exist |
| `SALE_NOT_FOUND` | 404 | Sale ID not found |
| `FAN_NOT_FOUND` | 404 | Fan profile not found by email/ID |
| `INVALID_ID` | 400 | Invalid MongoDB ObjectId format (Mongoose CastError) |
| `DUPLICATE` | 409 | Duplicate key -- a record with these details already exists (Mongoose 11000) |
| `DUPLICATE_EVENT` | 200 | CDP event with same idempotency key already exists |
| `TENANT_REQUIRED` | 400 | X-Club-Id header missing |
| `STOCK_INSUFFICIENT` | 409 | Not enough stock to complete sale |
| `PLAN_NOT_FOUND` | 404 | Membership plan code does not exist |

### Server Errors

| Code | HTTP | Description |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 31. Demo Credentials & Seed Data

After running `npm run seed` and `npm run seed:demo`:

### Admin/Staff Login (Club Dashboard)

| Email | Password | Role |
|---|---|---|
| `admin@coxa.live` | `CoxaDemo123!` | owner |
| `harsh@coxa.live` | `CoxaDemo123!` | owner |
| `james@coxa.live` | `CoxaDemo123!` | owner |

### Fan Login (Fan Dashboard / Fan Auth)

| Email | Password | Notes |
|---|---|---|
| `fan001@demo.coxa.live` | `CoxaDemo123!` | Diamond tier, high spend |
| `fan002@demo.coxa.live` | `CoxaDemo123!` | Gold tier, socio-premium |
| `fan003@demo.coxa.live` | `CoxaDemo123!` | Silver tier |

### Fanbox Staff Login (Fanbox Dashboard)

| Email | Password | Role |
|---|---|---|
| `admin@coxa.live` | `CoxaDemo123!` | fanbox_admin |

### Tenant IDs

| Tenant | Club |
|---|---|
| `coxa-club-001` | Coritiba FC (primary demo) |

### Default Headers for Testing

```bash
# Staff API calls
curl -H "Authorization: Bearer <token>" \
     -H "X-Club-Id: <clubId>" \
     http://localhost:5000/api/v1/retail/sales

# Fan API calls
curl -H "Authorization: Bearer <fan-token>" \
     -H "X-Tenant-Id: coxa-club-001" \
     http://localhost:5000/api/v1/loyalty/me

# No-auth endpoints (fan shop, ticketing shop)
curl -H "X-Tenant-Id: coxa-club-001" \
     http://localhost:5000/api/v1/ticketing/shop/events
```

### Quick API Health Check

```bash
curl http://localhost:5000/api/health
# {"status":"ok"}
# Note: production strips all extra info (no stack/version/module leak)
```

### Live API Documentation

```
http://localhost:5000/api/docs        <- POS module (ReDoc)
http://localhost:5000/api/docs/full   <- All modules (ReDoc)
http://localhost:5000/api/openapi.json      <- POS OpenAPI 3.1 JSON
http://localhost:5000/api/openapi/full.json <- Full OpenAPI 3.1 JSON
```

---

*This guide was generated from source code analysis of `/home/ubuntu/coxa-1touch/backend/src` on 2026-07-16.*  
*v1.1 updated 2026-07-16 -- added Sections 22-28 covering Push Notifications, Fan Self-Service Profile, Activation/Multiwoven, Personalization V2, Tracardi Bridge, ML Scoring, and Trait Calculator.*  
*For infrastructure (RudderStack, PostHog, ClickHouse, Dagster, Cube), see `docs/EC2_E2E_TEST_REPORT.md`.*  
*For deployment, see `docs/AWS_DEPLOYMENT.md`.*

