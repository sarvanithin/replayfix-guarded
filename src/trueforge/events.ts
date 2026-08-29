import {
  isEventDelta,
  mergeEventDelta,
  type TrueForgeApi,
} from "@truefoundry/trueforge-sdk";

export interface PendingToolApproval {
  eventId: string;
  requestedAt: string;
  threadId: string;
  toolCalls: {
    id: string;
    sourceEventId: string;
    toolName?: string;
    arguments?: string;
  }[];
}

export interface TrueForgeEventState {
  events: TrueForgeApi.TurnStreamingEvent[];
  messages: TrueForgeApi.ModelMessageEvent[];
  pendingApprovals: PendingToolApproval[];
  status: "streaming" | "awaiting_approval" | "done" | "error";
}

export function createEventState(): TrueForgeEventState {
  return {
    events: [],
    messages: [],
    pendingApprovals: [],
    status: "streaming",
  };
}

/**
 * Reduces a TrueForge turn stream into UI state. Approval-required events are
 * surfaced as pending data only; this module intentionally has no approval API.
 */
export function reduceTrueForgeEvent(
  state: TrueForgeEventState,
  event: TrueForgeApi.TurnStreamingEvent,
): TrueForgeEventState {
  if (isEventDelta(event)) {
    const baseIndex = state.messages.findIndex(
      (message) => message.id === event.id,
    );
    if (baseIndex === -1) {
      return { ...state, events: [...state.events, event] };
    }

    const messages = [...state.messages];
    const source = messages[baseIndex];
    if (!source) {
      return { ...state, events: [...state.events, event] };
    }
    const base = structuredClone(source);
    mergeEventDelta(base, event);
    messages[baseIndex] = base;
    return { ...state, events: [...state.events, event], messages };
  }

  const events = [...state.events, event];

  if (event.type === "model.message") {
    const withoutPrevious = state.messages.filter(
      (message) => message.id !== event.id,
    );
    return {
      ...state,
      events,
      messages: [...withoutPrevious, structuredClone(event)],
    };
  }

  if (event.type === "tool.approval_required") {
    const pending = toPendingApproval(event, state.messages);
    return {
      ...state,
      events,
      pendingApprovals: [
        ...state.pendingApprovals.filter(
          (approval) => approval.eventId !== pending.eventId,
        ),
        pending,
      ],
      status: "awaiting_approval",
    };
  }

  if (event.type === "turn.done") {
    const requiredApprovals =
      event.state.status === "done"
        ? event.state.requiredActions
            .filter(
              (action): action is TrueForgeApi.ToolApprovalRequiredEvent =>
                action.type === "tool.approval_required",
            )
            .map((action) => toPendingApproval(action, state.messages))
        : [];
    return {
      ...state,
      events,
      // A terminal event is authoritative. Previously pending calls have been
      // resolved or invalidated and must not leak into a completed turn.
      pendingApprovals: requiredApprovals,
      status:
        event.state.status === "error"
          ? "error"
          : requiredApprovals.length > 0
            ? "awaiting_approval"
            : "done",
    };
  }

  return { ...state, events };
}

export async function collectTrueForgeEvents(
  stream: AsyncIterable<TrueForgeApi.TurnStreamingEvent>,
  onState?: (state: TrueForgeEventState) => void,
): Promise<TrueForgeEventState> {
  let state = createEventState();
  for await (const event of stream) {
    state = reduceTrueForgeEvent(state, event);
    onState?.(state);
  }
  return state;
}

export function assertTurnCompletedOrPaused(state: TrueForgeEventState): void {
  if (state.status === "error") {
    throw new Error("TrueForge turn failed");
  }
  if (state.status === "streaming") {
    throw new Error(
      "TrueForge stream ended before a terminal or approval-required state",
    );
  }
}

/**
 * A branch is established only after TrueForge records a non-error response
 * for the exact create_branch call. Approval alone is not execution evidence.
 */
export function hasSuccessfulToolResponse(
  state: TrueForgeEventState,
  toolCallId: string,
): boolean {
  const response = state.events.find(
    (event): event is TrueForgeApi.ToolResponseEvent =>
      event.type === "tool.response" && event.toolCallId === toolCallId,
  );
  if (!response || response.content.trim().length === 0) return false;
  try {
    const content: unknown = JSON.parse(response.content);
    if (!isRecord(content)) return true;
    return content.isError !== true && content.is_error !== true;
  } catch {
    return true;
  }
}

function toPendingApproval(
  event: TrueForgeApi.ToolApprovalRequiredEvent,
  messages: TrueForgeApi.ModelMessageEvent[],
): PendingToolApproval {
  return {
    eventId: event.id,
    requestedAt: event.createdAt,
    threadId: event.threadId,
    toolCalls: event.toolCalls.map((reference) => {
      const source = messages.find(
        (message) => message.id === reference.sourceEventId,
      );
      const call = source?.toolCalls?.find(
        (candidate) => candidate.id === reference.id,
      );
      return {
        id: reference.id,
        sourceEventId: reference.sourceEventId,
        ...(call
          ? {
              toolName: call.function.name,
              arguments: call.function.arguments,
            }
          : {}),
      };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
