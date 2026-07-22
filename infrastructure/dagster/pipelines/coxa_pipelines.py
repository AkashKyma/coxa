"""
Coxa Dagster Pipelines — Phase 2 + Phase 3 orchestration

Schedules:
  - mv_refresh:     every 30 min — OPTIMIZE ClickHouse materialized views
  - fan_360_refresh: hourly      — sync MongoDB fan profiles → ClickHouse fan_360
  - ml_scoring:     daily 02:00  — XGBoost churn/propensity/channel scoring + writeback
"""
import os
import json
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from dagster import (
    op, job, schedule, ScheduleDefinition, Definitions,
    get_dagster_logger, Out, In, Nothing,
)
import clickhouse_connect
from pymongo import MongoClient, UpdateOne
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
import joblib
import tempfile

# ─── Connection helpers ───────────────────────────────────────────────────────

def get_clickhouse():
    return clickhouse_connect.get_client(
        host=os.environ.get("CLICKHOUSE_HOST", "localhost"),
        port=int(os.environ.get("CLICKHOUSE_HTTP_PORT", "8123")),
        database="coxa",
        username=os.environ.get("CLICKHOUSE_USER", "coxa"),
        password=os.environ.get("CLICKHOUSE_PASSWORD", "coxa_dev_password"),
    )

def get_mongo():
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/coxa")
    return MongoClient(uri)

# ─── Op: refresh_materialized_views ──────────────────────────────────────────

@op(out=Out(Nothing))
def refresh_materialized_views(context):
    """OPTIMIZE ClickHouse materialized views to merge parts."""
    log = get_dagster_logger()
    ch = get_clickhouse()
    views = [
        "coxa.mv_daily_sales",
        "coxa.mv_monthly_memberships",
        "coxa.mv_weekly_tickets",
    ]
    for view in views:
        ch.command(f"OPTIMIZE TABLE {view} FINAL")
        log.info(f"Optimized {view}")
    log.info(f"All {len(views)} materialized views refreshed")

# ─── Op: sync_fan_360 ─────────────────────────────────────────────────────────

