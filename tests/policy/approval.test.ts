import { describe, expect, it } from "vitest";

import {
  assertApprovalCurrent,
  createApprovalDigest,
  isApprovalCurrent,
  type ApprovalSubject,
} from "../../src/policy/approval.js";

const subject: ApprovalSubject = {
  repository: "owner/repo",
  baseSha: "a".repeat(40),
  diff: "diff --git a/src/a.ts b/src/a.ts\n+const fixed = true;",
  tests: [
    {
      command: "npm test",
      status: "passed",
      outputDigest: "test-output-sha256",
    },
  ],
  branch: "replayfix/checkout",
  title: "fix: prevent duplicate checkout",
};

describe("approval digest", () => {
  it("is stable and verifies the exact approved subject", () => {
    const digest = createApprovalDigest(subject);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(createApprovalDigest({ ...subject })).toBe(digest);
    expect(isApprovalCurrent({ digest }, subject)).toBe(true);
  });

  it.each([
    ["repository", "other/repo"],
    ["baseSha", "b".repeat(40)],
    ["diff", `${subject.diff}\n+// stale change`],
    [
      "tests",
      [{ command: "npm test", status: "failed", outputDigest: "different" }],
    ],
    ["branch", "replayfix/different"],
    ["title", "fix: a different change"],
  ] as const)("invalidates approval when %s changes", (field, value) => {
    const digest = createApprovalDigest(subject);
    const changed: ApprovalSubject = { ...subject, [field]: value };
    expect(isApprovalCurrent({ digest }, changed)).toBe(false);
  });

  it("rejects malformed and stale records", () => {
    expect(isApprovalCurrent({ digest: "not-a-digest" }, subject)).toBe(false);
    expect(() => {
      assertApprovalCurrent({ digest: "0".repeat(64) }, subject);
    }).toThrow(/stale/);
  });
});
