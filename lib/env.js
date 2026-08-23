// lib/env.js — minimal .env loader for standalone scripts (seed/reset/tests).
//
// Next.js injects `.env.local` into Route Handlers automatically; this loader
// exists only so `npm run seed` / `npm run reset` / vitest can read the same
// file without adding a dependency. Never overrides variables that are
// already present in the actual environment.

import fs from "node:fs";
import path from "node:path";

let loaded = false;

function parseEnvFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return false;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  return true;
}

/**
 * Idempotently load `.env.local` (falling back to `.env`) relative to the
 * project root. Safe to call from anywhere, any number of times.
 */
export function loadDotEnv() {
  if (loaded) return;
  loaded = true;

  const root = path.resolve(process.cwd());
  if (!parseEnvFile(path.join(root, ".env.local"))) {
    parseEnvFile(path.join(root, ".env"));
  }
}
