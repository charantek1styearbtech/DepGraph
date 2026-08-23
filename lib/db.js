// lib/db.js — CognoDB connection layer. SERVER-SIDE ONLY.
//
// Wraps the official neo4j-driver (CognoDB speaks openCypher over Bolt):
//   • lazy singleton driver built from environment variables
//   • every query runs through runQuery()/runQueryRows() which guarantee
//     parameterized Cypher + guaranteed session cleanup + typed errors
//   • plain-JS conversion of driver types (Integer/Node/Rel/Path)
//
// Components never import this directly except lib/queries/* and scripts/*.
import neo4j from "neo4j-driver";
import { loadDotEnv } from "./env.js";
import { classifyDriverError } from "./errors.js";

loadDotEnv(); // no-op inside Next (env preloaded); enables standalone scripts

const DEFAULT_QUERY_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 8_000;

let _driver = null;

export function getConfig() {
  return {
    uri: process.env.COGNODB_URI ?? "",
    username: process.env.COGNODB_USERNAME ?? "",
    password: process.env.COGNODB_PASSWORD ?? "",
    database: process.env.COGNODB_DATABASE || undefined,
  };
}

export function isDatabaseConfigured() {
  const { uri, username, password } = getConfig();
  return Boolean(uri && username && password);
}

/**
 * Lazily construct the singleton driver.
 * Throws DatabaseUnavailableError when configuration is missing.
 */
export function getDriver() {
  if (_driver) return _driver;

  const { uri, username, password } = getConfig();
  if (!uri || !username || !password) {
    throw classifyDriverError(
      Object.assign(new Error("COGNODB_URI / USERNAME / PASSWORD are not configured"), {
        code: "ServiceUnavailable.Misconfigured",
      }),
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    connectionTimeout: CONNECT_TIMEOUT_MS,
    maxTransactionRetryTime: 5_000,
    disableLosslessIntegers: true, // give us plain numbers back
  });
  return _driver;
}

/** Close the singleton (used by scripts and tests). */
export async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}

/** Cheap liveness probe: `RETURN 1`. Returns true/false, never throws. */
export async function checkConnection() {
  try {
    await runQuery("RETURN 1 AS ok");
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a parameterized query and return an array of plain-JS records,
 * where each record is an object keyed by the returned variable names.
 *
 * @param {string} query  Cypher — MUST use $parameters, never interpolation
 * @param {Record<string, unknown>} [params]
 * @param {{ readonly?: boolean, timeout?: number }} [opts]
 */
export async function runQuery(query, params = {}, opts = {}) {
  const { readonly = true, timeout = DEFAULT_QUERY_TIMEOUT_MS } = opts;
  const driver = getDriver();
  const session = driver.session({
    defaultAccessMode: readonly ? neo4j.session.READ : neo4j.session.WRITE,
    database: getConfig().database,
    connectionAcquisitionTimeout: timeout,
  });

  try {
    const result = await session.run(query, params, { timeout });
    return result.records.map((record) =>
      Object.fromEntries(
        record.keys.map((key) => [key, toPlain(record.get(key))]),
      ),
    );
  } catch (err) {
    throw classifyDriverError(err);
  } finally {
    await session.close(); // guaranteed cleanup
  }
}

/** Convenience wrapper mirroring runQuery but for writes. */
export function runWrite(query, params = {}, opts = {}) {
  return runQuery(query, params, { ...opts, readonly: false });
}

// ── driver-type → plain-JS conversion ────────────────────────────────────────

function toPlain(value) {
  if (value == null) return value;

  if (neo4j.int ? neo4j.isInt(value) : false) {
    return value.toNumber();
  }

  const types = neo4j.types ?? {};

  if (types.Node && value instanceof types.Node) {
    return {
      labels: [...value.labels],
      ...toPlainProperties(value.properties),
    };
  }
  if (types.Relationship && value instanceof types.Relationship) {
    return {
      type: value.type,
      ...toPlainProperties(value.properties),
    };
  }
  if (types.Path && value instanceof types.Path) {
    return {
      start: toPlain(value.start),
      end: toPlain(value.end),
      length: value.segments.length,
      segments: value.segments.map((s) => ({
        start: toPlain(s.start),
        relationship: toPlain(s.relationship),
        end: toPlain(s.end),
      })),
    };
  }
  if (Array.isArray(value)) {
    return value.map(toPlain);
  }
  if (typeof value === "object") {
    // Plain maps returned by Cypher (e.g. collect(node{.*}))
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

function toPlainProperties(props) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) out[k] = toPlain(v);
  return out;
}
