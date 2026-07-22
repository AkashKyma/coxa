/**
 * AI Insights Service (WS8) — thin facade over ragService.
 *
 * Kept for backward-compat with existing route imports.
 * All heavy-lifting (embeddings, retrieval, generation) lives in ragService.js.
 */

export { ragChat as chatWithContext, ragKpiInsights as generateKpiInsights } from "./ai/ragService.js";

// ─── GPT-Assisted KPI Discovery (unchanged, no retrieval needed) ──────────────

const OPENAI_BASE = "https://api.openai.com/v1";
const MODEL = process.env.AI_MODEL ?? "gpt-4o";

async function chatCompletion(messages, options = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { content: "AI insights are not configured. Set OPENAI_API_KEY.", stub: true };
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: options.maxTokens ?? 1200, temperature: 0.2 }),
  });
  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return { content: json.choices?.[0]?.message?.content ?? "", usage: json.usage };
}

export async function discoverAdditionalKpis({ department, industry = "football_club", existingKeys = [] }) {
  const prompt = `You are a sports analytics consultant. List up to 10 additional KPIs for the "${department}" department of a ${industry.replace("_", " ")} NOT already tracked. Existing: ${existingKeys.join(", ")}. Return a JSON array: [{ key, label, unit, format, tier, description, analysisHint, defaultViz }]. Only valid JSON, no markdown.`;
  const result = await chatCompletion([
    { role: "system", content: "Return only valid JSON arrays. No markdown." },
    { role: "user", content: prompt },
  ], { maxTokens: 1200 });
  if (result.stub) return { suggestions: [], stub: true };
  try {
    const suggestions = JSON.parse(result.content);
    return { suggestions: Array.isArray(suggestions) ? suggestions : [], usage: result.usage };
  } catch {
    return { suggestions: [], rawContent: result.content };
  }
}
