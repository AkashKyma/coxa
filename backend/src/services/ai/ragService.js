/**
 * RAG Service — Retrieval-Augmented Generation pipeline.
 *
 * Architecture:
 *   1. Document ingestion: text chunks are embedded via OpenAI text-embedding-3-small
 *      and stored in MongoDB `ragchunks` collection.
 *   2. Retrieval: at query time the query is embedded and cosine similarity is
 *      computed against stored chunk vectors to find the top-K most relevant chunks.
 *   3. Generation: retrieved chunks are injected as context into a GPT system prompt.
 *
 * MongoDB Atlas Vector Search is used when available (M10+ cluster).
 * Falls back to in-process cosine similarity for development / smaller clusters.
 *
 * ENV:
 *   OPENAI_API_KEY   – required for embeddings + generation
 *   AI_MODEL         – generation model (default gpt-4o-mini)
 *   AI_EMBED_MODEL   – embedding model (default text-embedding-3-small)
 *   AI_EMBED_DIMS    – embedding dimensions (default 1536)
 */

import mongoose from "mongoose";

const EMBED_MODEL = process.env.AI_EMBED_MODEL ?? "text-embedding-3-large";
const EMBED_DIMS = Number(process.env.AI_EMBED_DIMS ?? 3072);
const OPENAI_BASE = "https://api.openai.com/v1";
const GEN_MODEL = process.env.AI_MODEL ?? "gpt-4o";
const TOP_K = 8;
const MAX_CONTEXT_CHARS = 8000;

// ─── Mongoose schema for RAG chunks ──────────────────────────────────────────

const ragChunkSchema = new mongoose.Schema({
  tenantId:   { type: String, index: true },           // null = global platform docs
  source:     { type: String, required: true },        // e.g. 'docs/FANBOX_ADMIN_WORKFLOW.md'
  chunkIndex: { type: Number, required: true },
  text:       { type: String, required: true },
  embedding:  { type: [Number], required: true },      // text-embedding-3-large (3072-d)
  metadata:   { type: mongoose.Schema.Types.Mixed },
  updatedAt:  { type: Date, default: Date.now },
}, { timestamps: false });

ragChunkSchema.index({ source: 1, chunkIndex: 1 }, { unique: true });

let RagChunk;
try {
  RagChunk = mongoose.model("RagChunk");
} catch {
  RagChunk = mongoose.model("RagChunk", ragChunkSchema);
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────

function apiKey() { return process.env.OPENAI_API_KEY; }

async function getEmbedding(text) {
  const key = apiKey();
  if (!key) return null;
  const resp = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000), dimensions: EMBED_DIMS }),
  });
  if (!resp.ok) throw new Error(`Embedding API error ${resp.status}`);
  const json = await resp.json();
  return json.data?.[0]?.embedding ?? null;
}

async function generateWithContext(messages) {
  const key = apiKey();
  if (!key) return { content: "AI assistant is not configured. Set OPENAI_API_KEY.", stub: true };
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: GEN_MODEL, messages, max_tokens: 1500, temperature: 0.2 }),
  });
  if (!resp.ok) throw new Error(`Chat API error ${resp.status}`);
  const json = await resp.json();
  return { content: json.choices?.[0]?.message?.content ?? "", usage: json.usage };
}

// ─── Cosine similarity (fallback for non-Atlas vector search) ─────────────────

function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Document ingestion ───────────────────────────────────────────────────────

/**
 * Split text into ~500-token overlapping chunks.
 */
function chunkText(text, chunkSize = 1800, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

/**
 * Ingest a document: split into chunks, embed, upsert into MongoDB.
 * tenantId = null for global platform docs (shared across all tenants).
 */
export async function ingestDocument(source, text, { tenantId = null, metadata = {} } = {}) {
  if (!apiKey()) {
    return { skipped: true, reason: "OPENAI_API_KEY not set" };
  }

  const chunks = chunkText(text);
  let ingested = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);
    if (!embedding) continue;

    await RagChunk.findOneAndUpdate(
      { source, chunkIndex: i },
      { $set: { tenantId, source, chunkIndex: i, text: chunk, embedding, metadata, updatedAt: new Date() } },
      { upsert: true },
    );
    ingested++;
  }

  return { source, chunks: chunks.length, ingested };
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve top-K chunks most relevant to the query.
 * tenantId: pass to include tenant-specific docs alongside global docs.
 */
