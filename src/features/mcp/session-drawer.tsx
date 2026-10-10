"use client";

import {
  Badge,
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  makeStyles,
  OverlayDrawer,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import type { McpSession } from "./api";
import { endReasonLabel, STATUS_LABELS } from "./logic";

const useStyles = makeStyles({ dl: { display: "grid", gridTemplateColumns: "auto 1fr", gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`, margin: 0 } });

/** "Session details" (spec B3). */
export function SessionDrawer({
  session,
  canEnd,
  busy,
  onClose,
  onEnd,
}: {
  session: McpSession | null;
  canEnd: boolean;
  busy: boolean;
  onClose: () => void;
  onEnd: (s: McpSession) => void;
}) {
  const styles = useStyles();
  const [confirm, setConfirm] = useState(false);
  if (!session) return null;
  const st = STATUS_LABELS[session.status];
  return (
    <OverlayDrawer open position="end" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DrawerHeader>
        <DrawerHeaderTitle>Session details</DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <dl className={styles.dl}>
          <dt>User</dt>
          <dd>{session.user_name ?? session.user_id}</dd>
          <dt>Assistant</dt>
          <dd>{session.client_name}</dd>
          <dt>Status</dt>
          <dd>
            <Badge appearance="tint" color={st.color === "subtle" ? "subtle" : st.color}>
              {st.label}
            </Badge>{" "}
            {endReasonLabel(session.end_reason)}
          </dd>
          <dt>Protocol version</dt>
          <dd>{session.protocol_version}</dd>
          <dt>Tool calls</dt>
          <dd>{session.call_count}</dd>
          <dt>Proposals</dt>
          <dd>{session.proposal_count}</dd>
          <dt>Refusals</dt>
          <dd>{session.refusal_count}</dd>
          <dt>Redactions</dt>
          <dd>{session.redaction_count}</dd>
          <dt>Candidates read</dt>
          <dd>{session.distinct_candidates}</dd>
        </dl>
        <Body1>
          <AppLink href={`/admin/ai/runs/${session.run_id}`}>Open run</AppLink>
        </Body1>
      </DrawerBody>
      <DrawerFooter>
        {canEnd && session.status !== "ended" ? (
          <Button appearance="primary" disabled={busy} onClick={() => setConfirm(true)}>
            End session
          </Button>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DrawerFooter>
      <Dialog open={confirm} onOpenChange={(_, d) => setConfirm(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>End this session?</DialogTitle>
            <DialogContent>The assistant must reconnect to continue.</DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  onEnd(session);
                }}
              >
                End session
              </Button>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </OverlayDrawer>
  );
}
