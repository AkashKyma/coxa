import { Router } from "express";
import { TierConfig } from "../../models/TierConfig.js";

const router = Router();

const DEFAULT_TIERS = [
  {
    name: "Bronze",
    minPoints: 0,
    maxPoints: 999,
    color: "#CD7F32",
    benefits: ["Desconto de 5% na loja", "Acesso antecipado a ingressos"],
  },
  {
    name: "Prata",
    minPoints: 1000,
    maxPoints: 4999,
    color: "#C0C0C0",
    benefits: ["Desconto de 10% na loja", "Frete grátis", "Newsletter exclusiva"],
  },
  {
    name: "Ouro",
    minPoints: 5000,
    maxPoints: null,
    color: "#F2C438",
    benefits: [
      "Desconto de 15% na loja",
      "Acesso VIP",
      "Convite para eventos exclusivos",
      "Carteirinha digital premium",
    ],
  },
];

/* GET /api/v1/loyalty/tiers */
router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.ctx?.tenantId ?? "default";
    let config = await TierConfig.findOne({ tenantId });
    if (!config || config.tiers.length === 0) {
      return res.json({ data: DEFAULT_TIERS, tenantId });
    }
    res.json({ data: config.tiers, tenantId });
  } catch (err) {
    next(err);
  }
});

/* PUT /api/v1/loyalty/tiers */
router.put("/", async (req, res, next) => {
  try {
    const tenantId = req.ctx?.tenantId ?? "default";
    const tiers = req.body.tiers ?? req.body;
    if (!Array.isArray(tiers)) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "tiers must be an array" });
    }
    const config = await TierConfig.findOneAndUpdate(
      { tenantId },
      { $set: { tiers } },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ data: config.tiers, tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
