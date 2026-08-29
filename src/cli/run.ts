import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";

import {
  assertRepositoryAllowed,
  parseGitHubIssueUrl,
} from "../domain/github.js";
import {
  createGuardedApprovalInput,
  evaluateToolApproval,
  validateApprovalEvidence,
  type ApprovalEvidence,
} from "../policy/tool-approval.js";
import { createTrueForgeClient } from "../trueforge/client.js";
import {
  createEventState,
  reduceTrueForgeEvent,
  type TrueForgeEventState,
} from "../trueforge/events.js";
import { REPLAYFIX_GUARDED_AGENT_NAME } from "../trueforge/manifest.js";

const issueUrl = process.argv[2];
const interactiveApprovals = process.argv.includes("--interactive-approvals");
const evidenceFlagIndex = process.argv.indexOf("--evidence");
const evidencePath =
  evidenceFlagIndex >= 0 ? process.argv[evidenceFlagIndex + 1] : undefined;
if (!issueUrl) {
  console.error(
    "Usage: npm run demo -- <issue-url> [--interactive-approvals --evidence <file>]",
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
    const evidence = interactiveApprovals
      ? await loadApprovalEvidence(evidencePath, reference)
      : undefined;

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

    let stream = await client.sessions.createTurnStream(session.id, {
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

    let state = await collectTurn(stream);

    if (!interactiveApprovals && state.pendingApprovals.length > 0) {
      console.log("\nHuman approval required:");
      for (const approval of state.pendingApprovals) {
        for (const call of approval.toolCalls) {
          console.log(`- ${call.toolName ?? "unresolved tool"} (${call.id})`);
        }
      }
      console.log(
        "Default mode cannot approve. Re-run with --interactive-approvals and a sandbox-produced evidence file, or inspect the exact call in TrueForge.",
      );
      return;
    }

    if (interactiveApprovals && evidence) {
      const prompt = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      let approvedBranch: string | undefined;
      try {
        while (state.pendingApprovals.length > 0) {
          const decisions: TrueForgeApi.UserToolApprovalEvent[] = [];
          for (const pending of state.pendingApprovals) {
            for (const call of pending.toolCalls) {
              const evaluation = evaluateToolApproval(call, {
                issue: reference,
                evidence,
                ...(approvedBranch ? { approvedBranch } : {}),
              });
              console.log(`\n${evaluation.summary}`);
              if (!evaluation.allowed || !evaluation.digest) {
                console.error(
                  `Policy denied: ${evaluation.reasons.join("; ")}`,
                );
                decisions.push(
                  createGuardedApprovalInput(evaluation, pending.threadId, ""),
                );
                continue;
              }

              console.log(`Approval digest: ${evaluation.digest}`);
              const typedDigest = await prompt.question(
                "Type the full digest to approve this exact payload; anything else denies: ",
              );
              const decision = createGuardedApprovalInput(
                evaluation,
                pending.threadId,
                typedDigest,
              );
              decisions.push(decision);
              if (
                decision.approval.status === "allow" &&
                evaluation.operation === "create_branch"
              ) {
                approvedBranch = evaluation.branch;
              }
            }
          }

          stream = await client.sessions.createTurnStream(session.id, {
            input: decisions,
          });
          state = await collectTurn(stream);
        }
      } finally {
        prompt.close();
      }
    }

    console.log(`Turn finished with status: ${state.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Demo run failed: ${message}`);
    process.exitCode = 1;
  }
}

async function collectTurn(
  stream: AsyncIterable<TrueForgeApi.TurnStreamingEvent>,
): Promise<TrueForgeEventState> {
  let state = createEventState();
  for await (const event of stream) {
    state = reduceTrueForgeEvent(state, event);
    renderEvent(event.type, state);
  }
  return state;
}

async function loadApprovalEvidence(
  rawPath: string | undefined,
  issue: ReturnType<typeof parseGitHubIssueUrl>,
): Promise<ApprovalEvidence> {
  if (!rawPath) {
    throw new TypeError(
      "--evidence <file> is required for interactive approvals",
    );
  }
  const evidenceFile = resolve(rawPath);
  const metadata = await stat(evidenceFile);
  if (metadata.size > 256 * 1024) {
    throw new RangeError("Approval evidence file exceeds 262144 bytes");
  }
  const parsed: unknown = JSON.parse(await readFile(evidenceFile, "utf8"));
  return validateApprovalEvidence(parsed, issue);
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
