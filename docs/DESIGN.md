# Coxa Fan OS — Design System

Single visual language for all four web apps: **club-auth**, **club-dashboard**, **fan-auth**, and **fan-dashboard**.

Implementation lives in **`packages/ui`** (`@coxa/ui`). Every app imports the same stylesheet:

```javascript
import "@coxa/ui/styles.css";
```

---

## 1. Design principles

| Principle | Rule |
|-----------|------|
| **One brand** | Black primary on clean light surfaces — same palette for club and fan apps |
| **Role, not color** | Club vs fan is communicated by copy and layout, not different palettes |
| **Light-first** | All apps use a light theme with white cards on a soft gray page background |
| **Accessible contrast** | Text `#111111` on `#ffffff`; primary actions black with white label text |
| **Shared components** | Auth cards, nav, tables, cards, alerts use the same CSS classes |

---

## 2. Color tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--coxa-primary` | `#111111` | Buttons, links, active nav, brand accent |
| `--coxa-primary-hover` | `#2d2d2d` | Button hover |
| `--coxa-primary-dim` | `#000000` | Sidebar active nav |
| `--coxa-primary-soft` | `rgba(17,17,17,0.06)` | Auth background tint |
| `--coxa-bg` | `#f5f6f8` | Page background |
| `--coxa-surface` | `#ffffff` | Cards, sidebar, topbar |
| `--coxa-surface-hover` | `#f0f1f3` | Nav hover |
| `--coxa-border` | `#e5e7eb` | Borders, inputs |
| `--coxa-text` | `#111111` | Primary text |
| `--coxa-text-muted` | `#6b7280` | Secondary text, labels |
| `--coxa-danger` | `#dc2626` | Errors, destructive |

---

## 3. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Body | DM Sans, Segoe UI, system-ui | 16px | 400 |
| H1 (page) | same | 1.6rem | 600 |
| H1 (auth) | same | 1.5rem | 600 |
| H3 (card) | same | 1rem | 600 |
| Brand pill | same | 0.75rem | 600, uppercase |
| Labels | same | 0.85rem | 400 |
| Code | Consolas | 0.875em | — |

Load in every app `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<meta name="theme-color" content="#ffffff" />
```

---

## 4. Spacing & radius

| Token | Value |
|-------|-------|
| `--coxa-space-2` | 0.5rem |
| `--coxa-space-4` | 1rem |
| `--coxa-space-6` | 1.5rem |
| `--coxa-space-8` | 2rem |
| `--coxa-radius` | 10px |
| `--coxa-radius-lg` | 14px (auth cards) |
| `--coxa-radius-full` | pill badges |

---

## 5. Layout patterns

### 5.1 Auth layout (club-auth, fan-auth)

```
┌─────────────────────────────────────┐
│         subtle gray radial tint      │
│    ┌───────────────────────┐        │
│    │ COXA CLUB / COXA FAN  │        │
│    │ Title                 │        │
│    │ subtitle              │        │
│    │ [email]               │        │
│    │ [password]            │        │
│    │ [ Sign in ]           │        │
│    │ footer links          │        │
│    └───────────────────────┘        │
└─────────────────────────────────────┘
```

**Classes:** `auth-layout`, `auth-card`, `brand--pill`, `auth-footer`

### 5.2 Sidebar dashboard (club-dashboard)

```
┌──────────┬────────────────────────────┐
│ Coxa Club│  Page header               │
│ Admin    │  subtitle                  │
│          │                            │
│ Overview │  [ stats | cards | table] │
│ Roles    │                            │
│ Users    │                            │
│ Settings │                            │
│          │                            │
│ Sign out │                            │
└──────────┴────────────────────────────┘
```

**Classes:** `shell shell--sidebar`, `sidebar`, `main`, `nav-link`, `page-header`

### 5.3 Topbar dashboard (fan-dashboard)

```
┌──────────────────────────────────────────────┐
│ Coxa Fan   Home  Tickets  Wallet  …  Sign out│
├──────────────────────────────────────────────┤
│              main--narrow content            │
└──────────────────────────────────────────────┘
```

**Classes:** `shell shell--topbar`, `topbar`, `topnav`, `main main--narrow`

---

## 6. Component catalog

| Component | Classes | Used in |
|-----------|---------|---------|
| Primary button | `.btn .btn--primary .btn--block` or `auth-card button` | Auth forms |
| Text input | `.input` or `auth-card input` | Auth forms |
| Card | `.card`, `.card--interactive` | Dashboards |
| Stat block | `.stats`, `.stat` | club-dashboard overview |
| Data table | `.table` | Users list |
| Tag / badge | `.tags span`, `.tag--primary` | Role cards |
| Alert | `.alert`, `.alert.error` | API errors |
| Empty state | `.empty` | Placeholder pages |
| Grid | `.grid` or `.cards` | Card layouts |

---

## 7. App mapping

| App | Layout | Brand label | Port |
|-----|--------|-------------|------|
| club-auth | Auth | `Coxa Club` | 5173 |
| club-dashboard | Sidebar | `Coxa Club` / Admin Dashboard | 5174 |
| fan-auth | Auth | `Coxa Fan` | 5175 |
| fan-dashboard | Topbar | `Coxa Fan` | 5176 |

Same colors and typography everywhere. Only layout shell and copy differ.

---

## 8. Adding UI to a new app

1. Add dependency in `package.json`:
   ```json
   "@coxa/ui": "file:../../packages/ui"
   ```
2. Import in `src/main.jsx`:
   ```javascript
   import "@coxa/ui/styles.css";
   ```
3. Copy font `<link>` tags into `index.html`.
4. Use documented classes — do not redefine colors in app-local CSS.
5. App-specific overrides go in `src/app.css` only when truly necessary.

---

## 9. Do / Don't

**Do**
- Use `@coxa/ui` tokens via CSS variables for any custom styles
- Reuse `page-header`, `card`, `grid`, `table`, `alert`
- Keep auth and dashboard layouts consistent with this doc

**Don't**
- Introduce a second accent color per app
- Duplicate token definitions in app `index.css`
- Use inline styles for colors or spacing

---

## 10. File reference

```
packages/ui/
├── package.json
└── src/
    ├── index.css       ← entry (import this)
    ├── tokens.css      ← CSS variables
    ├── base.css        ← reset, typography
    └── components.css  ← all shared components
```

---

*Design system v0.2 — light theme, black primary*
