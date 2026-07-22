-- ─────────────────────────────────────────────────────────────────────────────
-- Coxa ClickHouse Schema — Phase 2 + Phase 3
-- Run automatically on first container start via docker-entrypoint-initdb.d
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS coxa;

-- ═══════════════════════════════════════════════════════════════════════════
-- coxa_events — All CDP events from RudderStack (streaming inserts)
-- Primary analytical table. Partitioned by month, ordered by tenant+time.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.coxa_events (
    tenant_id         String,
    event_id          String,
    event_name        String,          -- e.g. 'sale.completed', 'ticket.purchased'
    source            String,          -- e.g. 'retail_pos', 'fan_app', 'web_sdk'
    fan_profile_id    String,          -- MongoDB ObjectId or empty for anon
    anonymous_id      String,          -- RudderStack anonymous_id (pre-identify)
    user_id           String,          -- RudderStack userId (post-identify)
    idempotency_key   String,
    payload           String,          -- JSON blob of event-specific data
    properties        String,          -- RudderStack properties JSON
    received_at       DateTime,
    event_timestamp   DateTime,
    payload_version   UInt8 DEFAULT 1,
    ingested_at       DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (tenant_id, event_name, event_timestamp)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- coxa_sales — POS + e-commerce sales (denormalized for fast KPI queries)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.coxa_sales (
    tenant_id             String,
    sale_id               String,
    sale_number           String,
    fan_profile_id        String,
    location_id           String,
    location_name         String,
    channel               String,          -- 'retail_pos' | 'fan_shop'
    payment_method        String,
    total_cents           Int64,
    line_count            UInt16,
    units_sold            UInt32,
    sale_timestamp        DateTime,
    is_return             UInt8 DEFAULT 0, -- 1 = return transaction
    return_id             String,
    refund_cents          Int64 DEFAULT 0,
    created_at            DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(sale_timestamp)
ORDER BY (tenant_id, sale_timestamp, fan_profile_id)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS coxa.coxa_sale_lines (
    tenant_id       String,
    sale_id         String,
    sku_id          String,
    sku_code        String,
    product_name    String,
    category        String,
    qty             UInt16,
    unit_price_cents Int64,
    line_total_cents Int64,
    sale_timestamp  DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(sale_timestamp)
ORDER BY (tenant_id, sale_timestamp, sku_id)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- coxa_tickets — Ticket issuance + gate usage
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.coxa_tickets (
    tenant_id           String,
    ticket_id           String,
    ticket_number       String,
    fan_profile_id      String,
    match_event_id      String,
    event_title         String,
    event_date          Date,
    channel             String,
    price_cents         Int64,
    status              String,         -- 'issued' | 'used' | 'cancelled' | 'no_show'
    issued_at           DateTime,
    used_at             DateTime,
    is_member_ticket    UInt8 DEFAULT 0,
    reservation_id      String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(issued_at)
ORDER BY (tenant_id, match_event_id, issued_at)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- coxa_memberships — Membership lifecycle events
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.coxa_memberships (
    tenant_id           String,
    membership_id       String,
    fan_profile_id      String,
    plan_code           String,
    plan_name           String,
    tier_level          UInt8,
    payment_frequency   String,
    price_cents         Int64,
    status              String,         -- 'active' | 'cancelled' | 'expired'
    action              String,         -- 'created' | 'renewed' | 'upgraded' | 'cancelled'
    started_at          DateTime,
    expires_at          DateTime,
    event_timestamp     DateTime,
    created_at          DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (tenant_id, event_timestamp, fan_profile_id)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- coxa_loyalty — Loyalty ledger events
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.coxa_loyalty (
    tenant_id       String,
    entry_id        String,
    fan_profile_id  String,
    points          Int32,              -- positive = earn, negative = redeem/reverse
    action          String,             -- 'earned' | 'redeemed' | 'reversed' | 'adjusted'
    reason          String,
    source_event    String,             -- the CDP event that triggered this
    event_timestamp DateTime,
    created_at      DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (tenant_id, event_timestamp, fan_profile_id)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- fan_360 — Denormalized fan profile with aggregated stats (updated daily)
-- Source for Cube queries and Multiwoven reverse ETL syncs
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.fan_360 (
    tenant_id                   String,
    fan_profile_id              String,
    fan_id                      String,
    full_name                   String,
    email                       String,
    phone                       String,
    has_cpf                     UInt8,
    is_foreigner                UInt8,
    membership_status           String,
    membership_plan_code        String,
    membership_tier_level       UInt8,
    fan_score                   Float32,
    churn_risk_score            Float32 DEFAULT 0,
    ticket_propensity           Float32 DEFAULT 0,
    retail_propensity           Float32 DEFAULT 0,
    next_best_channel           String DEFAULT '',
    total_tickets_purchased     UInt32,
    total_tickets_used          UInt32,
    total_sales_count           UInt32,
    total_sales_cents           Int64,
    total_loyalty_points        Int32,
    total_loyalty_redeemed      Int32,
    total_checkins              UInt32,
    last_activity_at            DateTime,
    registered_at               DateTime,
    segment_ids                 Array(String),
    ml_scores_updated_at        DateTime DEFAULT toDateTime(0),
    updated_at                  DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, fan_profile_id)
SETTINGS index_granularity = 8192;

-- ═══════════════════════════════════════════════════════════════════════════
-- Materialized Views — Pre-aggregated for instant KPI queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Daily sales summary
CREATE MATERIALIZED VIEW IF NOT EXISTS coxa.mv_daily_sales
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, sale_date, channel)
POPULATE
AS SELECT
    tenant_id,
    toDate(sale_timestamp)    AS sale_date,
    channel,
    count()                   AS orders,
    sum(total_cents)          AS revenue_cents,
    sum(units_sold)           AS units_sold,
    sum(line_count)           AS line_count
FROM coxa.coxa_sales
WHERE is_return = 0
GROUP BY tenant_id, sale_date, channel;

-- Monthly membership snapshot
CREATE MATERIALIZED VIEW IF NOT EXISTS coxa.mv_monthly_memberships
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, period_month, action)
POPULATE
AS SELECT
    tenant_id,
    toYYYYMM(event_timestamp)  AS period_month,
    plan_code,
    action,
    count()                    AS count,
    sum(price_cents)           AS revenue_cents
FROM coxa.coxa_memberships
GROUP BY tenant_id, period_month, plan_code, action;

-- Weekly ticket summary
CREATE MATERIALIZED VIEW IF NOT EXISTS coxa.mv_weekly_tickets
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, week_start, match_event_id)
POPULATE
AS SELECT
    tenant_id,
    toMonday(issued_at)        AS week_start,
    match_event_id,
    event_title,
    count()                    AS tickets_issued,
    countIf(status = 'used')   AS tickets_used,
    countIf(status = 'no_show') AS no_shows,
    sum(price_cents)           AS revenue_cents
FROM coxa.coxa_tickets
GROUP BY tenant_id, week_start, match_event_id, event_title;

-- ═══════════════════════════════════════════════════════════════════════════
-- fan_features — Phase 3 ML feature store
-- Simple flat select from fan_360 (already has all aggregated stats).
-- The 90/30 day rolling counts are best computed by Dagster on schedule
-- since ClickHouse MVs in v24 do not support CTE + JOIN on external tables.
-- When Dagster refreshes fan_360, the MV auto-populates with fresh data.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW IF NOT EXISTS coxa.fan_features
ENGINE = AggregatingMergeTree()
ORDER BY (tenant_id, fan_profile_id)
POPULATE
AS SELECT
    tenant_id,
    fan_profile_id,
    fan_score,
    membership_tier_level,
    has_cpf,
    is_foreigner,
    dateDiff('day', last_activity_at, now())                                            AS days_since_last_activity,
    dateDiff('day', registered_at, now())                                               AS days_since_registration,
    total_tickets_purchased,
    total_tickets_used,
    if(total_tickets_purchased > 0,
        toFloat32(total_tickets_used) / total_tickets_purchased, 0)                     AS ticket_use_rate,
    total_sales_count,
    total_sales_cents,
    if(total_sales_count > 0,
        toFloat32(total_sales_cents) / total_sales_count, 0)                            AS avg_sale_value_cents,
    total_loyalty_points,
    total_loyalty_redeemed,
    if(total_loyalty_points > 0,
        toFloat32(total_loyalty_redeemed) / total_loyalty_points, 0)                    AS loyalty_redemption_rate,
    total_checkins,
    if(total_tickets_purchased > 0,
        toFloat32(total_checkins) / total_tickets_purchased, 0)                         AS checkin_rate,
    -- Rolling 90/30 day counts are set to 0 here; Dagster populates fan_360
    -- total_sales_count / total_tickets_purchased as a proxy until ML pipeline runs
    toFloat32(0)                                                                        AS sales_last_90d,
    toFloat32(0)                                                                        AS tickets_last_90d,
    toFloat32(0)                                                                        AS points_earned_30d,
    churn_risk_score,
    ticket_propensity,
    retail_propensity,
    next_best_channel,
    ml_scores_updated_at,
    now()                                                                               AS computed_at
FROM coxa.fan_360;

-- ═══════════════════════════════════════════════════════════════════════════
-- segment_memberships — which fans belong to which ClickHouse-evaluated segments
-- Written by segmentService.js after each ClickHouse segment evaluation run.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coxa.segment_memberships (
    tenant_id       String,
    segment_id      String,
    fan_profile_id  String,
    evaluated_at    DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(evaluated_at)
ORDER BY (tenant_id, segment_id, fan_profile_id)
SETTINGS index_granularity = 8192;
