// lib/errors.js — application error taxonomy.
//
// Rule: raw driver/database errors are NEVER surfaced to the client.
// `classifyDriverError()` converts them into typed AppErrors whose `message`
// is safe for display, while the technical detail stays server-side logs.

/** Base class — every error carries an HTTP status for route handlers. */
export class AppError extends Error {
  constructor(message, { status = 500, cause = undefined, detail = undefined } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.status = status;
    this.detail = detail;
  }
}

/** CognoDB unreachable, bad credentials, or timed out. HTTP 503. */
export class DatabaseUnavailableError extends AppError {
  constructor(message = "Database unavailable", opts = {}) {
    super(message, { status: 503, ...opts });
  }
}

/** A Cypher query failed for a non-connection reason. HTTP 500. */
export class QueryExecutionError extends AppError {
  constructor(message = "Query failed", opts = {}) {
    super(message, { status: 500, ...opts });
  }
}

/** Malformed request input. HTTP 400. */
export class ValidationError extends AppError {
  constructor(message = "Invalid input", opts = {}) {
    super(message, { status: 400, ...opts });
  }
}

/** Requested entity does not exist in the graph. HTTP 404. */
export class NotFoundError extends AppError {
  constructor(message = "Not found", opts = {}) {
    super(message, { status: 404, ...opts });
  }
}

/** GitHub (or other upstream) fetch failed during import. HTTP 502. */
export class UpstreamError extends AppError {
  constructor(message = "Upstream request failed", opts = {}) {
    super(message, { status: 502, ...opts });
  }
}

const CONNECTION_CODE_PREFIXES = [
  "ServiceUnavailable",
  "SessionExpired",
  "Neo.TransientError",
];

const AUTH_CODE_PREFIXES = ["Neo.ClientError.Security"];

/**
 * Convert a neo4j-driver failure into the right AppError.
 * Connection/security problems → DatabaseUnavailableError (retryable UI).
 * Anything else → QueryExecutionError with a generic message; the original
 * error is attached as `cause` for server-side logging only.
 */
export function classifyDriverError(err) {
  const code = err?.code ?? "";

  if (
    err instanceof DatabaseUnavailableError ||
    err instanceof QueryExecutionError
  ) {
    return err;
  }

  if (CONNECTION_CODE_PREFIXES.some((p) => code.startsWith(p))) {
    return new DatabaseUnavailableError("Database unavailable", { cause: err });
  }

  if (AUTH_CODE_PREFIXES.some((p) => code.startsWith(p))) {
    return new DatabaseUnavailableError(
      "Database credentials were rejected",
      { cause: err },
    );
  }

  if (code.startsWith("Neo.ClientError.Statement")) {
    return new QueryExecutionError("Query failed", { cause: err });
  }

  // Unknown shape (network reset, DNS failure, timeout without a driver code…)
  return new DatabaseUnavailableError("Database unavailable", { cause: err });
}
