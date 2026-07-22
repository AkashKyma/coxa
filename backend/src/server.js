import cluster from "node:cluster";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { load as loadYaml } from "js-yaml";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { requestContext } from "./middleware/requestContext.js";
import { resolveTenantContext } from "./middleware/resolveTenantContext.js";
import { optionalAuth } from "./middleware/optionalAuth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import authRouter from "./routes/auth.js";
import rolesRouter from "./routes/roles.js";
import assignmentsRouter from "./routes/assignments.js";
import usersRouter from "./routes/users.js";
import clubsRouter from "./routes/clubs.js";
import retailRouter from "./routes/retail/index.js";
import cdpRouter from "./routes/cdp/index.js";
import loyaltyRouter from "./routes/loyalty/index.js";
import personalizationRouter from "./routes/personalization/index.js";
import ticketingRouter from "./routes/ticketing/index.js";
import membershipRouter from "./routes/membership/index.js";
import membershipReferralsRouter from "./routes/membership/referrals.js";
import fanboxRouter from "./routes/fanbox/index.js";
import metaRouter from "./routes/meta.js";
import socialRouter from "./routes/social.js";
import aiRouter from "./routes/ai.js";
import exportsRouter from "./routes/exports.js";
import labelsRouter from "./routes/labels.js";
import clubAnalyticsRouter from "./routes/club/analytics.js";
import activationRouter from "./routes/activation/index.js";
import fanProfileRouter from "./routes/fanprofile/index.js";
import pushRouter from "./routes/push/index.js";
import consentRouter from "./routes/compliance/consent.js";
import dsrRouter from "./routes/compliance/dsr.js";
import emailRouter from "./routes/channels/email.js";
import channelRouterRouter from "./routes/channels/router.js";
import journeyRouter from "./routes/journeys/index.js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5000);

// Remove framework fingerprint header
app.disable("x-powered-by");

/* ── Health check — MUST be before CORS so ALB probes never get blocked ── */
app.get("/api/health", (_req, res) => {
  // Minimal payload — do not leak stack, versions, or module list to public
  res.json({ status: "ok" });
});

const allowedOrigins = [
  process.env.CLUB_AUTH_URL ?? "http://localhost:5173",
  process.env.CLUB_DASHBOARD_URL ?? "http://localhost:5174",
  process.env.FAN_AUTH_URL ?? "http://localhost:5175",
  process.env.FAN_DASHBOARD_URL ?? "http://localhost:5176",
  process.env.FANBOX_DASHBOARD_URL ?? "http://localhost:5178", 
  process.env.POS_APP_URL ?? "http://localhost:5177",
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no Origin header) and whitelisted browser origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Silently reject unknown origins — avoids noisy error logs from ALB probes
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(requestContext);
app.use(optionalAuth);
app.use(resolveTenantContext);

/* ── API Docs (OpenAPI 3.1 + ReDoc) ─────────────── */
let _spec = null;
let _posSpec = null;

function loadSpec(filename) {
  try {
    const specPath = join(__dirname, "openapi", filename);
    return loadYaml(readFileSync(specPath, "utf8"));
  } catch {
    return { openapi: "3.1.0", info: { title: "Coxa API", version: "0.2.0" }, paths: {} };
  }
}

function getPosSpec() {
  if (!_posSpec) _posSpec = loadSpec("openapi-pos.yaml");
  return _posSpec;
}

function getFullSpec() {
  if (!_spec) _spec = loadSpec("openapi.yaml");
  return _spec;
}

function redocHtml(specUrl, title) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url='${specUrl}'
           expand-responses="200,201"
           hide-download-button="false"
           theme='{"colors":{"primary":{"main":"#16a34a"}},"typography":{"fontSize":"15px","fontFamily":"Roboto, sans-serif","headings":{"fontFamily":"Montserrat, sans-serif"}}}'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}

// POS integration docs — gated behind auth (internal use only)
app.get("/api/openapi.json", requireAuth, (_req, res) => res.json(getPosSpec()));
app.get("/api/docs", requireAuth, (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(redocHtml("/api/openapi.json", "Coxa POS API — Documentation"));
});

