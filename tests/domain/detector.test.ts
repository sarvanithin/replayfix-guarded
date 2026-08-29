import { describe, expect, it } from "vitest";

import { detectIssues } from "../../src/domain/detector.js";
import type { ReplayEvent } from "../../src/domain/events.js";

const events: ReplayEvent[] = [
  {
    id: "c3",
    sessionId: "s1",
    timestamp: 800,
    type: "click",
    target: { selector: "#pay" },
    outcome: "no-effect",
  },
  {
    id: "form",
    sessionId: "s1",
    timestamp: 2_000,
    type: "form_submit",
    target: { selector: "form#payment" },
    succeeded: false,
    validationMessage: "Card field remained invalid",
  },
  {
    id: "c1",
    sessionId: "s1",
    timestamp: 100,
    type: "click",
    target: { selector: "#pay" },
  },
  {
    id: "error",
    sessionId: "s1",
    timestamp: 1_500,
    type: "error",
    message: "TypeError",
    fatal: true,
  },
  {
    id: "c2",
    sessionId: "s1",
    timestamp: 450,
    type: "click",
    target: { selector: "#pay" },
  },
];

describe("detectIssues", () => {
  it("detects rage, explicitly dead, error, and failed-form evidence", () => {
    const issues = detectIssues(events);

    expect(issues.map((issue) => issue.kind)).toEqual([
      "rage-click",
      "dead-click",
      "runtime-error",
      "form-failure",
    ]);
    expect(
      issues.find((issue) => issue.kind === "rage-click")?.eventIds,
    ).toEqual(["c1", "c2", "c3"]);
    expect(
      issues.find((issue) => issue.kind === "runtime-error")?.severity,
    ).toBe("critical");
  });

  it("is deterministic for input order and does not infer dead clicks from replay endings", () => {
    const reversed = detectIssues([...events].reverse());
    expect(reversed).toEqual(detectIssues(events));

    const ordinaryClick = events.find((event) => event.id === "c1");
    expect(ordinaryClick).toBeDefined();
    if (!ordinaryClick) throw new Error("test fixture is missing c1");
    expect(detectIssues([ordinaryClick])).toEqual([]);
  });

  it("validates detector thresholds", () => {
    expect(() => detectIssues(events, { rageClickCount: 1 })).toThrow(
      RangeError,
    );
    expect(() => detectIssues(events, { rageClickWindowMs: 0 })).toThrow(
      RangeError,
    );
  });
});
