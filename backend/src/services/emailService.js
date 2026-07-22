import { EmailTemplate } from "../models/EmailTemplate.js";
import { EmailCampaign } from "../models/EmailCampaign.js";
import { EmailSend } from "../models/EmailSend.js";
import { FanProfile } from "../models/FanProfile.js";

/**
 * Replace {{token.path}} placeholders with values from the tokens map.
 * Missing tokens resolve to an empty string.
 */
function resolveTokens(html, tokens) {
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => tokens[key] ?? "");
}

/**
 * Attempt to load @aws-sdk/client-ses dynamically so the service degrades
 * gracefully when the SDK is not installed.
 */
async function getSesClient() {
  const region = process.env.AWS_SES_REGION;
  const fromEmail = process.env.AWS_SES_FROM_EMAIL;
  if (!region || !fromEmail) return null;

  try {
    const { SESClient, SendEmailCommand } = await import("@aws-sdk/client-ses");
    return { client: new SESClient({ region }), SendEmailCommand, fromEmail };
  } catch {
    console.warn("[emailService] @aws-sdk/client-ses not installed — SES sending disabled");
    return null;
  }
}

/**
 * Send a transactional email to a single fan.
 *
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string|import("mongoose").Types.ObjectId} opts.fanId
 * @param {string} opts.emailAddress
 * @param {string} opts.templateSlug
 * @param {object} [opts.tokens]          token map e.g. { "fan.fullName": "João" }
 * @param {string} [opts.idempotencyKey]  reserved for future dedup logic
 * @returns {Promise<import("../models/EmailSend.js").EmailSend|null>}
 */
export async function sendTransactionalEmail({
  tenantId,
  fanId,
  emailAddress,
  templateSlug,
  tokens = {},
  idempotencyKey, // eslint-disable-line no-unused-vars
}) {
  const template = await EmailTemplate.findOne({
    tenantId,
    slug: templateSlug,
    status: "active",
  });

  if (!template) {
    console.warn(`[emailService] Template not found: tenantId=${tenantId} slug=${templateSlug}`);
    return null;
  }

  const subjectLine = template.subjectLines?.[0]?.text ?? "(no subject)";
  const rawHtml = template.compiledHtml ?? "";
  const resolvedHtml = resolveTokens(rawHtml, tokens);
  const resolvedSubject = resolveTokens(subjectLine, tokens);

  let sendDoc = null;
  try {
    const ses = await getSesClient();
    if (!ses) {
      console.warn(
        `[emailService] SES not configured (AWS_SES_REGION / AWS_SES_FROM_EMAIL missing). ` +
          `Skipping send for ${emailAddress}.`,
      );
      sendDoc = await EmailSend.create({
        tenantId,
        fanId,
        emailAddress,
        templateId: template._id,
        subjectServed: resolvedSubject,
        transactionalKey: templateSlug,
        status: "failed",
        suppressedReason: "ses_not_configured",
      });
      return sendDoc;
    }

    const { client, SendEmailCommand, fromEmail } = ses;
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [emailAddress] },
      Message: {
        Subject: { Data: resolvedSubject, Charset: "UTF-8" },
        Body: {
          Html: { Data: resolvedHtml, Charset: "UTF-8" },
          ...(template.plainTextFallback
            ? { Text: { Data: resolveTokens(template.plainTextFallback, tokens), Charset: "UTF-8" } }
            : {}),
        },
      },
    });

    const response = await client.send(command);
    const providerMessageId = response.MessageId;

    sendDoc = await EmailSend.create({
      tenantId,
      fanId,
      emailAddress,
      templateId: template._id,
      subjectServed: resolvedSubject,
      transactionalKey: templateSlug,
      status: "sent",
      providerMessageId,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error(`[emailService] Send failed for ${emailAddress}:`, err.message);
    sendDoc = await EmailSend.create({
      tenantId,
      fanId,
      emailAddress,
      templateId: template._id,
      subjectServed: resolvedSubject,
      transactionalKey: templateSlug,
      status: "failed",
      suppressedReason: err.message,
    });
  }

  return sendDoc;
}

