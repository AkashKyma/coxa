import { FanProfile } from "../models/FanProfile.js";
import { ImportJob } from "../models/ImportJob.js";

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvRows(csvText) {
  if (!csvText?.trim()) return [];

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function toLower(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function normalizeRow(rawRow, type) {
  const externalId = rawRow.externalId || rawRow.external_id || rawRow.idExterno || "";
  const fanId = rawRow.fanId || rawRow.fan_id || externalId || "";
  const email = toLower(rawRow.email || rawRow.emailAddress || rawRow.e_mail || "").trim();

  return {
    fanId: fanId.trim(),
    fullName: (rawRow.fullName || rawRow.nome || rawRow.name || "").trim(),
    email,
    phone: (rawRow.phone || rawRow.telefone || "").trim(),
    cpf: (rawRow.cpf || "").trim(),
    externalId: externalId.trim(),
    type,
  };
}

function buildImportIdentity(normalizedRow) {
  if (normalizedRow.fanId) return { fanId: normalizedRow.fanId };
  if (normalizedRow.externalId) return { fanId: normalizedRow.externalId };
  if (normalizedRow.email) return { email: normalizedRow.email };
  return null;
}

function pickProfileUpdates(row, type) {
  const updates = {};
  if (row.fullName) updates.fullName = row.fullName;
  if (row.email) updates.email = row.email;
  if (row.phone) updates.phone = row.phone;
  if (row.cpf) updates.cpf = row.cpf;
  if (type === "leads") updates.status = "lead";
  return updates;
}

export async function importFanboxCsv({
  tenantId,
  type,
  rows,
  csvText,
  filename,
  createdBy,
}) {
  const job = await ImportJob.create({
    tenantId,
    type,
    status: "processing",
    filename,
    createdBy,
  });

  const parsedRows = Array.isArray(rows)
    ? rows
    : parseCsvRows(typeof csvText === "string" ? csvText : "");

  let rowsOk = 0;
  let rowsFailed = 0;
  const errorLog = [];

  for (let i = 0; i < parsedRows.length; i += 1) {
    const rawRow = parsedRows[i];
    const row = normalizeRow(rawRow, type);
    const identity = buildImportIdentity(row);

    if (!identity) {
      rowsFailed += 1;
      errorLog.push(`row ${i + 1}: missing fanId/externalId/email`);
      continue;
    }

    try {
      const updates = pickProfileUpdates(row, type);
      if (!updates.fullName) {
        updates.fullName = updates.email?.split("@")[0] || row.fanId || row.externalId || "Fan";
      }
      if (!updates.email) {
        updates.email = `${identity.fanId || `fan-${Date.now()}-${i}`}@import.local`;
      }

      const fanId = row.fanId || row.externalId || `fan-import-${Date.now()}-${i}`;

      await FanProfile.findOneAndUpdate(
        { tenantId, ...identity },
        {
          $set: updates,
          $setOnInsert: {
            tenantId,
            fanId,
            status: type === "leads" ? "lead" : "active",
          },
        },
        { upsert: true, new: true, runValidators: true },
      );

      rowsOk += 1;
    } catch (err) {
      rowsFailed += 1;
      errorLog.push(`row ${i + 1}: ${err.message}`);
    }
  }

  job.rowsOk = rowsOk;
  job.rowsFailed = rowsFailed;
  job.errorLog = errorLog.slice(0, 200);
  job.status = rowsFailed > 0 ? "completed" : "completed";
  await job.save();

  return job;
}

export async function listImportJobs(tenantId, { type, status, limit = 50 } = {}) {
  const query = { tenantId };
  if (type) query.type = type;
  if (status) query.status = status;

  return ImportJob.find(query).sort({ createdAt: -1 }).limit(Number(limit));
}

export async function getImportJobById(tenantId, jobId) {
  const job = await ImportJob.findOne({ tenantId, _id: jobId });
  if (!job) {
    const err = new Error("Import job not found");
    err.status = 404;
    err.code = "IMPORT_JOB_NOT_FOUND";
    throw err;
  }
  return job;
}