// Full internal spec (all modules) — gated behind auth
app.get("/api/openapi/full.json", requireAuth, (_req, res) => res.json(getFullSpec()));
app.get("/api/docs/full", requireAuth, (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(redocHtml("/api/openapi/full.json", "Coxa Fan OS API — Full Documentation"));
});

app.use("/api/v1/auth", authRouter);

/* ── Protected / module routes ─────────────────── */
app.use("/api/v1/roles", rolesRouter);
app.use("/api/v1/clubs", clubsRouter);
app.use("/api/v1/assignments", requireAuth, assignmentsRouter);
app.use("/api/v1/users", requireAuth, usersRouter);
app.use("/api/v1/retail", requireAuth, retailRouter);
app.use("/api/v1/cdp", requireAuth, cdpRouter);
app.use("/api/v1/loyalty", requireAuth, loyaltyRouter);
app.use("/api/v1/personalization", requireAuth, personalizationRouter);
app.use("/api/v1/ticketing", requireAuth, ticketingRouter);
app.use("/api/v1/membership", requireAuth, membershipRouter);
app.use("/api/v1/membership/referrals", requireAuth, membershipReferralsRouter);
app.use("/api/v1/fanbox", fanboxRouter);
app.use("/api/v1/meta", metaRouter);
app.use("/api/v1/social", socialRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/exports", exportsRouter);
app.use("/api/v1/labels", labelsRouter);
app.use("/api/v1/club/analytics", clubAnalyticsRouter);
app.use("/api/v1/activation", activationRouter);
app.use("/api/v1/fanprofile", fanProfileRouter);
app.use("/api/v1/push", pushRouter);

/* ── Journeys ─────────────────────────────────────────────────────────── */
app.use("/api/v1/journeys", requireAuth, journeyRouter);

/* ── Compliance (LGPD) ───────────────────────────────── */
app.use("/api/v1/consent", requireAuth, consentRouter);
app.use("/api/v1/dsr", dsrRouter); // POST /submit is public; admin sub-routes guard themselves

/* ── Channels ────────────────────────────────────────── */
// SES webhook must be registered public BEFORE the requireAuth-guarded email mount
app.post("/api/v1/channels/email/webhooks/ses", (req, res, next) => emailRouter(req, res, next));
app.use("/api/v1/channels/email", requireAuth, emailRouter);
app.use("/api/v1/channels/router", requireAuth, channelRouterRouter);

/* ── Admin seed endpoint (dev only) ─────────────────── */
if (process.env.NODE_ENV !== "production") {
  app.post("/api/v1/admin/seed-demo", async (req, res, next) => {
    try {
      const { runSeedDemo } = await import("./scripts/seedDemo.js");
      const result = await runSeedDemo();
      res.json({ ok: true, result });
    } catch (err) { next(err); }
  });
}

/* ── Error handler ───────────────────────────────── */
app.use((err, _req, res, _next) => {
  // Mongoose validation errors: return a generic message — don't leak field names
  if (err.name === "ValidationError") {
    console.error("[Validation]", err.message);
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid request data" });
  }
  // Mongoose CastError (invalid ObjectId etc)
  if (err.name === "CastError") {
    return res.status(400).json({ code: "INVALID_ID", message: "Invalid identifier format" });
  }
  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({ code: "DUPLICATE", message: "A record with these details already exists" });
  }
  console.error(err);
  res.status(err.status ?? 500).json({
    code: err.code ?? "INTERNAL_ERROR",
    message: err.status ? err.message : "Internal server error",
  });
});

async function ensureFanboxModuleEnabled() {
  const { TenantConfig } = await import("./models/TenantConfig.js");
  const tenantId = process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
  const config = await TenantConfig.findOne({ tenantId });
  if (!config) return;
  if (!config.enabledModules.includes("fanbox")) {
    config.enabledModules = [...new Set([...config.enabledModules, "fanbox"])];
    await config.save();
    console.log(`[fanbox] enabled module for tenant ${tenantId}`);
  }
}

