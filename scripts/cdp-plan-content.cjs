// CDP Data Intelligence Plan v2 - Content data for DOCX generation (Refined with Open-Source CDP Stack)
module.exports = {
  title: "Coxa Fan OS",
  subtitle: "CDP & Data Intelligence Platform - Development Plan v2",
  scope: "Data Warehouse | CDP Events | Personalization | Segmentation | Multi-Channel Tracking",
  timeline: "6 Weeks (4 Phases, AI-Accelerated)",
  prepared: "July 2026",
  client: "Coritiba FC / Coxa Fan OS",

  executiveSummary: [
    "This document outlines an AI-accelerated 6-week implementation plan to evolve the Coxa Fan OS platform into an enterprise-grade data intelligence system with multi-channel event capture from websites, mobile apps, and tracking pixels. The plan leverages best-in-class open-source tools (RudderStack, PostHog, ClickHouse, Tracardi, Multiwoven, Cube, Dagster, XGBoost) to deliver capabilities that match or exceed commercial CDPs like Segment and Salesforce Data Cloud.",
    "The entire build requires only ~2.75 FTE over 6 weeks because AI agents generate 80-90% of the implementation code. All tools are open-source and self-hosted, meaning zero vendor lock-in, full data ownership, and no per-event SaaS fees.",
    "The key innovation in this plan is replacing the current backend-only event capture with a true multi-channel CDP that tracks fans across websites, mobile apps, in-stadium POS, and third-party integrations - unifying all touchpoints into a single fan profile for intelligent personalization.",
  ],

  keyDeliverables: [
    "Multi-channel event capture via RudderStack (web, mobile, server, pixels, webhooks)",
    "Product analytics and A/B testing via PostHog (session replay, funnels, experiments)",
    "Analytical data warehouse via ClickHouse for sub-second analytics",
    "Semantic metrics layer via Cube (single source of truth for ~80 KPIs)",
    "Advanced segmentation via Tracardi (visual AND/OR/NOT builder, real-time profiles)",
    "ML-powered fan intelligence - churn prediction, purchase propensity, next-best-channel",
    "ML-ranked personalization - multi-offer NBO with frequency capping",
    "Reverse ETL activation via Multiwoven (auto-sync segments to email, ads, CRM)",
    "AI campaign generation - LLM-drafted campaigns with human approval workflow",
  ],

  expectedOutcomes: [
    ["Event capture scope", "Backend POS/ticketing only", "Web + App + POS + Pixels + Webhooks"],
    ["Fan identity", "Single-channel (email at POS)", "Cross-device identity stitching"],
    ["Analytics query time", "3-8 seconds (MongoDB)", "< 500ms (ClickHouse + Cube)"],
    ["Segment creation", "JSON rules, engineer required", "Visual drag-and-drop, marketing self-serve"],
    ["Fan scoring", "Static weighted formula", "Predictive ML models (AUC > 0.7)"],
    ["Personalization", "Single priority-match", "ML-ranked multi-offer with fatigue control"],
    ["Activation", "Manual CSV export", "Auto-sync to email, ads, CRM (Multiwoven)"],
    ["Product analytics", "None", "Funnels, retention, session replay, A/B tests (PostHog)"],
    ["Event processing", "Synchronous (blocking)", "Async, resilient, 100K+ events/min"],
  ],

  currentAssets: [
    ["Event ingestion", "eventBus.js - 30 typed events, idempotency keys, DLQ, identity resolution", "Working"],
    ["Trait computation", "traitCalculator.js - event-driven, 9+ event types, derived traits", "Working"],
    ["Fan scoring", "fanScoreService.js - 6 weighted components, 5 tiers, history tracking", "Solid"],
    ["Segmentation", "segmentService.js - 8 operators, rule-based, CRUD + preview", "Working"],
    ["Customer 360", "customer360Service.js - aggregates 7 sources in parallel", "Working"],
    ["Personalization", "personalizationService.js - priority-first-match NBO", "Early"],
    ["Analytics", "fanboxAnalyticsService.js - MongoDB aggregations, period deltas", "Solid"],
    ["KPI catalog", "kpiRegistry.js - ~80 KPIs across 10 departments", "Comprehensive"],
    ["Fan profiles", "FanProfile model - 25+ fields including CPF, biometric, address", "Production"],
    ["Intelligence UI", "Full dashboard with AI narratives, charts, saved audiences", "Complete"],
  ],

  gaps: [
    ["Website tracking", "None - no JS SDK on web properties", "Full page/click/form capture via RudderStack JS SDK"],
    ["Mobile app tracking", "None - no mobile SDK", "iOS + Android SDKs via RudderStack (offline support)"],
    ["Tracking pixels", "None", "Cross-domain, ITP-compliant, ad platform integration"],
    ["Cross-device identity", "Email-only at POS", "Anonymous-to-known stitching across all touchpoints"],
    ["Product analytics", "None", "PostHog: funnels, retention, session replay, experiments"],
    ["Event processing", "Synchronous (blocks HTTP)", "Async via RudderStack (Go, 100K+ events/sec)"],
    ["Data store", "MongoDB only (OLTP + OLAP mixed)", "MongoDB (OLTP) + ClickHouse (OLAP)"],
    ["Segmentation logic", "AND-only, full-table-scan, engineering required", "Visual AND/OR/NOT builder via Tracardi"],
    ["Campaign activation", "Manual export, no tool sync", "Reverse ETL via Multiwoven to email/ads/CRM"],
    ["A/B testing", "None", "PostHog experiments with statistical significance"],
  ],

  openSourceStack: [
    ["RudderStack", "~9,000", "AGPL-3.0 / MIT (SDKs)", "Event streaming CDP with 200+ destinations, web/mobile/server SDKs", "Replaces custom eventBus.js; adds web + app tracking"],
    ["PostHog", "~30,000+", "MIT", "Product analytics, session replay, feature flags, experiments, CDP", "Product analytics + A/B testing (no custom build needed)"],
    ["ClickHouse", "~48,400", "Apache-2.0", "Columnar OLAP with vectorized SIMD execution", "Analytical warehouse for sub-second KPI queries"],
    ["Tracardi", "~2,500+", "Open-core", "CDP with profiles, real-time segmentation, visual workflows", "Replaces custom segment service with visual builder"],
    ["Multiwoven", "~1,600", "AGPL-3.0", "Open-source reverse ETL - warehouse to business tools", "Auto-syncs segments to email, ads, CRM platforms"],
    ["Cube", "~20,300", "Apache-2.0", "Semantic layer with pre-aggregations + REST/GraphQL API", "KPI governance - define once, query everywhere"],
    ["Dagster", "~15,800", "Apache-2.0", "Asset-centric pipeline orchestration", "Schedules ML training, scoring, data refresh"],
    ["XGBoost", "~27,000", "Apache-2.0", "Gradient-boosted trees for tabular data", "Churn, propensity, channel prediction models"],
  ],

  replacementMap: [
    ["Custom eventBus.js (synchronous)", "RudderStack event streaming", "Production-grade async, web/mobile/server SDKs, 200+ destinations"],
    ["No website/app tracking", "RudderStack JS + Mobile SDKs", "Auto-capture page views, clicks, forms, screen views"],
    ["No tracking pixels", "RudderStack + PostHog", "Cross-domain tracking, ITP-compliant, ad attribution"],
    ["segmentService.js (AND-only, full-scan)", "Tracardi segmentation", "Visual AND/OR/NOT builder, real-time evaluation, no code needed"],
    ["No reverse ETL / activation", "Multiwoven", "Pre-built connectors to email, ads, CRM - auto sync"],
    ["No product analytics", "PostHog", "Session replay, funnels, retention, A/B testing out of the box"],
    ["No A/B testing", "PostHog experiments", "Feature flags, variant assignment, statistical significance"],
    ["Airbyte CDC (was planned)", "RudderStack warehouse destination", "Events stream directly to ClickHouse - no CDC needed"],
  ],

  preserved: [
    ["traitCalculator.js", "Core fan trait logic specific to football/sports", "Triggered by RudderStack webhook instead of inline"],
    ["fanScoreService.js", "Unique 6-component scoring algorithm", "Fed by richer trait data from multi-channel events"],
    ["customer360Service.js", "Aggregation logic across 7 sources", "Gains ML scores + multi-channel event history"],
    ["personalizationService.js", "NBO logic stays but gets ML ranking", "Upgraded to ML-ranked with Tracardi workflow triggers"],
    ["kpiRegistry.js / analytics", "Analytics presentation layer", "Backed by Cube semantic layer reading ClickHouse"],
    ["ragService.js + AI insights", "Unique AI assistant for operators", "Enriched with more data from multi-channel CDP"],
    ["All frontend dashboards", "Client-facing FanBox UI", "Enhanced with PostHog embeds and richer real-time data"],
  ],
};
