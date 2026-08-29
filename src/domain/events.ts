export const REPLAY_EVENT_TYPES = [
  "click",
  "navigation",
  "dom_mutation",
  "error",
  "form_submit",
] as const;

export type ReplayEventType = (typeof REPLAY_EVENT_TYPES)[number];

export interface ReplayTarget {
  selector: string;
  role?: string;
  text?: string;
}

interface ReplayEventBase {
  id: string;
  sessionId: string;
  timestamp: number;
  pageUrl?: string;
}

export interface ClickEvent extends ReplayEventBase {
  type: "click";
  target: ReplayTarget;
  outcome?: "effect" | "no-effect" | "unknown";
}

export interface NavigationEvent extends ReplayEventBase {
  type: "navigation";
  to: string;
}

export interface DomMutationEvent extends ReplayEventBase {
  type: "dom_mutation";
  target?: ReplayTarget;
}

export interface ErrorEvent extends ReplayEventBase {
  type: "error";
  message: string;
  stack?: string;
  fatal?: boolean;
}

export interface FormSubmitEvent extends ReplayEventBase {
  type: "form_submit";
  target: ReplayTarget;
  succeeded: boolean;
  validationMessage?: string;
}

export type ReplayEvent =
  | ClickEvent
  | NavigationEvent
  | DomMutationEvent
  | ErrorEvent
  | FormSubmitEvent;

export interface SyntheticReplayEnvelope {
  schemaVersion: 1;
  sessionId: string;
  startedAt: string;
  events: readonly unknown[];
}

export interface EventValidationIssue {
  index: number;
  path: string;
  message: string;
}

export class ReplayEventValidationError extends Error {
  readonly issues: readonly EventValidationIssue[];

  constructor(issues: readonly EventValidationIssue[]) {
    super(
      `Invalid replay events: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`,
    );
    this.name = "ReplayEventValidationError";
    this.issues = issues;
  }
}

