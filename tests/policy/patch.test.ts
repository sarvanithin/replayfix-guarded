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
