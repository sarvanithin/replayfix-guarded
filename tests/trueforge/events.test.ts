import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  collectTrueForgeEvents,
  createEventState,
  reduceTrueForgeEvent,
} from "../../src/trueforge/events.js";

const createdAt = "2026-08-29T12:00:00.000Z";

describe("TrueForge event state", () => {
  it("merges model deltas into the base message", () => {
    const base: TrueForgeApi.ModelMessageEvent = {
      id: "message_1",
      threadId: "main",
      createdAt,
      type: "model.message",
      content: "Proposed ",
    };
    const delta: TrueForgeApi.ModelMessageDeltaEvent = {
      id: "message_1",
      threadId: "main",
      type: "model.message.delta",
      content: "patch",
    };

    const withBase = reduceTrueForgeEvent(createEventState(), base);
    const state = reduceTrueForgeEvent(withBase, delta);

    expect(state.messages[0]?.content).toBe("Proposed patch");
    expect(base.content).toBe("Proposed ");
  });

  it("models tool approvals as pending without producing an allow decision", () => {
    const message: TrueForgeApi.ModelMessageEvent = {
      id: "message_1",
      threadId: "main",
      createdAt,
      type: "model.message",
      toolCalls: [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "create_pull_request",
            arguments: '{"draft":true}',
          },
          toolInfo: {
            type: "mcp",
            name: "create_pull_request",
            serverId: "github_1",
            serverName: "github",
          },
        },
      ],
    };
    const approval: TrueForgeApi.ToolApprovalRequiredEvent = {
      id: "approval_1",
      threadId: "main",
      createdAt,
      type: "tool.approval_required",
      toolCalls: [{ id: "call_1", sourceEventId: "message_1" }],
    };

    const withMessage = reduceTrueForgeEvent(createEventState(), message);
    const state = reduceTrueForgeEvent(withMessage, approval);

    expect(state.status).toBe("awaiting_approval");
    expect(state.pendingApprovals).toEqual([
      {
        eventId: "approval_1",
        requestedAt: createdAt,
        threadId: "main",
        toolCalls: [
          {
            id: "call_1",
            sourceEventId: "message_1",
            toolName: "create_pull_request",
            arguments: '{"draft":true}',
          },
        ],
      },
    ]);
    expect(JSON.stringify(state)).not.toContain('"status":"allow"');
  });

  it("keeps unresolved tool references pending without inventing metadata", () => {
    const state = reduceTrueForgeEvent(createEventState(), {
      id: "approval_1",
      threadId: "main",
      createdAt,
      type: "tool.approval_required",
      toolCalls: [{ id: "call_1", sourceEventId: "missing" }],
    });

    expect(state.pendingApprovals[0]?.toolCalls[0]).toEqual({
      id: "call_1",
      sourceEventId: "missing",
    });
  });

  it("records deltas that arrive without a base message", () => {
    const state = reduceTrueForgeEvent(createEventState(), {
      id: "message_1",
      threadId: "main",
      type: "model.message.delta",
      content: "orphan",
    });

    expect(state.events).toHaveLength(1);
    expect(state.messages).toHaveLength(0);
  });

  it("replaces duplicate message snapshots and maps terminal states", () => {
    const first: TrueForgeApi.ModelMessageEvent = {
      id: "message_1",
      threadId: "main",
      createdAt,
      type: "model.message",
      content: "first",
    };
    const second: TrueForgeApi.ModelMessageEvent = {
      ...first,
      content: "second",
    };
    let state = reduceTrueForgeEvent(createEventState(), first);
    state = reduceTrueForgeEvent(state, second);
    state = reduceTrueForgeEvent(state, {
      id: "turn_done",
      threadId: null,
      createdAt,
      type: "turn.done",
      state: {
        status: "done",
        completedAt: createdAt,
        output: second,
        requiredActions: [],
      },
    });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.content).toBe("second");
    expect(state.status).toBe("done");
  });

  it("keeps a terminal turn paused when required actions contain approval", () => {
    const approval: TrueForgeApi.ToolApprovalRequiredEvent = {
      id: "approval_1",
      threadId: "main",
      createdAt,
      type: "tool.approval_required",
      toolCalls: [{ id: "call_1", sourceEventId: "message_1" }],
    };
    const state = reduceTrueForgeEvent(createEventState(), {
      id: "turn_done",
      threadId: null,
      createdAt,
      type: "turn.done",
      state: {
        status: "done",
        completedAt: createdAt,
        output: null,
        requiredActions: [approval],
      },
    });

    expect(state.status).toBe("awaiting_approval");
    expect(state.pendingApprovals[0]?.eventId).toBe("approval_1");
  });

  it("clears obsolete approvals when a later terminal event has none", () => {
    const approval: TrueForgeApi.ToolApprovalRequiredEvent = {
      id: "approval_1",
      threadId: "main",
      createdAt,
      type: "tool.approval_required",
      toolCalls: [{ id: "call_1", sourceEventId: "message_1" }],
    };
    const pending = reduceTrueForgeEvent(createEventState(), approval);
    const done = reduceTrueForgeEvent(pending, {
      id: "turn_done",
      threadId: null,
      createdAt,
      type: "turn.done",
      state: {
        status: "done",
        completedAt: createdAt,
        output: null,
        requiredActions: [],
      },
    });

    expect(done.status).toBe("done");
    expect(done.pendingApprovals).toEqual([]);
  });

  it("clears obsolete approvals when a terminal event reports an error", () => {
    const pending = reduceTrueForgeEvent(createEventState(), {
      id: "approval_1",
      threadId: "main",
      createdAt,
      type: "tool.approval_required",
      toolCalls: [{ id: "call_1", sourceEventId: "message_1" }],
    });
    const failed = reduceTrueForgeEvent(pending, {
      id: "turn_done",
      threadId: null,
      createdAt,
      type: "turn.done",
      state: {
        status: "error",
        completedAt: createdAt,
        message: "failed",
      },
    });

    expect(failed.status).toBe("error");
    expect(failed.pendingApprovals).toEqual([]);
  });

  it("collects an async SDK stream and emits state snapshots", async () => {
    const onState = vi.fn();
    const events: TrueForgeApi.TurnStreamingEvent[] = [
      {
        id: "approval_1",
        threadId: "main",
        createdAt,
        type: "tool.approval_required",
        toolCalls: [{ id: "call_1", sourceEventId: "message_1" }],
      },
    ];

    async function* stream() {
      await Promise.resolve();
      yield* events;
    }

    const state = await collectTrueForgeEvents(stream(), onState);

    expect(state.pendingApprovals).toHaveLength(1);
    expect(onState).toHaveBeenCalledOnce();
  });
});
