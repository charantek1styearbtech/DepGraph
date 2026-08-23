// lib/api.js — shared Route Handler plumbing.
//
// Every /app/api route wraps its handler in `route()` so AppErrors become
// clean JSON responses (with safe messages) and unexpected failures never
// leak driver internals to the client. Technical detail stays in server logs.

import { NextResponse } from "next/server";
import { AppError, ValidationError } from "./errors.js";

/** Wrap a Route Handler with uniform error → response mapping. */
export function route(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof AppError) {
        if (err.cause) console.error(`[${err.name}]`, err.cause?.message ?? err.cause);
        return NextResponse.json(
          { error: { message: err.message } },
          { status: err.status },
        );
      }
      console.error("[Unhandled API error]", err);
      return NextResponse.json(
        { error: { message: "Something went wrong" } },
        { status: 500 },
      );
    }
  };
}

/** Validated non-empty string (optionally pattern-checked). */
export function requireString(value, field, { pattern = null, max = 300 } = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`"${field}" is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`"${field}" is too long`);
  if (pattern && !pattern.test(trimmed)) {
    throw new ValidationError(`"${field}" has an invalid format`);
  }
  return trimmed;
}

export function searchParamsOf(request) {
  return new URL(request.url).searchParams;
}

/** Bounded integer query param with clamping (pagination safety). */
export function intParam(params, name, fallback, { min = 1, max = 500 } = {}) {
  const raw = params.get(name);
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new ValidationError(`"${name}" must be an integer`);
  return Math.min(max, Math.max(min, parsed));
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
