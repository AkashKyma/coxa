import { Offer } from "../models/Offer.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Club } from "../models/Club.js";
import { ClubMembership } from "../models/ClubMembership.js";
import { TenantConfig } from "../models/TenantConfig.js";
import { FanProfile } from "../models/FanProfile.js";
import { FanboxStaff } from "../models/FanboxStaff.js";
import { Segment } from "../models/Segment.js";
import { LoyaltyRule } from "../models/LoyaltyRule.js";
import { LoyaltyReward } from "../models/LoyaltyReward.js";
import { LoyaltyLedgerEntry } from "../models/LoyaltyLedgerEntry.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Sku } from "../models/Sku.js";
import { Location } from "../models/Location.js";
import { StockBalance } from "../models/StockBalance.js";
import { StockLot } from "../models/StockLot.js";
import { applyStockDelta } from "../services/stockService.js";
import { receiveStockLot } from "../services/foodLotService.js";
import { publishEvent } from "../services/cdp/cdpEventService.js";
import { Venue } from "../models/Venue.js";
import { MatchEvent } from "../models/MatchEvent.js";
import { TicketProduct } from "../models/TicketProduct.js";
import { MembershipPlan } from "../models/MembershipPlan.js";
import { CheckInWindow } from "../models/CheckInWindow.js";
import { FanMembership } from "../models/FanMembership.js";
import { FanScore } from "../models/FanScore.js";
import { Referral } from "../models/Referral.js";
import { createVenue, createMatchEvent, createTicketProduct } from "../services/ticketingCatalogService.js";
import { createMembershipPlan, createCheckInWindow } from "../services/membershipCheckInService.js";
import { issueTicketsDirect } from "../services/ticketIssuanceService.js";
import { Ticket } from "../models/Ticket.js";
import { adjustPoints } from "../services/loyaltyService.js";
import { createMembership } from "../services/fanMembershipService.js";
import { initFanScore, recalculateFanScore } from "../services/fanScoreService.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";
const DEMO_PASSWORD = "CoxaDemo123!";

const ENABLED_MODULES = [
  "platform_admin",
  "identity",
  "consent",
  "cdp",
  "retail",
  "fnb",
  "loyalty",
  "marketing",
  "personalization",
  "checkout",
  "reporting",
  "ticketing",
  "membership",
  "fanbox",
];

const seedAccounts = [
  { email: "admin@coxa.local", fullName: "Club Admin", role: "owner" },
  { email: "retail@coxa.local", fullName: "Retail Manager", role: "admin" },
  { email: "marketing@coxa.local", fullName: "Marketing Manager", role: "admin" },
  { email: "loyalty@coxa.local", fullName: "Loyalty Manager", role: "admin" },
  { email: "cashier@coxa.local", fullName: "POS Cashier", role: "member" },
];

const seedFanboxStaff = [
  { email: "admin@coxa.local", role: "fanbox_admin" },
  { email: "marketing@coxa.local", role: "fanbox_manager" },
  { email: "loyalty@coxa.local", role: "fanbox_marketer" },
];

const seedFans = [
  { email: "fan@coxa.local", fullName: "Demo Fan", memberId: "MEM-001" },
  { email: "maria@coxa.local", fullName: "Maria Silva", memberId: "MEM-002" },
  { email: "joao@coxa.local", fullName: "João Santos", memberId: "MEM-003" },
];

async function upsertUser({ email, fullName, password }) {
  let user = await User.findOne({ email: email.toLowerCase() });
  const passwordHash = await User.hashPassword(password);
  if (!user) {
    user = await User.create({ fullName, email: email.toLowerCase(), passwordHash });
    console.log(`Created user: ${email}`);
  } else {
    user.fullName = fullName;
    user.passwordHash = passwordHash;
    await user.save();
  }
  return user;
}

async function seedTenantAndClub() {
  let config = await TenantConfig.findOne({ tenantId: TENANT_ID });
  if (!config) {
    config = await TenantConfig.create({
      tenantId: TENANT_ID,
      clubName: "Coxa Club",
      enabledModules: ENABLED_MODULES,
      currency: "BRL",
      timezone: "America/Sao_Paulo",
    });
    console.log("Created tenant config");
  } else {
    config.enabledModules = [...new Set([...config.enabledModules, ...ENABLED_MODULES])];
    await config.save();
    console.log("Updated tenant config modules");
  }

  let club = await Club.findOne({ slug: "coxa-club" });
  const adminUser = await upsertUser({
    email: "admin@coxa.local",
    fullName: "Club Admin",
    password: DEMO_PASSWORD,
  });

  if (!club) {
    club = await Club.create({
      name: "Coxa Club",
      slug: "coxa-club",
      country: "Brazil",
      city: "Curitiba",
      sport: "Football",
      stadiumName: "Coxa Arena",
      size: "professional",
      ownerId: adminUser._id,
      tenantId: TENANT_ID,
    });
    console.log("Created demo club");
  } else if (!club.tenantId) {
    club.tenantId = TENANT_ID;
    await club.save();
  }

  for (const account of seedAccounts) {
    const user = await upsertUser({
      email: account.email,
      fullName: account.fullName,
      password: DEMO_PASSWORD,
    });
    const exists = await ClubMembership.findOne({
      clubId: club._id,
      userId: user._id,
      status: "active",
    });
    if (!exists) {
      await ClubMembership.create({
        clubId: club._id,
        userId: user._id,
        role: account.role,
        status: "active",
        moduleAccess: ENABLED_MODULES,
      });
      console.log(`  Club member: ${account.email} (${account.role})`);
    }
  }

  return { club, adminUser };
}

