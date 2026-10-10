"use client";

import {
  Body1,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import type { McpSettings } from "./api";
import { canEnable } from "./logic";

const useStyles = makeStyles({ body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM } });

/** "Allow external AI assistants?" (spec B2): the versioned notice, tool groups and the acknowledgement. */
export function EnableDialog({
  open,
  settings,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  settings: McpSettings;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (groups: string[]) => void;
}) {
  const styles = useStyles();
  const [ack, setAck] = useState(false);
  const [groups, setGroups] = useState<string[]>(settings.tool_groups.length ? settings.tool_groups : ["core", "recruiting"]);
  const toggle = (key: string, on: boolean) => setGroups((g) => (on ? [...new Set([...g, key])] : g.filter((k) => k !== key)));
  return (
    <Dialog open={open} onOpenChange={(_, d) => (!d.open ? onCancel() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Allow external AI assistants?</DialogTitle>
          <DialogContent className={styles.body}>
            {!settings.agentic_enabled ? (
              <MessageBar intent="warning">
                <MessageBarBody>
                  Turn on AI agents first in <AppLink href="/admin/ai/agents">Admin → AI</AppLink>.
                </MessageBarBody>
              </MessageBar>
            ) : null}
            <Body1>{settings.notice_text}</Body1>
            <Field label="Tool groups" required>
              {settings.groups.map((g) => (
                <Checkbox key={g.key} label={g.label} checked={groups.includes(g.key)} onChange={(_, d) => toggle(g.key, Boolean(d.checked))} />
              ))}
            </Field>
            <Checkbox label="I understand and want to allow AI assistants" checked={ack} onChange={(_, d) => setAck(Boolean(d.checked))} />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={busy || !canEnable(ack, groups, settings.agentic_enabled)} onClick={() => onConfirm(groups)}>
              Allow assistants
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** "Turn off AI assistant access?" with a required reason. */
export function DisableDialog({ open, busy, onCancel, onConfirm }: { open: boolean; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const styles = useStyles();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(_, d) => (!d.open ? onCancel() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Turn off AI assistant access?</DialogTitle>
          <DialogContent className={styles.body}>
            <Body1>All assistant sessions end within a minute. Pending proposals stay in people&apos;s inboxes.</Body1>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
              Turn off
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
