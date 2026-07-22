import { Router } from "express";
import { Category } from "../../models/Category.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find({ tenantId: req.ctx.tenantId }).sort({ name: 1 });
    res.json({ data: categories, total: categories.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

function normalizeCategoryCode(code) {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

router.post("/", async (req, res, next) => {
  try {
    const { code, name } = req.body;
    if (!code?.trim() || !name?.trim()) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "code and name are required",
      });
    }

    const normalizedCode = normalizeCategoryCode(code);
    if (!normalizedCode) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "code must contain at least one letter or number",
      });
    }

    const existing = await Category.findOne({
      tenantId: req.ctx.tenantId,
      code: normalizedCode,
    });
    if (existing) {
      return res.status(409).json({
        code: "DUPLICATE_CATEGORY",
        message: `Category code "${normalizedCode}" already exists`,
      });
    }

    const category = await Category.create({
      tenantId: req.ctx.tenantId,
      code: normalizedCode,
      name: name.trim(),
    });

    res.status(201).json({ data: category, tenantId: req.ctx.tenantId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        code: "DUPLICATE_CATEGORY",
        message: "Category code already exists for this club",
      });
    }
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { name, status } = req.body;
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      { ...(name && { name: name.trim() }), ...(status && { status }) },
      { new: true },
    );
    if (!category) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Category not found" });
    }
    res.json({ data: category, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

export default router;
