"use client";

/**
 * Turn stream (Epic 54 B1, AD-64): `EventSource` on `/api/v1/copilot/turns/{run}/events` (same-origin cookie). The
 * browser resumes with `Last-Event-ID`; after 3 consecutive failures the hook falls back to polling
 * `messages?after_seq=` every 1.5 s until the answer is stored. `reduceStream` is the pure state machine.
 */
import { useEffect, useRef, useState } from "react";
import { copilotApi } from "./api";
import { type CopilotMessage, isAssistant, type StreamFrame, type ToolEntry, type TurnStatus } from "./types";

export interface StreamDraft {
  proposal_id: string;
  tool_key: string;
  title: string;
}

export interface StreamState {
  text: string;
  tools: (ToolEntry & { pending?: boolean })[];
  drafts: StreamDraft[];
  done: boolean;
  status: TurnStatus | null;
  reasonCode: string | null;
  lastId: string | null;
  mode: "stream" | "poll";
}

export const INITIAL_STREAM: StreamState = {
  text: "",
  tools: [],
  drafts: [],
  done: false,
  status: null,
  reasonCode: null,
  lastId: null,
  mode: "stream",
};

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Apply one stream frame (idempotent per frame id: replays after a resume are ignored). */
export function reduceStream(state: StreamState, frame: StreamFrame): StreamState {
  if (state.done) return state;
  if (frame.id && state.lastId && compareIds(frame.id, state.lastId) <= 0) return state;
  const next: StreamState = { ...state, lastId: frame.id || state.lastId };
  const d = frame.data;
  switch (frame.event) {
    case "text.delta":
      return { ...next, text: next.text + str(d.text) };
    case "tool.started":
      return { ...next, tools: [...next.tools, { tool_key: str(d.tool_key), title: str(d.title), outcome: "", summary: "", pending: true }] };
    case "tool.finished": {
      const entry: ToolEntry = { tool_key: str(d.tool_key), title: str(d.title), outcome: str(d.outcome), summary: str(d.summary) };
      const i = next.tools.findIndex((t) => t.pending && t.tool_key === entry.tool_key);
      const tools = i >= 0 ? next.tools.map((t, j) => (j === i ? entry : t)) : [...next.tools, entry];
      return { ...next, tools };
    }
    case "draft.created":
      if (next.drafts.some((x) => x.proposal_id === str(d.proposal_id))) return next;
      return { ...next, drafts: [...next.drafts, { proposal_id: str(d.proposal_id), tool_key: str(d.tool_key), title: str(d.title) }] };
    case "turn.completed":
    case "turn.failed":
      return {
        ...next,
        done: true,
        status: (str(d.status) || (frame.event === "turn.failed" ? "failed" : "completed")) as TurnStatus,
        reasonCode: d.reason_code ? str(d.reason_code) : null,
        tools: next.tools.map((t) => ({ ...t, pending: false })),
      };
    default:
      return next;
  }
}

/** Redis stream ids "ms-seq" in numeric order. */
export function compareIds(a: string, b: string): number {
  const [am, as] = a.split("-").map(Number);
  const [bm, bs] = b.split("-").map(Number);
  return am !== bm ? am - bm : as - bs;
}

/** State from the stored assistant message of the run (polling fallback / final truth). */
export function stateFromMessage(msg: CopilotMessage): StreamState {
  const c = msg.content;
  if (!isAssistant(c)) return { ...INITIAL_STREAM, done: true, status: "completed" };
  return {
    ...INITIAL_STREAM,
    text: c.text,
    tools: c.tools,
    drafts: c.drafts.map((id) => ({ proposal_id: id, tool_key: "", title: "" })),
    done: true,
    status: c.status,
    reasonCode: c.reason_code ?? null,
  };
}

const EVENTS = ["turn.started", "text.delta", "tool.started", "tool.finished", "draft.created", "turn.completed", "turn.failed"];
export const MAX_FAILURES = 3;
export const POLL_MS = 1500;

export interface StreamTarget {
  runId: string;
  streamUrl: string;
  conversationId: string;
  afterSeq: number;
}

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onTool?: (tool: ToolEntry) => void;
  onDraft?: (draft: StreamDraft) => void;
  onDone?: (state: StreamState) => void;
  onError?: (error: unknown) => void;
}

/**
 * Epic 77 (D-22, additive): the portal Copilots reuse this hook with their own API base. `apiBase` is informational
 * (the stream URL already comes from the turn); `pollAnswer` replaces the internal messages endpoint in the polling
 * fallback (default: the internal `/api/v1/copilot` messages).
 */
export interface StreamOptions {
  apiBase?: string;
  pollAnswer?: (target: StreamTarget) => Promise<StreamState | null>;
}

export function useCopilotStream(target: StreamTarget | null, handlers: StreamHandlers = {}, options: StreamOptions = {}): StreamState {
  const [owned, setOwned] = useState<{ target: StreamTarget | null; state: StreamState }>({ target: null, state: INITIAL_STREAM });
  const handlersRef = useRef(handlers);
  const pollRef = useRef(options.pollAnswer);
  useEffect(() => {
    handlersRef.current = handlers;
    pollRef.current = options.pollAnswer;
  });

  useEffect(() => {
    if (!target) return;
    let current = INITIAL_STREAM;
    let closed = false;
    let failures = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    const setState = (next: StreamState) => setOwned({ target, state: next });

    const finish = (s: StreamState) => {
      if (closed) return;
      closed = true;
      source?.close();
      if (poll) clearInterval(poll);
      handlersRef.current.onDone?.(s);
    };

    const apply = (frame: StreamFrame) => {
      const before = current;
      current = reduceStream(current, frame);
      if (current === before) return;
      setState(current);
      if (frame.event === "text.delta") handlersRef.current.onDelta?.(str(frame.data.text));
      if (frame.event === "tool.finished") handlersRef.current.onTool?.(current.tools[current.tools.length - 1]);
      if (frame.event === "draft.created") handlersRef.current.onDraft?.(current.drafts[current.drafts.length - 1]);
      if (current.done) finish(current);
    };

    const startPolling = () => {
      current = { ...current, mode: "poll" };
      setState(current);
      const tick = async () => {
        try {
          if (pollRef.current) {
            const polled = await pollRef.current(target);
            if (polled) {
              current = polled;
              setState(current);
              finish(current);
            }
            return;
          }
          const msgs = await copilotApi.messages(target.conversationId, target.afterSeq);
          const answer = msgs.find((m) => m.role === "assistant" && m.run_id === target.runId);
          if (answer) {
            current = stateFromMessage(answer);
            setState(current);
            finish(current);
          }
        } catch (e) {
          handlersRef.current.onError?.(e);
        }
      };
      void tick();
      poll = setInterval(() => void tick(), POLL_MS);
    };

    let source: EventSource | null = null;
    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      source = new EventSource(target.streamUrl, { withCredentials: true });
      for (const name of EVENTS) {
        source.addEventListener(name, (ev) => {
          failures = 0;
          const me = ev as MessageEvent<string>;
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(me.data || "{}") as Record<string, unknown>;
          } catch {
            data = {};
          }
          apply({ id: me.lastEventId, event: name, data });
        });
      }
      source.onerror = () => {
        if (closed) return;
        failures += 1;
        if (failures >= MAX_FAILURES) {
          source?.close();
          startPolling();
        }
      };
    }
    return () => {
      closed = true;
      source?.close();
      if (poll) clearInterval(poll);
    };
  }, [target]);

  return owned.target === target ? owned.state : INITIAL_STREAM;
}