async function seedFanboxStaffRecords(club) {
  for (const entry of seedFanboxStaff) {
    const user = await User.findOne({ email: entry.email.toLowerCase() });
    if (!user) continue;

    const exists = await FanboxStaff.findOne({
      clubId: club._id,
      userId: user._id,
      status: "active",
    });
    if (!exists) {
      await FanboxStaff.create({
        clubId: club._id,
        userId: user._id,
        role: entry.role,
        status: "active",
      });
      console.log(`  FanBox staff: ${entry.email} (${entry.role})`);
    }
  }
}

async function seedFanProfiles() {
  const profiles = [];
  for (const fan of seedFans) {
    let profile = await FanProfile.findOne({ tenantId: TENANT_ID, email: fan.email.toLowerCase() });
    if (!profile) {
      const user = await upsertUser({
        email: fan.email,
        fullName: fan.fullName,
        password: DEMO_PASSWORD,
      });
      profile = await FanProfile.create({
        tenantId: TENANT_ID,
        fanId: `fan-${fan.email.split("@")[0]}`,
        fullName: fan.fullName,
        email: fan.email.toLowerCase(),
        userId: user._id,
        memberId: fan.memberId,
        status: "active",
      });
      console.log(`Created fan profile: ${fan.email}`);

      await publishEvent({
        tenantId: TENANT_ID,
        eventName: "fan.registered",
        source: "seed",
        fanProfileId: profile._id,
        idempotencyKey: `fan-register-${profile._id.toString()}`,
        payload: { email: profile.email, memberId: profile.memberId },
      });
    }
    profiles.push(profile);
  }
  return profiles;
}

async function seedLoyaltyRules() {
  const rules = [
    {
      name: "Retail POS earn",
      ruleType: "earn_retail",
      pointsPerReal: 1,
      minAmountCents: 0,
      description: "1 point per R$1 on stadium/store POS purchases",
    },
    {
      name: "Fan shop earn",
      ruleType: "earn_fan_shop",
      pointsPerReal: 2,
      minAmountCents: 0,
      description: "2 points per R$1 on online fan shop orders",
    },
    {
      name: "Ticket purchase earn",
      ruleType: "earn_ticket",
      pointsPerReal: 1,
      minAmountCents: 0,
      description: "1 point per R$1 on ticket purchases",
    },
    {
      name: "Member check-in earn",
      ruleType: "earn_attendance",
      pointsPerReal: 1,
      pointsFlat: 100,
      minAmountCents: 0,
      description: "100 points for member match check-in",
    },
    {
      name: "Merchandise earn",
      ruleType: "earn_merchandise",
      pointsPerReal: 1,
      minAmountCents: 0,
      description: "1 point per R$1 on merchandise purchases",
    },
    {
      name: "Food & Beverage earn",
      ruleType: "earn_fnb",
      pointsPerReal: 1,
      minAmountCents: 0,
      description: "1 point per R$1 on F&B purchases",
    },
    {
      name: "Referral bonus",
      ruleType: "earn_referral",
      pointsPerReal: 1,
      pointsFlat: 1000,
      minAmountCents: 0,
      description: "1,000 points when a referred fan joins as a member",
    },
    {
      name: "Annual renewal bonus",
      ruleType: "earn_annual_renewal",
      pointsPerReal: 1,
      pointsFlat: 2000,
      minAmountCents: 0,
      description: "2,000 bonus points for annual membership payment",
    },
    {
      name: "Away match bonus",
      ruleType: "earn_away_match",
      pointsPerReal: 1,
      pointsFlat: 500,
      minAmountCents: 0,
      description: "500 points for attending an away match",
    },
    {
      name: "Community event earn",
      ruleType: "earn_community_event",
      pointsPerReal: 1,
      pointsFlat: 250,
      minAmountCents: 0,
      description: "250 points for participating in a club community event",
    },
    {
      name: "Donation earn",
      ruleType: "earn_donation",
      pointsPerReal: 1,
      pointsFlat: 500,
      minAmountCents: 0,
      description: "500 points per donation to club projects",
    },
  ];

  for (const rule of rules) {
    const exists = await LoyaltyRule.findOne({ tenantId: TENANT_ID, ruleType: rule.ruleType });
    if (!exists) {
      await LoyaltyRule.create({ tenantId: TENANT_ID, ...rule, status: "active" });
      console.log(`Created loyalty rule: ${rule.name}`);
    }
  }
}

