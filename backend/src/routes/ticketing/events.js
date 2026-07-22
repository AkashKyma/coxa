import { Router } from "express";
import {
  listMatchEvents,
  getMatchEvent,
  createMatchEvent,
  updateMatchEventStatus,
  listTicketProducts,
  createTicketProduct,
} from "../../services/ticketingCatalogService.js";
import { listCheckInWindows, createCheckInWindow } from "../../services/membershipCheckInService.js";
import { recordNoShows } from "../../services/entitlementService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const events = await listMatchEvents(req.ctx.tenantId, {
      status: req.query.status,
      upcoming: req.query.upcoming === "true",
    });
    res.json({ data: events, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const event = await createMatchEvent(req.ctx.tenantId, req.body, req.user?.id);
    res.status(201).json({ data: event, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const event = await getMatchEvent(req.ctx.tenantId, req.params.id);
    const products = await listTicketProducts(req.ctx.tenantId, req.params.id);
    const checkInWindows = await listCheckInWindows(req.ctx.tenantId, req.params.id);
    res.json({
      data: { event, products, checkInWindows },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const event = await updateMatchEventStatus(
      req.ctx.tenantId,
      req.params.id,
      req.body.status,
      req.user?.id,
    );
    res.json({ data: event, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/ticket-products", async (req, res, next) => {
  try {
    const products = await listTicketProducts(req.ctx.tenantId, req.params.id);
    res.json({ data: products, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/ticket-products", async (req, res, next) => {
  try {
    const product = await createTicketProduct(req.ctx.tenantId, {
      ...req.body,
      matchEventId: req.params.id,
    });
    res.status(201).json({ data: product, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/check-in-windows", async (req, res, next) => {
  try {
    const windows = await listCheckInWindows(req.ctx.tenantId, req.params.id);
    res.json({ data: windows, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/check-in-windows", async (req, res, next) => {
  try {
    const window = await createCheckInWindow(req.ctx.tenantId, {
      ...req.body,
      matchEventId: req.params.id,
    });
    res.status(201).json({ data: window, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/record-no-shows", async (req, res, next) => {
  try {
    const result = await recordNoShows(req.ctx.tenantId, req.params.id);
    res.json({ data: result, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
