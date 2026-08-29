import path from "node:path";

export interface PatchFile {
  path: string;
  diff: string;
}

export interface PatchProposal {
  files: readonly PatchFile[];
}

export interface PatchPolicyViolation {
  path: string;
  reason:
    | "absolute-path"
    | "path-traversal"
    | "protected-path"
    | "secret-path"
    | "invalid-path";
  message: string;
}

export interface PatchPolicyResult {
  allowed: boolean;
  violations: PatchPolicyViolation[];
}

export class PatchPolicyError extends Error {
  readonly violations: readonly PatchPolicyViolation[];

  constructor(violations: readonly PatchPolicyViolation[]) {
    super(
      `Patch rejected: ${violations.map((violation) => `${violation.path}: ${violation.message}`).join("; ")}`,
    );
    this.name = "PatchPolicyError";
    this.violations = violations;
  }
}

const SECRET_FILE =
  /^(\.env(?:\..+)?|\.npmrc|\.netrc|secrets?(?:\..+)?|credentials?(?:\..+)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|.*\.(?:pem|p12|pfx|key))$/i;
const SECRET_SEGMENT = /^\.?(?:secrets?|credentials?)$/i;

export function inspectPatchPath(
  inputPath: string,
): PatchPolicyViolation | undefined {
  if (inputPath.length === 0 || inputPath.includes("\0")) {
    return {
      path: inputPath,
      reason: "invalid-path",
      message: "path must be a non-empty, null-free string",
    };
  }

  const slashPath = inputPath.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(slashPath) ||
    path.win32.isAbsolute(inputPath) ||
    /^[A-Za-z]:\//.test(slashPath)
  ) {
    return {
      path: inputPath,
      reason: "absolute-path",
      message: "absolute paths are not allowed",
    };
  }

  const segments = slashPath.split("/");
  if (segments.some((segment) => segment === "..")) {
    return {
      path: inputPath,
      reason: "path-traversal",
      message: "parent-directory traversal is not allowed",
    };
  }
  if (
    segments.some((segment) => {
      const normalized = segment.toLowerCase();
      return normalized === ".git" || normalized === ".github";
    })
  ) {
    return {
      path: inputPath,
      reason: "protected-path",
      message: ".git and .github are protected",
    };
  }
  if (
    segments.some((segment) => SECRET_SEGMENT.test(segment)) ||
    SECRET_FILE.test(segments.at(-1) ?? "")
  ) {
    return {
      path: inputPath,
      reason: "secret-path",
      message: "credential and secret files are protected",
    };
  }
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return {
      path: inputPath,
      reason: "invalid-path",
      message: "path must be normalized and repository-relative",
    };
  }
  return undefined;
}

export function evaluatePatchPolicy(
  proposal: PatchProposal,
): PatchPolicyResult {
  const violations: PatchPolicyViolation[] = [];
  if (proposal.files.length === 0) {
    violations.push({
      path: "<patch>",
      reason: "invalid-path",
      message: "patch must contain at least one file",
    });
  } else {
    for (const file of proposal.files) {
      const violation = inspectPatchPath(file.path);
      if (violation) violations.push(violation);
    }
  }
  return { allowed: violations.length === 0, violations };
}

export function assertPatchAllowed(proposal: PatchProposal): void {
  const result = evaluatePatchPolicy(proposal);
  if (!result.allowed) throw new PatchPolicyError(result.violations);
}
