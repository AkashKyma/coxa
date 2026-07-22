/** Category codes that imply F&B catalog (matches seed + common naming). */
export const FNB_CATEGORY_CODES = new Set(["food_bev", "food-bev", "fnb", "food", "beverage"]);

export const PRODUCT_KIND_OPTIONS = [
  {
    value: "merchandise",
    label: "Retail merchandise",
    segment: "retail",
    description: "Jerseys, caps, scarves — sold at stores and online.",
    trackLotsDefault: false,
    priceRequired: true,
    defaultStorage: "ambient",
    defaultShelfLifeDays: null,
    sellByBufferDays: 1,
  },
  {
    value: "menu_item",
    label: "F&B menu item",
    segment: "fnb",
    description: "Ready-to-sell food or drink at stands (hot dog, chopp, soda).",
    trackLotsDefault: true,
    priceRequired: true,
    defaultStorage: "chilled",
    defaultShelfLifeDays: 2,
    sellByBufferDays: 0,
  },
  {
    value: "ingredient",
    label: "F&B ingredient",
    segment: "fnb",
    description: "Prep/raw stock — tracked by lot, not sold directly at POS.",
    trackLotsDefault: true,
    priceRequired: false,
    defaultStorage: "ambient",
    defaultShelfLifeDays: 5,
    sellByBufferDays: 1,
  },
];

/** Only retail-segment kinds — used by the Retail Products page. */
export const RETAIL_KIND_OPTIONS = PRODUCT_KIND_OPTIONS.filter((o) => o.segment === "retail");

/** Only F&B-segment kinds — used by the F&B Products page. */
export const FNB_KIND_OPTIONS = PRODUCT_KIND_OPTIONS.filter((o) => o.segment === "fnb");

export const STORAGE_CLASS_OPTIONS = [
  { value: "ambient", label: "Ambient" },
  { value: "chilled", label: "Chilled" },
  { value: "frozen", label: "Frozen" },
];

export function getProductKindConfig(kind) {
  return PRODUCT_KIND_OPTIONS.find((o) => o.value === kind) ?? PRODUCT_KIND_OPTIONS[0];
}

export function isFnbCategory(category) {
  if (!category) return false;
  const code = (category.code ?? "").toLowerCase();
  const name = (category.name ?? "").toLowerCase();
  return (
    FNB_CATEGORY_CODES.has(code) ||
    name.includes("food") ||
    name.includes("beverage") ||
    name.includes("f&b")
  );
}

export function isFnbProductKind(kind) {
  return kind === "menu_item" || kind === "ingredient";
}

export function filterLocationsForSegment(locations, segment) {
  if (segment === "fnb") {
    return locations.filter(
      (l) => l.type === "fnb_stand" || l.type === "warehouse" || (l.code ?? "").startsWith("fnb_"),
    );
  }
  return locations.filter((l) => ["store", "warehouse", "online"].includes(l.type));
}

export function defaultLocationForSegment(locations, segment) {
  const pool = filterLocationsForSegment(locations, segment);
  if (segment === "fnb") {
    return (
      pool.find((l) => l.code === "fnb_norte") ??
      pool.find((l) => l.type === "fnb_stand") ??
      pool[0]
    )?.id ?? "";
  }
  return (
    pool.find((l) => l.code === "stadium_store") ??
    pool.find((l) => l.type === "store") ??
    pool[0]
  )?.id ?? "";
}

export function inferProductKindFromCategory(category) {
  return isFnbCategory(category) ? "menu_item" : "merchandise";
}

export function applyProductKindDefaults(form, kind, locations) {
  const config = getProductKindConfig(kind);
  const segment = config.segment;
  return {
    ...form,
    productKind: kind,
    trackLots: config.trackLotsDefault,
    storageClass: config.defaultStorage,
    defaultShelfLifeDays:
      config.defaultShelfLifeDays != null ? String(config.defaultShelfLifeDays) : "",
    sellByBufferDays: String(config.sellByBufferDays),
    initialLocationId: defaultLocationForSegment(locations, segment),
    expirationDate:
      config.defaultShelfLifeDays != null
        ? dateInputFromOffset(config.defaultShelfLifeDays)
        : form.expirationDate,
  };
}

export function dateInputFromOffset(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

export function productKindLabel(kind) {
  return getProductKindConfig(kind).label;
}

export function storageClassLabel(value) {
  return STORAGE_CLASS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
