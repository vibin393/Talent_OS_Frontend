"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Spinner,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { AssignClientDialog } from "./assign-client-dialog";
import { canAssign, canDiscard, canRetry, INTAKE_STATUS_COLORS, INTAKE_STATUS_LABELS, senderLabel } from "./logic";
import type { IntakeMessage } from "./types";

const useStyles = makeStyles({
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, marginBottom: tokens.spacingVerticalL },
  preview: { whiteSpace: "pre-wrap", wordBreak: "break-word", color: tokens.colorNeutralForeground2 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

/** Intake message details: sender, subject, plain-text preview, attachments (scan status), match and drafts. */
export function IntakeMessageDrawer({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [assigning, setAssigning] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: demandAgentKeys.message(messageId), queryFn: ({ signal }) => demandAgentApi.message(messageId, signal) });
  const refresh = (m: IntakeMessage) => {
    qc.setQueryData(demandAgentKeys.message(messageId), m);
    void qc.invalidateQueries({ queryKey: [...demandAgentKeys.all, "messages"] });
  };
  const retry = useMutation({
    mutationFn: () => demandAgentApi.retry(messageId),
    onSuccess: (m) => {
      refresh(m);
      toast.success("Demand Agent is drafting. You'll be notified when it's done.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const discard = useMutation({
    mutationFn: () => demandAgentApi.discard(messageId, reason.trim()),
    onSuccess: (m) => {
      refresh(m);
      setDiscarding(false);
      toast.success("Message discarded.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const m = query.data;

  return (
    <DetailsDrawer
      open
      size="medium"
      title={m?.subject || "Intake message"}
      onClose={onClose}
      footer={
        m && (
          <div className={styles.actions}>
            {canAssign(m.status) && (
              <Button appearance="primary" onClick={() => setAssigning(true)}>
                Assign client
              </Button>
            )}
            {canRetry(m.status, m.client_id) && (
              <Button disabled={retry.isPending} onClick={() => retry.mutate()}>
                Retry
              </Button>
            )}
            {canDiscard(m.status) && <Button onClick={() => setDiscarding(true)}>Discard</Button>}
          </div>
        )
      }
    >
      {query.isPending ? (
        <GridSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the message." message={errorMessage(query.error)} />
      ) : m ? (
        <>
          <div className={styles.section}>
            <Badge appearance="tint" color={INTAKE_STATUS_COLORS[m.status]}>
              {INTAKE_STATUS_LABELS[m.status]}
            </Badge>
            <Body1>{senderLabel(m.from_name, m.from_address)}</Body1>
            <Caption1>Received {formatDateTime(m.received_at)}</Caption1>
          </div>
          <div className={styles.section}>
            <Subtitle2>Match</Subtitle2>
            <Body1>{m.match.explanation ?? (m.client_name ? `Client: ${m.client_name}` : "Not matched to a client yet.")}</Body1>
            {m.match.contact_name && <Caption1>Contact: {m.match.contact_name}</Caption1>}
          </div>
          {m.body_preview && (
            <div className={styles.section}>
              <Subtitle2>Message</Subtitle2>
              <Body1 className={styles.preview}>{m.body_preview}</Body1>
            </div>
          )}
          {m.attachments.length > 0 && (
            <div className={styles.section}>
              <Subtitle2>Attachments</Subtitle2>
              {m.attachments.map((a) => (
                <Caption1 key={`${a.filename}-${a.file_id ?? ""}`}>
                  {a.filename} · {a.scan_status}
                </Caption1>
              ))}
            </div>
          )}
          {m.drafts.length > 0 && (
            <div className={styles.section}>
              <Subtitle2>Drafted demands</Subtitle2>
              {m.drafts.map((d) => (
                <AppLink key={d.id} href={`/demands/${d.id}`}>
                  {`${d.human_id ?? ""} ${d.title ?? ""}`.trim()}
                </AppLink>
              ))}
            </div>
          )}
          {assigning && <AssignClientDialog message={m} onClose={() => setAssigning(false)} onAssigned={refresh} />}
          <Dialog open={discarding} onOpenChange={(_, d) => !d.open && setDiscarding(false)}>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Discard message</DialogTitle>
                <DialogContent>
                  <Field label="Reason" required>
                    <Textarea value={reason} maxLength={300} onChange={(_, d) => setReason(d.value)} />
                  </Field>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setDiscarding(false)}>Cancel</Button>
                  <Button
                    appearance="primary"
                    disabled={reason.trim().length < 3 || discard.isPending}
                    icon={discard.isPending ? <Spinner size="tiny" /> : undefined}
                    onClick={() => discard.mutate()}
                  >
                    Discard
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        </>
      ) : null}
    </DetailsDrawer>
  );
}
