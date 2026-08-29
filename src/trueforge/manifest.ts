import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";

export const REPLAYFIX_GUARDED_AGENT_NAME = "replayfix-guarded";
export const TRUEFORGE_GITHUB_SERVER_NAME = "github";

/**
 * The complete GitHub capability allowlist for ReplayFix Guarded.
 *
 * Keep this list literal. In particular, broad selectors such as `@all` and
 * `@write` would make newly-added connector tools available without review.
 */
export const GITHUB_TOOLS = [
  "get_me",
  "issue_read",
  "get_file_contents",
  "search_code",
  "list_branches",
  "create_branch",
  "push_files",
  "create_pull_request",
] as const;

/** Every GitHub mutation available to this agent must stop for a person. */
export const GITHUB_TOOLS_REQUIRING_APPROVAL = [
  "create_branch",
  "push_files",
  "create_pull_request",
] as const;

export interface ReplayFixManifestOptions {
  /** TrueForge model FQN, for example `openai/gpt-5.2`. */
  model: string;
  /** Configured MCP connector name. Defaults to `github`. */
  githubServerName?: string;
}

export function createReplayFixManifest(
  options: ReplayFixManifestOptions,
): TrueForgeApi.AgentSpec {
  return {
    model: {
      name: options.model,
      params: {
        temperature: 0.1,
        maxTokens: 8192,
        parallelToolCalls: true,
      },
    },
    instructions: [
      "You are ReplayFix Guarded, an issue-to-draft-PR remediation agent.",
      "Require a public GitHub issue URL as input. Read that issue and repository evidence before proposing work.",
      "Use the sandbox to reproduce the problem, create the smallest safe patch, and run relevant tests. Do not propose a GitHub write until sandbox execution has produced test evidence.",
      "Dynamic subagents share the parent tool surface. Give them read-only investigation and review tasks only; explicitly forbid them from calling GitHub mutations or editing the patch. Any attempted mutation must still pause at the TrueForge approval gate.",
      "Before each GitHub mutation, show the exact change and test evidence, then wait for the TrueForge tool approval gate. Never approve a tool call yourself.",
      "Produce a redacted evidence artifact containing the exact repository, base branch, 40-character base SHA, and ordered passing test commands with SHA-256 output digests. The supported write path resumes through ReplayFix Guarded's executable approval policy.",
      "Treat .github/**, CODEOWNERS, .env*, lockfiles, deployment/infrastructure configuration, and authentication or security policy files as protected paths. Never include them in a patch; the executable approval policy cannot override this denial.",
      "Never push to the default branch. Use a new topic branch only. Never merge or close a pull request, and never delete branches, files, issues, or repositories.",
      "Every create_pull_request call must set draft: true. Include the issue evidence, patch summary, and test results in the pull request body.",
    ].join("\n"),
    mcpServers: [
      {
        name: options.githubServerName ?? TRUEFORGE_GITHUB_SERVER_NAME,
        enableTools: [...GITHUB_TOOLS],
        requireApprovalForTools: [...GITHUB_TOOLS_REQUIRING_APPROVAL],
        preload: false,
        preloadTools: [...GITHUB_TOOLS],
      },
    ],
    skills: [{ name: "replayfix-guarded" }],
    config: {
      iterationLimit: 60,
      sandbox: {
        enabled: true,
        fileDownloads: true,
      },
      dynamicSubAgents: { enabled: true },
      generativeUi: { enabled: true },
      askUserQuestions: { enabled: true },
      contextManagement: {
        compaction: { enabled: true },
        largeToolResponse: { enabled: true },
      },
    },
  };
}
