import { createHash } from "node:crypto";

import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";

import type { GitHubIssueReference } from "../domain/github.js";
import {
  createApprovalDigest,
  isApprovalCurrent,
  type ApprovalSubject,
  type TestEvidence,
} from "./approval.js";
import { evaluatePatchPolicy } from "./patch.js";

export const MUTATING_GITHUB_TOOLS = [
  "create_branch",
  "push_files",
  "create_pull_request",
] as const;

export interface ApprovalEvidence {
  repository: string;
  baseSha: string;
  baseBranch: string;
  tests: readonly TestEvidence[];
}

export interface ApprovalPolicyContext {
  issue: GitHubIssueReference;
  evidence: ApprovalEvidence;
  approvedBranch?: string;
}

export interface PendingCall {
  id: string;
  toolName?: string;
  arguments?: string;
}

export interface ToolApprovalEvaluation {
  allowed: boolean;
  call: PendingCall;
  digest?: string;
  operation?: (typeof MUTATING_GITHUB_TOOLS)[number];
  branch?: string;
  reasons: string[];
  subject?: ApprovalSubject;
  summary: string;
}

export interface BaseReferenceVerificationOptions {
  context: ApprovalPolicyContext;
  token: string;
  fetch?: typeof fetch;
}

export interface CreatedBranchVerificationOptions extends BaseReferenceVerificationOptions {
  branch: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const GIT_SHA = /^[a-f0-9]{40}$/i;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PATCH_BYTES = 1024 * 1024;

export function validateApprovalEvidence(
  value: unknown,
  issue: GitHubIssueReference,
): ApprovalEvidence {
  if (!isRecord(value))
    throw new TypeError("Approval evidence must be an object");
  const repository = stringField(value, "repository");
  const baseSha = stringField(value, "baseSha");
  const baseBranch = stringField(value, "baseBranch");
  const expectedRepository = `${issue.owner}/${issue.repository}`;
  if (repository.toLowerCase() !== expectedRepository.toLowerCase()) {
    throw new TypeError(
      "Approval evidence repository does not match the issue",
    );
  }
  if (!GIT_SHA.test(baseSha)) {
    throw new TypeError(
      "Approval evidence baseSha must be a 40-character Git SHA",
    );
  }
  if (!validBranchName(baseBranch)) {
    throw new TypeError("Approval evidence baseBranch is invalid");
  }
  if (!Array.isArray(value.tests) || value.tests.length === 0) {
    throw new TypeError("Approval evidence must contain at least one test");
  }
  const tests = value.tests.map((test, index): TestEvidence => {
    if (!isRecord(test)) {
      throw new TypeError(`Approval evidence test ${String(index)} is invalid`);
    }
    const command = stringField(test, "command");
    const status = stringField(test, "status");
    const outputDigest = stringField(test, "outputDigest");
    if (status !== "passed") {
      throw new TypeError(
        `Approval evidence test ${String(index)} did not pass`,
      );
    }
    if (!SHA256.test(outputDigest)) {
      throw new TypeError(
        `Approval evidence test ${String(index)} outputDigest is invalid`,
      );
    }
    return { command, status, outputDigest };
  });
  return { repository, baseSha, baseBranch, tests };
}

export function evaluateToolApproval(
  call: PendingCall,
  context: ApprovalPolicyContext,
): ToolApprovalEvaluation {
  const reasons: string[] = [];
  if (!call.toolName || !call.arguments) {
    return failed(call, "Tool name or arguments could not be resolved");
  }
  if (!isMutationTool(call.toolName)) {
    return failed(call, `Tool ${call.toolName} is not an approved mutation`);
  }

  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(call.arguments);
    if (!isRecord(parsed)) throw new TypeError("arguments must be an object");
    args = parsed;
  } catch {
    return failed(call, "Tool arguments are not a valid JSON object");
  }

  const expectedRepository = `${context.issue.owner}/${context.issue.repository}`;
  if (
    context.evidence.repository.toLowerCase() !==
    expectedRepository.toLowerCase()
  ) {
    reasons.push("Evidence repository does not match the accepted issue");
  }
  if (
    optionalString(args.owner)?.toLowerCase() !==
      context.issue.owner.toLowerCase() ||
    optionalString(args.repo)?.toLowerCase() !==
      context.issue.repository.toLowerCase()
  ) {
    reasons.push("Mutation repository does not match the accepted issue");
  }
  if (!GIT_SHA.test(context.evidence.baseSha)) {
    reasons.push("Evidence base SHA is invalid");
  }
  if (
    context.evidence.tests.length === 0 ||
    context.evidence.tests.some(
      (test) => test.status !== "passed" || !SHA256.test(test.outputDigest),
    )
  ) {
    reasons.push("All bound test evidence must be present and passing");
  }

