# Coxa

Coxa is a multi-surface football club platform with separate experiences for club operators, fans, and FanBox marketing teams.

## Surfaces

- `apps/club-dashboard` — club operations and admin workflows
- `apps/fan-dashboard` — fan-facing web/mobile-style portal
- `apps/fanbox-dashboard` — B2B marketing and audience tooling
- `backend` — shared API and service layer

## PAP-471 — Gap One documentation snapshot

This repository currently includes a PAP-471 implementation commit:

- `feat(pap-471): add missing fan portal route pages`

What was built in that implementation:

- wired the missing fan-dashboard routes into `apps/fan-dashboard/src/App.jsx`
- added shared markdown-friendly route scaffolding via `SharedInfoPage.jsx`
- added non-blank pages for these fan portal routes:
  - `/videos`
  - `/votes`
  - `/friends`
  - `/support`
  - `/help`
  - `/faq`
  - `/language`

## What Gap One ships in this branch

This branch improves fan-portal completeness by replacing several blank/dead-end routes with real informational screens and navigation back into existing product flows.

Included screens provide:

- a consistent shared layout for informational fan pages
- feature-oriented copy for media, participation, support, and settings areas
- quick actions linking users back to active routes such as community, referrals, settings, polls, consent, and news
- page-title coverage and analytics-friendly route naming through the main app router

## Setup

### Install dependencies

```bash
npm install
```

If the workspace uses a different package manager in your environment, use the repo-standard installer already configured by your team.

## Run locally

Because this monorepo contains multiple apps, run the surface you need from the repo root.

Typical targets:

```bash
# fan portal
npm run dev --workspace apps/fan-dashboard

# club dashboard
npm run dev --workspace apps/club-dashboard

# fanbox dashboard
npm run dev --workspace apps/fanbox-dashboard

# backend
npm run dev --workspace backend
```

If your local scripts differ, inspect the workspace package scripts and use the matching dev command for the target app.

## Focus for reviewers / deployers

For PAP-471, verify that the fan dashboard no longer drops users onto blank pages for the documented routes above, and that each new page links back into a working flow.

## Notes

- This documentation reflects the implementation that is already present in the repository.
- No source-code behavior is introduced by this README update; it exists to support automated PR review and release handoff.
