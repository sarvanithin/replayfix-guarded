import { TrueForge } from "@truefoundry/trueforge-sdk";
import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";

import {
  createReplayFixManifest,
  REPLAYFIX_GUARDED_AGENT_NAME,
  type ReplayFixManifestOptions,
} from "./manifest.js";

export interface TrueForgeClientOptions {
  /** TrueForge API base URL. Kept explicit so deployments cannot target an accidental environment. */
  baseUrl: string;
  /** TrueForge bearer token. Omit for a trusted local server with auth disabled. */
  token?: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  timeoutInSeconds?: number;
}

export function createTrueForgeClient(
  options: TrueForgeClientOptions,
): TrueForge {
  return new TrueForge({
    baseUrl: options.baseUrl,
    ...(options.token ? { token: options.token } : { auth: false }),
    ...(options.fetch ? { fetch: options.fetch } : {}),
    maxRetries: options.maxRetries ?? 2,
    timeoutInSeconds: options.timeoutInSeconds ?? 60,
  });
}

export interface AgentRegistryClient {
  agents: {
    list(): PromiseLike<TrueForgeApi.ListAgentsResponse>;
    create(request: {
      manifest: TrueForgeApi.AgentSpec;
      name: string;
    }): PromiseLike<TrueForgeApi.GetAgentResponse>;
    update(
      agentId: string,
      request: { manifest: TrueForgeApi.AgentSpec },
    ): PromiseLike<TrueForgeApi.GetAgentResponse>;
  };
}

export interface EnsureReplayFixAgentOptions extends ReplayFixManifestOptions {
  agentName?: string;
}

export interface EnsuredAgent {
  agent: TrueForgeApi.Agent;
  action: "created" | "unchanged" | "updated";
}

/**
 * Creates the named agent once, then updates only its manifest on later runs.
 * Agent deletion and renaming are deliberately not represented in this API.
 */
export async function ensureReplayFixAgent(
  client: AgentRegistryClient,
  options: EnsureReplayFixAgentOptions,
): Promise<EnsuredAgent> {
  const agentName = options.agentName ?? REPLAYFIX_GUARDED_AGENT_NAME;
  const desiredManifest = createReplayFixManifest(options);
  const { data: agents } = await client.agents.list();
  const existing = agents.find((agent) => agent.name === agentName);

  if (!existing) {
    const { data } = await client.agents.create({
      name: agentName,
      manifest: desiredManifest,
    });
    return { agent: data, action: "created" };
  }

  if (manifestsEqual(existing.manifest, desiredManifest)) {
    return { agent: existing, action: "unchanged" };
  }

  const { data } = await client.agents.update(existing.id, {
    manifest: desiredManifest,
  });
  return { agent: data, action: "updated" };
}

function manifestsEqual(
  left: TrueForgeApi.AgentSpec,
  right: TrueForgeApi.AgentSpec,
): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
