# Registering the Channel Router

Add the following to your main `app.js` / `server.js` entry point:

```js
// Add import:
import channelRouterRouter from "./routes/channels/router.js";

// Add mount (after requireAuth middleware is set up):
app.use("/api/v1/channels/router", requireAuth, channelRouterRouter);
```

## Available endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/channels/router/send` | Route a message to the best available channel |
| `GET`  | `/api/v1/channels/router/preferences/:fanId` | Get fan's channel preferences |
| `PUT`  | `/api/v1/channels/router/preferences/:fanId` | Update fan's channel preferences |
| `GET`  | `/api/v1/channels/router/intents` | List recent MessageIntents (last 100) |

## Request body — POST /send

```json
{
  "fanId": "<ObjectId>",
  "intent": "nbo.offer_assigned",
  "category": "marketing",
  "payload": {
    "title": "Exclusive offer for you",
    "body": "Get 20% off your next jersey purchase",
    "templateSlug": "offer_assigned",
    "tokens": { "fan.fullName": "João", "offer.title": "20% off jersey" }
  },
  "preferredChannel": "email"
}
```

## Categories and cascade order

| Category | Default cascade |
|----------|----------------|
| `marketing` | whatsapp → email → push → sms → in_app |
| `transactional` | email → whatsapp → push → sms |
| `matchday_critical` | push → whatsapp → email → sms |
| `system` | in_app → push → email |
