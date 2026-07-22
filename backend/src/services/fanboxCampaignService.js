import { FanboxCampaign } from "../models/FanboxCampaign.js";
import { FanboxCampaignTemplate } from "../models/FanboxCampaignTemplate.js";
import { Segment } from "../models/Segment.js";
import { FanProfile } from "../models/FanProfile.js";
import { SavedFilter } from "../models/SavedFilter.js";
import { previewFilter } from "./fanboxFilterService.js";
import { publishEvent } from "./cdp/cdpEventService.js";
import { sendCampaignEmail } from "./emailService.js";
import { sendCampaignPush } from "./pushService.js";

async function getCampaignOrThrow(tenantId, campaignId) {
  const campaign = await FanboxCampaign.findOne({ _id: campaignId, tenantId });
  if (!campaign) {
    const err = new Error("Campaign not found");
    err.status = 404;
    err.code = "CAMPAIGN_NOT_FOUND";
    throw err;
  }
  return campaign;
}

async function getTemplateOrThrow(tenantId, templateId) {
  const template = await FanboxCampaignTemplate.findOne({ _id: templateId, tenantId });
  if (!template) {
    const err = new Error("Campaign template not found");
    err.status = 404;
    err.code = "CAMPAIGN_TEMPLATE_NOT_FOUND";
    throw err;
  }
  return template;
}

