import { createHash, timingSafeEqual } from "node:crypto";

export interface TestEvidence {
  command: string;
  status: "passed" | "failed";
  outputDigest: string;
}

export interface ApprovalSubject {
  repository: string;
  baseSha: string;
  diff: string;
  tests: readonly TestEvidence[];
  branch: string;
  title: string;
}

export interface ApprovalRecord {
  digest: string;
  approvedBy: string;
  approvedAt: string;
}

function lengthPrefixed(value: string): string {
  return `${String(Buffer.byteLength(value, "utf8"))}:${value}`;
}

function canonicalSubject(subject: ApprovalSubject): string {
  const testData = subject.tests
    .map((test) =>
      [test.command, test.status, test.outputDigest]
        .map(lengthPrefixed)
        .join(""),
    )
    .join("");
  return [
    "replayfix-guarded-approval-v1",
    subject.repository,
    subject.baseSha,
    subject.diff,
    testData,
    subject.branch,
    subject.title,
  ]
    .map(lengthPrefixed)
    .join("");
}

/** Binds approval to the exact repository, base, patch, tests, branch, and PR title. */
export function createApprovalDigest(subject: ApprovalSubject): string {
  return createHash("sha256")
    .update(canonicalSubject(subject), "utf8")
    .digest("hex");
}

export function isApprovalCurrent(
  record: Pick<ApprovalRecord, "digest">,
  subject: ApprovalSubject,
): boolean {
  const expected = createApprovalDigest(subject);
  if (!/^[a-f0-9]{64}$/.test(record.digest)) return false;
  return timingSafeEqual(
    Buffer.from(record.digest, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export function assertApprovalCurrent(
  record: Pick<ApprovalRecord, "digest">,
  subject: ApprovalSubject,
): void {
  if (!isApprovalCurrent(record, subject)) {
    throw new Error(
      "Approval is missing or stale for the current patch proposal",
    );
  }
}
