# PAP-471 — Gap One Architect Plan

## Scope
Close **Gap One: outbound communication channels are not operationally complete** across:
- `apps/club-dashboard`
- `apps/fanbox-dashboard`
- `apps/fan-dashboard`
- `backend`

This phase is **plan only**. No code implementation in this document.

---

## 1) Repo stack and current state

### Stack
- **Frontend**: React 19 + Vite apps
  - `apps/club-dashboard`
  - `apps/fanbox-dashboard`
  - `apps/fan-dashboard`
- **Backend**: Express + Mongoose in `backend/src`
- **Persistence**: Mongo models already exist for campaigns, sends, consent, preferences, suppressions, DSR

### What already exists
#### Club dashboard
- Route already mounted: `/channels/email`
- UI exists: `apps/club-dashboard/src/pages/channels/EmailCampaignsPage.jsx`
- API client exists: `apps/club-dashboard/src/lib/api.js` (`emailApi`)
- Backend route exists: `backend/src/routes/channels/email.js`

#### FanBox
- Campaign pages already exist:
  - `apps/fanbox-dashboard/src/pages/campaigns/CampaignsPage.jsx`
  - `apps/fanbox-dashboard/src/pages/campaigns/CampaignWizardPage.jsx`
  - `apps/fanbox-dashboard/src/pages/campaigns/TemplatesPage.jsx`
- Backend route exists: `backend/src/routes/fanbox/campaigns.js`
- Service exists: `backend/src/services/fanboxCampaignService.js`

#### Channel orchestration / compliance foundations
- Universal router exists: `backend/src/services/messageRouter.js`
- Push service exists: `backend/src/services/pushService.js`
- Consent routes exist: `backend/src/routes/compliance/consent.js`
- DSR routes exist: `backend/src/routes/compliance/dsr.js`
- Channel preference model exists: `backend/src/models/FanChannelPreference.js`
- Suppression model exists: `backend/src/models/ChannelSuppression.js`
- Email send model exists: `backend/src/models/EmailSend.js`

### Main gaps found in code
1. **Club email create flow is mismatched**
   - UI posts `subjectLine` + `segmentId`
   - backend expects `templateId`, `audienceSegmentId`, sender fields, etc.
   - result: club email page is structurally incomplete

2. **FanBox campaign sending is not truly omnichannel**
   - `sendCampaign()` handles only:
     - `email`
     - `push`
   - `sms` is stubbed
   - `whatsapp` appears in UI/data model but has no dispatcher

3. **Campaign data model is inconsistent**
   - `FanboxCampaign` has both `type` and `channel`
   - service reads `campaign.channel ?? "email"`
   - UI mostly writes `type`
   - this will silently mis-route campaigns

4. **Fan app preferences/consents are still local-only**
   - `apps/fan-dashboard/src/pages/ConsentPage.jsx`
   - `apps/fan-dashboard/src/pages/ProfileEditPage.jsx`
   - `apps/fan-dashboard/src/pages/SettingsPage.jsx`
   - these write to `localStorage`, not backend consent/preference APIs

5. **Push infrastructure exists server-side but is not connected end-to-end in fan UI**
   - backend exposes `/api/v1/push/vapid-key`, `/register`, `/token`
   - no clear fan-dashboard integration for browser subscription lifecycle

6. **Universal router is only partially implemented**
   - cascade logic exists
   - only `email` dispatch branch is implemented in `messageRouter.js`
   - `push`, `sms`, `whatsapp`, `in_app` fall through as unimplemented

7. **Operational analytics are incomplete**
   - club email stats are based on campaign `stats`
   - fanbox metrics use ad-hoc `metrics.deliveredCount/openCount/...`
   - no unified send ledger or campaign outcome normalization across products

---

## 2) Goal for Gap One
Ship a **single operational communications layer** that lets Coxa:
- capture and persist channel consent + preferences
- register push devices
- create/send campaigns from Club and FanBox
- route transactional/system/marketing messages through a single backend policy layer
- support at least **Email + Push** end-to-end in production-grade flow
- leave **SMS + WhatsApp** behind stable interfaces so they can be plugged in next without UI rewrites

---

## 3) Delivery strategy

## Phase A — Normalize the backend contract first
**Why first:** current frontends are already built, but they target inconsistent payloads and fields.

### A1. Normalize campaign model usage
Target files:
- `backend/src/models/FanboxCampaign.js`
- `backend/src/services/fanboxCampaignService.js`
- `backend/src/routes/fanbox/campaigns.js`
- `apps/fanbox-dashboard/src/lib/api.js`
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignWizardPage.jsx`
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignsPage.jsx`

Plan:
- declare **`type` as the canonical channel field** for FanBox campaigns
- either remove `channel` from runtime usage or keep it as a derived/back-compat alias only
- update service send path to branch on `campaign.type`
- ensure campaign list/detail payloads return consistent `type`, `status`, `metrics`

Definition of done:
- no send path depends on `campaign.channel`
- UI create/edit/list pages use the same field name the backend sends

