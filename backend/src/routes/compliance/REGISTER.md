# Compliance Routes — Registration Instructions

Add the following lines to `backend/src/server.js`:

## Imports (add near the other route imports)

```js
import consentRouter from "./routes/compliance/consent.js";
import dsrRouter from "./routes/compliance/dsr.js";
```

## Route mounts (add after the existing routes, e.g. after the push router line)

```js
app.use("/api/v1/consent", requireAuth, consentRouter);
app.use("/api/v1/dsr", dsrRouter); // DSR submit is public (fans use it); admin endpoints have their own requireAuth inside
```

> **Note:** `requireAuth` is already imported in server.js. The consent router also calls
> `router.use(requireAuth)` internally, but the outer mount ensures the middleware is present
> even if the internal one is ever removed. The DSR router deliberately does NOT have a blanket
> `requireAuth` at mount level because `POST /submit` must remain publicly accessible by fans.