export async function retrieveChunks(query, { tenantId = null, k = TOP_K } = {}) {
  if (!apiKey()) return [];

  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) return [];

  // Pull candidate chunks for this tenant (+ global docs)
  const tenantFilter = tenantId
    ? { $or: [{ tenantId }, { tenantId: null }] }
    : { tenantId: null };

  const candidates = await RagChunk.find(tenantFilter).select("text embedding source metadata").lean();

  if (!candidates.length) return [];

  // Score + sort
  const scored = candidates.map((c) => ({
    text: c.text,
    source: c.source,
    score: cosineSim(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ─── RAG-grounded chat ────────────────────────────────────────────────────────

/**
 * Main RAG assistant call.
 *
 * @param {string[]} messages  - conversation history [{role,content}]
 * @param {object}  options
 *   tenantId     - for tenant-specific docs
 *   role         - operator role code (for tone/scope)
 *   tenantName   - club display name
 *   kpiContext   - optional live KPI snapshot to inject
 */
export async function ragChat(messages = [], {
  tenantId = null,
  role = "support_agent",
  tenantName = "Club",
  kpiContext = null,
} = {}) {
  const userQuery = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  // Retrieve context chunks
  const chunks = await retrieveChunks(userQuery, { tenantId, k: TOP_K });

  let contextBlock = "";
  if (chunks.length > 0) {
    let totalChars = 0;
    const kept = [];
    for (const c of chunks) {
      if (totalChars + c.text.length > MAX_CONTEXT_CHARS) break;
      kept.push(c.text);
      totalChars += c.text.length;
    }
    contextBlock = `\n\n--- Platform Knowledge (retrieved) ---\n${kept.join("\n\n---\n")}\n--- End Knowledge ---`;
  }

  const kpiBlock = kpiContext
    ? `\n\nCurrent dashboard KPIs:\n${JSON.stringify(kpiContext, null, 2)}`
    : "";

  const systemPrompt =
    `You are the Fan OS AI assistant for ${tenantName}. The current user has role: "${role}". ` +
    `Answer only questions about fan management, ticketing, retail, membership, campaigns, analytics, and platform operations. ` +
    `Use the retrieved knowledge below as your primary source; if an answer is not there, say so. ` +
    `Never expose PII about fans. Keep answers concise and actionable.` +
    contextBlock +
    kpiBlock;

  return generateWithContext([
    { role: "system", content: systemPrompt },
    ...messages,
  ]);
}

// ─── KPI insight summary ──────────────────────────────────────────────────────

/**
 * RAG-grounded KPI narrative. Retrieves context about each department before narrating.
 */
export async function ragKpiInsights(kpis = [], {
  tenantId = null,
  role = "executive_viewer",
  tenantName = "Club",
  from,
  to,
} = {}) {
  const department = kpis[0]?.department ?? "general";
  const chunks = await retrieveChunks(`${department} KPIs analysis for football club`, { tenantId, k: 3 });
  const contextBlock = chunks.length
    ? `\n\nRelevant platform context:\n${chunks.map((c) => c.text).join("\n---\n")}`
    : "";

  const period = from && to ? `${from} to ${to}` : "the current period";
  const kpiLines = kpis.map((k) => `• ${k.label}: ${k.value}${k.unit === "pct" ? "%" : k.unit === "cents" ? " (BRL cents)" : ""}`).join("\n");

  const systemPrompt =
    `You are a sports analytics assistant for ${tenantName}. Narrate KPI performance to a "${role}" in 2–4 bullet points. ` +
    `Be factual. Reference deltas where available. End with one actionable recommendation. Do not fabricate data.` +
    contextBlock;

  return generateWithContext([
    { role: "system", content: systemPrompt },
    { role: "user", content: `KPIs for ${period}:\n${kpiLines}\n\nProvide a brief insight summary.` },
  ]);
}

export { RagChunk };