const MAX_EVENTS = 10_000;
const MAX_TEXT_LENGTH = 10_000;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(
  value: unknown,
  maxLength = MAX_TEXT_LENGTH,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function validateTarget(
  value: unknown,
  index: number,
  path: string,
  issues: EventValidationIssue[],
): value is ReplayTarget {
  if (!isRecord(value)) {
    issues.push({ index, path, message: "must be an object" });
    return false;
  }

  if (!nonEmptyString(value.selector, 2_000)) {
    issues.push({
      index,
      path: `${path}.selector`,
      message: "must be a non-empty string",
    });
  }
  for (const optional of ["role", "text"] as const) {
    if (
      value[optional] !== undefined &&
      !nonEmptyString(value[optional], 2_000)
    ) {
      issues.push({
        index,
        path: `${path}.${optional}`,
        message: "must be a non-empty string when provided",
      });
    }
  }

  return issues.every(
    (issue) => issue.index !== index || !issue.path.startsWith(path),
  );
}

function validateEvent(
  value: unknown,
  index: number,
  issues: EventValidationIssue[],
): value is ReplayEvent {
  const root = `[${String(index)}]`;
  if (!isRecord(value)) {
    issues.push({ index, path: root, message: "must be an object" });
    return false;
  }

  if (!nonEmptyString(value.id, 256)) {
    issues.push({
      index,
      path: `${root}.id`,
      message: "must be a non-empty string",
    });
  }
  if (!nonEmptyString(value.sessionId, 512)) {
    issues.push({
      index,
      path: `${root}.sessionId`,
      message: "must be a non-empty string",
    });
  }
  if (
    typeof value.timestamp !== "number" ||
    !Number.isFinite(value.timestamp) ||
    value.timestamp < 0
  ) {
    issues.push({
      index,
      path: `${root}.timestamp`,
      message: "must be a finite, non-negative number",
    });
  }
  if (value.pageUrl !== undefined && !nonEmptyString(value.pageUrl, 8_192)) {
    issues.push({
      index,
      path: `${root}.pageUrl`,
      message: "must be a non-empty string when provided",
    });
  }
  if (
    typeof value.type !== "string" ||
    !REPLAY_EVENT_TYPES.includes(value.type as ReplayEventType)
  ) {
    issues.push({
      index,
      path: `${root}.type`,
      message: `must be one of ${REPLAY_EVENT_TYPES.join(", ")}`,
    });
    return false;
  }

  switch (value.type) {
    case "click":
      validateTarget(value.target, index, `${root}.target`, issues);
      if (
        value.outcome !== undefined &&
        value.outcome !== "effect" &&
        value.outcome !== "no-effect" &&
        value.outcome !== "unknown"
      ) {
        issues.push({
          index,
          path: `${root}.outcome`,
          message: "must be effect, no-effect, or unknown",
        });
      }
      break;
    case "navigation":
      if (!nonEmptyString(value.to, 8_192)) {
        issues.push({
          index,
          path: `${root}.to`,
          message: "must be a non-empty string",
        });
      }
      break;
    case "dom_mutation":
      if (value.target !== undefined) {
        validateTarget(value.target, index, `${root}.target`, issues);
      }
      break;
    case "error":
      if (!nonEmptyString(value.message)) {
        issues.push({
          index,
          path: `${root}.message`,
          message: "must be a non-empty string",
        });
      }
      if (value.stack !== undefined && !nonEmptyString(value.stack, 100_000)) {
        issues.push({
          index,
          path: `${root}.stack`,
          message: "must be a non-empty string when provided",
        });
      }
      if (value.fatal !== undefined && typeof value.fatal !== "boolean") {
        issues.push({
          index,
          path: `${root}.fatal`,
          message: "must be a boolean when provided",
        });
      }
      break;
    case "form_submit":
      validateTarget(value.target, index, `${root}.target`, issues);
      if (typeof value.succeeded !== "boolean") {
        issues.push({
          index,
          path: `${root}.succeeded`,
          message: "must be a boolean",
        });
      }
      if (
        value.validationMessage !== undefined &&
        !nonEmptyString(value.validationMessage)
      ) {
        issues.push({
          index,
          path: `${root}.validationMessage`,
          message: "must be a non-empty string when provided",
        });
      }
      break;
  }

  return !issues.some((issue) => issue.index === index);
}

/** Validates untrusted, synthetic replay data at the application boundary. */
function validateCanonicalReplayEvents(input: unknown): ReplayEvent[] {
  if (!Array.isArray(input)) {
    throw new ReplayEventValidationError([
      { index: -1, path: "$", message: "must be an array" },
    ]);
  }
  if (input.length === 0 || input.length > MAX_EVENTS) {
    throw new ReplayEventValidationError([
      {
        index: -1,
        path: "$",
        message: `must contain between 1 and ${String(MAX_EVENTS)} events`,
      },
    ]);
  }

  const issues: EventValidationIssue[] = [];
  input.forEach((event, index) => validateEvent(event, index, issues));

  const seenIds = new Set<string>();
  input.forEach((event, index) => {
    if (!isRecord(event) || typeof event.id !== "string") return;
    if (seenIds.has(event.id)) {
      issues.push({
        index,
        path: `[${String(index)}].id`,
        message: "must be unique",
      });
    }
    seenIds.add(event.id);
  });

  if (issues.length > 0) throw new ReplayEventValidationError(issues);
  return input as ReplayEvent[];
}

function parseIsoTimestamp(
  value: unknown,
  index: number,
  path: string,
  issues: EventValidationIssue[],
): number | undefined {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
    issues.push({
      index,
      path,
      message: "must be an ISO-8601 timestamp string",
    });
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    issues.push({ index, path, message: "must be a valid ISO-8601 timestamp" });
    return undefined;
  }
  return timestamp;
}

