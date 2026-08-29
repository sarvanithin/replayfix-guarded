import { describe, expect, it } from "vitest";

import {
  createReplayFixManifest,
  GITHUB_TOOLS,
  GITHUB_TOOLS_REQUIRING_APPROVAL,
} from "../../src/trueforge/manifest.js";

describe("createReplayFixManifest", () => {
  it("uses a literal least-privilege GitHub allowlist and approval list", () => {
    const manifest = createReplayFixManifest({ model: "openai/gpt-5.2" });
    const github = manifest.mcpServers?.[0];

    expect(github?.enableTools).toEqual([...GITHUB_TOOLS]);
    expect(github?.preloadTools).toEqual([...GITHUB_TOOLS]);
    expect(github?.requireApprovalForTools).toEqual([
      ...GITHUB_TOOLS_REQUIRING_APPROVAL,
    ]);
    expect(github?.enableTools).not.toContain("@all");
    expect(github?.enableTools).not.toContain("@read-only");
    expect(github?.requireApprovalForTools).not.toContain("@write");
    expect(github?.requireApprovalForTools).not.toContain("@destructive");
  });

  it("enables the sandbox, subagents, generative UI, and questions", () => {
    const manifest = createReplayFixManifest({ model: "openai/gpt-5.2" });

    expect(manifest.config).toMatchObject({
      iterationLimit: 60,
      sandbox: { enabled: true },
      dynamicSubAgents: { enabled: true },
      generativeUi: { enabled: true },
      askUserQuestions: { enabled: true },
      contextManagement: {
        compaction: { enabled: true },
        largeToolResponse: { enabled: true },
      },
    });
    expect(manifest.skills).toEqual([{ name: "replayfix-guarded" }]);
    expect(manifest.model.params).toMatchObject({
      temperature: 0.1,
      maxTokens: 8192,
      parallelToolCalls: true,
    });
  });

  it("does not expose merge or delete capabilities", () => {
    const manifest = createReplayFixManifest({ model: "openai/gpt-5.2" });
    const serialized = JSON.stringify(manifest.mcpServers);

    expect(serialized).not.toMatch(/merge/i);
    expect(serialized).not.toMatch(/delete/i);
  });
});