/**
 * Queue all sends for a campaign (stub — BullMQ worker handles actual dispatch).
 *
 * @param {object} opts
 * @param {string|import("mongoose").Types.ObjectId} opts.campaignId
 * @param {string} opts.tenantId
 * @returns {Promise<{ campaignId: string, queued: number }>}
 */
export async function queueCampaignSend({ campaignId, tenantId }) {
  const campaign = await EmailCampaign.findOne({ _id: campaignId, tenantId });
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (campaign.approvalStatus !== "approved") {
    throw new Error(`Campaign ${campaignId} is not approved (status: ${campaign.approvalStatus})`);
  }

  // Stub: use first 10 FanProfile docs for the tenant
  const fans = await FanProfile.find({ tenantId, status: "active" }).limit(10).lean();

  const sendDocs = fans.map((fan) => ({
    tenantId,
    campaignId: campaign._id,
    fanId: fan._id,
    emailAddress: fan.email,
    templateId: campaign.templateId,
    status: "queued",
  }));

  if (sendDocs.length > 0) {
    await EmailSend.insertMany(sendDocs, { ordered: false });
  }

  campaign.status = "sending";
  await campaign.save();

  return { campaignId: campaign._id.toString(), queued: sendDocs.length };
}

/**
 * Process an SNS-delivered SES event notification payload.
 *
 * @param {object} payload  Parsed JSON body from SNS
 */
export async function handleSesWebhook(payload) {
  // SNS may wrap the SES notification in a Message string
  let notification = payload;
  if (typeof payload.Message === "string") {
    try {
      notification = JSON.parse(payload.Message);
    } catch {
      console.warn("[emailService] Could not parse SNS Message as JSON");
      return;
    }
  }

  const eventType = notification.eventType ?? notification.notificationType;
  const mail = notification.mail ?? {};
  const providerMessageId = mail.messageId;

  if (!providerMessageId) {
    console.warn("[emailService] SES webhook: no messageId found in payload");
    return;
  }

  const sendDoc = await EmailSend.findOne({ providerMessageId });
  if (!sendDoc) {
    console.warn(`[emailService] SES webhook: EmailSend not found for messageId=${providerMessageId}`);
    return;
  }

  switch (eventType) {
    case "Bounce": {
      const bounceType = notification.bounce?.bounceType;
      sendDoc.status = "bounced";
      sendDoc.suppressedReason = bounceType === "Permanent" ? "hard_bounce" : "soft_bounce";
      if (bounceType === "Permanent") {
        await _insertSuppression(sendDoc, bounceType === "Permanent" ? "hard_bounce" : "bounce");
      }
      break;
    }
    case "Complaint": {
      sendDoc.status = "bounced";
      sendDoc.suppressedReason = "complaint";
      await _insertSuppression(sendDoc, "complaint");
      break;
    }
    case "Delivery": {
      sendDoc.status = "delivered";
      sendDoc.deliveredAt = new Date();
      break;
    }
    case "Open":
    case "Click":
      // Reserved for future analytics ingestion
      console.info(`[emailService] SES ${eventType} event for messageId=${providerMessageId} — logged`);
      return;
    default:
      console.warn(`[emailService] Unknown SES eventType: ${eventType}`);
      return;
  }

  await sendDoc.save();
}

// ─── Campaign email helper ────────────────────────────────────────────────────

/**
 * Send a single campaign/bulk email directly via SES (no EmailSend record).
 * Used by fanboxCampaignService for batch sends.
 * Falls back to console.info when SES is not configured.
 *
 * @param {object} opts
 * @param {string} opts.to             recipient email address
 * @param {string} opts.subject        email subject line
 * @param {string} opts.html           compiled HTML body
 * @param {string} [opts.campaignId]   for logging
 * @param {string} [opts.fanProfileId] for logging
 */
