import { DigitalProject } from "../models/DigitalProject.js";
import { DigitalProjectResponse } from "../models/DigitalProjectResponse.js";
import { FanProfile } from "../models/FanProfile.js";

async function getProjectOrThrow(tenantId, projectId) {
  const project = await DigitalProject.findOne({ _id: projectId, tenantId });
  if (!project) {
    const err = new Error("Digital project not found");
    err.status = 404;
    err.code = "PROJECT_NOT_FOUND";
    throw err;
  }
  return project;
}

async function resolveFanProfileId(tenantId, payload = {}) {
  if (payload.fanProfileId) return payload.fanProfileId;
  if (payload.email) {
    const existing = await FanProfile.findOne({ tenantId, email: payload.email.toLowerCase() });
    if (existing) return existing._id;
  }

  const email = (payload.email ?? `fanbox-test-${Date.now()}@local.test`).toLowerCase();
  const profile = await FanProfile.create({
    tenantId,
    fanId: payload.fanId ?? `fanbox-test-${Date.now().toString(36)}`,
    fullName: payload.fullName ?? "FanBox Test User",
    email,
    status: "active",
  });
  return profile._id;
}

export async function listProjects(tenantId, { type, status, limit = 100 } = {}) {
  const query = { tenantId };
  if (type) query.type = type;
  if (status) query.status = status;
  return DigitalProject.find(query).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function getProject(tenantId, projectId) {
  return getProjectOrThrow(tenantId, projectId);
}

export async function createProject(tenantId, payload) {
  return DigitalProject.create({
    tenantId,
    type: payload.type,
    title: payload.title,
    status: payload.status ?? "draft",
    questions: payload.questions ?? [],
    schedule: payload.schedule ?? {},
    eligibility: payload.eligibility ?? {},
    resultsMeta: payload.resultsMeta ?? {},
    createdBy: payload.createdBy,
  });
}

export async function updateProject(tenantId, projectId, updates) {
  const project = await getProjectOrThrow(tenantId, projectId);
  const fields = ["title", "type", "status", "questions", "schedule", "eligibility", "resultsMeta"];
  for (const field of fields) {
    if (updates[field] !== undefined) project[field] = updates[field];
  }
  await project.save();
  return project;
}

export async function closeProject(tenantId, projectId) {
  const project = await getProjectOrThrow(tenantId, projectId);
  project.status = "closed";
  project.resultsMeta = {
    ...(project.resultsMeta ?? {}),
    closedAt: new Date(),
  };
  await project.save();
  return project;
}

export async function listResponses(tenantId, projectId, { limit = 100 } = {}) {
  await getProjectOrThrow(tenantId, projectId);
  return DigitalProjectResponse.find({ projectId }).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function submitResponse(tenantId, projectId, payload = {}) {
  await getProjectOrThrow(tenantId, projectId);
  const fanProfileId = await resolveFanProfileId(tenantId, payload);
  return DigitalProjectResponse.create({
    projectId,
    fanProfileId,
    answers: payload.answers ?? {},
    optionId: payload.optionId,
    npsScore: payload.npsScore,
  });
}

export async function drawRaffleWinner(tenantId, projectId) {
  const project = await getProjectOrThrow(tenantId, projectId);
  if (project.type !== "raffle") {
    const err = new Error("Raffle winner can only be drawn for raffle projects");
    err.status = 400;
    err.code = "INVALID_PROJECT_TYPE";
    throw err;
  }

  const responses = await DigitalProjectResponse.find({ projectId }).select("fanProfileId createdAt");
  if (!responses.length) {
    const err = new Error("No responses available to draw winner");
    err.status = 400;
    err.code = "NO_RESPONSES";
    throw err;
  }

  const uniqueFanIds = [...new Set(responses.map((response) => response.fanProfileId.toString()))];
  const winnerFanProfileId = uniqueFanIds[Math.floor(Math.random() * uniqueFanIds.length)];

  project.resultsMeta = {
    ...(project.resultsMeta ?? {}),
    raffleWinnerFanProfileId: winnerFanProfileId,
    raffleWinnerDrawnAt: new Date(),
    raffleEntrants: uniqueFanIds.length,
  };
  await project.save();

  const winnerProfile = await FanProfile.findOne({ _id: winnerFanProfileId, tenantId }).select(
    "fanId fullName email",
  );

  return {
    projectId: project.id,
    winnerFanProfileId,
    winner: winnerProfile,
    entrants: uniqueFanIds.length,
  };
}
