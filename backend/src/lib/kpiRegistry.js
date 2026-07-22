/**
 * KPI Registry — config-driven catalog of every metric in the platform.
 * Each entry defines:
 *   key          – unique snake_case identifier
 *   label        – human display name
 *   unit         – 'count' | 'cents' | 'pct' | 'text'
 *   format       – 'number' | 'currency' | 'percent' | 'string'
 *   tier         – 'essential' | 'advanced'
 *   department   – source module
 *   industry     – ['football_club'] (extensible per WS9)
 *   description  – tooltip / plain-language "what question does this answer"
 *   analysisHint – what this metric reveals when high/low
 *   defaultViz   – recommended chart type for this KPI
 */

export const KPI_REGISTRY = [
  // ── Fan base ──────────────────────────────────────────────────────────────
  { key: "total_fans", label: "Total Fans", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "All active fan profiles for this club.", analysisHint: "Overall reach of the fan base.", defaultViz: "kpi_card" },
  { key: "with_cpf", label: "With CPF", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "Profiles with a valid Brazilian CPF on record.", analysisHint: "Data completeness for compliance.", defaultViz: "kpi_card" },
  { key: "with_foreigners", label: "Foreigners", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "Profiles flagged as foreign (CPF not required).", analysisHint: "International fan reach.", defaultViz: "kpi_card" },
  { key: "without_cpf_not_foreigner", label: "Missing CPF (not foreigner)", unit: "count", format: "number", tier: "advanced", department: "fans", industry: ["football_club"], description: "Profiles missing CPF and not flagged as foreigner — data quality gap.", analysisHint: "Profiles requiring data completion outreach.", defaultViz: "kpi_card" },
  { key: "with_email", label: "With Email", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "Profiles with a non-empty email.", analysisHint: "Email reachability.", defaultViz: "kpi_card" },
  { key: "with_phone", label: "With Phone", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "Profiles with a phone number.", analysisHint: "SMS/push reachability.", defaultViz: "kpi_card" },
  { key: "with_address", label: "With Address", unit: "count", format: "number", tier: "advanced", department: "fans", industry: ["football_club"], description: "Profiles with at least street + city.", analysisHint: "Physical mail / geo-targeting readiness.", defaultViz: "kpi_card" },
  { key: "fan_growth_rate_pct", label: "Fan Growth Rate", unit: "pct", format: "percent", tier: "essential", department: "fans", industry: ["football_club"], description: "% change in fan base vs previous period.", analysisHint: "Momentum of fan acquisition.", defaultViz: "line" },
  { key: "active_fans_30d", label: "Active Fans (30 d)", unit: "count", format: "number", tier: "essential", department: "fans", industry: ["football_club"], description: "Fans with at least one event in the last 30 days.", analysisHint: "Engaged base size.", defaultViz: "kpi_card" },

  // ── Membership ────────────────────────────────────────────────────────────
  { key: "active_memberships", label: "Active Memberships", unit: "count", format: "number", tier: "essential", department: "membership", industry: ["football_club"], description: "Members with active status.", analysisHint: "Core subscriber base.", defaultViz: "kpi_card" },
  { key: "new_memberships", label: "New Memberships", unit: "count", format: "number", tier: "essential", department: "membership", industry: ["football_club"], description: "Joins in the selected period.", analysisHint: "Acquisition velocity.", defaultViz: "bar" },
  { key: "churned_memberships", label: "Churned / Cancelled", unit: "count", format: "number", tier: "essential", department: "membership", industry: ["football_club"], description: "Cancellations in the selected period.", analysisHint: "Churn pressure.", defaultViz: "bar" },
  { key: "reactivated_memberships", label: "Reactivated", unit: "count", format: "number", tier: "advanced", department: "membership", industry: ["football_club"], description: "Members who re-joined after cancellation.", analysisHint: "Win-back effectiveness.", defaultViz: "kpi_card" },
  { key: "net_member_growth", label: "Net Member Growth", unit: "count", format: "number", tier: "essential", department: "membership", industry: ["football_club"], description: "New − churned in the period.", analysisHint: "Net subscriber momentum.", defaultViz: "combo" },
  { key: "membership_revenue_cents", label: "Membership Revenue", unit: "cents", format: "currency", tier: "essential", department: "membership", industry: ["football_club"], description: "Revenue from membership transactions in the period.", analysisHint: "Subscription revenue stream.", defaultViz: "bar" },
  { key: "membership_arpu_cents", label: "ARPU", unit: "cents", format: "currency", tier: "advanced", department: "membership", industry: ["football_club"], description: "Average Revenue Per User — revenue ÷ active members.", analysisHint: "Per-member monetisation.", defaultViz: "kpi_card" },
  { key: "avg_tenure_months", label: "Avg Tenure (months)", unit: "count", format: "number", tier: "advanced", department: "membership", industry: ["football_club"], description: "Average months since first membership.", analysisHint: "Loyalty depth.", defaultViz: "kpi_card" },
  { key: "adimplentes_pct", label: "Compliance Rate", unit: "pct", format: "percent", tier: "essential", department: "membership", industry: ["football_club"], description: "% of members in good standing (adimplentes).", analysisHint: "Payment health.", defaultViz: "gauge" },
  { key: "renewal_rate_pct", label: "Renewal Rate", unit: "pct", format: "percent", tier: "advanced", department: "membership", industry: ["football_club"], description: "% of expiring members who renewed.", analysisHint: "Retention effectiveness.", defaultViz: "gauge" },
  { key: "member_lifetime_value_cents", label: "Member LTV", unit: "cents", format: "currency", tier: "advanced", department: "membership", industry: ["football_club"], description: "Projected total revenue over average member lifetime.", analysisHint: "Long-term subscription value.", defaultViz: "kpi_card" },

  // ── Tickets ───────────────────────────────────────────────────────────────
  { key: "tickets_issued", label: "Tickets Issued", unit: "count", format: "number", tier: "essential", department: "tickets", industry: ["football_club"], description: "Tickets sold in the period.", analysisHint: "Ticket sales volume.", defaultViz: "bar" },
  { key: "ticket_revenue_cents", label: "Ticket Revenue", unit: "cents", format: "currency", tier: "essential", department: "tickets", industry: ["football_club"], description: "Total revenue from ticket sales.", analysisHint: "Match-day gate revenue.", defaultViz: "bar" },
  { key: "avg_ticket_value_cents", label: "Avg Ticket Value", unit: "cents", format: "currency", tier: "essential", department: "tickets", industry: ["football_club"], description: "Revenue ÷ tickets issued.", analysisHint: "Per-ticket pricing performance.", defaultViz: "kpi_card" },
  { key: "tickets_used", label: "Tickets Used", unit: "count", format: "number", tier: "essential", department: "tickets", industry: ["football_club"], description: "Tickets scanned at the gate.", analysisHint: "Actual attendance from paid tickets.", defaultViz: "kpi_card" },
  { key: "sold_not_checked_in", label: "Sold but Not Attended", unit: "count", format: "number", tier: "essential", department: "tickets", industry: ["football_club"], description: "Tickets issued but not used (no-shows from paid tickets).", analysisHint: "Revenue leakage and seat waste.", defaultViz: "kpi_card" },
  { key: "ticket_use_rate_pct", label: "Ticket Use Rate", unit: "pct", format: "percent", tier: "essential", department: "tickets", industry: ["football_club"], description: "% of issued tickets that were used.", analysisHint: "Fan follow-through rate.", defaultViz: "gauge" },
  { key: "sell_through_pct", label: "Sell-Through %", unit: "pct", format: "percent", tier: "advanced", department: "tickets", industry: ["football_club"], description: "Tickets sold ÷ total capacity.", analysisHint: "Venue fill rate.", defaultViz: "gauge" },
  { key: "avg_tickets_per_match", label: "Avg Tickets / Match", unit: "count", format: "number", tier: "advanced", department: "tickets", industry: ["football_club"], description: "Mean tickets per fixture in the period.", analysisHint: "Per-game demand.", defaultViz: "kpi_card" },
  { key: "member_ticket_buyers_pct", label: "Member Ticket Buyers", unit: "pct", format: "percent", tier: "advanced", department: "tickets", industry: ["football_club"], description: "% of ticket buyers who are active members.", analysisHint: "Member vs non-member ticketing split.", defaultViz: "pie" },

  // ── Access ────────────────────────────────────────────────────────────────
  { key: "access_records", label: "Total Gate Entries", unit: "count", format: "number", tier: "essential", department: "access", industry: ["football_club"], description: "Total recorded gate entries in the period.", analysisHint: "Actual stadium footfall.", defaultViz: "kpi_card" },
  { key: "unique_attendees", label: "Unique Attendees", unit: "count", format: "number", tier: "essential", department: "access", industry: ["football_club"], description: "Distinct fans who entered.", analysisHint: "Unique audience size.", defaultViz: "kpi_card" },
  { key: "member_attendees_pct", label: "Member Attendees", unit: "pct", format: "percent", tier: "essential", department: "access", industry: ["football_club"], description: "% of entries by active members.", analysisHint: "Membership utilisation at matches.", defaultViz: "pie" },
  { key: "non_member_attendee_value_cents", label: "Non-Member Attendee Revenue", unit: "cents", format: "currency", tier: "advanced", department: "access", industry: ["football_club"], description: "Combined ticket + retail spend by non-members.", analysisHint: "Value of non-subscriber fans attending.", defaultViz: "bar" },
  { key: "member_attendee_value_cents", label: "Member Attendee Revenue", unit: "cents", format: "currency", tier: "advanced", department: "access", industry: ["football_club"], description: "Combined ticket + retail spend by members.", analysisHint: "Value of subscriber fans attending.", defaultViz: "bar" },
  { key: "repeat_visit_rate_pct", label: "Repeat Visit Rate", unit: "pct", format: "percent", tier: "advanced", department: "access", industry: ["football_club"], description: "% of attendees who attended more than once in the period.", analysisHint: "Fan loyalty to live matchdays.", defaultViz: "kpi_card" },
  { key: "no_show_rate_pct", label: "No-Show Rate", unit: "pct", format: "percent", tier: "essential", department: "access", industry: ["football_club"], description: "% of issued tickets that were not used.", analysisHint: "Fan reliability and resale opportunity.", defaultViz: "gauge" },

  // ── Stores / Retail ───────────────────────────────────────────────────────
  { key: "stores_orders", label: "Retail Orders", unit: "count", format: "number", tier: "essential", department: "stores", industry: ["football_club"], description: "POS transactions in the period.", analysisHint: "Store transaction volume.", defaultViz: "bar" },
  { key: "stores_revenue_cents", label: "Retail Revenue", unit: "cents", format: "currency", tier: "essential", department: "stores", industry: ["football_club"], description: "Total POS revenue in the period.", analysisHint: "In-store revenue stream.", defaultViz: "bar" },
  { key: "stores_units_sold", label: "Units Sold", unit: "count", format: "number", tier: "essential", department: "stores", industry: ["football_club"], description: "Total items sold across all stores.", analysisHint: "Product movement volume.", defaultViz: "kpi_card" },
  { key: "stores_avg_order_value_cents", label: "Avg Order Value", unit: "cents", format: "currency", tier: "essential", department: "stores", industry: ["football_club"], description: "Revenue ÷ orders.", analysisHint: "Per-transaction spend quality.", defaultViz: "kpi_card" },
  { key: "stores_avg_items_per_order", label: "Avg Items / Order", unit: "count", format: "number", tier: "advanced", department: "stores", industry: ["football_club"], description: "Mean basket size.", analysisHint: "Cross-sell effectiveness.", defaultViz: "kpi_card" },
  { key: "stores_best_location", label: "Best Performing Store", unit: "text", format: "string", tier: "essential", department: "stores", industry: ["football_club"], description: "Store with highest revenue in the period.", analysisHint: "Top-performing location.", defaultViz: "kpi_card" },
  { key: "stores_worst_location", label: "Worst Performing Store", unit: "text", format: "string", tier: "advanced", department: "stores", industry: ["football_club"], description: "Store with lowest revenue in the period.", analysisHint: "Under-performing location requiring attention.", defaultViz: "kpi_card" },
  { key: "stores_top5_products", label: "Top 5 Products", unit: "text", format: "string", tier: "essential", department: "stores", industry: ["football_club"], description: "Best-selling products by revenue.", analysisHint: "Demand leaders for replenishment and promotion.", defaultViz: "bar" },
  { key: "stores_top5_categories", label: "Top 5 Categories", unit: "text", format: "string", tier: "essential", department: "stores", industry: ["football_club"], description: "Best-selling categories by revenue.", analysisHint: "Category mix for buying decisions.", defaultViz: "pie" },
  { key: "stores_revenue_by_hour", label: "Revenue by Hour", unit: "cents", format: "currency", tier: "advanced", department: "stores", industry: ["football_club"], description: "Revenue aggregated by hour-of-day.", analysisHint: "Peak trading hours for staffing.", defaultViz: "heatmap" },
  { key: "stores_revenue_by_dow", label: "Revenue by Day of Week", unit: "cents", format: "currency", tier: "advanced", department: "stores", industry: ["football_club"], description: "Revenue aggregated by day of week.", analysisHint: "Best trading days.", defaultViz: "bar" },
  { key: "stores_returns_rate_pct", label: "Returns Rate", unit: "pct", format: "percent", tier: "advanced", department: "stores", industry: ["football_club"], description: "Returns ÷ sales.", analysisHint: "Product quality and fit issues.", defaultViz: "kpi_card" },
  { key: "stores_member_spend_pct", label: "Member Share of Spend", unit: "pct", format: "percent", tier: "advanced", department: "stores", industry: ["football_club"], description: "% of retail revenue from active members.", analysisHint: "Member monetisation via retail.", defaultViz: "pie" },

  // ── E-Commerce ────────────────────────────────────────────────────────────
  { key: "ecommerce_orders", label: "Online Orders", unit: "count", format: "number", tier: "essential", department: "ecommerce", industry: ["football_club"], description: "Fan shop orders in the period.", analysisHint: "Online channel volume.", defaultViz: "bar" },
  { key: "ecommerce_revenue_cents", label: "Online Revenue", unit: "cents", format: "currency", tier: "essential", department: "ecommerce", industry: ["football_club"], description: "Fan shop revenue.", analysisHint: "E-commerce revenue stream.", defaultViz: "bar" },
  { key: "ecommerce_avg_order_value_cents", label: "Online AOV", unit: "cents", format: "currency", tier: "essential", department: "ecommerce", industry: ["football_club"], description: "Revenue ÷ online orders.", analysisHint: "Online basket size.", defaultViz: "kpi_card" },
  { key: "ecommerce_repeat_buyers_pct", label: "Repeat Buyers", unit: "pct", format: "percent", tier: "advanced", department: "ecommerce", industry: ["football_club"], description: "% of online buyers who purchased more than once.", analysisHint: "Online customer loyalty.", defaultViz: "kpi_card" },
  { key: "ecommerce_top5_products", label: "Top 5 Online Products", unit: "text", format: "string", tier: "essential", department: "ecommerce", industry: ["football_club"], description: "Best-selling products in the fan shop.", analysisHint: "Online demand leaders.", defaultViz: "bar" },

  // ── Coxa Foods ────────────────────────────────────────────────────────────
  { key: "foods_revenue_cents", label: "F&B Revenue", unit: "cents", format: "currency", tier: "essential", department: "coxa-foods", industry: ["football_club"], description: "Food and beverage revenue.", analysisHint: "Concession revenue stream.", defaultViz: "bar" },
  { key: "foods_items_sold", label: "F&B Items Sold", unit: "count", format: "number", tier: "essential", department: "coxa-foods", industry: ["football_club"], description: "Total F&B units sold.", analysisHint: "Concession volume.", defaultViz: "kpi_card" },
  { key: "foods_avg_spend_per_attendee_cents", label: "F&B Spend / Attendee", unit: "cents", format: "currency", tier: "advanced", department: "coxa-foods", industry: ["football_club"], description: "F&B revenue ÷ unique attendees.", analysisHint: "Per-fan concession yield.", defaultViz: "kpi_card" },
  { key: "foods_top5_items", label: "Top 5 F&B Items", unit: "text", format: "string", tier: "essential", department: "coxa-foods", industry: ["football_club"], description: "Best-selling food/drink items.", analysisHint: "Menu optimisation.", defaultViz: "bar" },

  // ── Loyalty ───────────────────────────────────────────────────────────────
  { key: "loyalty_points_issued", label: "Points Issued", unit: "count", format: "number", tier: "essential", department: "loyalty", industry: ["football_club"], description: "Total loyalty points earned in the period.", analysisHint: "Engagement with the loyalty programme.", defaultViz: "bar" },
  { key: "loyalty_points_redeemed", label: "Points Redeemed", unit: "count", format: "number", tier: "essential", department: "loyalty", industry: ["football_club"], description: "Total points spent in the period.", analysisHint: "Programme utilisation.", defaultViz: "bar" },
  { key: "loyalty_redemption_rate_pct", label: "Redemption Rate", unit: "pct", format: "percent", tier: "essential", department: "loyalty", industry: ["football_club"], description: "Redeemed ÷ issued.", analysisHint: "How well fans use earned points.", defaultViz: "gauge" },
  { key: "loyalty_liability_cents", label: "Points Liability", unit: "cents", format: "currency", tier: "advanced", department: "loyalty", industry: ["football_club"], description: "Estimated cash value of unredeemed points.", analysisHint: "Balance sheet loyalty liability.", defaultViz: "kpi_card" },
  { key: "loyalty_tier_distribution", label: "Tier Distribution", unit: "text", format: "string", tier: "essential", department: "loyalty", industry: ["football_club"], description: "Member count per loyalty tier (Bronze/Silver/Gold/Platinum/Diamond).", analysisHint: "Fan score segmentation.", defaultViz: "pie" },

  // ── Social media ──────────────────────────────────────────────────────────
  { key: "social_followers", label: "Total Followers", unit: "count", format: "number", tier: "essential", department: "social", industry: ["football_club"], description: "Combined followers across all tracked channels.", analysisHint: "Overall social reach.", defaultViz: "kpi_card" },
  { key: "social_follower_growth", label: "Follower Growth", unit: "count", format: "number", tier: "essential", department: "social", industry: ["football_club"], description: "Net follower change in the period.", analysisHint: "Social audience momentum.", defaultViz: "line" },
  { key: "social_engagement_rate_pct", label: "Avg Engagement Rate", unit: "pct", format: "percent", tier: "essential", department: "social", industry: ["football_club"], description: "Avg (likes + comments + shares) ÷ reach across posts.", analysisHint: "Content resonance.", defaultViz: "gauge" },
  { key: "social_impressions", label: "Impressions", unit: "count", format: "number", tier: "essential", department: "social", industry: ["football_club"], description: "Total post impressions in the period.", analysisHint: "Content visibility.", defaultViz: "bar" },
  { key: "social_top_post", label: "Top Post", unit: "text", format: "string", tier: "advanced", department: "social", industry: ["football_club"], description: "Highest engagement post in the period.", analysisHint: "Best-performing content for replication.", defaultViz: "kpi_card" },

  // ── Advanced — Fan Intelligence ────────────────────────────────────────────
  { key: "fan_engagement_score_avg", label: "Avg Fan Engagement Score", unit: "count", format: "number", tier: "advanced", department: "fans", industry: ["football_club"], description: "Weighted score combining attendance, purchases, campaign participation, loyalty activity (0–100).", analysisHint: "High score = highly engaged fan; segment the bottom 20% for reactivation campaigns.", defaultViz: "gauge" },
  { key: "fan_data_completeness_pct", label: "Data Completeness %", unit: "pct", format: "percent", tier: "advanced", department: "fans", industry: ["football_club"], description: "% of profiles with CPF/email/phone/address all present.", analysisHint: "Operational data quality for personalisation and compliance.", defaultViz: "gauge" },
  { key: "fans_at_churn_risk", label: "Fans at Churn Risk", unit: "count", format: "number", tier: "advanced", department: "fans", industry: ["football_club"], description: "Fans with no activity (attendance, purchase, campaign) in the last 90 days.", analysisHint: "Prioritise for win-back campaigns before they fully lapse.", defaultViz: "kpi_card" },
  { key: "cohort_retention_30d_pct", label: "30-Day Cohort Retention", unit: "pct", format: "percent", tier: "advanced", department: "fans", industry: ["football_club"], description: "% of fans registered in the period who had at least one activity within 30 days.", analysisHint: "Measures onboarding effectiveness — critical for new fan conversion.", defaultViz: "bar" },
  { key: "cohort_retention_90d_pct", label: "90-Day Cohort Retention", unit: "pct", format: "percent", tier: "advanced", department: "fans", industry: ["football_club"], description: "% of fans registered in the period who were still active at 90 days.", analysisHint: "Predictor of long-term fan lifetime value.", defaultViz: "bar" },

  // ── Advanced — Membership ──────────────────────────────────────────────────
  { key: "mrr_cents", label: "MRR", unit: "cents", format: "currency", tier: "advanced", department: "membership", industry: ["football_club"], description: "Monthly Recurring Revenue — projected from active member ARPU.", analysisHint: "Core subscription health metric; compare MoM to track business trajectory.", defaultViz: "line" },
  { key: "arr_cents", label: "ARR", unit: "cents", format: "currency", tier: "advanced", department: "membership", industry: ["football_club"], description: "Annual Recurring Revenue — MRR × 12.", analysisHint: "Forward-looking annual revenue from subscriptions.", defaultViz: "kpi_card" },
  { key: "churn_rate_pct", label: "Monthly Churn Rate", unit: "pct", format: "percent", tier: "advanced", department: "membership", industry: ["football_club"], description: "Churned members ÷ start-of-period active members.", analysisHint: "Below 2% is healthy for sports clubs; above 5% signals urgent retention action.", defaultViz: "gauge" },
  { key: "plan_mix", label: "Plan Mix", unit: "text", format: "string", tier: "advanced", department: "membership", industry: ["football_club"], description: "% distribution of active members per plan/tier.", analysisHint: "Identify which plans drive value vs volume — optimise pricing accordingly.", defaultViz: "pie" },
  { key: "members_at_risk_count", label: "Members at Renewal Risk", unit: "count", format: "number", tier: "advanced", department: "membership", industry: ["football_club"], description: "Active members whose membership expires within 30 days and have not yet renewed.", analysisHint: "Trigger proactive renewal campaigns before these members lapse.", defaultViz: "kpi_card" },
  { key: "revenue_recovery_cents", label: "Win-Back Revenue", unit: "cents", format: "currency", tier: "advanced", department: "membership", industry: ["football_club"], description: "Revenue from reactivated (previously churned) members.", analysisHint: "Measures effectiveness of win-back campaigns.", defaultViz: "kpi_card" },

  // ── Advanced — Revenue Intelligence ───────────────────────────────────────
  { key: "total_platform_revenue_cents", label: "Total Platform Revenue", unit: "cents", format: "currency", tier: "advanced", department: "revenue", industry: ["football_club"], description: "All revenue streams combined: tickets + memberships + retail (POS + online + F&B).", analysisHint: "Single source of truth for club-wide commercial performance.", defaultViz: "bar" },
  { key: "revenue_per_attendee_cents", label: "Revenue per Attendee", unit: "cents", format: "currency", tier: "advanced", department: "revenue", industry: ["football_club"], description: "Total platform revenue ÷ unique attendees.", analysisHint: "Core matchday monetisation KPI — target improvement via upsells and F&B.", defaultViz: "kpi_card" },
  { key: "revenue_per_member_cents", label: "Revenue per Member", unit: "cents", format: "currency", tier: "advanced", department: "revenue", industry: ["football_club"], description: "Total platform revenue ÷ active members.", analysisHint: "Measures how well the member base is monetised across all touchpoints.", defaultViz: "kpi_card" },
  { key: "revenue_by_stream", label: "Revenue by Stream", unit: "text", format: "string", tier: "advanced", department: "revenue", industry: ["football_club"], description: "Revenue breakdown: membership / tickets / retail / F&B / online.", analysisHint: "Identifies over-reliance on any single channel — diversification indicator.", defaultViz: "pie" },
  { key: "revenue_growth_rate_pct", label: "Revenue Growth Rate", unit: "pct", format: "percent", tier: "advanced", department: "revenue", industry: ["football_club"], description: "% change in total platform revenue vs previous equivalent period.", analysisHint: "Headline commercial momentum — target double-digit growth.", defaultViz: "line" },

  // ── Advanced — Tickets ─────────────────────────────────────────────────────
  { key: "sell_through_pct", label: "Sell-Through %", unit: "pct", format: "percent", tier: "advanced", department: "tickets", industry: ["football_club"], description: "Tickets sold ÷ total capacity × 100.", analysisHint: "Venue fill rate — below 60% signals pricing or marketing issues.", defaultViz: "gauge" },
  { key: "avg_tickets_per_match", label: "Avg Tickets / Match", unit: "count", format: "number", tier: "advanced", department: "tickets", industry: ["football_club"], description: "Mean tickets issued per distinct match/event in the period.", analysisHint: "Per-game demand smoothing — identifies strong vs weak fixtures.", defaultViz: "bar" },
  { key: "member_ticket_buyers_pct", label: "Member Ticket Buyers %", unit: "pct", format: "percent", tier: "advanced", department: "tickets", industry: ["football_club"], description: "% of ticket buyers who are active members.", analysisHint: "Low % = members not using their benefits or buying via other channels.", defaultViz: "pie" },
  { key: "ticket_revenue_per_match_cents", label: "Revenue per Match", unit: "cents", format: "currency", tier: "advanced", department: "tickets", industry: ["football_club"], description: "Avg ticket revenue per fixture.", analysisHint: "Normalises revenue for variable fixture schedules.", defaultViz: "bar" },

  // ── Advanced — Retail ──────────────────────────────────────────────────────
  { key: "retail_revenue_per_attendee_cents", label: "Retail Spend / Attendee", unit: "cents", format: "currency", tier: "advanced", department: "stores", industry: ["football_club"], description: "In-store + F&B revenue ÷ unique matchday attendees.", analysisHint: "Key monetisation ratio — grow via product mix, placement, and impulse offers.", defaultViz: "kpi_card" },
  { key: "retail_repeat_buyer_rate_pct", label: "Repeat Buyer Rate", unit: "pct", format: "percent", tier: "advanced", department: "stores", industry: ["football_club"], description: "% of buyers who made 2+ purchases in the period.", analysisHint: "Measures brand loyalty via the store; target through loyalty point incentives.", defaultViz: "kpi_card" },
  { key: "category_concentration_pct", label: "Top Category Concentration", unit: "pct", format: "percent", tier: "advanced", department: "stores", industry: ["football_club"], description: "% of retail revenue from the single top product category.", analysisHint: "High concentration = fragile category mix; diversify to reduce risk.", defaultViz: "gauge" },

  // ── Advanced — Loyalty ─────────────────────────────────────────────────────
  { key: "loyalty_active_earners_pct", label: "Active Earners %", unit: "pct", format: "percent", tier: "advanced", department: "loyalty", industry: ["football_club"], description: "% of fans who earned points at least once in the period.", analysisHint: "Programme participation rate — below 30% suggests low awareness or friction.", defaultViz: "gauge" },
  { key: "loyalty_dormant_count", label: "Dormant Loyalty Fans", unit: "count", format: "number", tier: "advanced", department: "loyalty", industry: ["football_club"], description: "Fans with unredeemed points but no earn/redeem activity in 90 days.", analysisHint: "Target with 'points expiry' push to reactivate and drive redemption.", defaultViz: "kpi_card" },
  { key: "loyalty_tier_upgrade_rate_pct", label: "Tier Upgrade Rate", unit: "pct", format: "percent", tier: "advanced", department: "loyalty", industry: ["football_club"], description: "% of fans who moved to a higher tier in the period.", analysisHint: "Measures loyalty programme progression velocity.", defaultViz: "kpi_card" },
  { key: "loyalty_points_burn_rate_pct", label: "Points Burn Rate", unit: "pct", format: "percent", tier: "advanced", department: "loyalty", industry: ["football_club"], description: "Points redeemed ÷ total outstanding balance.", analysisHint: "High burn = healthy programme engagement; very high = liability risk.", defaultViz: "gauge" },

  // ── Advanced — Social Media ────────────────────────────────────────────────
  { key: "social_platform_breakdown", label: "Followers by Platform", unit: "text", format: "string", tier: "advanced", department: "social", industry: ["football_club"], description: "Follower count per social channel (Instagram, TikTok, YouTube, X).", analysisHint: "Identify dominant channels and under-invested platforms.", defaultViz: "bar" },
  { key: "social_engagement_trend", label: "Engagement Rate Trend", unit: "pct", format: "percent", tier: "advanced", department: "social", industry: ["football_club"], description: "Engagement rate per week over the selected period.", analysisHint: "Flat or declining trend = content strategy review needed.", defaultViz: "line" },
  { key: "social_video_share_pct", label: "Video Content Share", unit: "pct", format: "percent", tier: "advanced", department: "social", industry: ["football_club"], description: "% of impressions from video posts vs static posts.", analysisHint: "Video-first platforms reward video content with organic reach uplift.", defaultViz: "pie" },

  // ── Advanced — Fan 360 (Cross-Department) ─────────────────────────────────
  { key: "fan_360_value_cents", label: "Fan 360 Value", unit: "cents", format: "currency", tier: "advanced", department: "revenue", industry: ["football_club"], description: "Total per-fan spend across all touchpoints: tickets + retail + membership + loyalty redemptions.", analysisHint: "Identifies your most valuable fans — top 20% often drive 80% of total revenue.", defaultViz: "bar" },
  { key: "top10_fans_revenue_pct", label: "Top 10% Fan Revenue Share", unit: "pct", format: "percent", tier: "advanced", department: "revenue", industry: ["football_club"], description: "% of total platform revenue from the top 10% highest-spending fans.", analysisHint: "Pareto concentration metric — reveals VIP segment importance.", defaultViz: "gauge" },
  { key: "multi_touchpoint_fans_pct", label: "Multi-Touchpoint Fans %", unit: "pct", format: "percent", tier: "advanced", department: "revenue", industry: ["football_club"], description: "% of fans who engaged via 3+ revenue channels (ticket + retail + membership) in the period.", analysisHint: "Fully engaged fans have the highest LTV — grow this % via cross-sell campaigns.", defaultViz: "kpi_card" },
];

/** Look up a KPI by key */
export function getKpi(key) {
  return KPI_REGISTRY.find((k) => k.key === key);
}

/** Get KPIs for a department, optionally filtered by tier */
export function getKpisByDepartment(department, tier = null) {
  return KPI_REGISTRY.filter(
    (k) => k.department === department && (!tier || k.tier === tier)
  );
}

/** Get KPIs for an industry profile */
export function getKpisByIndustry(industry) {
  return KPI_REGISTRY.filter((k) => k.industry.includes(industry));
}

export default KPI_REGISTRY;
