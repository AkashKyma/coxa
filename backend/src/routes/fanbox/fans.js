import { Router } from "express";
import { requireFanboxAuth } from "../../middleware/requireFanboxAuth.js";
import { FanProfile } from "../../models/FanProfile.js";
import { buildCustomer360, lookupCustomer360 } from "../../services/customer360Service.js";
import { validateCpfOrForeigner, validateAndNormalizeCpf } from "../../lib/cpfUtils.js";

const router = Router();
router.use(requireFanboxAuth);

const SEARCH_FIELDS = ["cpf", "fullName", "email", "fanId", "passport", "phone"];

router.get("/search", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const { q, field = "email" } = req.query;
    if (!q?.trim()) {
      return res.status(400).json({ code: "QUERY_REQUIRED", message: "Query parameter q is required" });
    }
    if (!SEARCH_FIELDS.includes(field)) {
      return res.status(400).json({ code: "INVALID_FIELD", message: `field must be one of: ${SEARCH_FIELDS.join(", ")}` });
    }

    const filter = { tenantId, status: "active" };
    const term = q.trim();

    if (field === "fullName") {
      filter.fullName = { $regex: term, $options: "i" };
    } else if (field === "cpf" || field === "fanId" || field === "passport") {
      filter[field] = term;
    } else {
      filter[field] = field === "email" ? term.toLowerCase() : term;
    }

    const profiles = await FanProfile.find(filter).limit(25).lean();
    res.json({ data: profiles, total: profiles.length });
  } catch (err) {
    next(err);
  }
});

router.get("/customer-360", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      return res.status(400).json({ code: "QUERY_REQUIRED", message: "Query parameter q is required" });
    }

    const data = await lookupCustomer360(tenantId, q, { revealPii: true });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get("/customer-360/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const data = await buildCustomer360(tenantId, req.params.id, { revealPii: true });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const profile = await FanProfile.findOne({
      _id: req.params.id,
      tenantId,
      status: "active",
    }).lean();

    if (!profile) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Fan profile not found" });
    }

    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(400).json({ code: "TENANT_REQUIRED", message: "X-Club-Id header required" });
    }

    const allowed = [
      "fullName", "email", "phone", "cpf", "passport", "gender", "birthDate",
      "address", "hasChildren", "ageRange", "householdIncomeBand",
      "preferredSocialNetwork", "sportsBetting", "affinityClubId",
      "biometricRegistered", "primaryInteractionChannels", "isForeigner",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // WS6: validate CPF if present
    if (updates.cpf) {
      updates.cpf = validateAndNormalizeCpf(updates.cpf, true);
    }
    validateCpfOrForeigner(updates);

    const profile = await FanProfile.findOneAndUpdate(
      { _id: req.params.id, tenantId, status: "active" },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!profile) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Fan profile not found" });
    }

    res.json({ data: profile });
  } catch (err) {
    next(err);
  }
});

export default router;