export async function sendCampaignEmail({ to, subject, html, campaignId, fanProfileId }) {
  const ses = await getSesClient();
  if (!ses) {
    console.info(`[emailService] Campaign email (no SES) → ${to} | campaign=${campaignId} fan=${fanProfileId}`);
    return;
  }
  const { client, SendEmailCommand, fromEmail } = ses;
  try {
    await client.send(new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: html } },
      },
    }));
  } catch (err) {
    console.warn(`[emailService] sendCampaignEmail failed for ${to}: ${err.message}`);
    throw err; // let caller handle retry/skip logic
  }
}

// ─── Auth email helpers ───────────────────────────────────────────────────────

/**
 * Send a password-reset email.
 * Falls back to a console log if SES is not configured.
 *
 * @param {object} opts
 * @param {string} opts.to         recipient email address
 * @param {string} opts.token      raw reset token (caller builds the link)
 * @param {boolean} [opts.isFan]   true for fan portal, false for club staff
 */
export async function sendPasswordResetEmail({ to, token, isFan = false }) {
  const portalLabel = isFan ? "Fan Portal" : "Club Dashboard";
  const baseUrl = isFan
    ? (process.env.FAN_AUTH_URL ?? "http://localhost:5175")
    : (process.env.CLUB_AUTH_URL ?? "http://localhost:5173");
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  const ses = await getSesClient();
  if (!ses) {
    console.info(`[emailService] Password reset (${portalLabel}) → ${to} | link: ${resetLink}`);
    return;
  }

  const { client, SendEmailCommand, fromEmail } = ses;
  const html = `
    <p>Você solicitou a redefinição de senha no <strong>${portalLabel}</strong>.</p>
    <p><a href="${resetLink}">Clique aqui para redefinir sua senha</a></p>
    <p>O link expira em 1 hora. Se você não solicitou isso, ignore este e-mail.</p>
  `;
  try {
    await client.send(new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `Redefinição de senha — ${portalLabel}` },
        Body: { Html: { Data: html } },
      },
    }));
  } catch (err) {
    console.warn(`[emailService] sendPasswordResetEmail failed: ${err.message}`);
  }
}

/**
 * Send an email verification message.
 * Falls back to a console log if SES is not configured.
 *
 * @param {object} opts
 * @param {string} opts.to      recipient email address
 * @param {string} opts.token   raw verification token
 */
export async function sendVerifyEmailMessage({ to, token }) {
  const baseUrl = process.env.FAN_DASHBOARD_URL ?? "http://localhost:5176";
  const verifyLink = `${baseUrl}/verify-email?token=${token}`;

  const ses = await getSesClient();
  if (!ses) {
    console.info(`[emailService] Email verification → ${to} | link: ${verifyLink}`);
    return;
  }

  const { client, SendEmailCommand, fromEmail } = ses;
  const html = `
    <p>Confirme seu endereço de e-mail clicando no link abaixo:</p>
    <p><a href="${verifyLink}">Verificar e-mail</a></p>
    <p>O link expira em 24 horas.</p>
  `;
  try {
    await client.send(new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: "Verifique seu e-mail — Coxa" },
        Body: { Html: { Data: html } },
      },
    }));
  } catch (err) {
    console.warn(`[emailService] sendVerifyEmailMessage failed: ${err.message}`);
  }
}

/**
 * Insert a ChannelSuppression record if the model is available.
 * Gracefully skips if the model is not registered yet.
 */
async function _insertSuppression(sendDoc, reason) {
  try {
    const { ChannelSuppression } = await import("../models/ChannelSuppression.js");
    await ChannelSuppression.updateOne(
      { tenantId: sendDoc.tenantId, fanId: sendDoc.fanId, channel: "email" },
      {
        $setOnInsert: {
          tenantId: sendDoc.tenantId,
          fanId: sendDoc.fanId,
          channel: "email",
          emailAddress: sendDoc.emailAddress,
          reason,
          suppressedAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.warn("[emailService] Could not insert ChannelSuppression:", err.message);
  }
}
