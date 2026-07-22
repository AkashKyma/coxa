/**
 * Period resolution utility.
 * Converts preset shortcuts + granularity into { from, to, granularity }.
 *
 * Presets: today | 7d | 30d | mtd | qtd | ytd | custom
 * Granularity: day | week | month | quarter | year
 */
export function resolvePeriod({ from, to, granularity, preset } = {}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  let resolvedFrom = from;
  let resolvedTo = to;
  let resolvedGranularity = granularity ?? "month";

  if (preset && preset !== "custom") {
    switch (preset) {
      case "today":
        resolvedFrom = today;
        resolvedTo = today;
        resolvedGranularity = "day";
        break;
      case "7d": {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        resolvedFrom = d.toISOString().slice(0, 10);
        resolvedTo = today;
        resolvedGranularity = "day";
        break;
      }
      case "30d": {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        resolvedFrom = d.toISOString().slice(0, 10);
        resolvedTo = today;
        resolvedGranularity = "day";
        break;
      }
      case "mtd":
        resolvedFrom = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        resolvedTo = today;
        resolvedGranularity = granularity ?? "week";
        break;
      case "qtd": {
        const qStartMonth = Math.floor(m / 3) * 3;
        resolvedFrom = `${y}-${String(qStartMonth + 1).padStart(2, "0")}-01`;
        resolvedTo = today;
        resolvedGranularity = granularity ?? "month";
        break;
      }
      case "ytd":
        resolvedFrom = `${y}-01-01`;
        resolvedTo = today;
        resolvedGranularity = granularity ?? "month";
        break;
    }
  }

  return {
    from: resolvedFrom ?? null,
    to: resolvedTo ?? null,
    granularity: resolvedGranularity,
  };
}

/**
 * Build a MongoDB date-range filter on a given field.
 * Returns {} if no dates supplied.
 */
export function buildDateFilter(field, { from, to } = {}) {
  if (!from && !to) return {};
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return { [field]: filter };
}

/**
 * Returns the equivalent previous period (same span, shifted back).
 * Returns null if from/to not available.
 */
export function getPreviousPeriod({ from, to } = {}) {
  if (!from || !to) return null;
  const f = new Date(from);
  const t = new Date(to);
  const span = t.getTime() - f.getTime();
  return {
    from: new Date(f.getTime() - span).toISOString().slice(0, 10),
    to: new Date(t.getTime() - span).toISOString().slice(0, 10),
  };
}