@op(out={"tenant_ids": Out(list)})
def sync_fan_360(context):
    """
    Real MongoDB → ClickHouse fan_360 sync.
    Reads FanProfile + computed stats from MongoDB, upserts to ClickHouse fan_360.
    """
    log = get_dagster_logger()
    mongo = get_mongo()
    ch = get_clickhouse()

    # Determine database name from URI
    uri = os.environ.get("MONGODB_URI", "")
    db_name = uri.split("/")[-1].split("?")[0] if "/" in uri else "coxa"
    db = mongo[db_name]

    tenants = db["fanprofiles"].distinct("tenantId")
    log.info(f"Syncing fan_360 for {len(tenants)} tenants")

    for tenant_id in tenants:
        # Aggregate fan stats from MongoDB in one pipeline
        pipeline = [
            {"$match": {"tenantId": tenant_id, "status": "active"}},
            {
                "$lookup": {
                    "from": "fantraits",
                    "localField": "_id",
                    "foreignField": "fanProfileId",
                    "as": "traits",
                }
            },
            {
                "$lookup": {
                    "from": "loyalityledgerentries",
                    "localField": "_id",
                    "foreignField": "fanProfileId",
                    "as": "loyalty",
                }
            },
            {
                "$lookup": {
                    "from": "fanscores",
                    "localField": "_id",
                    "foreignField": "fanProfileId",
                    "pipeline": [{"$sort": {"createdAt": -1}}, {"$limit": 1}],
                    "as": "score",
                }
            },
            {
                "$project": {
                    "tenantId": 1,
                    "fanId": 1,
                    "fullName": 1,
                    "email": 1,
                    "phone": {"$ifNull": ["$phone", ""]},
                    "hasCpf": {"$cond": [{"$gt": ["$cpf", None]}, 1, 0]},
                    "isForeigner": {"$cond": ["$isForeigner", 1, 0]},
                    "createdAt": 1,
                    "updatedAt": 1,
                    "churnRiskScore": {"$ifNull": ["$churnRiskScore", 0.0]},
                    "ticketPropensity": {"$ifNull": ["$ticketPropensity", 0.0]},
                    "retailPropensity": {"$ifNull": ["$retailPropensity", 0.0]},
                    "nextBestChannel": {"$ifNull": ["$nextBestChannel", ""]},
                    "mlScoresUpdatedAt": {"$ifNull": ["$mlScoresUpdatedAt", datetime(1970, 1, 1)]},
                    "fanScore": {"$ifNull": [{"$arrayElemAt": ["$score.totalScore", 0]}, 0.0]},
                    "loyaltyPoints": {"$sum": "$loyalty.points"},
                    "loyaltyRedeemed": {
                        "$sum": {
                            "$map": {
                                "input": "$loyalty",
                                "as": "e",
                                "in": {"$cond": [{"$lt": ["$$e.points", 0]}, {"$abs": "$$e.points"}, 0]},
                            }
                        }
                    },
                }
            },
        ]

        fans = list(db["fanprofiles"].aggregate(pipeline, allowDiskUse=True))
        if not fans:
            log.info(f"  tenant {tenant_id}: no fans, skipping")
            continue

        # Fetch ticket stats from MongoDB Sales/Tickets collections
        ticket_stats = {
            str(s["_id"]): s
            for s in db["tickets"].aggregate([
                {"$match": {"tenantId": tenant_id}},
                {"$group": {
                    "_id": "$fanProfileId",
                    "purchased": {"$sum": 1},
                    "used": {"$sum": {"$cond": [{"$eq": ["$status", "used"]}, 1, 0]}},
                    "checkins": {"$sum": {"$cond": [{"$eq": ["$status", "used"]}, 1, 0]}},
                    "lastActivity": {"$max": "$issuedAt"},
                }},
            ])
        }

        # Fetch sales stats
        sales_stats = {
            str(s["_id"]): s
            for s in db["sales"].aggregate([
                {"$match": {"tenantId": tenant_id, "isReturn": {"$ne": True}}},
                {"$group": {
                    "_id": "$fanProfileId",
                    "count": {"$sum": 1},
                    "totalCents": {"$sum": "$totalCents"},
                    "lastActivity": {"$max": "$saleTimestamp"},
                }},
            ])
        }

        # Build ClickHouse rows
        rows = []
        for fan in fans:
            fid = str(fan["_id"])
            ts = ticket_stats.get(fid, {})
            ss = sales_stats.get(fid, {})

            last_activity = max(
                ts.get("lastActivity") or datetime(2000, 1, 1),
                ss.get("lastActivity") or datetime(2000, 1, 1),
                fan.get("updatedAt") or datetime(2000, 1, 1),
            )

            rows.append({
                "tenant_id": tenant_id,
                "fan_profile_id": fid,
                "fan_id": fan.get("fanId", ""),
                "full_name": fan.get("fullName", ""),
                "email": fan.get("email", ""),
                "phone": fan.get("phone", ""),
                "has_cpf": int(fan.get("hasCpf", 0)),
                "is_foreigner": int(fan.get("isForeigner", 0)),
                "membership_status": "",
                "membership_plan_code": "",
                "membership_tier_level": 0,
                "fan_score": float(fan.get("fanScore", 0)),
                "churn_risk_score": float(fan.get("churnRiskScore", 0)),
                "ticket_propensity": float(fan.get("ticketPropensity", 0)),
                "retail_propensity": float(fan.get("retailPropensity", 0)),
                "next_best_channel": fan.get("nextBestChannel", ""),
                "total_tickets_purchased": int(ts.get("purchased", 0)),
                "total_tickets_used": int(ts.get("used", 0)),
                "total_sales_count": int(ss.get("count", 0)),
                "total_sales_cents": int(ss.get("totalCents", 0)),
                "total_loyalty_points": int(fan.get("loyaltyPoints", 0)),
                "total_loyalty_redeemed": int(fan.get("loyaltyRedeemed", 0)),
                "total_checkins": int(ts.get("checkins", 0)),
                "last_activity_at": last_activity,
                "registered_at": fan.get("createdAt", datetime(2000, 1, 1)),
                "segment_ids": [],
                "ml_scores_updated_at": fan.get("mlScoresUpdatedAt", datetime(1970, 1, 1)),
                "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
            })

        # Batch insert to ClickHouse (ReplacingMergeTree deduplicates by updated_at)
        df = pd.DataFrame(rows)
        ch.insert_df("coxa.fan_360", df)
        log.info(f"  tenant {tenant_id}: upserted {len(rows)} fan_360 rows")

    mongo.close()
    return tenants

