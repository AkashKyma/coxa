import { Router } from "express";
import { Location } from "../../models/Location.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const locations = await Location.find({ tenantId: req.ctx.tenantId }).sort({ name: 1 });
    res.json({ data: locations, total: locations.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { code, name, type } = req.body;
    if (!code?.trim() || !name?.trim() || !type) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "code, name and type are required",
      });
    }

    const location = await Location.create({
      tenantId: req.ctx.tenantId,
      code: code.trim(),
      name: name.trim(),
      type,
    });

    res.status(201).json({ data: location, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ code: "DUPLICATE_LOCATION", message: "Location code already exists" });
    }
    next(err);
  }
});

export default router;
