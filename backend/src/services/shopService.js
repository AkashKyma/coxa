import { Location } from "../models/Location.js";
import { Sku } from "../models/Sku.js";
import { Product } from "../models/Product.js";
import { StockBalance } from "../models/StockBalance.js";
import { FanProfile } from "../models/FanProfile.js";
import { getLotSummaryForSku } from "./foodLotService.js";

export async function getOnlineLocation(tenantId) {
  return Location.findOne({ tenantId, code: "online", status: "active" });
}

export async function getLocationCatalog(tenantId, locationId) {
  const location = await Location.findOne({ _id: locationId, tenantId, status: "active" });
  if (!location) {
    return { location: null, items: [] };
  }

  const balances = await StockBalance.find({
    tenantId,
    locationId: location._id,
    qtyOnHand: { $gt: 0 },
  });

  const items = await Promise.all(
    balances.map(async (balance) => {
      const sku = await Sku.findOne({ _id: balance.skuId, tenantId, status: "active" });
      if (!sku) return null;
      const product = await Product.findOne({ _id: sku.productId, tenantId, status: "active" });
      if (!product) return null;

      let qtyAvailable = balance.qtyOnHand;
      let lotMeta;

      if (product.trackLots) {
        lotMeta = await getLotSummaryForSku(tenantId, location._id, sku._id);
        qtyAvailable = lotMeta.sellableQty;
        if (qtyAvailable <= 0) return null;
      }

      return {
        sku,
        product,
        qtyAvailable,
        lotMeta,
      };
    }),
  );

  return {
    location,
    items: items.filter(Boolean),
  };
}

export async function getShopCatalog(tenantId) {
  const online = await getOnlineLocation(tenantId);
  if (!online) {
    return { location: null, items: [] };
  }
  return getLocationCatalog(tenantId, online._id);
}

export async function resolveFanProfile(tenantId, { fanProfileId, fanId, fanEmail, fanUserId }) {
  if (fanProfileId) {
    return FanProfile.findOne({ _id: fanProfileId, tenantId, status: "active" });
  }
  if (fanId) {
    return FanProfile.findOne({ tenantId, fanId, status: "active" });
  }
  if (fanEmail) {
    return FanProfile.findOne({ tenantId, email: fanEmail.toLowerCase(), status: "active" });
  }
  if (fanUserId) {
    return FanProfile.findOne({ tenantId, userId: fanUserId, status: "active" });
  }
  return null;
}

/** @deprecated use resolveFanProfile */
export async function resolveFanUser(tenantId, opts) {
  return resolveFanProfile(tenantId, opts);
}
