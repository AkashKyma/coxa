# Loyalty Tiers Route — Mount Instructions

The tiers sub-router is mounted automatically inside `backend/src/routes/loyalty/index.js`
at the `/tiers` sub-path, making the full API paths:

| Method | Path                      | Description               |
|--------|---------------------------|---------------------------|
| GET    | `/api/v1/loyalty/tiers`   | Return tier configuration |
| PUT    | `/api/v1/loyalty/tiers`   | Save tier configuration   |

## How it is registered

In `backend/src/routes/loyalty/index.js`:

```js
import tiersRouter from "./tiers.js";
// ...
router.use("/tiers", tiersRouter);
```

`loyaltyRouter` is already mounted in `backend/src/server.js`:

```js
import loyaltyRouter from "./routes/loyalty/index.js";
// ...
app.use("/api/v1/loyalty", requireAuth, loyaltyRouter);
```

No changes to `server.js` are required.

## Data Model

`TierConfig` (MongoDB collection: `tierconfigs`):
- `tenantId` — unique per tenant
- `tiers[]` — array of `{ name, minPoints, maxPoints, color, benefits[] }`

Default tiers (Bronze, Prata, Ouro) are returned when no config exists for the tenant.