# ─── Op: extract_ml_features ──────────────────────────────────────────────────

@op(ins={"start": In(Nothing)}, out={"features_df": Out(pd.DataFrame)})
def extract_ml_features(context):
    """
    Query fan_features MV from ClickHouse and return as a DataFrame for ML scoring.
    """
    log = get_dagster_logger()
    ch = get_clickhouse()

    result = ch.query("""
        SELECT
            tenant_id,
            fan_profile_id,
            fan_score,
            membership_tier_level,
            has_cpf,
            days_since_last_activity,
            days_since_registration,
            total_tickets_purchased,
            total_tickets_used,
            ticket_use_rate,
            total_sales_count,
            total_sales_cents,
            avg_sale_value_cents,
            total_loyalty_points,
            loyalty_redemption_rate,
            total_checkins,
            checkin_rate,
            sales_last_90d,
            tickets_last_90d,
            points_earned_30d,
            churn_risk_score AS current_churn_score,
            ticket_propensity AS current_ticket_propensity,
            next_best_channel AS current_channel
        FROM coxa.fan_features
        WHERE fan_profile_id != ''
        LIMIT 100000
    """)

    df = result.df()
    log.info(f"Extracted features for {len(df)} fans across all tenants")
    return df

FEATURE_COLS = [
    "fan_score", "membership_tier_level", "has_cpf",
    "days_since_last_activity", "days_since_registration",
    "total_tickets_purchased", "total_tickets_used", "ticket_use_rate",
    "total_sales_count", "total_sales_cents", "avg_sale_value_cents",
    "total_loyalty_points", "loyalty_redemption_rate",
    "total_checkins", "checkin_rate",
    "sales_last_90d", "tickets_last_90d", "points_earned_30d",
]

CHANNEL_LABELS = ["push", "email", "whatsapp", "sms"]

# ─── Op: score_churn_risk ─────────────────────────────────────────────────────

@op(ins={"features_df": In(pd.DataFrame)}, out={"scored_df": Out(pd.DataFrame)})
def score_churn_risk(context, features_df):
    """
    XGBoost churn risk model.
    Label: fan is at churn risk if days_since_last_activity > 90 AND fan_score < 20000.
    """
    log = get_dagster_logger()
    df = features_df.copy()

    X = df[FEATURE_COLS].fillna(0)

    # Heuristic labels for self-supervised training
    # In production: replace with actual churn outcomes from CRM
    y_churn = ((df["days_since_last_activity"] > 90) & (df["fan_score"] < 20000)).astype(int)

    if y_churn.sum() < 10 or (1 - y_churn).sum() < 10:
        log.warning("Insufficient churn samples — using heuristic scores only")
        df["churn_risk_score"] = (df["days_since_last_activity"] / 365).clip(0, 1).fillna(0)
        return df

    X_train, X_test, y_train, y_test = train_test_split(X, y_churn, test_size=0.2, random_state=42)
    base_model = GradientBoostingClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model = CalibratedClassifierCV(base_model, cv=3, method="isotonic")
    model.fit(X_train, y_train)

    accuracy = model.score(X_test, y_test)
    log.info(f"Churn model accuracy: {accuracy:.3f} on {len(X_test)} test samples")

    df["churn_risk_score"] = model.predict_proba(X)[:, 1]
    return df

