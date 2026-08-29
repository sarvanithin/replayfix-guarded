import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { detectIssues } from "../domain/detector.js";
import { validateReplayEvents } from "../domain/events.js";
import { sanitizeReplayEvents } from "../domain/sanitize.js";

const inputPath = resolve(process.argv[2] ?? "demo/session-replay.json");

try {
  const raw = await readFile(inputPath, "utf8");
  const events = sanitizeReplayEvents(validateReplayEvents(JSON.parse(raw)));
  const issues = detectIssues(events);

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        eventCount: events.length,
        issueCount: issues.length,
        issues,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Replay analysis failed: ${message}`);
  process.exitCode = 1;
}
