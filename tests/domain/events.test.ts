import { describe, expect, it } from "vitest";

import {
  ReplayEventValidationError,
  validateReplayEvents,
} from "../../src/domain/events.js";

describe("validateReplayEvents", () => {
  it("accepts a valid synthetic replay", () => {
    const events = validateReplayEvents([
      {
        id: "click-1",
        sessionId: "private-session",
        timestamp: 100,
        type: "click",
        target: { selector: "#checkout", role: "button" },
        outcome: "no-effect",
      },
      {
        id: "error-1",
        sessionId: "private-session",
        timestamp: 200,
        type: "error",
        message: "Checkout failed",
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("click");
  });

  it("reports boundary errors and duplicate event IDs", () => {
    expect(() =>
      validateReplayEvents([
        {
          id: "same",
          sessionId: "s",
          timestamp: -1,
          type: "click",
          target: {},
        },
        { id: "same", sessionId: "s", timestamp: 2, type: "unknown" },
      ]),
    ).toThrow(ReplayEventValidationError);

    try {
      validateReplayEvents([
        {
          id: "same",
          sessionId: "s",
          timestamp: -1,
          type: "click",
          target: {},
        },
        { id: "same", sessionId: "s", timestamp: 2, type: "unknown" },
      ]);
    } catch (error) {
      expect(error).toBeInstanceOf(ReplayEventValidationError);
      expect(
        (error as ReplayEventValidationError).issues.map((issue) => issue.path),
      ).toEqual(
        expect.arrayContaining([
          "[0].timestamp",
          "[0].target.selector",
          "[1].type",
          "[1].id",
        ]),
      );
    }
  });

  it("normalizes the public synthetic replay envelope", () => {
    const events = validateReplayEvents({
      schemaVersion: 1,
      sessionId: "demo-session",
      startedAt: "2026-08-29T18:00:00.000Z",
      events: [
        {
          id: "state-1",
          timestamp: "2026-08-29T18:00:01.000Z",
          type: "state",
          url: "https://demo.invalid/checkout?private=yes",
          metadata: { pending: true },
        },
        {
          id: "click-1",
          timestamp: "2026-08-29T18:00:01.100Z",
          type: "click",
          url: "https://demo.invalid/checkout",
          selector: "#checkout",
        },
      ],
    });

    expect(events).toEqual([
      {
        id: "state-1",
        sessionId: "demo-session",
        timestamp: Date.parse("2026-08-29T18:00:01.000Z"),
        type: "dom_mutation",
        pageUrl: "https://demo.invalid/checkout?private=yes",
      },
      {
        id: "click-1",
        sessionId: "demo-session",
        timestamp: Date.parse("2026-08-29T18:00:01.100Z"),
        type: "click",
        pageUrl: "https://demo.invalid/checkout",
        target: { selector: "#checkout" },
      },
    ]);
  });

  it("reports malformed envelope timestamps at their source paths", () => {
    try {
      validateReplayEvents({
        schemaVersion: 1,
        sessionId: "demo-session",
        startedAt: "not-a-time",
        events: [{ id: "e1", timestamp: "also-not-a-time", type: "state" }],
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ReplayEventValidationError);
      expect(
        (error as ReplayEventValidationError).issues.map((issue) => issue.path),
      ).toEqual(
        expect.arrayContaining(["$.startedAt", "$.events[0].timestamp"]),
      );
    }
  });

  it("does not accept date-like strings without an ISO time and timezone", () => {
    expect(() =>
      validateReplayEvents({
        schemaVersion: 1,
        sessionId: "demo-session",
        startedAt: "2026-08-29",
        events: [{ id: "e1", timestamp: "2026-08-29 18:00:01", type: "state" }],
      }),
    ).toThrow(ReplayEventValidationError);
  });

  it("rejects non-array and empty payloads", () => {
    expect(() => validateReplayEvents({ nope: [] })).toThrow(
      "must be an array",
    );
    expect(() => validateReplayEvents([])).toThrow(
      "must contain between 1 and 10000 events",
    );
  });

  it("accepts every canonical event shape and optional field", () => {
    const common = {
      sessionId: "session",
      timestamp: 100,
      pageUrl: "https://demo.invalid/page",
    };
    const events = validateReplayEvents([
      {
        ...common,
        id: "click",
        type: "click",
        target: { selector: "#buy", role: "button", text: "Buy" },
        outcome: "effect",
      },
      { ...common, id: "nav", type: "navigation", to: "/complete" },
      {
        ...common,
        id: "mutation",
        type: "dom_mutation",
        target: { selector: "#status" },
      },
      {
        ...common,
        id: "error",
        type: "error",
        message: "failed",
        stack: "at checkout.ts:1",
        fatal: false,
      },
      {
        ...common,
        id: "submit",
        type: "form_submit",
        target: { selector: "form" },
        succeeded: false,
        validationMessage: "Card required",
      },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      "click",
      "navigation",
      "dom_mutation",
      "error",
      "form_submit",
    ]);
  });

  it("reports canonical field errors for every event variant", () => {
    let captured: ReplayEventValidationError | undefined;
    try {
      validateReplayEvents([
        null,
        {
          id: "",
          sessionId: "",
          timestamp: Number.NaN,
          pageUrl: "",
          type: "click",
          target: "button",
          outcome: "maybe",
        },
        {
          id: "navigation",
          sessionId: "s",
          timestamp: 1,
          type: "navigation",
          to: "",
        },
        {
          id: "mutation",
          sessionId: "s",
          timestamp: 2,
          type: "dom_mutation",
          target: { selector: "#ok", role: "" },
        },
        {
          id: "error",
          sessionId: "s",
          timestamp: 3,
          type: "error",
          message: "",
          stack: "",
          fatal: "yes",
        },
        {
          id: "submit",
          sessionId: "s",
          timestamp: 4,
          type: "form_submit",
          target: { selector: "#form", text: "" },
          succeeded: "yes",
          validationMessage: "",
        },
      ]);
    } catch (error) {
      if (error instanceof ReplayEventValidationError) captured = error;
    }

    expect(captured).toBeInstanceOf(ReplayEventValidationError);
    expect(captured?.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "[0]",
        "[1].id",
        "[1].sessionId",
        "[1].timestamp",
        "[1].pageUrl",
        "[1].target",
        "[1].outcome",
        "[2].to",
        "[3].target.role",
        "[4].message",
        "[4].stack",
        "[4].fatal",
        "[5].target.text",
        "[5].succeeded",
        "[5].validationMessage",
      ]),
    );
  });

  it("normalizes every envelope event variant", () => {
    const events = validateReplayEvents({
      schemaVersion: 1,
      sessionId: "demo-session",
      startedAt: "2026-08-29T18:00:00Z",
      events: [
        {
          id: "click",
          timestamp: "2026-08-29T18:00:01Z",
          type: "click",
          selector: "#buy",
          outcome: "unknown",
        },
        {
          id: "nav",
          timestamp: "2026-08-29T18:00:02+00:00",
          type: "navigation",
          to: "/done",
        },
        {
          id: "error",
          timestamp: "2026-08-29T18:00:03.123Z",
          type: "error",
          message: "failed",
          stack: "stack",
          fatal: true,
        },
        {
          id: "submit",
          timestamp: "2026-08-29T18:00:04Z",
          type: "form_submit",
          selector: "form",
          succeeded: false,
          validationMessage: "Try again",
        },
      ],
    });

    expect(events).toMatchObject([
      { type: "click", outcome: "unknown" },
      { type: "navigation", to: "/done" },
      { type: "error", stack: "stack", fatal: true },
      {
        type: "form_submit",
        succeeded: false,
        validationMessage: "Try again",
      },
    ]);
  });

  it("reports malformed envelope metadata and fields", () => {
    let captured: ReplayEventValidationError | undefined;
    try {
      validateReplayEvents({
        schemaVersion: 2,
        sessionId: "",
        startedAt: "2026-99-99T18:00:00Z",
        events: [
          null,
          {
            id: "",
            timestamp: "2026-08-29T18:00:01Z",
            type: "state",
            url: "",
            metadata: [],
          },
          {
            id: "missing-type",
            timestamp: "2026-08-29T18:00:02Z",
          },
          {
            id: "unknown",
            timestamp: "2026-08-29T18:00:03Z",
            type: "keypress",
          },
        ],
      });
    } catch (error) {
      if (error instanceof ReplayEventValidationError) captured = error;
    }

    expect(captured?.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "$.schemaVersion",
        "$.sessionId",
        "$.startedAt",
        "$.events[0]",
        "$.events[1].id",
        "$.events[1].url",
        "$.events[1].metadata",
        "$.events[2].type",
        "$.events[3].type",
      ]),
    );
  });

  it("maps normalized validation errors back to envelope paths", () => {
    expect(() =>
      validateReplayEvents({
        schemaVersion: 1,
        sessionId: "demo",
        startedAt: "2026-08-29T18:00:00Z",
        events: [
          {
            id: "bad-click",
            timestamp: "2026-08-29T18:00:01Z",
            type: "click",
          },
          {
            id: "bad-nav",
            timestamp: "2026-08-29T18:00:02Z",
            type: "navigation",
          },
        ],
      }),
    ).toThrow(/\$\.events\[0\]\.target\.selector/);
  });

  it("rejects a non-array envelope event collection", () => {
    expect(() =>
      validateReplayEvents({
        schemaVersion: 1,
        sessionId: "demo",
        startedAt: "2026-08-29T18:00:00Z",
        events: "not-an-array",
      }),
    ).toThrow(/\$\.events must be an array/);
  });
});
