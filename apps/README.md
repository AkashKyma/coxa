# Web applications

Four primary React (Vite) frontends — **one shared design system** (`@coxa/ui`, see [docs/DESIGN.md](../docs/DESIGN.md)).

| App | Folder | Port | Purpose |
|-----|--------|------|---------|
| **club-auth** | `club-auth/` | 5173 | Staff login and account access |
| **club-dashboard** | `club-dashboard/` | 5174 | Club admin — roles, users, settings |
| **fan-auth** | `fan-auth/` | 5175 | Fan login and signup |
| **fan-dashboard** | `fan-dashboard/` | 5176 | Fan self-service — tickets, wallet, rewards |
| **fanbox-dashboard** | `fanbox-dashboard/` | 5178 | FanBox parity — intelligence, campaigns, analytics |

## Run

From repo root:

```bash
npm install
npm run dev              # API + all web apps
npm run dev:fanbox-dashboard
npm run dev:club-auth    # single app
```

FanBox is a backend module at `/api/v1/fanbox` (same server as retail, CDP). See [backend/FANBOX_CLUSTER.md](../backend/FANBOX_CLUSTER.md).

## Legacy scaffolds

Other folders (`admin-console`, `fan-app`, `pos-app`, etc.) are placeholders for future surfaces.
