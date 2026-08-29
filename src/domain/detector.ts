import type { ClickEvent, ReplayEvent } from "./events.js";

export type IssueKind =
  "rage-click" | "dead-click" | "runtime-error" | "form-failure";
export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface DetectedIssue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  sessionId: string;
  timestamp: number;
  eventIds: string[];
  title: string;
  evidence: string;
}

export interface DetectorOptions {
  rageClickCount?: number;
  rageClickWindowMs?: number;
}

const KIND_ORDER: Record<IssueKind, number> = {
  "runtime-error": 0,
  "form-failure": 1,
  "rage-click": 2,
  "dead-click": 3,
};

function compareEvents(a: ReplayEvent, b: ReplayEvent): number {
  return a.timestamp - b.timestamp || a.id.localeCompare(b.id);
}

function detectRageClicks(
  clicks: ClickEvent[],
  count: number,
  windowMs: number,
): DetectedIssue[] {
  const groups = new Map<string, ClickEvent[]>();
  for (const click of clicks) {
    const key = `${click.sessionId}\u0000${click.target.selector}`;
    const group = groups.get(key) ?? [];
    group.push(click);
    groups.set(key, group);
  }

  const issues: DetectedIssue[] = [];
  for (const group of groups.values()) {
    group.sort(compareEvents);
    let start = 0;
    while (start <= group.length - count) {
      const firstInWindow = group[start];
      if (!firstInWindow) break;
      const endTimestamp = firstInWindow.timestamp + windowMs;
      let end = start;
      let next = group[end + 1];
      while (next && next.timestamp <= endTimestamp) {
        end += 1;
        next = group[end + 1];
      }

      if (end - start + 1 >= count) {
        const cluster = group.slice(start, end + 1);
        const first = cluster[0];
        if (!first) break;
        issues.push({
          id: `rage-click:${first.sessionId}:${first.id}`,
          kind: "rage-click",
          severity: "medium",
          sessionId: first.sessionId,
          timestamp: first.timestamp,
          eventIds: cluster.map((event) => event.id),
          title: `Repeated clicks on ${first.target.selector}`,
          evidence: `${String(cluster.length)} clicks within ${String(windowMs)}ms`,
        });
        start = end + 1;
      } else {
        start += 1;
      }
    }
  }
  return issues;
}

/**
 * Produces stable findings from validated events. A dead click is intentionally
 * evidence-based: it is emitted only when the recorder explicitly reports
 * `outcome: "no-effect"`, never merely because a replay ended after a click.
 */
export function detectIssues(
  events: readonly ReplayEvent[],
  options: DetectorOptions = {},
): DetectedIssue[] {
  const rageClickCount = options.rageClickCount ?? 3;
  const rageClickWindowMs = options.rageClickWindowMs ?? 1_000;
  if (!Number.isInteger(rageClickCount) || rageClickCount < 2) {
    throw new RangeError("rageClickCount must be an integer of at least 2");
  }
  if (!Number.isFinite(rageClickWindowMs) || rageClickWindowMs <= 0) {
    throw new RangeError("rageClickWindowMs must be positive");
  }

  const ordered = [...events].sort(compareEvents);
  const issues: DetectedIssue[] = [];
  const clicks: ClickEvent[] = [];

  for (const event of ordered) {
    switch (event.type) {
      case "click":
        clicks.push(event);
        if (event.outcome === "no-effect") {
          issues.push({
            id: `dead-click:${event.sessionId}:${event.id}`,
            kind: "dead-click",
            severity: "low",
            sessionId: event.sessionId,
            timestamp: event.timestamp,
            eventIds: [event.id],
            title: `Unresponsive click on ${event.target.selector}`,
            evidence: "The recorder observed no resulting UI effect",
          });
        }
        break;
      case "error":
        issues.push({
          id: `runtime-error:${event.sessionId}:${event.id}`,
          kind: "runtime-error",
          severity: event.fatal ? "critical" : "high",
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          eventIds: [event.id],
          title: event.fatal ? "Fatal client error" : "Client runtime error",
          evidence: event.message,
        });
        break;
      case "form_submit":
        if (!event.succeeded) {
          issues.push({
            id: `form-failure:${event.sessionId}:${event.id}`,
            kind: "form-failure",
            severity: "medium",
            sessionId: event.sessionId,
            timestamp: event.timestamp,
            eventIds: [event.id],
            title: `Failed form submission at ${event.target.selector}`,
            evidence:
              event.validationMessage ?? "The form submission did not succeed",
          });
        }
        break;
      default:
        break;
    }
  }

  issues.push(...detectRageClicks(clicks, rageClickCount, rageClickWindowMs));
  return issues.sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.id.localeCompare(b.id),
  );
}
