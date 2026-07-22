import { Router } from "express";
import { findFanProfile } from "../../services/fanProfileService.js";
import {
  listTickets,
  issueTicketsFromReservation,
  issueTicketsDirect,
  purchaseTicketsDirect,
  cancelTicket,
} from "../../services/ticketIssuanceService.js";

const router = Router();

async function resolveFanFromRequest(req) {
  if (req.body?.fanProfileId || req.query?.fanProfileId) {
    return findFanProfile(req.ctx.tenantId, {
      fanProfileId: req.body?.fanProfileId ?? req.query?.fanProfileId,
    });
  }
  if (req.ctx.userId) {
    return findFanProfile(req.ctx.tenantId, { userId: req.ctx.userId });
  }
  const email = req.body?.fanEmail ?? req.query?.fanEmail;
  if (email) return findFanProfile(req.ctx.tenantId, { email });
  return null;
}

router.get("/", async (req, res, next) => {
  try {
    const fan = await resolveFanFromRequest(req);
    const tickets = await listTickets(req.ctx.tenantId, {
      fanProfileId: fan?._id ?? req.query.fanProfileId,
      fanEmail: !fan && !req.ctx.userId ? req.query.fanEmail : undefined,
      matchEventId: req.query.matchEventId,
      status: req.query.status,
    });
    res.json({ data: tickets, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/issue", async (req, res, next) => {
  try {
    const idempotencyKey =
      req.body.idempotencyKey ?? req.headers["idempotency-key"] ?? `issue-${Date.now()}`;

    let result;
    if (req.body.reservationId) {
      result = await issueTicketsFromReservation({
        tenantId: req.ctx.tenantId,
        reservationId: req.body.reservationId,
        paymentMethod: req.body.paymentMethod ?? "stub",
        idempotencyKey,
        channel: req.body.channel ?? "box_office",
      });
    } else if (req.body.lines) {
      result = await purchaseTicketsDirect({
        tenantId: req.ctx.tenantId,
        matchEventId: req.body.matchEventId,
        lines: req.body.lines,
        fanProfileId: req.body.fanProfileId,
        fanEmail: req.body.fanEmail,
        paymentMethod: req.body.paymentMethod ?? "stub",
        channel: req.body.channel ?? "fan_app",
        idempotencyKey,
      });
    } else {
      result = await issueTicketsDirect({
        tenantId: req.ctx.tenantId,
        matchEventId: req.body.matchEventId,
        ticketProductId: req.body.ticketProductId,
        qty: Number(req.body.qty ?? 1),
        fanProfileId: req.body.fanProfileId,
        fanEmail: req.body.fanEmail,
        paymentMethod: req.body.paymentMethod ?? "cash",
        channel: req.body.channel ?? "box_office",
        idempotencyKey,
        skipReservation: req.body.skipReservation ?? false,
      });
    }

    res.status(result.duplicate ? 200 : 201).json({
      data: result.tickets,
      duplicate: result.duplicate,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const ticket = await cancelTicket(req.ctx.tenantId, req.params.id, req.body.reason);
    res.json({ data: ticket, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
