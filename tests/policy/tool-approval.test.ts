import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseGitHubIssueUrl } from "../../src/domain/github.js";
import {
  createGuardedApprovalInput,
  evaluateToolApproval,
  validateApprovalEvidence,
  type ApprovalEvidence,
  type ApprovalPolicyContext,
  type PendingCall,
} from "../../src/policy/tool-approval.js";

const issue = parseGitHubIssueUrl(
  "https://github.com/sarvanithin/replayfix-guarded/issues/7",
);
const outputDigest = createHash("sha256").update("passed").digest("hex");
const evidence: ApprovalEvidence = {
  repository: "sarvanithin/replayfix-guarded",
  baseSha: "a".repeat(40),
  baseBranch: "main",
  tests: [{ command: "npm test", status: "passed", outputDigest }],
};
const context: ApprovalPolicyContext = { issue, evidence };

function call(toolName: string, args: Record<string, unknown>): PendingCall {
  return { id: `call-${toolName}`, toolName, arguments: JSON.stringify(args) };
}

describe("validateApprovalEvidence", () => {
  it("accepts evidence bound to the issue repository", () => {
    expect(validateApprovalEvidence(evidence, issue)).toEqual(evidence);
  });

  it.each([
    [{ ...evidence, repository: "someone/else" }, /repository/],
    [{ ...evidence, baseSha: "short" }, /baseSha/],
    [{ ...evidence, baseBranch: "bad branch" }, /baseBranch/],
    [{ ...evidence, tests: [] }, /at least one test/],
    [
      {
        ...evidence,
        tests: [{ command: "npm test", status: "failed", outputDigest }],
      },
      /did not pass/,
    ],
    [
      {
        ...evidence,
        tests: [{ command: "npm test", status: "passed", outputDigest: "bad" }],
      },
      /outputDigest/,
    ],
  ])("rejects stale or malformed evidence", (value, expected) => {
    expect(() => validateApprovalEvidence(value, issue)).toThrow(expected);
  });
});

describe("evaluateToolApproval", () => {
  it("binds an allowed branch call to an exact typed digest", () => {
    const evaluation = evaluateToolApproval(
      call("create_branch", {
        owner: issue.owner,
        repo: issue.repository,
        branch: "replayfix/issue-7-stop-duplicates",
        from_branch: "main",
      }),
      context,
    );

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(
      createGuardedApprovalInput(evaluation, "main", evaluation.digest ?? ""),
    ).toMatchObject({ approval: { status: "allow" } });
    expect(
      createGuardedApprovalInput(evaluation, "main", "wrong"),
    ).toMatchObject({ approval: { status: "deny" } });
  });

  it("allows a bounded safe text patch on the previously approved branch", () => {
    const evaluation = evaluateToolApproval(
      call("push_files", {
        owner: issue.owner,
        repo: issue.repository,
        branch: "replayfix/issue-7-stop-duplicates",
        message: "fix: prevent duplicate checkout",
        files: [
          { path: "src/checkout.ts", content: "export const safe = true;" },
        ],
      }),
      { ...context, approvedBranch: "replayfix/issue-7-stop-duplicates" },
    );

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.summary).not.toContain("export const safe");
    expect(evaluation.summary).toContain("sha256");
  });

  it("allows only a draft PR to the evidence base", () => {
    const evaluation = evaluateToolApproval(
      call("create_pull_request", {
        owner: issue.owner,
        repo: issue.repository,
        base: "main",
        head: "replayfix/issue-7-stop-duplicates",
        title: "fix: prevent duplicate checkout",
        draft: true,
      }),
      { ...context, approvedBranch: "replayfix/issue-7-stop-duplicates" },
    );

    expect(evaluation.allowed).toBe(true);
  });

  it.each([
    [
      call("create_branch", {
        owner: "someone",
        repo: "else",
        branch: "main",
        from_branch: "develop",
      }),
      context,
      /repository|prefix|base branch/,
    ],
    [
      call("push_files", {
        owner: issue.owner,
        repo: issue.repository,
        branch: "replayfix/issue-7-stop-duplicates",
        message: "publish",
        files: [{ path: ".github/workflows/unsafe.yml", content: "unsafe" }],
      }),
      context,
      /protected/,
    ],
    [
      call("create_pull_request", {
        owner: issue.owner,
        repo: issue.repository,
        base: "develop",
        head: "replayfix/issue-7-stop-duplicates",
        title: "unsafe",
        draft: false,
      }),
      context,
      /base|draft/,
    ],
  ])("denies an unsafe mutation payload", (pending, policy, expected) => {
    const evaluation = evaluateToolApproval(pending, policy);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reasons.join(" ")).toMatch(expected);
    expect(createGuardedApprovalInput(evaluation, "main", "")).toMatchObject({
      approval: { status: "deny" },
    });
  });

  it.each([
    [{ id: "missing" }, /could not be resolved/],
    [
      { id: "read", toolName: "issue_read", arguments: "{}" },
      /not an approved mutation/,
    ],
    [
      { id: "broken", toolName: "push_files", arguments: "not-json" },
      /not a valid JSON/,
    ],
  ])("fails closed for an unresolved call", (pending, expected) => {
    expect(evaluateToolApproval(pending, context).reasons.join(" ")).toMatch(
      expected,
    );
  });
});
