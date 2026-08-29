import {
  createTrueForgeClient,
  ensureReplayFixAgent,
} from "../trueforge/client.js";

const baseUrl = process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790";
const model = requireEnvironment("TRUEFORGE_MODEL");
const skillRef = requireEnvironment("REPLAYFIX_SKILL_REF");
const configureConnectors = process.argv.includes("--configure-connectors");
const client = createTrueForgeClient({
  baseUrl,
  ...(process.env.TRUEFORGE_TOKEN
    ? { token: process.env.TRUEFORGE_TOKEN }
    : {}),
  timeoutInSeconds: 600,
});

try {
  if (configureConnectors) {
    const githubToken = requireEnvironment("GITHUB_TOKEN");
    const daytonaApiKey = requireEnvironment("DAYTONA_API_KEY");

    await client.settings.mcpServers.createOrUpdate({
      manifest: {
        type: "remote",
        name: "github",
        url: "https://api.githubcopilot.com/mcp/",
        description: "GitHub reads and approval-gated draft-PR publishing",
        auth: {
          type: "header",
          headers: { Authorization: `Bearer ${githubToken}` },
        },
      },
    });

    await client.settings.sandboxProviders.createOrUpdate({
      manifest: {
        type: "daytona",
        auth: { apiKey: daytonaApiKey },
        execTimeoutMs: 600_000,
        autoStopIntervalInMinutes: 30,
        autoArchiveIntervalInMinutes: 60,
        autoDeleteIntervalInMinutes: 1_440,
      },
    });
  }

  await client.settings.skills.createOrUpdate({
    manifest: {
      type: "git",
      name: "replayfix-guarded",
      description:
        "Approval-gated public issue to tested draft pull request workflow.",
      url: "https://github.com/sarvanithin/replayfix-guarded",
      path: "skills/replayfix-guarded",
      ref: skillRef,
    },
  });

  const result = await ensureReplayFixAgent(client, { model });
  console.log(
    `ReplayFix Guarded agent ${result.action}: ${result.agent.name} (${result.agent.id})`,
  );
  console.log("No GitHub operation was approved or executed by this command.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Provisioning failed: ${message}`);
  process.exitCode = 1;
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new TypeError(`${name} is required`);
  return value;
}
