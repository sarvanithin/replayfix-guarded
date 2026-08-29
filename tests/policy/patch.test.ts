import { describe, expect, it } from "vitest";

import {
  assertPatchAllowed,
  evaluatePatchPolicy,
  inspectPatchPath,
  PatchPolicyError,
} from "../../src/policy/patch.js";

describe("patch path policy", () => {
  it("allows ordinary repository-relative source and test paths", () => {
    const result = evaluatePatchPolicy({
      files: [
        { path: "src/checkout.ts", diff: "+fixed" },
        { path: "tests/checkout.test.ts", diff: "+tested" },
      ],
    });
    expect(result).toEqual({ allowed: true, violations: [] });
  });

  it.each([
    ["/etc/passwd", "absolute-path"],
    ["C:\\Users\\person\\secret.txt", "absolute-path"],
    ["src/../../outside.ts", "path-traversal"],
    [".github/workflows/publish.yml", "protected-path"],
    ["nested/.git/config", "protected-path"],
    ["secrets/production.json", "secret-path"],
    ["config/secrets.json", "secret-path"],
    [".npmrc", "secret-path"],
    [".env.production", "secret-path"],
    ["certs/signing-key.pem", "secret-path"],
    ["package.json", "protected-path"],
    ["package-lock.json", "protected-path"],
    ["CODEOWNERS", "protected-path"],
    ["deploy/production.yml", "protected-path"],
    ["infra/main.tf", "protected-path"],
    ["src/auth/session.ts", "protected-path"],
    ["SECURITY.md", "protected-path"],
    ["vendor/lib.js", "protected-path"],
    ["dist/app.js", "protected-path"],
    ["assets/logo.png", "protected-path"],
  ])("blocks %s as %s", (filePath, reason) => {
    expect(inspectPatchPath(filePath)?.reason).toBe(reason);
  });

  it("throws with every violation for enforcement callers", () => {
    expect(() => {
      assertPatchAllowed({
        files: [
          { path: "../outside", diff: "bad" },
          { path: ".github/workflows/release.yml", diff: "bad" },
        ],
      });
    }).toThrow(PatchPolicyError);
  });
});