  const branch = branchFor(call.toolName, args);
  if (!branch || !expectedTopicBranch(branch, context.issue.issueNumber)) {
    reasons.push(
      "Mutation branch does not use the required issue-scoped prefix",
    );
  }
  if (context.approvedBranch && branch !== context.approvedBranch) {
    reasons.push("Mutation branch differs from the approved branch");
  }
  if (call.toolName !== "create_branch" && !context.approvedBranch) {
    reasons.push(
      "Branch creation must complete successfully before later mutation gates",
    );
  }

  switch (call.toolName) {
    case "create_branch":
      if (args.from_branch !== context.evidence.baseBranch) {
        reasons.push("Branch must start from the evidence base branch");
      }
      break;
    case "push_files":
      validatePushedFiles(args, reasons);
      if (!nonEmptyString(args.message) || args.message.length > 200) {
        reasons.push(
          "Commit message must contain between 1 and 200 characters",
        );
      }
      break;
    case "create_pull_request":
      if (args.base !== context.evidence.baseBranch) {
        reasons.push(
          "Pull request base does not match the evidence base branch",
        );
      }
      if (args.draft !== true) reasons.push("Pull request must be a draft");
      if (!nonEmptyString(args.title) || args.title.length > 200) {
        reasons.push(
          "Pull request title must contain between 1 and 200 characters",
        );
      }
      break;
  }

  const summary = summarizeMutation(call.toolName, args);
  if (reasons.length > 0 || !branch) {
    return { allowed: false, call, operation: call.toolName, reasons, summary };
  }

  const subject: ApprovalSubject = {
    repository: expectedRepository,
    baseSha: context.evidence.baseSha,
    diff: stableJson({ operation: call.toolName, arguments: args }),
    tests: context.evidence.tests,
    branch,
    title:
      call.toolName === "create_pull_request"
        ? String(args.title)
        : `${call.toolName}:${call.id}`,
  };
  return {
    allowed: true,
    call,
    operation: call.toolName,
    branch,
    digest: createApprovalDigest(subject),
    reasons: [],
    subject,
    summary,
  };
}

/**
 * Resolves the evidence base ref immediately before branch approval. A branch
 * name alone is mutable, so its current GitHub SHA must still equal the SHA
 * whose sandbox checkout and tests produced the approval evidence.
 */
export async function verifyBaseReference(
  options: BaseReferenceVerificationOptions,
): Promise<void> {
  const { evidence, issue } = options.context;
  await verifyReferenceSha({
    issue,
    branch: evidence.baseBranch,
    expectedSha: evidence.baseSha,
    token: options.token,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    description: "evidence base",
  });
}

/** Confirms that a newly created topic branch actually starts at baseSha. */
export async function verifyCreatedBranchReference(
  options: CreatedBranchVerificationOptions,
): Promise<void> {
  await verifyReferenceSha({
    issue: options.context.issue,
    branch: options.branch,
    expectedSha: options.context.evidence.baseSha,
    token: options.token,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    description: "created branch",
  });
}

