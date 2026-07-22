import { Router } from "express";
import { Product } from "../../models/Product.js";
import { Sku } from "../../models/Sku.js";
import { Location } from "../../models/Location.js";
import { ensureSkuStockPlaces, receiveStock } from "../../services/stockService.js";
import { receiveStockLot } from "../../services/foodLotService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const filter = { tenantId: req.ctx.tenantId };
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.status) filter.status = req.query.status;

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ data: products, total: products.length, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.patch("/skus/:skuId", async (req, res, next) => {
  try {
    const { variantLabel, barcode, priceCents, minQty, status } = req.body;
    const updates = {};
    if (variantLabel !== undefined) updates.variantLabel = variantLabel?.trim();
    if (barcode !== undefined) updates.barcode = barcode?.trim();
    if (priceCents !== undefined) updates.priceCents = Number(priceCents);
    if (minQty !== undefined) updates.minQty = Number(minQty);
    if (status !== undefined) updates.status = status;

    const sku = await Sku.findOneAndUpdate(
      { _id: req.params.skuId, tenantId: req.ctx.tenantId },
      updates,
      { new: true },
    );
    if (!sku) {
      return res.status(404).json({ code: "SKU_NOT_FOUND", message: "SKU not found" });
    }
    res.json({ data: sku, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { name, description, status, categoryId, productKind, trackLots, storageClass, defaultShelfLifeDays, sellByBufferDays } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (status !== undefined) updates.status = status;
    if (categoryId !== undefined) updates.categoryId = categoryId || null;
    if (productKind !== undefined) updates.productKind = productKind;
    if (trackLots !== undefined) updates.trackLots = Boolean(trackLots);
    if (storageClass !== undefined) updates.storageClass = storageClass;
    if (defaultShelfLifeDays !== undefined) updates.defaultShelfLifeDays = Number(defaultShelfLifeDays);
    if (sellByBufferDays !== undefined) updates.sellByBufferDays = Number(sellByBufferDays);

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.ctx.tenantId },
      updates,
      { new: true },
    );
    if (!product) {
      return res.status(404).json({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    }

    const skus = await Sku.find({ tenantId: req.ctx.tenantId, productId: product._id });
    res.json({ data: { product, skus }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.ctx.tenantId,
    });
    if (!product) {
      return res.status(404).json({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    }

    const skus = await Sku.find({ tenantId: req.ctx.tenantId, productId: product._id });
    res.json({ data: { product, skus }, tenantId: req.ctx.tenantId });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      name,
      description,
      categoryId,
      skus,
      initialQty,
      initialLocationId,
      productKind,
      trackLots,
      storageClass,
      defaultShelfLifeDays,
      sellByBufferDays,
      initialLot,
    } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "name is required",
      });
    }

    const resolvedKind = productKind ?? "merchandise";
    const resolvedTrackLots =
      resolvedKind === "ingredient" || resolvedKind === "menu_item"
        ? trackLots !== false
        : Boolean(trackLots);

    const product = await Product.create({
      tenantId: req.ctx.tenantId,
      name: name.trim(),
      description: description?.trim(),
      categoryId: categoryId || undefined,
      productKind: resolvedKind,
      trackLots: resolvedTrackLots,
      storageClass: storageClass ?? "ambient",
      defaultShelfLifeDays: defaultShelfLifeDays != null ? Number(defaultShelfLifeDays) : undefined,
      sellByBufferDays: sellByBufferDays != null ? Number(sellByBufferDays) : 1,
    });

    const createdSkus = [];
    if (Array.isArray(skus) && skus.length > 0) {
      for (const s of skus) {
        if (!s.skuCode || s.priceCents == null) continue;
        const sku = await Sku.create({
          tenantId: req.ctx.tenantId,
          productId: product._id,
          skuCode: s.skuCode.trim(),
          barcode: s.barcode?.trim(),
          variantLabel: s.variantLabel?.trim(),
          priceCents: Number(s.priceCents),
          minQty: s.minQty ?? 0,
        });
        createdSkus.push(sku);
      }
    }

    const qty = Number(initialQty ?? 0);
    let targetLocation = null;
    if (initialLocationId) {
      targetLocation = await Location.findOne({
        _id: initialLocationId,
        tenantId: req.ctx.tenantId,
        status: "active",
      });
    }
    if (!targetLocation && qty > 0) {
      const defaultCode =
        resolvedKind === "menu_item" || resolvedKind === "ingredient" ? "fnb_norte" : "stadium_store";
      targetLocation =
        (await Location.findOne({
          tenantId: req.ctx.tenantId,
          code: defaultCode,
          status: "active",
        })) || (await Location.findOne({ tenantId: req.ctx.tenantId, status: "active" }));
    }

    if (resolvedTrackLots && qty > 0 && !initialLot?.expirationDate) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Lot-tracked products require expirationDate in initialLot when receiving stock",
      });
    }

    for (const sku of createdSkus) {
      await ensureSkuStockPlaces(req.ctx.tenantId, sku._id);
      if (qty <= 0 || !targetLocation) continue;

      if (resolvedTrackLots) {
        await receiveStockLot({
          tenantId: req.ctx.tenantId,
          locationId: targetLocation._id,
          skuId: sku._id,
          qty,
          purchaseDate: initialLot?.purchaseDate,
          expirationDate: initialLot.expirationDate,
          sellByDate: initialLot?.sellByDate,
          lotNumber: initialLot?.lotNumber,
          supplierName: initialLot?.supplierName,
          note: initialLot?.note ?? "Initial lot on product create",
          createdBy: req.ctx.userId,
        });
      } else {
        await receiveStock({
          tenantId: req.ctx.tenantId,
          locationId: targetLocation._id,
          skuId: sku._id,
          qty,
          note: "Initial stock on product create",
          createdBy: req.ctx.userId,
        });
      }
    }

    res.status(201).json({
      data: { product, skus: createdSkus },
      tenantId: req.ctx.tenantId,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ code: "DUPLICATE_SKU", message: "SKU code already exists" });
    }
    next(err);
  }
});

export default router;
