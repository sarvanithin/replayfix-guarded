import { createHash } from "node:crypto";

import type { ReplayEvent } from "./events.js";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const INLINE_SECRET_PATTERN =
  /\b(token|access[_-]?token|api[_-]?key|secret|session[_-]?id)\s*([:=])\s*([^\s,;&]+)/gi;
const SENSITIVE_KEY =
  /^(authorization|cookie|set-cookie|token|access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password)$/i;
const SESSION_KEY = /^session[_-]?id$/i;

export const REDACTED_EMAIL = "[REDACTED_EMAIL]";
export const REDACTED_TOKEN = "[REDACTED_TOKEN]";
export const REDACTED_QUERY = "[REDACTED_QUERY]";
export const REDACTED_SECRET = "[REDACTED_SECRET]";

/** Produces a stable correlation key without retaining the source session ID. */
export function sanitizeSessionId(sessionId: string): string {
  const digest = createHash("sha256")
    .update(sessionId, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `session-${digest}`;
}

export function sanitizeUrl(rawUrl: string): string {
  const queryIndex = rawUrl.indexOf("?");
  const hashIndex = rawUrl.indexOf("#");
  const firstPrivatePart = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const safePath =
    firstPrivatePart === undefined ? rawUrl : rawUrl.slice(0, firstPrivatePart);
  return queryIndex >= 0 ? `${safePath}?${REDACTED_QUERY}` : safePath;
}

export function sanitizeText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_TOKEN}`)
    .replace(JWT_PATTERN, REDACTED_TOKEN)
    .replace(
      INLINE_SECRET_PATTERN,
      (_match, key: string, separator: string) => {
        return `${key}${separator}${REDACTED_SECRET}`;
      },
    );
}

function sanitizeUnknown(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && SESSION_KEY.test(key)) return sanitizeSessionId(value);
    if (key && SENSITIVE_KEY.test(key)) return REDACTED_SECRET;
    if (key && (/url$/i.test(key) || key === "to")) {
      return sanitizeText(sanitizeUrl(value));
    }
    return sanitizeText(value);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeUnknown(childValue, childKey),
      ]),
    );
  }
  return value;
}

/** Returns a detached, JSON-safe copy suitable for logs and model prompts. */
export function sanitizeReplayEvent<T extends ReplayEvent>(event: T): T {
  return sanitizeUnknown(event) as T;
}

export function sanitizeReplayEvents(
  events: readonly ReplayEvent[],
): ReplayEvent[] {
  return events.map(sanitizeReplayEvent);
}