async function verifyReferenceSha(options: {
  issue: GitHubIssueReference;
  branch: string;
  expectedSha: string;
  token: string;
  fetch?: typeof fetch;
  description: string;
}): Promise<void> {
  const request = options.fetch ?? fetch;
  const url = new URL(
    `/repos/${encodeURIComponent(options.issue.owner)}/${encodeURIComponent(options.issue.repository)}/git/ref/heads/${encodeURIComponent(options.branch)}`,
    "https://api.github.com",
  );
  const response = await request(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${options.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Unable to resolve the ${options.description} ref (${String(response.status)})`,
    );
  }
  const payload: unknown = await response.json();
  const liveSha =
    isRecord(payload) && isRecord(payload.object)
      ? optionalString(payload.object.sha)
      : undefined;
  if (liveSha?.toLowerCase() !== options.expectedSha.toLowerCase()) {
    throw new Error(
      `${options.description} SHA does not match the tested evidence SHA`,
    );
  }
}

export function createGuardedApprovalInput(
  evaluation: ToolApprovalEvaluation,
  threadId: string,
  typedDigest: string,
): TrueForgeApi.UserToolApprovalEvent {
  if (
    !evaluation.allowed ||
    !evaluation.subject ||
    !isApprovalCurrent({ digest: typedDigest.trim() }, evaluation.subject)
  ) {
    return {
      type: "user.tool_approval",
      threadId,
      toolCallId: evaluation.call.id,
      approval: {
        status: "deny",
        reason:
          evaluation.reasons.join("; ") ||
          "Typed approval digest did not match the exact tested payload",
      },
    };
  }
  return {
    type: "user.tool_approval",
    threadId,
    toolCallId: evaluation.call.id,
    approval: { status: "allow" },
  };
}

function validatePushedFiles(
  args: Record<string, unknown>,
  reasons: string[],
): void {
  if (!Array.isArray(args.files) || args.files.length === 0) {
    reasons.push("push_files must contain at least one text file");
    return;
  }
  if (args.files.length > MAX_FILES) {
    reasons.push(`push_files exceeds the ${String(MAX_FILES)} file limit`);
  }
  const paths = new Set<string>();
  let totalBytes = 0;
  const policyFiles: { path: string; diff: string }[] = [];
  for (const file of args.files) {
    if (
      !isRecord(file) ||
      !nonEmptyString(file.path) ||
      typeof file.content !== "string"
    ) {
      reasons.push("Every pushed file must have a path and text content");
      continue;
    }
    if (paths.has(file.path))
      reasons.push(`Duplicate pushed path: ${file.path}`);
    paths.add(file.path);
    const bytes = Buffer.byteLength(file.content, "utf8");
    totalBytes += bytes;
    if (bytes > MAX_FILE_BYTES)
      reasons.push(`Pushed file is too large: ${file.path}`);
    policyFiles.push({ path: file.path, diff: file.content });
  }
  if (totalBytes > MAX_PATCH_BYTES)
    reasons.push("Pushed patch exceeds the byte limit");
  const policy = evaluatePatchPolicy({ files: policyFiles });
  reasons.push(...policy.violations.map((violation) => violation.message));
}

function summarizeMutation(
  operation: (typeof MUTATING_GITHUB_TOOLS)[number],
  args: Record<string, unknown>,
): string {
  const safeArgs = { ...args };
  if (Array.isArray(args.files)) {
    safeArgs.files = args.files.map((file) => {
      if (!isRecord(file)) return { invalid: true };
      const content = typeof file.content === "string" ? file.content : "";
      return {
        path: optionalString(file.path) ?? "<invalid>",
        bytes: Buffer.byteLength(content, "utf8"),
        sha256: createHash("sha256").update(content, "utf8").digest("hex"),
      };
    });
  }
  return stableJson({ operation, arguments: safeArgs });
}

function branchFor(
  operation: (typeof MUTATING_GITHUB_TOOLS)[number],
  args: Record<string, unknown>,
): string | undefined {
  return optionalString(
    operation === "create_pull_request" ? args.head : args.branch,
  );
}

function expectedTopicBranch(branch: string, issueNumber: number): boolean {
  return new RegExp(
    `^replayfix/issue-${String(issueNumber)}-[a-z0-9]+(?:-[a-z0-9]+)*$`,
  ).test(branch);
}

function validBranchName(branch: string): boolean {
  return (
    branch.length <= 255 &&
    !branch.startsWith("/") &&
    !branch.endsWith("/") &&
    !branch.includes("..") &&
    !/[~^:?*[\\\s]/.test(branch)
  );
}

function isMutationTool(
  value: string,
): value is (typeof MUTATING_GITHUB_TOOLS)[number] {
  return MUTATING_GITHUB_TOOLS.includes(
    value as (typeof MUTATING_GITHUB_TOOLS)[number],
  );
}

function failed(call: PendingCall, reason: string): ToolApprovalEvaluation {
  return {
    allowed: false,
    call,
    reasons: [reason],
    summary: stableJson({ toolName: call.toolName ?? null, resolvable: false }),
  };
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (!nonEmptyString(field))
    throw new TypeError(`${key} must be a non-empty string`);
  return field;
}

function optionalString(value: unknown): string | undefined {
  return nonEmptyString(value) ? value : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