async function seedSegments() {
  const segments = [
    {
      name: "High Value Retail Buyers",
      description: "Fans with total retail spend over R$500",
      rules: [{ traitKey: "is_high_value_retail", operator: "eq", value: true }],
    },
    {
      name: "Recent Buyers",
      description: "Purchased in the last 30 days",
      rules: [{ traitKey: "is_recent_buyer", operator: "eq", value: true }],
    },
    {
      name: "Inactive Fans",
      description: "No purchase activity in 90+ days",
      rules: [{ traitKey: "is_inactive", operator: "eq", value: true }],
    },
  ];

  for (const seg of segments) {
    const exists = await Segment.findOne({ tenantId: TENANT_ID, name: seg.name });
    if (!exists) {
      await Segment.create({ tenantId: TENANT_ID, ...seg, status: "active", memberCount: 0 });
      console.log(`Created segment: ${seg.name}`);
    }
  }
}

async function upsertCategory(code, name) {
  let cat = await Category.findOne({ tenantId: TENANT_ID, code });
  if (!cat) {
    cat = await Category.create({ tenantId: TENANT_ID, code, name });
    console.log(`Created category: ${code}`);
  }
  return cat;
}

async function upsertLocation(code, name, type) {
  let loc = await Location.findOne({ tenantId: TENANT_ID, code });
  if (!loc) {
    loc = await Location.create({ tenantId: TENANT_ID, code, name, type });
    console.log(`Created location: ${code}`);
  }
  return loc;
}

async function upsertProductWithSkus({ name, description, categoryId, skus }) {
  let product = await Product.findOne({ tenantId: TENANT_ID, name });
  if (!product) {
    product = await Product.create({
      tenantId: TENANT_ID,
      name,
      description,
      categoryId,
      status: "active",
    });
    console.log(`Created product: ${name}`);
  }

  const skuDocs = [];
  for (const s of skus) {
    let sku = await Sku.findOne({ tenantId: TENANT_ID, skuCode: s.skuCode });
    if (!sku) {
      sku = await Sku.create({
        tenantId: TENANT_ID,
        productId: product._id,
        skuCode: s.skuCode,
        barcode: s.barcode,
        variantLabel: s.variantLabel,
        priceCents: s.priceCents,
        minQty: s.minQty ?? 5,
        status: "active",
      });
      console.log(`  Created SKU: ${s.skuCode}`);
    }
    skuDocs.push(sku);
  }
  return { product, skus: skuDocs };
}

async function seedOpeningStock(location, sku, qty) {
  const existing = await StockBalance.findOne({
    tenantId: TENANT_ID,
    locationId: location._id,
    skuId: sku._id,
  });
  if (existing && existing.qtyOnHand > 0) return;

  await applyStockDelta({
    tenantId: TENANT_ID,
    locationId: location._id,
    skuId: sku._id,
    qtyDelta: qty,
    type: "receive",
    referenceType: "seed",
    note: "Opening stock",
  });
  console.log(`  Stock ${sku.skuCode} @ ${location.code}: ${qty}`);
}

async function seedRetail() {
  const apparel = await upsertCategory("apparel", "Apparel");
  await upsertCategory("accessories", "Accessories");

  const warehouse = await upsertLocation("warehouse", "Central Warehouse", "warehouse");
  const stadiumStore = await upsertLocation("stadium_store", "Stadium Store", "store");
  const onlineShop = await upsertLocation("online", "Fan Shop Online", "online");

  const jersey = await upsertProductWithSkus({
    name: "Home Jersey 2026",
    description: "Official home kit",
    categoryId: apparel._id,
    skus: [
      { skuCode: "JERSEY-26-S", variantLabel: "S", priceCents: 29900, barcode: "7891000000001" },
      { skuCode: "JERSEY-26-M", variantLabel: "M", priceCents: 29900, barcode: "7891000000002" },
    ],
  });

  const cap = await upsertProductWithSkus({
    name: "Club Cap",
    description: "Embroidered club cap",
    categoryId: apparel._id,
    skus: [{ skuCode: "CAP-001", variantLabel: "One size", priceCents: 8900 }],
  });

  const scarf = await upsertProductWithSkus({
    name: "Fan Scarf",
    description: "Matchday scarf",
    categoryId: apparel._id,
    skus: [{ skuCode: "SCARF-001", variantLabel: "Standard", priceCents: 5900 }],
  });

  const stockPlan = [
    { sku: jersey.skus.find((s) => s.skuCode === "JERSEY-26-M"), warehouse: 50, store: 10, online: 20 },
    { sku: jersey.skus.find((s) => s.skuCode === "JERSEY-26-S"), warehouse: 40, store: 8, online: 15 },
    { sku: cap.skus[0], warehouse: 100, store: 25, online: 40 },
    { sku: scarf.skus[0], warehouse: 80, store: 15, online: 30 },
  ];

  for (const row of stockPlan) {
    if (!row.sku) continue;
    await seedOpeningStock(warehouse, row.sku, row.warehouse);
    await seedOpeningStock(stadiumStore, row.sku, row.store);
    if (row.online != null) {
      await seedOpeningStock(onlineShop, row.sku, row.online);
    }
  }
}