async function start() {
  await connectDB();
  await ensureFanboxModuleEnabled();

  // WS10: ensure analytics aggregation indexes exist
  const { ensureAllIndexes } = await import("./lib/ensureIndexes.js");
  await ensureAllIndexes();

  const server = app.listen(port, () => {
    const role = cluster.isWorker ? `worker#${cluster.worker.id} pid=${process.pid}` : `pid=${process.pid}`;
    console.log(`[coxa-backend] ${role} listening on http://localhost:${port}`);
    if (!cluster.isWorker) console.log(`[coxa-backend] API docs → http://localhost:${port}/api/docs`);
  });

  // ── CDP connection checks (non-blocking, purely informational) ──────────
  if (!cluster.isWorker) {
    import("./services/cdp/index.js").then(async ({ probeRudderConnection, probePostHogConnection }) => {
      const [rs, ph] = await Promise.all([probeRudderConnection(), probePostHogConnection()]);
      const cdpOk = rs.ok && ph.ok;
      console.log(
        `[cdp] startup probe — rudderstack=${rs.ok ? "✓" : "✗"}  posthog=${ph.ok ? "✓" : "✗"}  ${cdpOk ? "CDP fully operational" : "CDP degraded — events fall back to MongoDB"}`
      );
    }).catch((err) => {
      console.warn("[cdp] startup probe failed:", err?.message);
    });

    // Ensure Tracardi source exists for the RudderStack bridge
    import("./routes/cdp/tracardiWebhookBridge.js").then(({ ensureTracardiSource }) => {
      ensureTracardiSource();
    }).catch(() => {});
  }

  // Tune keep-alive so connections stay warm between the ALB / nginx and node.
  // Must be > nginx keepalive_timeout (default 75s) — see .ebextensions.
  server.keepAliveTimeout = 75_000;
  server.headersTimeout = 80_000;

  // ── Silent background seed + RAG re-seed ──────────────────────────────
  // Disabled in production — demo data seeding must never run against live data.
  // In development/staging, runs once 15s after boot then every 12 hours.
  if (!cluster.isWorker && process.env.NODE_ENV !== "production") {
    const SEED_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

    async function runBackgroundSeed() {
      try {
        console.log("[seed] running background demo seed …");
        const { runSeedDemo } = await import("./scripts/seedDemo.js");
        await runSeedDemo();
        console.log("[seed] demo seed complete");
      } catch (err) {
        console.warn("[seed] demo seed non-fatal error:", err?.message);
      }

      try {
        const { seedAllKnowledge } = await import("./services/ai/seedKnowledgeBase.js");
        await seedAllKnowledge();
        console.log("[seed] RAG knowledge base refreshed");
      } catch (err) {
        console.warn("[seed] RAG seed non-fatal error:", err?.message);
      }
    }

    // Initial run after a short warm-up delay
    setTimeout(runBackgroundSeed, 15_000).unref();
    // Recurring interval — .unref() so it never keeps the process alive during shutdown
    setInterval(runBackgroundSeed, SEED_INTERVAL_MS).unref();
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────
  // The cluster primary sends "shutdown" + SIGTERM during deploys. We:
  //   1. Stop accepting new connections (server.close).
  //   2. Let in-flight requests finish (close keeps existing sockets open).
  //   3. Disconnect mongoose so Atlas doesn't see a dangling client.
  //   4. Exit. The primary force-kills after a 30s deadline if we hang.
  let shuttingDown = false;
  const shutdown = async (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[coxa-backend] pid=${process.pid} draining (${reason})`);
    server.close(async () => {
      try {
        const { flushRudder, shutdownPostHog } = await import("./services/cdp/index.js");
        await flushRudder();
        await shutdownPostHog();
      } catch (err) {
        console.warn("[coxa-backend] CDP shutdown error:", err?.message);
      }
      try {
        const { closeClickhouseClient } = await import("./lib/clickhouseClient.js");
        await closeClickhouseClient();
      } catch (err) {
        console.warn("[coxa-backend] ClickHouse close error:", err?.message);
      }
      try {
        const { disconnectDB } = await import("./config/db.js");
        await disconnectDB();
      } catch (err) {
        console.warn("[coxa-backend] mongoose disconnect error:", err?.message);
      }
      process.exit(0);
    });
    // Fallback: don't hold the process forever if a socket refuses to close
    setTimeout(() => process.exit(0), 25_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  // Primary uses IPC for an orderly heads-up before SIGTERM (see cluster.js)
  process.on("message", (msg) => msg === "shutdown" && shutdown("primary-ipc"));
}

start().catch((err) => {
  console.error("[coxa-backend] failed to start:", err);
  process.exit(1);
});
