import { Router } from "express";
import {
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
} from "../../services/ticketingCatalogService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const venues = await listVenues(req.ctx.tenantId, { includeInactive });
    res.json({ data: venues, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const venue = await getVenue(req.ctx.tenantId, req.params.id);
    res.json({ data: venue, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const venue = await createVenue(req.ctx.tenantId, req.body);
    res.status(201).json({ data: venue, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const venue = await updateVenue(req.ctx.tenantId, req.params.id, req.body);
    res.json({ data: venue, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await deleteVenue(req.ctx.tenantId, req.params.id);
    res.json({
      data: result.venue,
      softDeleted: result.softDeleted,
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    next(err);
  }
});

export default router;
