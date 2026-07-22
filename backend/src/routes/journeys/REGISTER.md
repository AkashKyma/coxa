# Journey Routes — Registration

Add the following to `backend/src/server.js` after the push router line:

```js
import journeyRouter from "./routes/journeys/index.js";
// ... (add after pushRouter import)
app.use("/api/v1/journeys", requireAuth, journeyRouter);
```

Add the import near the top with the other router imports:
```js
import journeyRouter from "./routes/journeys/index.js";
```

Add the mount after the push router line (around line 160):
```js
app.use("/api/v1/journeys", requireAuth, journeyRouter);
```
