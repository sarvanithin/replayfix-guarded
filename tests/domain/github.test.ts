import { describe, expect, it } from "vitest";

import {
  assertRepositoryAllowed,
  parseGitHubIssueUrl,
} from "../../src/domain/github.js";

describe("parseGitHubIssueUrl", () => {
  it("returns a canonical issue reference", () => {
    expect(
      parseGitHubIssueUrl("https://github.com/acme/demo/issues/42/"),
    ).toEqual({
      owner: "acme",
      repository: "demo",
      issueNumber: 42,
      canonicalUrl: "https://github.com/acme/demo/issues/42",
    });
  });

  it.each([
    "not a url",
    "http://github.com/acme/demo/issues/1",
    "https://gitlab.com/acme/demo/issues/1",
    "https://user:pass@github.com/acme/demo/issues/1",
    "https://github.com:8443/acme/demo/issues/1",
    "https://github.com/acme/demo/issues/1?token=secret",
    "https://github.com/acme/demo/issues/1#comment",
    "https://github.com/acme/demo/pull/1",
    "https://github.com/acme/demo/issues/0",
    "https://github.com/-bad/demo/issues/1",
    "https://github.com/acme/demo.git/issues/1",
    `https://github.com/acme/demo/issues/${String(Number.MAX_SAFE_INTEGER)}0`,
  ])("rejects unsafe or noncanonical input: %s", (input) => {
    expect(() => parseGitHubIssueUrl(input)).toThrow(TypeError);
  });
});

describe("assertRepositoryAllowed", () => {
  const reference = parseGitHubIssueUrl(
    "https://github.com/sarvanithin/replayfix-guarded/issues/1",
  );

  it("matches repository names case-insensitively", () => {
    expect(() => {
      assertRepositoryAllowed(reference, ["SARVANITHIN/REPLAYFIX-GUARDED"]);
    }).not.toThrow();
  });

  it("rejects a repository outside the exact allowlist", () => {
    expect(() => {
      assertRepositoryAllowed(reference, ["someone/else"]);
    }).toThrow(/not in REPLAYFIX_ALLOWED_REPOSITORIES/);
  });
});