# ─── Op: score_ticket_propensity ──────────────────────────────────────────────

@op(ins={"scored_df": In(pd.DataFrame)}, out={"scored_df2": Out(pd.DataFrame)})
def score_ticket_propensity(context, scored_df):
    """XGBoost ticket purchase propensity model."""
    log = get_dagster_logger()
    df = scored_df.copy()
    X = df[FEATURE_COLS].fillna(0)

    # Label: fan bought a ticket in the last 90 days
    y_ticket = (df["tickets_last_90d"] > 0).astype(int)

    if y_ticket.sum() < 10 or (1 - y_ticket).sum() < 10:
        log.warning("Insufficient ticket samples — using heuristic scores")
        df["ticket_propensity"] = (df["total_tickets_purchased"] / (df["total_tickets_purchased"].max() + 1)).fillna(0)
        return df

    X_train, X_test, y_train, y_test = train_test_split(X, y_ticket, test_size=0.2, random_state=42)
    base_model = GradientBoostingClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model = CalibratedClassifierCV(base_model, cv=3, method="isotonic")
    model.fit(X_train, y_train)

    log.info(f"Ticket propensity model accuracy: {model.score(X_test, y_test):.3f}")
    df["ticket_propensity"] = model.predict_proba(X)[:, 1]
    return df

# ─── Op: score_retail_propensity ──────────────────────────────────────────────

@op(ins={"scored_df2": In(pd.DataFrame)}, out={"scored_df3": Out(pd.DataFrame)})
def score_retail_propensity(context, scored_df2):
    """XGBoost retail purchase propensity model."""
    log = get_dagster_logger()
    df = scored_df2.copy()
    X = df[FEATURE_COLS].fillna(0)

    y_retail = (df["sales_last_90d"] > 0).astype(int)

    if y_retail.sum() < 10 or (1 - y_retail).sum() < 10:
        log.warning("Insufficient retail samples — using heuristic scores")
        df["retail_propensity"] = (df["total_sales_count"] / (df["total_sales_count"].max() + 1)).fillna(0)
        return df

    X_train, X_test, y_train, y_test = train_test_split(X, y_retail, test_size=0.2, random_state=42)
    base_model = GradientBoostingClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model = CalibratedClassifierCV(base_model, cv=3, method="isotonic")
    model.fit(X_train, y_train)

    log.info(f"Retail propensity model accuracy: {model.score(X_test, y_test):.3f}")
    df["retail_propensity"] = model.predict_proba(X)[:, 1]
    return df

# ─── Op: score_next_best_channel ──────────────────────────────────────────────

@op(ins={"scored_df3": In(pd.DataFrame)}, out={"final_df": Out(pd.DataFrame)})
def score_next_best_channel(context, scored_df3):
    """
    Rule-based next-best-channel classifier.
    Priority: push (high engagement) > whatsapp (high loyalty) > email (default) > sms (low digital)
    """
    log = get_dagster_logger()
    df = scored_df3.copy()

    def pick_channel(row):
        # High engagement fans prefer push
        if row["days_since_last_activity"] < 14 and row["total_checkins"] > 5:
            return "push"
        # Loyalty-active fans respond well to WhatsApp
        if row["points_earned_30d"] > 100 or row["loyalty_redemption_rate"] > 0.5:
            return "whatsapp"
        # Fans with email (has_cpf implies digital registration) → email
        if row["has_cpf"] == 1:
            return "email"
        # Low digital footprint → SMS
        return "sms"

    df["next_best_channel"] = df.apply(pick_channel, axis=1)
    channel_dist = df["next_best_channel"].value_counts().to_dict()
    log.info(f"Next-best-channel distribution: {channel_dist}")
    return df

# ─── Op: write_ml_scores ──────────────────────────────────────────────────────

