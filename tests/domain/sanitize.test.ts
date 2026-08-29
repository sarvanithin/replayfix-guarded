import { describe, expect, it } from "vitest";

import {
  sanitizeReplayEvent,
  sanitizeSessionId,
  sanitizeText,
  sanitizeUrl,
} from "../../src/domain/sanitize.js";
import type { ErrorEvent } from "../../src/domain/events.js";

describe("replay sanitization", () => {
  it("strips query strings and fragments", () => {
    expect(
      sanitizeUrl(
        "https://example.test/pay?email=user@example.com&token=abc#card",
      ),
    ).toBe("https://example.test/pay?[REDACTED_QUERY]");
    expect(sanitizeUrl("/checkout#private")).toBe("/checkout");
  });

  it("redacts emails, bearer tokens, JWTs, and inline secrets", () => {
    const text = sanitizeText(
      "user@example.com Bearer abc.def eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature api_key=raw-key",
    );
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("raw-key");
    expect(text).toContain("[REDACTED_EMAIL]");
    expect(text).toContain("[REDACTED_TOKEN]");
    expect(text).toContain("[REDACTED_SECRET]");
  });

  it("replaces session IDs with stable, non-reversible correlation IDs", () => {
    expect(sanitizeSessionId("private-123")).toBe(
      sanitizeSessionId("private-123"),
    );
    expect(sanitizeSessionId("private-123")).not.toContain("private-123");
    expect(sanitizeSessionId("another-session")).not.toBe(
      sanitizeSessionId("private-123"),
    );
  });

  it("sanitizes nested replay fields without mutating the input", () => {
    const event: ErrorEvent = {
      id: "e1",
      sessionId: "private-123",
      timestamp: 1,
      type: "error",
      pageUrl: "https://example.test/?token=secret",
      message: "Contact owner@example.com token=secret",
      stack: "Authorization: Bearer top-secret",
    };

    const safe = sanitizeReplayEvent(event);
    expect(safe.sessionId).toMatch(/^session-[a-f0-9]{12}$/);
    expect(safe.pageUrl).toBe("https://example.test/?[REDACTED_QUERY]");
    expect(safe.message).not.toContain("owner@example.com");
    expect(safe.stack).not.toContain("top-secret");
    expect(event.sessionId).toBe("private-123");
  });
});
