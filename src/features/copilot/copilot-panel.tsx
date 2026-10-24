"use client";

/**
 * Copilot side panel (Epic 54 B2): a Fluent `InlineDrawer` on the right (400 px, resizable to 560 px); below 768 px a
 * full-width `OverlayDrawer`. Alt+C toggles (not while typing in another field); focus goes to the composer on open
 * and back to the header toggle on close (Escape). Hidden without `copilot:use`; staff app shell only.
 */
import {
  Button,
  Dropdown,
  InlineDrawer,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Spinner,
  Title3,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Compose20Regular, Dismiss20Regular, History20Regular, Open20Regular } from "@fluentui/react-icons";
import { usePathname, useRouter } from "next/navigation";
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCopilotStatus } from "./api";
import { ContextChip } from "./context-chip";
import { setCopilotState, toggleCopilot, useCopilotState } from "./copilot-context";
import { COPILOT_TOGGLE_ID, COPY, isEditable, isToggleShortcut, unavailableMessage } from "./copy";
import { ConversationView } from "./conversation-view";
import { HistoryList } from "./history-list";
import { contextFromPath } from "./page-context";
import type { PageContext } from "./types";

const MIN_WIDTH = 400;
const MAX_WIDTH = 560;

const useStyles = makeStyles({
  drawer: { position: "relative", borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  inner: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    boxSizing: "border-box",
  },
  header: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  title: { flex: 1 },
  mode: { minWidth: "160px" },
  handle: {
    position: "absolute",
    insetBlock: 0,
    left: "-3px",
    width: "6px",
    cursor: "col-resize",
    zIndex: 1,
    ":hover": { backgroundColor: tokens.colorBrandStroke2 },
  },
  history: { flex: 1, minHeight: 0, overflowY: "auto" },
});

export function usePageContext(): PageContext | null {
  const pathname = usePathname() ?? "/";
  const { listContext } = useCopilotState();
  const [title, setTitle] = useState<string>("");
  useEffect(() => {
    const first = setTimeout(() => setTitle(document.title), 0);
    const later = setTimeout(() => setTitle(document.title), 500);
    return () => {
      clearTimeout(first);
      clearTimeout(later);
    };
  }, [pathname]);
  return useMemo(() => {
    const record = contextFromPath(pathname, title);
    if (record) return record;
    return listContext && listContext.route === pathname ? listContext : null;
  }, [pathname, title, listContext]);
}

export function CopilotPanel() {
  const me = useMe();
  const allowed = hasPermission(me.data?.permissions, "copilot:use");
  if (!allowed) return null;
  return <CopilotPanelInner />;
}

function CopilotPanelInner() {
  const styles = useStyles();
  const router = useRouter();
  const state = useCopilotState();
  const narrow = useMediaQuery("(max-width: 767px)");
  const status = useCopilotStatus();
  const pageContext = usePageContext();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isToggleShortcut(e)) return;
      const active = document.activeElement;
      const inPanel = panelRef.current?.contains(active) ?? false;
      if (isEditable(active) && !inPanel) return;
      e.preventDefault();
      toggleCopilot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (state.open && !wasOpen.current) {
      setTimeout(() => composerRef.current?.focus(), 50);
    }
    if (!state.open && wasOpen.current) {
      document.getElementById(COPILOT_TOGGLE_ID)?.focus();
    }
    wasOpen.current = state.open;
  }, [state.open]);

  const close = () => toggleCopilot(false);
  const effectiveContext = state.dismissed ? null : pageContext;
  const data = status.data;
  const warning = data && !data.available ? unavailableMessage(data.reason) : null;
  const modes = data?.modes ?? [];

  const onResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + (startX - ev.clientX))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const body = (
    <div/* NOSONAR */
      ref={panelRef}
      className={styles.inner}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className={styles.header}>
        <Title3 as="h2" className={styles.title}>
          {COPY.title}
        </Title3>
        {modes.length > 1 ? (
          <Dropdown
            className={styles.mode}
            size="small"
            aria-label="Copilot mode"
            value={modes.find((m) => m.agent_key === state.mode)?.label ?? COPY.modeCopilot}
            selectedOptions={[state.mode]}
            onOptionSelect={(_, d) =>
              setCopilotState((s) => ({ mode: d.optionValue ?? "copilot", conversationId: null, view: "chat", chatNonce: s.chatNonce + 1 }))
            }
          >
            {modes.map((m) => (
              <Option key={m.agent_key} value={m.agent_key}>
                {m.label}
              </Option>
            ))}
          </Dropdown>
        ) : null}
        <Tooltip content={COPY.newChat} relationship="label">
          <Button appearance="subtle" icon={<Compose20Regular />} aria-label={COPY.newChat} onClick={() => setCopilotState((s) => ({ conversationId: null, view: "chat", chatNonce: s.chatNonce + 1 }))} />
        </Tooltip>
        <Tooltip content={COPY.history} relationship="label">
          <Button
            appearance="subtle"
            icon={<History20Regular />}
            aria-label={COPY.history}
            aria-pressed={state.view === "history"}
            onClick={() => setCopilotState((s) => ({ view: s.view === "history" ? "chat" : "history" }))}
          />
        </Tooltip>
        <Tooltip content={COPY.openFullPage} relationship="label">
          <Button
            appearance="subtle"
            icon={<Open20Regular />}
            aria-label={COPY.openFullPage}
            onClick={() => {
              router.push(state.conversationId ? `/ai/copilot?conversation=${state.conversationId}` : "/ai/copilot");
              close();
            }}
          />
        </Tooltip>
        <Tooltip content={COPY.close} relationship="label">
          <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label={COPY.close} onClick={close} />
        </Tooltip>
      </div>
      {status.isPending ? <Spinner size="small" label="Loading Copilot" /> : null}
      {warning ? (
        <MessageBar intent="warning">
          <MessageBarBody>{warning}</MessageBarBody>
        </MessageBar>
      ) : null}
      {state.view === "history" ? (
        <div className={styles.history}>
          <HistoryList
            selectedId={state.conversationId}
            retentionDays={data?.retention_days ?? null}
            onOpen={(id, agentKey) => setCopilotState((s) => ({ conversationId: id, mode: agentKey, view: "chat", chatNonce: s.chatNonce + 1 }))}
            onDeleted={(id) =>
              setCopilotState((s) => (s.conversationId === id ? { conversationId: null, chatNonce: s.chatNonce + 1 } : {}))
            }
          />
        </div>
      ) : data?.available ? (
        <>
          <ContextChip
            context={pageContext}
            dismissed={state.dismissed}
            onDismiss={() => setCopilotState({ dismissed: true })}
            onRestore={() => setCopilotState({ dismissed: false })}
          />
          <ConversationView
            key={`${state.mode}:${state.chatNonce}`}
            ref={composerRef}
            conversationId={state.conversationId}
            mode={state.mode}
            pageContext={effectiveContext}
            status={data}
            onConversation={(id) => setCopilotState({ conversationId: id })}
          />
        </>
      ) : null}
    </div>
  );

  if (narrow) {
    return (
      <OverlayDrawer position="end" size="full" open={state.open} onOpenChange={(_, d) => toggleCopilot(d.open)} aria-label={COPY.title}>
        {body}
      </OverlayDrawer>
    );
  }
  return (
    <InlineDrawer position="end" open={state.open} className={styles.drawer} style={{ width }} aria-label={COPY.title} role="complementary">
      <div className={styles.handle} role="separator" aria-orientation="vertical" aria-label="Resize Copilot" onPointerDown={onResize} />
      {body}
    </InlineDrawer>
  );
}
