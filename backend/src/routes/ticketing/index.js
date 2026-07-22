import { Router } from "express";
import { TenantConfig } from "../../models/TenantConfig.js";
import { requireModule } from "../../middleware/requireModule.js";
import { listMatchEvents, listTicketProducts } from "../../services/ticketingCatalogService.js";
import { purchaseTicketsDirect } from "../../services/ticketIssuanceService.js";
import venuesRouter from "./venues.js";
import eventsRouter from "./events.js";
import reservationsRouter from "./reservations.js";
import ticketsRouter from "./tickets.js";
import entitlementsRouter from "./entitlements.js";
import checkInsRouter from "./checkIns.js";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const config = await TenantConfig.findOne({ tenantId: req.ctx.tenantId });
    res.json({
      module: "ticketing",
      enabled: config?.enabledModules?.includes("ticketing") ?? false,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/shop/events", async (req, res, next) => {
  try {
    const events = await listMatchEvents(req.ctx.tenantId, { upcoming: true });
    const withProducts = await Promise.all(
      events.map(async (event) => {
        const products = await listTicketProducts(req.ctx.tenantId, event._id);
        return { event, products };
      }),
    );
    res.json({ data: withProducts, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/shop/purchase", async (req, res, next) => {
  try {
    const idempotencyKey =
      req.body.idempotencyKey ?? req.headers["idempotency-key"] ?? `fan-purchase-${Date.now()}`;

    let fanProfileId = req.body.fanProfileId;
    let fanEmail = req.body.fanEmail;
    if (req.ctx.userId) {
      const { findFanProfile } = await import("../../services/fanProfileService.js");
      const fan = await findFanProfile(req.ctx.tenantId, { userId: req.ctx.userId });
      if (fan) {
        fanProfileId = fan._id;
        fanEmail = fan.email;
      }
    }

    const result = await purchaseTicketsDirect({
      tenantId: req.ctx.tenantId,
      matchEventId: req.body.matchEventId,
      lines: req.body.lines,
      fanProfileId,
      fanEmail,
      paymentMethod: req.body.paymentMethod ?? "stub",
      channel: "fan_app",
      idempotencyKey,
    });
    res.status(result.duplicate ? 200 : 201).json({
      data: result.tickets,
      duplicate: result.duplicate,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireModule("ticketing"));

router.use("/venues", venuesRouter);
router.use("/events", eventsRouter);
router.use("/reservations", reservationsRouter);
router.use("/tickets", ticketsRouter);
router.use("/entitlements", entitlementsRouter);
router.use("/check-ins", checkInsRouter);

export default router;