@op(ins={"final_df": In(pd.DataFrame)})
def write_ml_scores(context, final_df):
    """
    Write ML scores back to:
      1. ClickHouse fan_360 (via INSERT with ReplacingMergeTree dedup)
      2. MongoDB FanProfile (bulk UpdateOne operations)
    """
    log = get_dagster_logger()
    ch = get_clickhouse()
    mongo = get_mongo()

    uri = os.environ.get("MONGODB_URI", "")
    db_name = uri.split("/")[-1].split("?")[0] if "/" in uri else "coxa"
    db = mongo[db_name]

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Update ClickHouse fan_360 — use ALTER TABLE UPDATE (lightweight mutation)
    tenants = final_df["tenant_id"].unique()
    updated_ch = 0
    for tenant_id in tenants:
        tenant_df = final_df[final_df["tenant_id"] == tenant_id]
        for _, row in tenant_df.iterrows():
            ch.command(f"""
                ALTER TABLE coxa.fan_360 UPDATE
                    churn_risk_score = {float(row.get('churn_risk_score', 0)):.6f},
                    ticket_propensity = {float(row.get('ticket_propensity', 0)):.6f},
                    retail_propensity = {float(row.get('retail_propensity', 0)):.6f},
                    next_best_channel = '{row.get('next_best_channel', '')}',
                    ml_scores_updated_at = now()
                WHERE tenant_id = '{tenant_id}'
                  AND fan_profile_id = '{row['fan_profile_id']}'
            """)
            updated_ch += 1

    log.info(f"Updated {updated_ch} rows in ClickHouse fan_360")

    # 2. Bulk update MongoDB FanProfile
    mongo_ops = []
    for _, row in final_df.iterrows():
        from bson import ObjectId
        try:
            fid = ObjectId(row["fan_profile_id"])
        except Exception:
            continue
        mongo_ops.append(UpdateOne(
            {"_id": fid},
            {"$set": {
                "churnRiskScore": float(row.get("churn_risk_score", 0)),
                "ticketPropensity": float(row.get("ticket_propensity", 0)),
                "retailPropensity": float(row.get("retail_propensity", 0)),
                "nextBestChannel": str(row.get("next_best_channel", "")),
                "mlScoresUpdatedAt": now,
            }},
        ))

    if mongo_ops:
        result = db["fanprofiles"].bulk_write(mongo_ops, ordered=False)
        log.info(f"MongoDB bulk_write: {result.modified_count} profiles updated")

    mongo.close()
    log.info("ML score writeback complete")

# ─── Jobs ─────────────────────────────────────────────────────────────────────

@job
def mv_refresh_job():
    refresh_materialized_views()

@job
def fan_360_refresh_job():
    tenants = sync_fan_360()

@job
def ml_scoring_job():
    # fan_360 sync must run first so fan_features MV has fresh data
    tenants = sync_fan_360()
    # Then extract features and run the scoring pipeline
    features = extract_ml_features(start=tenants)
    scored1 = score_churn_risk(features_df=features)
    scored2 = score_ticket_propensity(scored_df=scored1)
    scored3 = score_retail_propensity(scored_df2=scored2)
    final = score_next_best_channel(scored_df3=scored3)
    write_ml_scores(final_df=final)

# ─── Schedules ────────────────────────────────────────────────────────────────

mv_refresh_schedule = ScheduleDefinition(
    job=mv_refresh_job,
    cron_schedule="*/30 * * * *",
    name="mv_refresh_every_30min",
)

fan_360_schedule = ScheduleDefinition(
    job=fan_360_refresh_job,
    cron_schedule="0 * * * *",
    name="fan_360_hourly_refresh",
)

ml_scoring_schedule = ScheduleDefinition(
    job=ml_scoring_job,
    cron_schedule="0 2 * * *",
    name="ml_scoring_daily",
)

# ─── Definitions ──────────────────────────────────────────────────────────────

defs = Definitions(
    jobs=[mv_refresh_job, fan_360_refresh_job, ml_scoring_job],
    schedules=[mv_refresh_schedule, fan_360_schedule, ml_scoring_schedule],
)