### A2. Standardize club email campaign payloads
Target files:
- `apps/club-dashboard/src/pages/channels/EmailCampaignsPage.jsx`
- `apps/club-dashboard/src/lib/api.js`
- `backend/src/routes/channels/email.js`
- `backend/src/models/EmailCampaign.js`

Plan:
- align club email creation form to backend fields:
  - `name`
  - `templateId`
  - `audienceSegmentId`
  - `scheduledAt`
  - `senderName`
  - `senderEmail`
  - `replyTo`
- decide whether `subjectLine` belongs in template or campaign override
- if override is needed, explicitly add it to model + route; otherwise remove it from UI

Definition of done:
- club dashboard can create a valid email campaign without field loss or ignored inputs

### A3. Unify campaign metrics shape
Target files:
- `backend/src/models/EmailCampaign.js`
- `backend/src/models/FanboxCampaign.js`
- `backend/src/services/fanboxCampaignService.js`
- `backend/src/routes/channels/email.js`

Plan:
- standardize on a single metrics contract:
  - `recipientCount`
  - `sentCount`
  - `deliveredCount`
  - `openCount`
  - `clickCount`
  - `bounceCount`
  - `complaintCount`
  - `unsubscribeCount`
  - `sentAt`
- adapt club/fanbox pages to render from this shape

Definition of done:
- both dashboards read metrics from the same keys

---

## Phase B — Make Email + Push truly operational

### B1. Harden email sending path
Target files:
- `backend/src/services/emailService.js`
- `backend/src/routes/channels/email.js`
- `backend/src/models/EmailSend.js`

Plan:
- keep SES as primary provider path
- keep graceful no-config behavior in non-prod, but make production failure explicit
- persist one `EmailSend` record per outbound campaign recipient, not just transactional sends or queued stubs
- ensure webhook reconciliation updates send records and campaign aggregates
- update campaign status flow:
  - `draft -> approved -> scheduled/sending -> sent`

Definition of done:
- campaign send creates durable send records and usable stats

### B2. Complete push delivery flow
Target files:
- `backend/src/services/pushService.js`
- `backend/src/routes/push/index.js`
- `apps/fan-dashboard/src/lib/api.js`
- `apps/fan-dashboard/src/pages/SettingsPage.jsx`
- potentially new fan app utility/component for browser push subscription

Plan:
- add fan-dashboard API client methods for:
  - `GET /api/v1/push/vapid-key`
  - `POST /api/v1/push/register`
  - `DELETE /api/v1/push/token`
- add browser subscription lifecycle:
  - permission prompt
  - subscribe/unsubscribe
  - token persistence
  - device state re-sync on login/session restore
- connect push toggle in Settings to real registration state instead of localStorage only

Definition of done:
- fan can opt into browser push and backend can send to registered devices

### B3. Finish universal message routing for email + push
Target files:
- `backend/src/services/messageRouter.js`
- `backend/src/routes/channels/router.js`

Plan:
- implement `push` dispatch branch using `sendPushToFan`
- keep `email` branch as-is but route through normalized templates/payloads
- return explicit reasons for skip/fallback decisions:
  - no consent
  - suppressed
  - quiet hours
  - no configured device/email
  - frequency capped

Definition of done:
- router can successfully deliver `system`, `transactional`, and selected `marketing` intents to either email or push

---

## Phase C — Persist real fan consent and preference state

### C1. Replace localStorage-only consent with API-backed consent
Target files:
- `apps/fan-dashboard/src/pages/ConsentPage.jsx`
- `apps/fan-dashboard/src/pages/ProfileEditPage.jsx`
- `apps/fan-dashboard/src/lib/api.js`
- `backend/src/routes/compliance/consent.js`

Plan:
- add fan-dashboard API client for:
  - fetch latest consent records for current fan
  - create/update consent records
  - revoke purpose consent
- map UI purposes to backend enum keys exactly:
  - `email_marketing`
  - `sms`
  - `whatsapp`
  - `push_notifications`
  - `analytics`
  - `personalization`
  - `third_party_sharing`
- keep legitimate-interest purposes display-only
- remove localStorage as source of truth; at most keep optimistic cache

Definition of done:
- consent page reads/writes real `ConsentRecord`s

### C2. Persist fan channel preferences and quiet-hours-related settings
Target files:
- `apps/fan-dashboard/src/pages/SettingsPage.jsx`
- `apps/fan-dashboard/src/lib/api.js`
- `backend/src/routes/channels/router.js`
- optionally backend model/service for per-fan DND if current `QuietHoursConfig` stays tenant-level only

Plan:
- wire fan-facing notification settings to `FanChannelPreference`
- map toggles to:
  - channel enabled flags
  - category-level opt-ins where meaningful
- decide scope for DND:
  - if per-tenant only: relabel UI to avoid false promise
  - if per-fan needed: extend backend schema deliberately instead of storing locally

Definition of done:
- fan settings survive sessions/devices and affect routing behavior

---

## Phase D — Close the product-surface gaps

### D1. Club dashboard
Pages/components:
- `apps/club-dashboard/src/pages/channels/EmailCampaignsPage.jsx`
- nav/layout if channel menu needs surfacing

Plan:
- make club email page fully functional
- show template, audience, approval status, send state, stats
- add sender config fields or read them from tenant config if centralized