async function upsertFoodProduct({
  name,
  description,
  categoryId,
  productKind = "menu_item",
  trackLots = true,
  storageClass = "ambient",
  defaultShelfLifeDays,
  sellByBufferDays = 1,
  skus,
}) {
  let product = await Product.findOne({ tenantId: TENANT_ID, name });
  if (!product) {
    product = await Product.create({
      tenantId: TENANT_ID,
      name,
      description,
      categoryId,
      productKind,
      trackLots,
      storageClass,
      defaultShelfLifeDays,
      sellByBufferDays,
      status: "active",
    });
    console.log(`Created food product: ${name}`);
  } else {
    product.productKind = productKind;
    product.trackLots = trackLots;
    product.storageClass = storageClass;
    if (defaultShelfLifeDays != null) product.defaultShelfLifeDays = defaultShelfLifeDays;
    product.sellByBufferDays = sellByBufferDays;
    await product.save();
  }

  const skuDocs = [];
  for (const s of skus) {
    let sku = await Sku.findOne({ tenantId: TENANT_ID, skuCode: s.skuCode });
    if (!sku) {
      sku = await Sku.create({
        tenantId: TENANT_ID,
        productId: product._id,
        skuCode: s.skuCode,
        barcode: s.barcode,
        variantLabel: s.variantLabel,
        priceCents: s.priceCents,
        minQty: s.minQty ?? 10,
        status: "active",
      });
      console.log(`  Created food SKU: ${s.skuCode}`);
    }
    skuDocs.push(sku);
  }
  return { product, skus: skuDocs };
}

function daysFromNow(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

async function seedFnb() {
  const foodCat = await upsertCategory("food_bev", "Food & Beverage");
  const fnbWarehouse = await upsertLocation("fnb_warehouse", "F&B Central Store", "warehouse");
  const standNorte = await upsertLocation("fnb_norte", "Stand Norte", "fnb_stand");
  const standSul = await upsertLocation("fnb_sul", "Stand Sul", "fnb_stand");

  const hotDog = await upsertFoodProduct({
    name: "Hot Dog Matchday",
    description: "Prepared hot dog — lot tracked",
    categoryId: foodCat._id,
    productKind: "menu_item",
    storageClass: "chilled",
    defaultShelfLifeDays: 2,
    sellByBufferDays: 0,
    skus: [{ skuCode: "FOOD-HOTDOG", variantLabel: "Standard", priceCents: 1800 }],
  });

  const chopp = await upsertFoodProduct({
    name: "Chopp 500ml",
    description: "Draft beer cup",
    categoryId: foodCat._id,
    productKind: "menu_item",
    storageClass: "chilled",
    defaultShelfLifeDays: 1,
    sellByBufferDays: 0,
    skus: [{ skuCode: "FOOD-CHOPP", variantLabel: "500ml", priceCents: 2200 }],
  });

  const soda = await upsertFoodProduct({
    name: "Refrigerante Lata",
    description: "Canned soft drink",
    categoryId: foodCat._id,
    productKind: "menu_item",
    storageClass: "ambient",
    defaultShelfLifeDays: 180,
    sellByBufferDays: 30,
    skus: [{ skuCode: "FOOD-SODA", variantLabel: "350ml", priceCents: 800 }],
  });

  const bun = await upsertFoodProduct({
    name: "Hot Dog Bun (ingredient)",
    description: "Bakery bun for prep",
    categoryId: foodCat._id,
    productKind: "ingredient",
    storageClass: "ambient",
    defaultShelfLifeDays: 5,
    skus: [{ skuCode: "ING-BUN", variantLabel: "Pack 24", priceCents: 0, minQty: 5 }],
  });

  const lotPlan = [
    {
      sku: hotDog.skus[0],
      location: standNorte,
      lots: [
        { lotNumber: "HD-N-001", qty: 40, purchaseDaysAgo: 0, expireDays: 2, sellByDays: 1 },
        { lotNumber: "HD-N-002", qty: 30, purchaseDaysAgo: 0, expireDays: 4, sellByDays: 3 },
      ],
    },
    {
      sku: chopp.skus[0],
      location: standNorte,
      lots: [
        { lotNumber: "CH-N-001", qty: 80, purchaseDaysAgo: 0, expireDays: 1, sellByDays: 1 },
      ],
    },
    {
      sku: soda.skus[0],
      location: standNorte,
      lots: [
        { lotNumber: "SD-N-001", qty: 120, purchaseDaysAgo: 30, expireDays: 150, sellByDays: 120 },
        { lotNumber: "SD-N-002", qty: 60, purchaseDaysAgo: 0, expireDays: 180, sellByDays: 150 },
      ],
    },
    {
      sku: hotDog.skus[0],
      location: standSul,
      lots: [{ lotNumber: "HD-S-001", qty: 25, purchaseDaysAgo: 0, expireDays: 3, sellByDays: 2 }],
    },
    {
      sku: bun.skus[0],
      location: fnbWarehouse,
      lots: [{ lotNumber: "BN-W-001", qty: 48, purchaseDaysAgo: 1, expireDays: 4, sellByDays: 3 }],
    },
  ];

  for (const row of lotPlan) {
    for (const lot of row.lots) {
      const exists = await StockLot.findOne({
        tenantId: TENANT_ID,
        locationId: row.location._id,
        skuId: row.sku._id,
        lotNumber: lot.lotNumber,
      });
      if (exists) continue;

      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - lot.purchaseDaysAgo);

      await receiveStockLot({
        tenantId: TENANT_ID,
        locationId: row.location._id,
        skuId: row.sku._id,
        qty: lot.qty,
        purchaseDate,
        expirationDate: daysFromNow(lot.expireDays),
        sellByDate: daysFromNow(lot.sellByDays),
        lotNumber: lot.lotNumber,
        supplierName: "Demo Supplier",
        note: "Seed F&B lot",
      });
      console.log(`  Lot ${lot.lotNumber} @ ${row.location.code}: ${lot.qty}`);
    }
  }
}

