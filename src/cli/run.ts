import {
  assertRepositoryAllowed,
  parseGitHubIssueUrl,
} from "../domain/github.js";
import { createTrueForgeClient } from "../trueforge/client.js";
import {
  createEventState,
  reduceTrueForgeEvent,
  type TrueForgeEventState,
} from "../trueforge/events.js";
import { REPLAYFIX_GUARDED_AGENT_NAME } from "../trueforge/manifest.js";

const issueUrl = process.argv[2];
if (!issueUrl) {
  console.error(
    "Usage: npm run demo -- https://github.com/<owner>/<repo>/issues/<n>",
  );
  process.exitCode = 1;
} else {
  await run(issueUrl);
}

async function run(rawIssueUrl: string): Promise<void> {
  try {
    const reference = parseGitHubIssueUrl(rawIssueUrl);
    const allowedRepositories = (
      process.env.REPLAYFIX_ALLOWED_REPOSITORIES ?? ""
    )
      .split(",")
      .filter(Boolean);
    if (allowedRepositories.length === 0) {
      throw new TypeError("REPLAYFIX_ALLOWED_REPOSITORIES is required");
    }
    assertRepositoryAllowed(reference, allowedRepositories);

    const client = createTrueForgeClient({
      baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790",
      ...(process.env.TRUEFORGE_TOKEN
        ? { token: process.env.TRUEFORGE_TOKEN }
        : {}),
      timeoutInSeconds: 600,
    });
    const { data: session } = await client.sessions.create({
      agent: { name: REPLAYFIX_GUARDED_AGENT_NAME },
    });
    console.log(`TrueForge session: ${session.id}`);

    const stream = await client.sessions.createTurnStream(session.id, {
      input: [
        {
          type: "user.message",
          content: [
            `Safely investigate and propose a tested fix for ${reference.canonicalUrl}.`,
            "Use only synthetic replay evidence. Reproduce and test in the sandbox.",
            "Stop at every TrueForge approval gate. Never merge.",
          ].join(" "),
        },
      ],
    });

    let state = createEventState();
    for await (const event of stream) {
      state = reduceTrueForgeEvent(state, event);
      renderEvent(event.type, state);
    }

    if (state.pendingApprovals.length > 0) {
      console.log("\nHuman approval required in the TrueForge UI:");
      for (const approval of state.pendingApprovals) {
        for (const call of approval.toolCalls) {
          console.log(`- ${call.toolName ?? "unresolved tool"} (${call.id})`);
          if (call.arguments) console.log(`  arguments: ${call.arguments}`);
        }
      }
      console.log("This CLI never approves tool calls automatically.");
    } else {
      console.log(`Turn finished with status: ${state.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Demo run failed: ${message}`);
    process.exitCode = 1;
  }
}

function renderEvent(type: string, state: TrueForgeEventState): void {
  const visibleTypes = new Set([
    "sandbox.created",
    "thread.created",
    "thread.done",
    "tool.call",
    "tool.response",
    "tool.approval_required",
    "turn.done",
  ]);
  if (visibleTypes.has(type)) {
    console.log(`[${state.status}] ${type}`);
  }
}
