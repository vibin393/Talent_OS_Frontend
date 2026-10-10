"use client";

/**
 * Copilot shell state (Epic 54): a tiny external store shared by the header toggle, the panel and the list pages
 * (`useCopilotPageContext`), so the shell layout needs no provider. `CopilotContextProvider` is a pass-through kept for
 * pages that prefer an explicit wrapper.
 */
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { listContext } from "./page-context";
import type { ListContext, PageContext } from "./types";

export interface CopilotState {
  open: boolean;
  /** Context registered by a list page (records come from the route). */
  listContext: PageContext | null;
  /** The user dismissed the context chip ("Not using this page"). */
  dismissed: boolean;
  conversationId: string | null;
  mode: string;
  view: "chat" | "history";
  /** Bumped by "New chat" / opening a conversation, to remount the conversation view. */
  chatNonce: number;
}

const INITIAL: CopilotState = {
  open: false,
  listContext: null,
  dismissed: false,
  conversationId: null,
  mode: "copilot",
  view: "chat",
  chatNonce: 0,
};

let state: CopilotState = INITIAL;
const listeners = new Set<() => void>();

export function getCopilotState(): CopilotState {
  return state;
}

export function setCopilotState(patch: Partial<CopilotState> | ((s: CopilotState) => Partial<CopilotState>)): void {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCopilotState(): CopilotState {
  return useSyncExternalStore(subscribe, getCopilotState, () => INITIAL);
}

export function toggleCopilot(open?: boolean): void {
  setCopilotState((s) => ({ open: open ?? !s.open }));
}

/** List pages add one line: `useCopilotPageContext({ list: { kind: "candidates", filters }, label })`. */
export function useCopilotPageContext({ list, label }: { list: ListContext; label?: string | null }): void {
  const pathname = usePathname();
  const key = JSON.stringify([pathname, list, label]);
  useEffect(() => {
    const ctx = listContext(pathname ?? "/", list, label);
    setCopilotState({ listContext: ctx, dismissed: false });
    return () => {
      if (getCopilotState().listContext?.route === ctx.route) setCopilotState({ listContext: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures list / label by value
  }, [key]);
}

export function CopilotContextProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
