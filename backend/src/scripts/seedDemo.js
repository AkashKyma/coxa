/**
 * Demo data seeder ù populates all screens with realistic data.
 * Run: node backend/src/scripts/seedDemo.js
 *
 * Creates:
 *  - 120 fan profiles (various demographics, CPF, foreigners)
 *  - 80 active memberships + transactions
 *  - 200 tickets across 6 match events + attendance records
 *  - 300 retail sales across 2 stores (60 days of data)
 *  - 150 loyalty ledger entries
 *  - Social channel metrics (30 days)
 *  - Saved filter audiences
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { connectDB, disconnectDB } from "../config/db.js";
import { FanProfile } from "../models/FanProfile.js";
import { FanMembership } from "../models/FanMembership.js";
import { MembershipTransaction } from "../models/MembershipTransaction.js";
import { Ticket } from "../models/Ticket.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { Sale } from "../models/Sale.js";
import { LoyaltyLedgerEntry } from "../models/LoyaltyLedgerEntry.js";
import { Location } from "../models/Location.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Sku } from "../models/Sku.js";
import { MembershipPlan } from "../models/MembershipPlan.js";
import { MatchEvent } from "../models/MatchEvent.js";
import { SavedFilter } from "../models/SavedFilter.js";
import { SocialChannel, SocialMetric } from "../models/Social.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const TENANT = process.env.DEFAULT_TENANT_ID ?? "coxa-club-001";

// ??? utility helpers ?????????????????????????????????????????????????????????

function uid() { return new mongoose.Types.ObjectId(); }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function hoursAgo(n) { const d = new Date(); d.setHours(d.getHours() - n); return d; }

function randomDate(startDaysAgo, endDaysAgo = 0) {
  const start = daysAgo(startDaysAgo).getTime();
  const end   = daysAgo(endDaysAgo).getTime();
  return new Date(start + Math.random() * (end - start));
}

const FIRST_NAMES = ["Ana","Carlos","Maria","Joùo","Lucas","Fernanda","Pedro","Juliana","Rafael","Camila","Bruno","Beatriz","Diego","Letùcia","Marcos","Larissa","Felipe","Amanda","Eduardo","Patricia","Gabriel","Vanessa","Rodrigo","Renata","Thiago","Mariana","Leonardo","Dùbora","Henrique","Adriana","James","Sophie","Mohammed","Yuki","Lena"];
const LAST_NAMES  = ["Silva","Santos","Oliveira","Souza","Costa","Pereira","Ferreira","Lima","Carvalho","Alves","Rodrigues","Nascimento","Martins","Araùjo","Gomes","Smith","Brown","Mùller","Tanaka","Dupont"];
const CITIES      = ["Curitiba","Sùo Paulo","Rio de Janeiro","Londrina","Cascavel","Ponta Grossa","Foz do Iguaùu","Maringù","Guarapuava","Apucarana"];
const STATES      = ["PR","SP","RJ","MG","RS","SC"];
const GENDERS     = ["male","female","other","prefer_not_to_say"];
const AGE_BANDS   = ["18-24","25-34","35-44","45-54","55-64","65+"];
const INCOME      = ["A","B","C","D"];

// ??? 1. Fan profiles ?????????????????????????????????????????????????????????

async function seedFans() {
  const existing = await FanProfile.countDocuments({ tenantId: TENANT });
  if (existing >= 100) { console.log(`  Fans: ${existing} already exist ù skip`); return; }

  const fans = [];
  for (let i = 0; i < 120; i++) {
    const first = pick(FIRST_NAMES);
    const last  = pick(LAST_NAMES);
    const city  = pick(CITIES);
    const isForeigner = i < 5; // first 5 are foreigners
    const cpf   = isForeigner ? null : String(rnd(10000000000, 99999999999));
    fans.push({
      tenantId: TENANT,
      fanId: `fan-demo-${i + 1}`,
      fullName: `${first} ${last}`,
      email: `demo.fan.${i + 1}@coxa.demo`,
      phone: `+5541${rnd(900000000, 999999999)}`,
      cpf,
      isForeigner,
      status: "active",
      gender: pick(GENDERS),
      ageRange: pick(AGE_BANDS),
      householdIncomeBand: pick(INCOME),
      hasChildren: Math.random() > 0.5,
      address: { street: `Rua Demo ${i + 1}`, city, state: pick(STATES), country: "Brazil" },
      createdAt: randomDate(180, 1),
    });
  }
  for (const fan of fans) {
    await FanProfile.findOneAndUpdate(
      { tenantId: TENANT, email: fan.email },
      { $setOnInsert: fan },
      { upsert: true, new: false }
    ).catch(() => {});
  }
  console.log(`  Created ${fans.length} fan profiles`);
}

// ??? 2. Memberships + transactions ???????????????????????????????????????????

async function seedMemberships() {
  const existing = await FanMembership.countDocuments({ tenantId: TENANT });
  if (existing >= 30) { console.log(`  Memberships: ${existing} exist ù skip`); return; }

  const plans = await MembershipPlan.find({ tenantId: TENANT }).lean();
  if (!plans.length) { console.log("  No plans found ù run main seed first"); return; }

  const fans = await FanProfile.find({ tenantId: TENANT }).limit(100).lean();
  if (!fans.length) return;

  const memberships = [];
  const transactions = [];

  const statuses = ["active","active","active","active","active","active","cancelled","expired"];

  for (let i = 0; i < 80; i++) {
    const fan    = fans[i % fans.length];
    const plan   = plans[i % plans.length];
    const status = pick(statuses);
    const createdAt = randomDate(365, 30);
    const memId  = uid();

    memberships.push({
      _id: memId,
      tenantId: TENANT,
      fanProfileId: fan._id,
      planId: plan._id,
      planCode: plan.planCode,
      status,
      paymentFrequency: pick(["monthly","annual"]),
      paymentMethod: pick(["card","pix"]),
      startedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    // 1ù3 transactions per membership
    const txCount = rnd(1, 3);
    for (let t = 0; t < txCount; t++) {
      transactions.push({
        tenantId: TENANT,
        fanProfileId: fan._id,
        membershipId: memId,
        transactionType: t === 0 ? "new" : "renewal",
        amountCents: plan.monthlyPriceCents ?? 8990,
        status: "completed",
        paymentMethod: "pix",
        createdAt: new Date(createdAt.getTime() + t * 30 * 24 * 3600 * 1000),
      });
    }
  }

  try { await FanMembership.insertMany(memberships, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  try { await MembershipTransaction.insertMany(transactions, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  console.log(`  Created ${memberships.length} memberships + ${transactions.length} transactions`);
}

// ??? 3. Match events + tickets + attendance ??????????????????????????????????

async function seedTicketsAndAttendance() {
  const existingTickets = await Ticket.countDocuments({ tenantId: TENANT });
  if (existingTickets >= 100) { console.log(`  Tickets: ${existingTickets} exist ù skip`); return; }

  const fans = await FanProfile.find({ tenantId: TENANT }).limit(100).lean();
  if (!fans.length) return;

  const matchEvents = await MatchEvent.find({ tenantId: TENANT }).lean();
  if (!matchEvents.length) { console.log("  No match events ù run main seed first"); return; }

  const tickets = [];
  const attendance = [];

  for (const match of matchEvents.slice(0, 4)) {
    const count = rnd(30, 60);
    const usedCount = Math.floor(count * rnd(70, 92) / 100);
    const sections = ["NORTE","SUL","VIP","MEMBER"];

    for (let i = 0; i < count; i++) {
      const fan = fans[i % fans.length];
      const isUsed = i < usedCount;
      const section = pick(sections);
      const priceCents = section === "VIP" ? 35000 : section === "MEMBER" ? 4500 : 8000;
      const issuedAt = randomDate(60, 7);
      const ticketId = uid();

      tickets.push({
        _id: ticketId,
        tenantId: TENANT,
        ticketNumber: `TKT-DEMO-${match.eventCode}-${i + 1}`,
        matchEventId: match._id,
        ticketProductId: uid(),
        fanProfileId: fan._id,
        sectionCode: section,
        priceCents,
        qrToken: crypto.randomBytes(16).toString("hex"),
        status: isUsed ? "used" : "issued",
        paymentStatus: "paid",
        paymentMethod: pick(["pix","card","cash"]),
        channel: pick(["fan_app","box_office"]),
        issuedAt,
        usedAt: isUsed ? new Date(issuedAt.getTime() + rnd(1,3) * 24 * 3600000) : undefined,
      });

      if (isUsed) {
        attendance.push({
          tenantId: TENANT,
          matchEventId: match._id,
          fanProfileId: fan._id,
          ticketId,
          attendanceStatus: "present",
          idempotencyKey: `attn-demo-${match._id}-${i}`,
          entryMethod: pick(["qr","nfc"]),
          recordedAt: new Date(issuedAt.getTime() + rnd(1,3) * 24 * 3600000),
          gateId: pick(["G1","G2","G3","G4"]),
        });
      }
    }
  }

  try { await Ticket.insertMany(tickets, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  try { await AttendanceRecord.insertMany(attendance, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  console.log(`  Created ${tickets.length} tickets + ${attendance.length} attendance records`);
}

// ??? 4. Retail sales across 2 stores ?????????????????????????????????????????

async function seedRetailSales() {
  const existing = await Sale.countDocuments({ tenantId: TENANT, channel: "pos" });
  if (existing >= 100) { console.log(`  Sales: ${existing} exist ù skip`); return; }

  const fans = await FanProfile.find({ tenantId: TENANT }).limit(100).lean();
  const locs  = await Location.find({ tenantId: TENANT, type: "store" }).lean();
  if (!locs.length) { console.log("  No store locations ù run main seed first"); return; }

  // Ensure second store exists
  let cityStore = locs.find((l) => l.code === "city_store");
  if (!cityStore) {
    cityStore = await Location.create({ tenantId: TENANT, code: "city_store", name: "City Store", type: "store" });
    console.log("  Created City Store location");
  }
  const stadiumStore = locs.find((l) => l.code === "stadium_store") ?? locs[0];
  const allStores = [stadiumStore, cityStore];

  const skus = await Sku.find({ tenantId: TENANT }).lean();
  const cats = await Category.find({ tenantId: TENANT }).lean();
  if (!skus.length) { console.log("  No SKUs ù run main seed first"); return; }

  const PRODUCTS = [
    { name: "Home Jersey 2026", skuCode: "JERSEY-26-M", priceCents: 29900, categoryName: "Apparel" },
    { name: "Home Jersey 2026", skuCode: "JERSEY-26-S", priceCents: 29900, categoryName: "Apparel" },
    { name: "Club Cap",         skuCode: "CAP-001",     priceCents: 8900,  categoryName: "Apparel" },
    { name: "Fan Scarf",        skuCode: "SCARF-001",   priceCents: 5900,  categoryName: "Apparel" },
    { name: "Keyring",          skuCode: "KR-001",      priceCents: 1990,  categoryName: "Accessories" },
    { name: "Mug",              skuCode: "MUG-001",     priceCents: 3500,  categoryName: "Accessories" },
  ];

  // Ensure demo SKUs exist
  const apparel = cats.find((c) => c.code === "apparel") ?? cats[0];
  const acc     = cats.find((c) => c.code === "accessories") ?? cats[0];
  const ensuredSkus = {};
  for (const p of PRODUCTS) {
    let sku = skus.find((s) => s.skuCode === p.skuCode);
    if (!sku) {
      let prod = await Product.findOne({ tenantId: TENANT, name: p.name });
      if (!prod) prod = await Product.create({ tenantId: TENANT, name: p.name, status: "active", categoryId: apparel?._id });
      sku = await Sku.create({ tenantId: TENANT, productId: prod._id, skuCode: p.skuCode, variantLabel: p.skuCode, priceCents: p.priceCents, status: "active" });
    }
    ensuredSkus[p.skuCode] = { ...p, skuId: sku._id };
  }

  const sales = [];
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // 300 sales over 60 days across both stores
  for (let i = 0; i < 300; i++) {
    const location = allStores[i % 2 === 0 ? 0 : 1] ?? allStores[0];
    const fan      = Math.random() > 0.3 ? fans[i % fans.length] : null;
    const createdAt = randomDate(60, 0);
    const hour  = rnd(9, 21);
    const dow   = createdAt.getDay();
    createdAt.setHours(hour, rnd(0, 59), 0, 0);

    const lineCount = rnd(1, 3);
    const lines = [];
    let total = 0;

    for (let l = 0; l < lineCount; l++) {
      const prodKeys = Object.keys(ensuredSkus);
      const key  = pick(prodKeys);
      const prod = ensuredSkus[key];
      const qty  = rnd(1, 3);
      const lineTotal = prod.priceCents * qty;
      total += lineTotal;
      lines.push({
        skuId: prod.skuId,
        skuCode: key,
        productName: prod.name,
        qty,
        unitPriceCents: prod.priceCents,
        lineTotalCents: lineTotal,
        categoryName: prod.categoryName,
        locationName: location.name,
        hourOfDay: hour,
        dayOfWeek: dow,
      });
    }

    sales.push({
      tenantId: TENANT,
      saleNumber: `SALE-DEMO-${i + 1}`,
      locationId: location._id,
      lines,
      subtotalCents: total,
      totalCents: total,
      paymentStatus: "paid",
      paymentMethod: pick(["card","pix","cash"]),
      fanProfileId: fan?._id,
      channel: "pos",
      status: "completed",
      createdAt,
    });
  }

  // 100 online (fan_shop) sales
  const onlineLoc = await Location.findOne({ tenantId: TENANT, type: "online" });
  if (onlineLoc) {
    for (let i = 0; i < 100; i++) {
      const fan = fans[i % fans.length];
      const createdAt = randomDate(60, 0);
      const key  = pick(Object.keys(ensuredSkus));
      const prod = ensuredSkus[key];
      const qty  = rnd(1, 2);
      const lineTotal = prod.priceCents * qty;
      sales.push({
        tenantId: TENANT,
        saleNumber: `SALE-ONLINE-${i + 1}`,
        locationId: onlineLoc._id,
        lines: [{ skuId: prod.skuId, skuCode: key, productName: prod.name, qty, unitPriceCents: prod.priceCents, lineTotalCents: lineTotal, categoryName: prod.categoryName, locationName: "Fan Shop Online", hourOfDay: createdAt.getHours(), dayOfWeek: createdAt.getDay() }],
        subtotalCents: lineTotal,
        totalCents: lineTotal,
        paymentStatus: "paid",
        paymentMethod: "pix",
        fanProfileId: fan._id,
        channel: "fan_shop",
        status: "completed",
        createdAt,
      });
    }
  }

  try { await Sale.insertMany(sales, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  console.log(`  Created ${sales.length} sales`);
}

// ??? 5. Loyalty ledger ???????????????????????????????????????????????????????

async function seedLoyalty() {
  const existing = await LoyaltyLedgerEntry.countDocuments({ tenantId: TENANT });
  if (existing >= 100) { console.log(`  Loyalty: ${existing} exist ó skip`); return; }

  const fans = await FanProfile.find({ tenantId: TENANT }).limit(80).lean();
  const entries = [];

  for (let i = 0; i < 150; i++) {
    const fan = fans[i % fans.length];
    const isRedeem = i % 5 === 4;
    entries.push({
      tenantId: TENANT,
      fanProfileId: fan._id,
      type: isRedeem ? "redeem" : "earn",
      pointsDelta: isRedeem ? -rnd(100, 500) : rnd(50, 500),
      ruleType: isRedeem ? "redeem_reward" : pick(["earn_retail","earn_ticket","earn_attendance","earn_fan_shop"]),
      note: isRedeem ? "Reward redemption" : "Purchase earn",
      createdAt: randomDate(90, 0),
    });
  }

  try { await LoyaltyLedgerEntry.insertMany(entries, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  console.log(`  Created ${entries.length} loyalty entries`);
}

// ??? 6. Social channels + daily metrics ?????????????????????????????????????

async function seedSocial() {
  const existing = await SocialChannel.countDocuments({ tenantId: TENANT });
  if (existing >= 3) { console.log(`  Social: ${existing} channels exist ó skip`); return; }

  const channels = [
    { source: "instagram",  channelHandle: "@coritiba",     displayName: "Coritiba FBC", followersCount: 824000 },
    { source: "twitter_x",  channelHandle: "@Coritiba",     displayName: "Coritiba FBC", followersCount: 312000 },
    { source: "youtube",    channelHandle: "@CoritibaFBC",  displayName: "Coritiba FBC", followersCount: 185000 },
    { source: "tiktok",     channelHandle: "@coritibafbc",  displayName: "Coritiba FBC", followersCount: 94000  },
    { source: "facebook",   channelHandle: "CoritibaFBC",   displayName: "Coritiba FBC", followersCount: 560000 },
  ];

  const metrics = [];
  for (const ch of channels) {
    let channel = await SocialChannel.findOne({ tenantId: TENANT, source: ch.source });
    if (!channel) {
      channel = await SocialChannel.create({ tenantId: TENANT, ...ch, isActive: true, isVerified: true });
      console.log(`  Created social channel: ${ch.source}`);
    }

    // 30 days of daily metrics
    let followers = ch.followersCount - rnd(200, 1000);
    for (let d = 30; d >= 0; d--) {
      const growth = rnd(-50, 300);
      followers += growth;
      const reach = rnd(1000, 15000);
      const impressions = reach * rnd(2, 5);
      const likes    = rnd(50, 2000);
      const comments = rnd(5, 200);
      const shares   = rnd(2, 150);
      metrics.push({
        tenantId: TENANT,
        channelId: channel._id,
        source: ch.source,
        date: daysAgo(d),
        followersCount: followers,
        followersGrowth: growth,
        reach,
        impressions,
        likes,
        comments,
        shares,
        engagementRate: reach > 0 ? Number(((likes + comments + shares) / reach * 100).toFixed(2)) : 0,
        postsCount: rnd(0, 3),
      });
    }
  }

  try { await SocialMetric.insertMany(metrics, { ordered: false }); } catch(e) { if(e.code !== 11000 && !e.message?.includes("11000")) throw e; }
  console.log(`  Created ${metrics.length} social metric records`);
}

// ??? 7. Saved filter audiences ???????????????????????????????????????????????

async function seedFilters() {
  const existing = await SavedFilter.countDocuments({ tenantId: TENANT });
  if (existing >= 3) { console.log(`  Filters: ${existing} exist ó skip`); return; }

const filters = [
    { name: "High-Value Members",   lastRunCount: 48, rules: [{ field: "planCode", operator: "in",    value: "ALTO_GLORIA_SOC" }] },
    { name: "Curitiba Fans",        lastRunCount: 72, rules: [{ field: "address.city", operator: "eq", value: "Curitiba" }] },
    { name: "No CPF - Follow Up",   lastRunCount: 11, rules: [{ field: "cpf", operator: "exists",     value: false }] },
    { name: "Recent Buyers (30 d)", lastRunCount: 63, rules: [{ field: "lastPurchaseAt", operator: "gte", value: "30d" }] },
    { name: "Churned Members",      lastRunCount: 14, rules: [{ field: "memberStatus",  operator: "eq", value: "cancelled" }] },
  ];

  await SavedFilter.insertMany(
    filters.map((f) => ({ tenantId: TENANT, ...f, lastRunAt: randomDate(30, 1) })),
    { ordered: false },
  );
  console.log(`  Created ${filters.length} saved filters`);
}

// ??? main ????????????????????????????????????????????????????????????????????

export async function runSeedDemo() {
  const log = [];
  const step = (msg) => { console.log(msg); log.push(msg); };
  step("[1/7] Fan profiles");   await seedFans();
  step("[2/7] Memberships");    await seedMemberships();
  step("[3/7] Tickets");        await seedTicketsAndAttendance();
  step("[4/7] Retail sales");   await seedRetailSales();
  step("[5/7] Loyalty");        await seedLoyalty();
  step("[6/7] Social");         await seedSocial();
  step("[7/7] Saved filters");  await seedFilters();
  step("Demo seed complete!");
  return log;
}

async function run() {
  console.log("Connecting to database...");
  await connectDB();
  console.log("Connected. Seeding demo data.\n");
  await runSeedDemo();
  console.log("\nAll screens should now show populated charts and KPIs.");
  await disconnectDB();
}

import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error("Seed error:", err);
    mongoose.connection.close();
    process.exit(1);
  });
}