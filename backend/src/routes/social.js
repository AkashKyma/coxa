import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { SocialChannel } from "../models/Social.js";
import { getSocialKpis, runIngestionForTenant } from "../services/socialIngestionService.js";
import { resolvePeriod } from "../services/periodService.js";

const router = Router();
router.use(requireAuth);

function tid(req) { return req.ctx?.tenantId; }

/** GET /api/v1/social/channels */
router.get("/channels", async (req, res, next) => {
  try {
    const channels = await SocialChannel.find({ tenantId: tid(req), isActive: true }).lean();
    res.json({ data: channels, total: channels.length });
  } catch (err) { next(err); }
});

/** POST /api/v1/social/channels */
router.post("/channels", async (req, res, next) => {
  try {
    const { source, channelHandle, channelId, displayName } = req.body;
    const channel = await SocialChannel.create({ tenantId: tid(req), source, channelHandle, channelId, displayName });
    res.status(201).json({ data: channel });
  } catch (err) { next(err); }
});

/** DELETE /api/v1/social/channels/:id */
router.delete("/channels/:id", async (req, res, next) => {
  try {
    await SocialChannel.findOneAndUpdate({ _id: req.params.id, tenantId: tid(req) }, { isActive: false });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** GET /api/v1/social/kpis — analytics summary */
router.get("/kpis", async (req, res, next) => {
  try {
    const { from, to, preset } = req.query;
    const period = resolvePeriod({ from, to, preset });
    const data = await getSocialKpis(tid(req), period);
    res.json({ data });
  } catch (err) { next(err); }
});

/** POST /api/v1/social/ingest — trigger manual ingestion */
router.post("/ingest", async (req, res, next) => {
  try {
    const results = await runIngestionForTenant(tid(req));
    res.json({ results });
  } catch (err) { next(err); }
});

export default router;
