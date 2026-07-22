# Email Channel — Registration Instructions

Add the following lines to `backend/src/server.js` to mount the email channel router.

## 1. Import

```js
import emailRouter from "./routes/channels/email.js";
```

## 2. Public webhook route (add BEFORE the requireAuth-guarded mount)

SNS pushes directly to this endpoint without a Bearer token, so it must be
registered as a standalone public route ahead of the auth-guarded prefix:

```js
app.post("/api/v1/channels/email/webhooks/ses", (req, res, next) => emailRouter(req, res, next));
```

## 3. Auth-guarded mount (add after the public webhook line, alongside other channel routers)

```js
app.use("/api/v1/channels/email", requireAuth, emailRouter);
```

> **Note:** Express matches routes in registration order.  The explicit
> `POST /api/v1/channels/email/webhooks/ses` line above is registered first,
> so SNS requests reach the router handler without hitting `requireAuth`.
> All other `/api/v1/channels/email/*` requests will go through `requireAuth`
> via the `app.use(...)` mount.
