import { describe, expect, it, vi } from "vitest";

import {
  createTrueForgeClient,
  ensureReplayFixAgent,
  type AgentRegistryClient,
} from "../../src/trueforge/client.js";
import { createReplayFixManifest } from "../../src/trueforge/manifest.js";

function registry(overrides: Partial<AgentRegistryClient["agents"]>) {
  return { agents: overrides } as AgentRegistryClient;
}

describe("ensureReplayFixAgent", () => {
  it("constructs the SDK client without making a network request", () => {
    const client = createTrueForgeClient({
      baseUrl: "https://trueforge.example.test",
    });

    expect(client.agents).toBeDefined();
    expect(client.sessions).toBeDefined();
  });

  it("creates the agent when it does not exist", async () => {
    const created = {
      id: "agent_1",
      name: "replayfix-guarded",
      manifest: createReplayFixManifest({ model: "openai/gpt-5.2" }),
    };
    const create = vi.fn().mockResolvedValue({ data: created });
    const update = vi.fn();
    const client = registry({
      list: vi.fn().mockResolvedValue({ data: [] }),
      create,
      update,
    });

    await expect(
      ensureReplayFixAgent(client, { model: "openai/gpt-5.2" }),
    ).resolves.toEqual({ action: "created", agent: created });
    expect(create).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not write when the manifest is already current", async () => {
    const existing = {
      id: "agent_1",
      name: "replayfix-guarded",
      manifest: createReplayFixManifest({ model: "openai/gpt-5.2" }),
    };
    const create = vi.fn();
    const update = vi.fn();
    const client = registry({
      list: vi.fn().mockResolvedValue({ data: [existing] }),
      create,
      update,
    });

    await expect(
      ensureReplayFixAgent(client, { model: "openai/gpt-5.2" }),
    ).resolves.toEqual({ action: "unchanged", agent: existing });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("updates only the manifest of the matching immutable agent id", async () => {
    const existing = {
      id: "agent_1",
      name: "replayfix-guarded",
      manifest: createReplayFixManifest({ model: "openai/gpt-4.1" }),
    };
    const updated = {
      ...existing,
      manifest: createReplayFixManifest({ model: "openai/gpt-5.2" }),
    };
    const update = vi.fn().mockResolvedValue({ data: updated });
    const client = registry({
      list: vi.fn().mockResolvedValue({ data: [existing] }),
      create: vi.fn(),
      update,
    });

    await expect(
      ensureReplayFixAgent(client, { model: "openai/gpt-5.2" }),
    ).resolves.toEqual({ action: "updated", agent: updated });
    expect(update).toHaveBeenCalledWith("agent_1", {
      manifest: updated.manifest,
    });
  });
});