export async function listCampaigns(tenantId, { status, type, limit = 100 } = {}) {
  const query = { tenantId };
  if (status) query.status = status;
  if (type) query.type = type;
  return FanboxCampaign.find(query).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function getCampaign(tenantId, campaignId) {
  return getCampaignOrThrow(tenantId, campaignId);
}

export async function createCampaign(tenantId, payload) {
  return FanboxCampaign.create({
    tenantId,
    name: payload.name,
    type: payload.type,
    status: payload.status ?? "draft",
    subject: payload.subject,
    bodyHtml: payload.bodyHtml,
    templateId: payload.templateId,
    savedFilterId: payload.savedFilterId,
    segmentId: payload.segmentId,
    scheduledAt: payload.scheduledAt,
    metrics: payload.metrics ?? {},
    createdBy: payload.createdBy,
  });
}

export async function updateCampaign(tenantId, campaignId, updates) {
  const campaign = await getCampaignOrThrow(tenantId, campaignId);
  const fields = [
    "name",
    "type",
    "status",
    "subject",
    "bodyHtml",
    "templateId",
    "savedFilterId",
    "segmentId",
    "scheduledAt",
    "metrics",
  ];
  for (const field of fields) {
    if (updates[field] !== undefined) campaign[field] = updates[field];
  }
  await campaign.save();
  return campaign;
}

export async function deleteCampaign(tenantId, campaignId) {
  const campaign = await getCampaignOrThrow(tenantId, campaignId);
  await campaign.deleteOne();
  return { id: campaignId, deleted: true };
}

export async function scheduleCampaign(tenantId, campaignId, { scheduledAt } = {}) {
  const campaign = await getCampaignOrThrow(tenantId, campaignId);
  campaign.status = "scheduled";
  campaign.scheduledAt = scheduledAt ? new Date(scheduledAt) : campaign.scheduledAt ?? new Date();
  await campaign.save();
  return campaign;
}

async function computeRecipientCount(tenantId, campaign) {
  if (campaign.savedFilterId) {
    const savedFilter = await SavedFilter.findOne({ _id: campaign.savedFilterId, tenantId });
    if (savedFilter) {
      const filterPreview = await previewFilter(tenantId, savedFilter.rules);
      return filterPreview.count;
    }
  }

  if (campaign.segmentId) {
    const segment = await Segment.findOne({ _id: campaign.segmentId, tenantId });
    if (segment) return segment.memberCount ?? 0;
  }

  return FanProfile.countDocuments({ tenantId, status: "active" });
}

export async function sendCampaign(tenantId, campaignId) {
  const campaign = await getCampaignOrThrow(tenantId, campaignId);
  const recipientCount = await computeRecipientCount(tenantId, campaign);

  // Resolve actual recipient fan profiles
  let fans = [];
  if (campaign.savedFilterId) {
    const filter = await SavedFilter.findOne({ _id: campaign.savedFilterId, tenantId });
    if (filter) fans = await previewFilter(tenantId, filter.rules, { limit: 10000 });
  } else if (campaign.segmentId) {
    fans = await FanProfile.find({
      tenantId, status: "active",
      segments: campaign.segmentId.toString(),
    }).select("email fullName _id pushTokens").limit(10000).lean();
  } else {
    fans = await FanProfile.find({ tenantId, status: "active" })
      .select("email fullName _id pushTokens").limit(10000).lean();
  }

  const channel = campaign.channel ?? "email";
  let deliveredCount = 0;

  // ── Dispatch by channel ──────────────────────────────────────────────────
  if (channel === "email") {
    // Send in batches of 50 concurrently
    const BATCH = 50;
    for (let i = 0; i < fans.length; i += BATCH) {
      const batch = fans.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (fan) => {
          if (!fan.email) return;
          try {
            await sendCampaignEmail({
              to: fan.email,
              subject: campaign.subject ?? campaign.name,
              html: campaign.bodyHtml ?? `<p>Hello ${fan.fullName ?? "Fan"},</p><p>${campaign.description ?? ""}</p>`,
              campaignId: campaign.id ?? campaign._id,
              fanProfileId: fan._id,
            });
            deliveredCount++;
          } catch (err) {
            console.warn(`[campaign] email failed for ${fan.email}:`, err.message);
          }
        })
      );
    }
  } else if (channel === "push") {
    const fanIds = fans.map((f) => f._id);
    const result = await sendCampaignPush({
      fanProfileIds: fanIds,
      title: campaign.name,
      body: campaign.description ?? campaign.subject ?? "New message from Coxa",
      url: process.env.FAN_DASHBOARD_URL ?? "https://fan.coxa.live",
      campaignId: campaign.id ?? campaign._id,
    });
    deliveredCount = result.totalSent;
  }
  // sms: stub (no provider configured yet)

  campaign.status = "sent";
  campaign.metrics = {
    ...campaign.metrics,
    recipientCount,
    deliveredCount,
    openCount: campaign.metrics?.openCount ?? 0,
    clickCount: campaign.metrics?.clickCount ?? 0,
    sentAt: new Date(),
  };
  await campaign.save();

  await publishEvent({
    tenantId,
    eventName: "campaign.message.sent",
    source: "fanbox_campaigns",
    idempotencyKey: `campaign-sent-${campaignId}-${Date.now()}`,
    payload: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      channel,
      recipientCount,
      deliveredCount,
      segmentId: campaign.segmentId?.toString(),
    },
  }).catch(() => {});

  return campaign;
}

export async function listTemplates(tenantId, { limit = 100 } = {}) {
  return FanboxCampaignTemplate.find({ tenantId }).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function createTemplate(tenantId, payload) {
  return FanboxCampaignTemplate.create({
    tenantId,
    name: payload.name,
    subject: payload.subject,
    bodyHtml: payload.bodyHtml,
    createdBy: payload.createdBy,
  });
}

export async function updateTemplate(tenantId, templateId, updates) {
  const template = await getTemplateOrThrow(tenantId, templateId);
  if (updates.name !== undefined) template.name = updates.name;
  if (updates.subject !== undefined) template.subject = updates.subject;
  if (updates.bodyHtml !== undefined) template.bodyHtml = updates.bodyHtml;
  await template.save();
  return template;
}

export async function deleteTemplate(tenantId, templateId) {
  const template = await getTemplateOrThrow(tenantId, templateId);
  await template.deleteOne();
  return { id: templateId, deleted: true };
}
