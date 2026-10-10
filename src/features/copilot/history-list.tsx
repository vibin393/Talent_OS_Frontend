"use client";

/** The user's own Copilot conversations (Epic 54 B7): title, mode, last message time, Delete with a confirm dialog. */
import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { useConversations, useDeleteConversation } from "./api";
import { COPY } from "./copy";

const useStyles = makeStyles({
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  item: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  open: {
    flex: 1,
    minWidth: 0,
    textAlign: "start",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  title: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { color: tokens.colorNeutralForeground3 },
  note: { color: tokens.colorNeutralForeground3 },
});

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function HistoryList({
  selectedId,
  onOpen,
  retentionDays,
  onDeleted,
}: {
  selectedId: string | null;
  onOpen: (id: string, agentKey: string) => void;
  retentionDays: number | null;
  onDeleted?: (id: string) => void;
}) {
  const styles = useStyles();
  const conversations = useConversations();
  const remove = useDeleteConversation();
  const [pending, setPending] = useState<string | null>(null);
  if (conversations.isPending) return <Spinner size="small" label="Loading conversations" />;
  if (conversations.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(conversations.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const items = conversations.data.items;
  return (
    <div>
      {retentionDays ? <Caption1 className={styles.note}>{`Conversations are deleted automatically after ${retentionDays} days.`}</Caption1> : null}
      {items.length === 0 ? (
        <Body1>{COPY.historyEmpty}</Body1>
      ) : (
        <ul className={styles.list} aria-label="Conversation history">
          {items.map((c) => (
            <li key={c.id} className={`${styles.item} ${c.id === selectedId ? styles.selected : ""}`}>
              <button type="button" className={styles.open} onClick={() => onOpen(c.id, c.agent_key)}>
                <Body1 className={styles.title}>{c.title || "Untitled conversation"}</Body1>
                <Caption1 className={styles.meta}>{`${c.mode_label} · ${when(c.last_message_at ?? c.created_at)}`}</Caption1>
              </button>
              <Tooltip content={COPY.delete} relationship="label">
                <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label={`${COPY.delete} ${c.title ?? ""}`.trim()} onClick={() => setPending(c.id)} />
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={pending !== null} onOpenChange={(_, d) => !d.open && setPending(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{COPY.deleteTitle}</DialogTitle>
            <DialogContent>
              {COPY.deleteBody}
              {remove.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>{errorMessage(remove.error)}</MessageBarBody>
                </MessageBar>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabled={remove.isPending}
                onClick={() =>
                  pending &&
                  remove.mutate(pending, {
                    onSuccess: () => {
                      onDeleted?.(pending);
                      setPending(null);
                    },
                  })
                }
              >
                {COPY.delete}
              </Button>
              <Button onClick={() => setPending(null)}>{COPY.cancel}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
