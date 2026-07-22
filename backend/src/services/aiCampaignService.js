/**
 * AI Campaign Service — Phase 4
 *
 * Generates campaign briefs and content using AI, targeted at fan segments
 * identified via ML scores and ClickHouse segment evaluation.
 *
 * Workflow:
 *  1. generateCampaignBrief() — AI creates targeting + content recommendation
 *  2. Campaign is saved as status="pending_approval"
 *  3. Staff approves via approveCampaign()
 *  4. On approval, campaign is promoted to the existing fanboxCampaignService
 *
 * AI generation calls ragService.ragChat() directly (in-process) to avoid the
 * need for an internal HTTP round-trip and auth middleware bypass.
 */

import { FanboxCampaign } from "../models/FanboxCampaign.js";
import { getChurnRiskSummary, getChannelDistribution } from "./mlScoringService.js";
import { listSegments } from "./segmentService.js";
import { Offer } from "../models/Offer.js";
import { getAbTestResults } from "./personalizationServiceV2.js";
import { ragChat } from "./ai/ragService.js";

// ─── Generate AI campaign brief ───────────────────────────────────────────────

export async function generateCampaignBrief(tenantId, { objective, channel, staffId } = {}) {
  const [churnSummary, channelDist, segments, offers] = await Promise.all([
    getChurnRiskSummary(tenantId),
    getChannelDistribution(tenantId),
    listSegments(tenantId),
    Offer.find({ tenantId, status: "active" }).sort({ priority: 1 }).limit(5),
  ]);

  // Build context for AI
  const context = {
    objective: objective ?? "re-engagement",
    channel: channel ?? channelDist[0]?.next_best_channel ?? "email",
    highRiskFans: churnSummary.high_risk_fans ?? 0,
    mediumRiskFans: churnSummary.medium_risk_fans ?? 0,
    avgTicketPropensity: ((churnSummary.avg_ticket_propensity ?? 0) * 100).toFixed(1),
    avgRetailPropensity: ((churnSummary.avg_retail_propensity ?? 0) * 100).toFixed(1),
    topSegments: segments.slice(0, 5).map((s) => ({ name: s.name, count: s.memberCount })),
    topOffers: offers.map((o) => ({ title: o.title, type: o.offerType, value: o.value })),
    channelDistribution: channelDist,
  };

  const brief = await callAiAssistant(tenantId, buildPrompt(context));

  // Save campaign as pending_approval
  const campaign = await FanboxCampaign.create({
    tenantId,
    name: `AI Brief — ${new Date().toLocaleDateString("pt-BR")} — ${context.channel}`,
    type: "broadcast",
    status: "pending_approval",
    channel: context.channel,
    content: brief,
    targetingContext: context,
    generatedByAi: true,
    aiObjective: objective ?? "re-engagement",
    approvalRequestedBy: staffId ?? null,
    approvalRequestedAt: new Date(),
  });

  return { campaign, context, brief };
}

// ─── Approve a pending AI campaign ───────────────────────────────────────────

export async function approveCampaign(tenantId, campaignId, { approvedBy, scheduledAt } = {}) {
  const campaign = await FanboxCampaign.findOne({
    _id: campaignId,
    tenantId,
    status: "pending_approval",
  });

  if (!campaign) {
    const err = new Error("Campaign not found or already processed");
    err.status = 404;
    throw err;
  }

  campaign.status = scheduledAt ? "scheduled" : "active";
  campaign.approvedBy = approvedBy ?? null;
  campaign.approvedAt = new Date();
  if (scheduledAt) campaign.scheduledAt = new Date(scheduledAt);
  await campaign.save();
  return campaign;
}

// ─── Reject a pending AI campaign ────────────────────────────────────────────

export async function rejectCampaign(tenantId, campaignId, { rejectedBy, reason } = {}) {
  const campaign = await FanboxCampaign.findOne({
    _id: campaignId,
    tenantId,
    status: "pending_approval",
  });

  if (!campaign) {
    const err = new Error("Campaign not found or already processed");
    err.status = 404;
    throw err;
  }

  campaign.status = "archived";
  campaign.rejectedBy = rejectedBy ?? null;
  campaign.rejectionReason = reason ?? null;
  await campaign.save();
  return campaign;
}

// ─── List pending approval queue ─────────────────────────────────────────────

export async function listPendingApprovals(tenantId) {
  return FanboxCampaign.find({
    tenantId,
    generatedByAi: true,
    status: "pending_approval",
  }).sort({ createdAt: -1 });
}

// ─── A/B performance summary for campaigns page ───────────────────────────────

export async function getCampaignAbSummary(tenantId) {
  const offers = await Offer.find({ tenantId, status: "active" }).limit(10);
  const results = await Promise.allSettled(
    offers.map(async (o) => ({
      offerId: o._id.toString(),
      offerTitle: o.title,
      variants: await getAbTestResults(tenantId, o._id.toString()),
    })),
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value.variants.length > 0)
    .map((r) => r.value);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPrompt(ctx) {
  return `You are a sports marketing AI for a Brazilian football club.

Fan data context:
- High churn-risk fans: ${ctx.highRiskFans}
- Medium churn-risk fans: ${ctx.mediumRiskFans}
- Avg ticket propensity: ${ctx.avgTicketPropensity}%
- Avg retail propensity: ${ctx.avgRetailPropensity}%
- Top segments: ${ctx.topSegments.map((s) => `${s.name} (${s.count} fans)`).join(", ")}
- Best channel for most fans: ${ctx.channel}
- Available offers: ${ctx.topOffers.map((o) => `${o.title} (${o.type})`).join(", ")}

Campaign objective: ${ctx.objective}
Preferred channel: ${ctx.channel}

Write a concise campaign brief (max 200 words) including:
1. Target audience (which segment / ML risk tier)
2. Key message (1-2 sentences)
3. Offer recommendation
4. CTA suggestion
5. Best send time

Reply in pt-BR.`;
}

async function callAiAssistant(tenantId, prompt) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("[aiCampaignService] OPENAI_API_KEY is not set — skipping AI generation");
      return null;
    }
    const result = await ragChat(
      [{ role: "user", content: prompt }],
      { tenantId, role: "fanbox_admin", tenantName: "Club" },
    );
    const content = result?.content ?? null;
    // Treat ragService stubs (returned when key is missing mid-call) as no brief
    if (!content || content.includes("not configured")) return null;
    return content;
  } catch (err) {
    console.warn("[aiCampaignService] AI call failed:", err.message);
    return null;
  }
}