async function seedLoyaltyRewards() {
  const rewards = [
    {
      code: "FOOD-COMBO",
      name: "Free hot dog combo",
      description: "Redeem at any F&B stand on matchday",
      rewardType: "fnb",
      pointsCost: 500,
      inventoryLimit: 200,
      terms: "Valid on published matchdays only. Non-transferable.",
    },
    {
      code: "SHOP-10",
      name: "10% off fan shop",
      description: "Single-use discount on your next online order",
      rewardType: "discount",
      pointsCost: 300,
      inventoryLimit: null,
      terms: "Minimum order R$50. Cannot combine with other offers.",
    },
    {
      code: "VIP-TOUR",
      name: "Stadium tour experience",
      description: "Guided tour for 2 people",
      rewardType: "experience",
      pointsCost: 2000,
      inventoryLimit: 20,
      terms: "Book via support. Subject to schedule availability.",
    },
    {
      code: "SCARF-REDEEM",
      name: "Official fan scarf",
      description: "Pick up at stadium store",
      rewardType: "merchandise",
      pointsCost: 800,
      inventoryLimit: 100,
    },
  ];

  for (const r of rewards) {
    const exists = await LoyaltyReward.findOne({ tenantId: TENANT_ID, code: r.code });
    if (!exists) {
      await LoyaltyReward.create({ tenantId: TENANT_ID, ...r, status: "active" });
      console.log(`Created loyalty reward: ${r.code}`);
    }
  }
}

async function seedDemoLoyaltyBalance(fanProfiles) {
  const demoFan = fanProfiles.find((p) => p.email === "fan@coxa.local");
  if (!demoFan) return;

  const exists = await LoyaltyLedgerEntry.findOne({
    tenantId: TENANT_ID,
    fanProfileId: demoFan._id,
  });
  if (exists) return;

  await adjustPoints({
    tenantId: TENANT_ID,
    fanProfileId: demoFan._id,
    pointsDelta: 1200,
    note: "Welcome bonus — demo seed",
    createdBy: "seed",
    idempotencyKey: `seed-welcome-${demoFan._id}`,
  });
  console.log("Seeded welcome loyalty points for fan@coxa.local");
}

