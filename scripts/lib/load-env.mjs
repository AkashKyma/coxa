/**
 * Load root (and optional backend) .env into process.env.
 * Zero deps — simple KEY=VALUE parser.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export function loadEnv(extraFiles = []) {
  parseEnvFile(join(ROOT, ".env"));
  parseEnvFile(join(ROOT, "backend", ".env"));
  for (const f of extraFiles) parseEnvFile(f);
  return process.env;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(
      `Missing required env var: ${name}. Add it to the repo root .env (see .env.example).`
    );
  }
  return v;
}

export function envOr(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export { ROOT };