### D2. FanBox dashboard
Pages/components:
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignsPage.jsx`
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignWizardPage.jsx`
- `apps/fanbox-dashboard/src/pages/campaigns/TemplatesPage.jsx`

Plan:
- keep FanBox as the broader multi-channel marketing surface
- constrain currently-shippable channels in UI to those actually wired:
  - `email`
  - `push`
- show `sms` and `whatsapp` as disabled/coming soon unless backend dispatch lands in same ticket
- remove fake/randomized stats in details panel and use backend metrics only

### D3. Fan portal
Pages/components:
- `apps/fan-dashboard/src/pages/ConsentPage.jsx`
- `apps/fan-dashboard/src/pages/SettingsPage.jsx`
- `apps/fan-dashboard/src/pages/ProfilePage.jsx`
- `apps/fan-dashboard/src/pages/NotificationsPage.jsx`

Plan:
- replace placeholders with live consent/preference state
- update Profile “Consent & preferences” section from placeholder copy to real summary cards
- keep Notifications page if needed as read-only mocked inbox only if honest labeling is added; otherwise defer

---

## 4) SMS / WhatsApp plan boundary
These channels should **not** block Gap One if providers are absent.

### For this ticket
- define provider interfaces and route branches
- keep campaign/channel enum support
- gate UI actions or label as unavailable until provider config exists

### Suggested future adapter points
- `backend/src/services/smsService.js`
- `backend/src/services/whatsappService.js`
- dispatch integration inside `messageRouter.js`
- fanbox campaign send branch additions in `fanboxCampaignService.js`

This lets the Grunt ship a real Email + Push milestone without pretending SMS/WhatsApp are production-ready.

---

## 5) Recommended implementation order for Grunt
1. **Backend contract normalization**
   - FanBox `type/channel` cleanup
   - club email payload alignment
   - metrics normalization
2. **Email operational path**
   - send ledger + stats aggregation
3. **Push operational path**
   - fan-browser registration + backend dispatch
4. **Universal router completion for email/push**
5. **Fan consent/preferences API integration**
6. **Dashboard cleanup to reflect true channel availability**

This order minimizes UI churn and prevents frontend work against unstable contracts.

---

## 6) Risks / edge cases
- **Hidden field drift** between club email model and page form
- **Mixed auth contexts**:
  - club dashboard uses `coxa_token` + `X-Club-Id`
  - fanbox uses `fanbox_token` + `X-Club-Id`
  - fan portal auth may need dedicated current-fan endpoints for consent/preferences
- **Consent semantics** currently fail-open in parts of `messageRouter.js`; must be reviewed before production hardening
- **Push token identity** currently depends on locating `FanProfile` via authenticated user + tenant
- **Campaign status truthfulness** is weak if provider send outcome is not persisted consistently
- **UI promises exceed backend reality** on FanBox (`sms`, `whatsapp`) and fan portal (`consent`/`notifications` local-only)

---

## 7) Test plan for Pedant
### Backend
- create/send club email campaign end-to-end
- create/send fanbox email campaign end-to-end
- create/send fanbox push campaign with registered browser token
- router send cases:
  - email allowed
  - push fallback when no email
  - blocked by consent
  - blocked by suppression
  - blocked by quiet hours
  - blocked by frequency cap

### Frontend
- fan consent toggles persist across refresh/login
- fan notification toggles affect backend preference records
- push enable/disable registers and removes token
- club email page no longer drops fields
- fanbox campaign detail metrics are real, not synthetic

---

## 8) Concrete artifact list for implementation handoff
### Backend
- `backend/src/services/fanboxCampaignService.js`
- `backend/src/services/emailService.js`
- `backend/src/services/pushService.js`
- `backend/src/services/messageRouter.js`
- `backend/src/routes/fanbox/campaigns.js`
- `backend/src/routes/channels/email.js`
- `backend/src/routes/channels/router.js`
- `backend/src/routes/compliance/consent.js`
- `backend/src/models/FanboxCampaign.js`
- `backend/src/models/EmailCampaign.js`
- `backend/src/models/EmailSend.js`

### Frontend
- `apps/club-dashboard/src/pages/channels/EmailCampaignsPage.jsx`
- `apps/club-dashboard/src/lib/api.js`
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignsPage.jsx`
- `apps/fanbox-dashboard/src/pages/campaigns/CampaignWizardPage.jsx`
- `apps/fanbox-dashboard/src/lib/api.js`
- `apps/fan-dashboard/src/pages/ConsentPage.jsx`
- `apps/fan-dashboard/src/pages/SettingsPage.jsx`
- `apps/fan-dashboard/src/pages/ProfilePage.jsx`
- `apps/fan-dashboard/src/lib/api.js`

---

## 9) Handoff summary
- The repo is **not starting from zero**; it already contains partial comms/compliance infrastructure.
- The real work is to **normalize the contract, complete Email + Push, and connect fan consent/preferences to the backend**.
- Do **not** try to fully ship SMS/WhatsApp in the same pass unless provider adapters are already available.
- Prioritize **truthful product behavior over placeholder breadth**.