async function seedTicketing(fanProfiles) {
  let venue = await Venue.findOne({ tenantId: TENANT_ID, code: "coxa_arena" });
  if (!venue) {
    venue = await createVenue(TENANT_ID, {
      code: "coxa_arena",
      name: "Coxa Arena",
      city: "Curitiba",
      address: "Av. Presidente Kennedy",
      totalCapacity: 42000,
      sections: [
        { code: "NORTE", name: "Arquibancada Norte", capacity: 15000, sectionType: "general" },
        { code: "SUL", name: "Arquibancada Sul", capacity: 15000, sectionType: "general" },
        { code: "VIP", name: "Camarote VIP", capacity: 2000, sectionType: "vip" },
        { code: "MEMBER", name: "Member Zone", capacity: 10000, sectionType: "general" },
      ],
    });
    console.log("Created venue: Coxa Arena");
  }

  let matchEvent = await MatchEvent.findOne({ tenantId: TENANT_ID, eventCode: "COXA-2026-05" });
  if (!matchEvent) {
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 14);
    startsAt.setHours(16, 0, 0, 0);

    const saleStartsAt = new Date();
    saleStartsAt.setHours(saleStartsAt.getHours() - 1);

    matchEvent = await createMatchEvent(
      TENANT_ID,
      {
        eventCode: "COXA-2026-05",
        title: "Coxa vs Rivals FC",
        description: "Brasileirão matchday — demo fixture",
        eventType: "match",
        venueId: venue._id,
        homeTeam: "Coxa Club",
        awayTeam: "Rivals FC",
        startsAt,
        gatesOpenAt: new Date(Date.now() - 60 * 60 * 1000),
        saleStartsAt,
        saleEndsAt: startsAt,
        capacity: venue.totalCapacity,
        status: "on_sale",
      },
      "seed",
    );
    console.log("Created match event: Coxa vs Rivals FC");
  } else {
    matchEvent.gatesOpenAt = new Date(Date.now() - 60 * 60 * 1000);
    await matchEvent.save();
  }

  const norteSection = venue.sections.find((s) => s.code === "NORTE");
  const vipSection = venue.sections.find((s) => s.code === "VIP");
  const memberSection = venue.sections.find((s) => s.code === "MEMBER");

  const productDefs = [
    {
      productCode: "GEN-NORTE",
      name: "General Admission — Norte",
      sectionId: norteSection?._id,
      sectionCode: "NORTE",
      audienceType: "public",
      priceCents: 8000,
      capacity: 500,
    },
    {
      productCode: "VIP-CAMAROTE",
      name: "VIP Camarote",
      sectionId: vipSection?._id,
      sectionCode: "VIP",
      audienceType: "vip",
      priceCents: 35000,
      capacity: 100,
    },
    {
      productCode: "MEMBER-ZONE",
      name: "Member Ticket",
      sectionId: memberSection?._id,
      sectionCode: "MEMBER",
      audienceType: "member",
      priceCents: 4500,
      capacity: 300,
      requiresMemberId: true,
    },
  ];

  for (const def of productDefs) {
    const exists = await TicketProduct.findOne({
      tenantId: TENANT_ID,
      matchEventId: matchEvent._id,
      productCode: def.productCode,
    });
    if (!exists) {
      await createTicketProduct(TENANT_ID, { ...def, matchEventId: matchEvent._id });
      console.log(`  Created ticket product: ${def.productCode}`);
    }
  }

  let memberPlan = await MembershipPlan.findOne({ tenantId: TENANT_ID, planCode: "SOCIO-OURO" });
  if (memberPlan) {
    // Migrate legacy seed plan to proper code
    memberPlan.planCode = "COXA_DOIDO";
    memberPlan.name = "Coxa Doido";
    memberPlan.tierLevel = 2;
    memberPlan.monthlyPriceCents = 8990;
    memberPlan.annualPriceCents = 8990 * 10;
    memberPlan.seatType = "general";
    memberPlan.sectorCode = "NORTE";
    memberPlan.priorityBase = 200;
    await memberPlan.save();
    console.log("Migrated legacy SOCIO-OURO plan to COXA_DOIDO");
  }

  // Seed the full 6 Coritiba plans
  const planDefs = [
    {
      planCode: "CAMPEAO_POVO",
      name: "Campeão do Povo",
      tierLevel: 1,
      description: "Entry-level membership — benefits, discounts, no guaranteed seat",
      benefits: ["Club discounts", "Partner benefits", "Loyalty points"],
      monthlyPriceCents: 1985,
      annualPriceCents: 1985 * 10,
      seatType: "none",
      sectorCode: "",
      priorityBase: 100,
      priorityOrder: 10,
    },
    {
      planCode: "COXA_DOIDO",
      name: "Coxa Doido",
      tierLevel: 2,
      description: "Arquibancada access membership",
      benefits: ["Arquibancada access", "Priority check-in window", "Loyalty bonus", "10% shop discount"],
      monthlyPriceCents: 8990,
      annualPriceCents: 8990 * 10,
      seatType: "general",
      sectorCode: "NORTE",
      priorityBase: 200,
      priorityOrder: 20,
    },
    {
      planCode: "TORCIDA_MAUA",
      name: "Torcida da Mauá",
      tierLevel: 3,
      description: "Mauá sector membership",
      benefits: ["Mauá sector access", "Priority check-in", "15% shop discount", "F&B discount"],
      monthlyPriceCents: 16990,
      annualPriceCents: 16990 * 10,
      seatType: "general",
      sectorCode: "MAUA",
      priorityBase: 300,
      priorityOrder: 30,
    },
    {
      planCode: "NUNCA_ABANDONA",
      name: "Nunca Abandona",
      tierLevel: 4,
      description: "Social sector access",
      benefits: ["Social sector access", "Priority check-in", "20% shop discount", "Partner discounts"],
      monthlyPriceCents: 19990,
      annualPriceCents: 19990 * 10,
      seatType: "general",
      sectorCode: "SOCIAL",
      priorityBase: 400,
      priorityOrder: 40,
    },
    {
      planCode: "ALTO_GLORIA_MAU",
      name: "Alto da Glória Mauá",
      tierLevel: 5,
      description: "Premium assigned seating in Mauá",
      benefits: ["Assigned seat", "VIP lounge access", "25% shop discount", "Exclusive experiences"],
      monthlyPriceCents: 26990,
      annualPriceCents: 26990 * 10,
      seatType: "assigned",
      sectorCode: "ALTO_GLORIA_MAU",
      priorityBase: 500,
      priorityOrder: 50,
    },
    {
      planCode: "ALTO_GLORIA_SOC",
      name: "Alto da Glória Social",
      tierLevel: 6,
      description: "Premium social assigned seating",
      benefits: [
        "Assigned social premium seat",
        "VIP lounge access",
        "30% shop discount",
        "Exclusive experiences",
        "Player meet-and-greet access",
      ],
      monthlyPriceCents: 29990,
      annualPriceCents: 29990 * 10,
      seatType: "assigned",
      sectorCode: "ALTO_GLORIA_SOC",
      priorityBase: 600,
      priorityOrder: 60,
    },
  ];

  for (const def of planDefs) {
    await createMembershipPlan(TENANT_ID, def);
    console.log(`Upserted membership plan: ${def.name}`);
  }

  // Fetch plans we'll need for windows + fan memberships
  const coxaDoido = await MembershipPlan.findOne({ tenantId: TENANT_ID, planCode: "COXA_DOIDO" });
  const altaGloriaSoc = await MembershipPlan.findOne({ tenantId: TENANT_ID, planCode: "ALTO_GLORIA_SOC" });
  const campeaoPovo = await MembershipPlan.findOne({ tenantId: TENANT_ID, planCode: "CAMPEAO_POVO" });

  // Staggered priority check-in windows (5 score-gated tiers)
  const windowDefs = [
    {
      plan: altaGloriaSoc,
      name: "Diamond & Platinum priority access",
      fanScoreMin: 35001,
      capacity: 500,
      opensOffset: -4,
    },
    {
      plan: altaGloriaSoc,
      name: "Gold priority access",
      fanScoreMin: 15001,
      capacity: 1000,
      opensOffset: -3,
    },
    {
      plan: coxaDoido,
      name: "Silver priority access",
      fanScoreMin: 5001,
      capacity: 2000,
      opensOffset: -2,
    },
    {
      plan: coxaDoido,
      name: "Bronze member access",
      fanScoreMin: 0,
      capacity: 5000,
      opensOffset: -1,
    },
    {
      plan: campeaoPovo,
      name: "Campeão do Povo access",
      fanScoreMin: 0,
      capacity: 3000,
      opensOffset: 0,
    },
  ];

  for (const wd of windowDefs) {
    if (!wd.plan) continue;
    const exists = await CheckInWindow.findOne({
      tenantId: TENANT_ID,
      matchEventId: matchEvent._id,
      membershipPlanId: wd.plan._id,
      fanScoreMin: wd.fanScoreMin,
    });
    if (!exists) {
      const opensAt = new Date();
      opensAt.setDate(opensAt.getDate() + wd.opensOffset);
      opensAt.setHours(9, 0, 0, 0);

      const closesAt = new Date(matchEvent.startsAt);
      closesAt.setHours(closesAt.getHours() - 1);

      await createCheckInWindow(TENANT_ID, {
        matchEventId: matchEvent._id,
        membershipPlanId: wd.plan._id,
        name: wd.name,
        opensAt,
        closesAt,
        capacity: wd.capacity,
        fanScoreMin: wd.fanScoreMin,
      });
      console.log(`  Created check-in window: ${wd.name}`);
    }
  }

  const demoFan = fanProfiles.find((p) => p.email === "fan@coxa.local");
  const mariaFan = fanProfiles.find((p) => p.email === "maria@coxa.local");
  const joaoFan = fanProfiles.find((p) => p.email === "joao@coxa.local");

  // Seed FanMembership records
  const fanMembershipDefs = [
    { profile: demoFan, planCode: "COXA_DOIDO", paymentFrequency: "annual" },
    { profile: mariaFan, planCode: "ALTO_GLORIA_SOC", paymentFrequency: "annual" },
    { profile: joaoFan, planCode: "CAMPEAO_POVO", paymentFrequency: "monthly" },
  ];

  for (const def of fanMembershipDefs) {
    if (!def.profile) continue;
    const existing = await FanMembership.findOne({
      tenantId: TENANT_ID,
      fanProfileId: def.profile._id,
      status: "active",
    });
    if (!existing) {
      const mem = await createMembership({
        tenantId: TENANT_ID,
        fanProfileId: def.profile._id,
        planCode: def.planCode,
        paymentFrequency: def.paymentFrequency,
        paymentMethod: "stub",
        idempotencyKey: `seed-membership-${def.profile._id}`,
      });
      console.log(`Created FanMembership: ${def.profile.email} → ${def.planCode}`);
    }
  }

  // Seed FanScore initial records and recalculate
  for (const def of fanMembershipDefs) {
    if (!def.profile) continue;
    await initFanScore(TENANT_ID, def.profile._id);
    await recalculateFanScore(TENANT_ID, def.profile._id);
    console.log(`Computed FanScore for ${def.profile.email}`);
  }

  // Seed referral code for demo fan
  if (demoFan) {
    const existingCode = await Referral.findOne({
      tenantId: TENANT_ID,
      referrerFanProfileId: demoFan._id,
      refereeFanProfileId: { $exists: false },
    });
    if (!existingCode) {
      await Referral.create({
        tenantId: TENANT_ID,
        referrerFanProfileId: demoFan._id,
        referralCode: "DEMOFAN1",
        status: "pending",
      });
      console.log("Created referral code DEMOFAN1 for fan@coxa.local");
    }
  }

  const memberProduct = await TicketProduct.findOne({
    tenantId: TENANT_ID,
    matchEventId: matchEvent._id,
    productCode: "MEMBER-ZONE",
  });

  if (demoFan && memberProduct) {
    const existingTicket = await Ticket.findOne({
      tenantId: TENANT_ID,
      fanProfileId: demoFan._id,
      matchEventId: matchEvent._id,
    });
    if (!existingTicket) {
      await issueTicketsDirect({
        tenantId: TENANT_ID,
        matchEventId: matchEvent._id,
        ticketProductId: memberProduct._id,
        qty: 1,
        fanProfileId: demoFan._id,
        paymentMethod: "stub",
        channel: "fan_app",
        idempotencyKey: `seed-ticket-${demoFan._id}`,
        skipReservation: true,
      });
      console.log("Issued demo ticket for fan@coxa.local");
    }
  }
}