function normalizeEnvelope(input: Record<string, unknown>): ReplayEvent[] {
  const issues: EventValidationIssue[] = [];
  if (input.schemaVersion !== 1) {
    issues.push({
      index: -1,
      path: "$.schemaVersion",
      message: "must equal 1",
    });
  }
  if (!nonEmptyString(input.sessionId, 512)) {
    issues.push({
      index: -1,
      path: "$.sessionId",
      message: "must be a non-empty string",
    });
  }
  parseIsoTimestamp(input.startedAt, -1, "$.startedAt", issues);
  if (!Array.isArray(input.events)) {
    issues.push({ index: -1, path: "$.events", message: "must be an array" });
    throw new ReplayEventValidationError(issues);
  }
  if (input.events.length === 0 || input.events.length > MAX_EVENTS) {
    issues.push({
      index: -1,
      path: "$.events",
      message: `must contain between 1 and ${String(MAX_EVENTS)} events`,
    });
  }

  const normalized: unknown[] = [];
  input.events.forEach((rawEvent, index) => {
    const root = `$.events[${String(index)}]`;
    if (!isRecord(rawEvent)) {
      issues.push({ index, path: root, message: "must be an object" });
      return;
    }
    if (!nonEmptyString(rawEvent.id, 256)) {
      issues.push({
        index,
        path: `${root}.id`,
        message: "must be a non-empty string",
      });
    }
    const timestamp = parseIsoTimestamp(
      rawEvent.timestamp,
      index,
      `${root}.timestamp`,
      issues,
    );
    if (!nonEmptyString(rawEvent.type, 64)) {
      issues.push({
        index,
        path: `${root}.type`,
        message: "must be a non-empty string",
      });
      return;
    }
    if (rawEvent.url !== undefined && !nonEmptyString(rawEvent.url, 8_192)) {
      issues.push({
        index,
        path: `${root}.url`,
        message: "must be a non-empty string when provided",
      });
    }

    const common = {
      id: rawEvent.id,
      sessionId: input.sessionId,
      timestamp,
      ...(rawEvent.url === undefined ? {} : { pageUrl: rawEvent.url }),
    };

    switch (rawEvent.type) {
      case "state":
        if (rawEvent.metadata !== undefined && !isRecord(rawEvent.metadata)) {
          issues.push({
            index,
            path: `${root}.metadata`,
            message: "must be an object when provided",
          });
        }
        normalized.push({ ...common, type: "dom_mutation" });
        break;
      case "click":
        normalized.push({
          ...common,
          type: "click",
          target: { selector: rawEvent.selector },
          ...(rawEvent.outcome === undefined
            ? {}
            : { outcome: rawEvent.outcome }),
        });
        break;
      case "navigation":
        normalized.push({
          ...common,
          type: "navigation",
          to: rawEvent.to ?? rawEvent.url,
        });
        break;
      case "error":
        normalized.push({
          ...common,
          type: "error",
          message: rawEvent.message,
          ...(rawEvent.stack === undefined ? {} : { stack: rawEvent.stack }),
          ...(rawEvent.fatal === undefined ? {} : { fatal: rawEvent.fatal }),
        });
        break;
      case "form_submit":
        normalized.push({
          ...common,
          type: "form_submit",
          target: { selector: rawEvent.selector },
          succeeded: rawEvent.succeeded,
          ...(rawEvent.validationMessage === undefined
            ? {}
            : { validationMessage: rawEvent.validationMessage }),
        });
        break;
      default:
        issues.push({
          index,
          path: `${root}.type`,
          message:
            "must be one of state, click, navigation, error, form_submit",
        });
    }
  });

  if (issues.length > 0) throw new ReplayEventValidationError(issues);
  try {
    return validateCanonicalReplayEvents(normalized);
  } catch (error) {
    if (!(error instanceof ReplayEventValidationError)) throw error;
    throw new ReplayEventValidationError(
      error.issues.map((issue) => ({
        ...issue,
        path: issue.path.replace(/^\[(\d+)\]/, "$.events[$1]"),
      })),
    );
  }
}

/**
 * Validates either canonical events or the checked-in synthetic replay envelope.
 * Envelope inputs are normalized into canonical events for deterministic analysis.
 */
export function validateReplayEvents(input: unknown): ReplayEvent[] {
  if (isRecord(input) && ("schemaVersion" in input || "events" in input)) {
    return normalizeEnvelope(input);
  }
  return validateCanonicalReplayEvents(input);
}