async function seedOffers() {
  const existingCount = await Offer.countDocuments({ tenantId: TENANT_ID });
  if (existingCount > 0) return;

  // Fetch segments so we can link by ID
  const segments = await Segment.find({ tenantId: TENANT_ID, status: "active" });
  const seg = (name) => segments.find((s) => s.name === name);

  const offers = [
    {
      title: "10% off Home Jersey",
      description: "Exclusive jersey discount for top retail supporters.",
      offerType: "discount_percent",
      value: 10,
      productHint: "Home Jersey 2026",
      segmentId: seg("High Value Retail Buyers")?._id ?? null,
      segmentName: seg("High Value Retail Buyers")?.name ?? null,
      priority: 10,
    },
    {
      title: "Cap + Scarf bundle",
      description: "Matchday bundle offer for recent shoppers.",
      offerType: "bundle",
      value: 15,
      productHint: "Club Cap",
      segmentId: seg("Recent Buyers")?._id ?? null,
      segmentName: seg("Recent Buyers")?.name ?? null,
      priority: 20,
    },
    {
      title: "Welcome back — 500 bonus points",
      description: "Re-engage with bonus loyalty points on your next purchase.",
      offerType: "bonus_points",
      value: 500,
      segmentId: seg("Inactive Fans")?._id ?? null,
      segmentName: seg("Inactive Fans")?.name ?? null,
      priority: 30,
    },
    {
      title: "Free shipping on orders over R$150",
      description: "Standard welcome offer for all fans.",
      offerType: "free_shipping",
      value: 15000,
      segmentId: null,
      segmentName: null,
      priority: 999,
    },
  ];

  for (const def of offers) {
    await Offer.create({ tenantId: TENANT_ID, status: "active", minPoints: 0, ...def });
    console.log(`Created offer: ${def.title}`);
  }
}

async function seed() {
  await connectDB();
  const { club } = await seedTenantAndClub();
  await seedFanboxStaffRecords(club);
  const fanProfiles = await seedFanProfiles();
  await seedLoyaltyRules();
  await seedLoyaltyRewards();
  await seedSegments();
  await seedOffers();
  await seedRetail();
  await seedFnb();
  await seedDemoLoyaltyBalance(fanProfiles);
  await seedTicketing(fanProfiles);
  console.log("\nSeed complete.");
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
  console.log("Staff login: admin@coxa.local | Fan login: fan@coxa.local");
  console.log("FanBox login (5178): admin@coxa.local | marketing@coxa.local");
  await disconnectDB();
}

seed().catch((err) => {
  console.error(err);
  mongoose.connection.close();
  process.exit(1);
});
