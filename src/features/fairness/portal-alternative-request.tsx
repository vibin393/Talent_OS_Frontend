"use client";

import {
  Body1,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Textarea,
} from "@fluentui/react-components";
import { useState } from "react";
import { usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { formatDate } from "./logic";
import { usePortalAlternativeRequests, useRequestPortalAlternative } from "./use-fairness";

/**
 * Candidate Portal application detail: "Request an alternative process" for the candidate's own application
 * (Epic 49, NYC LL144). Shows the existing request instead when one was already made.
 */
export function PortalAlternativeRequest({ applicationId, active }: { applicationId: string; active: boolean }) {
  const styles = usePortalStyles();
  const q = usePortalAlternativeRequests();
  const m = useRequestPortalAlternative();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (q.isPending || q.isError) return null;
  const existing = q.data.find((r) => r.application_id === applicationId);
  if (!existing && !active) return null;

  const submit = async () => {
    setError(null);
    try {
      await m.mutateAsync({ applicationId, note: note.trim() || null });
      setOpen(false);
      setNote("");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.card} role="region" aria-labelledby="alt-request-title">
      <Subtitle1 as="h2" id="alt-request-title">
        Alternative process
      </Subtitle1>
      {existing ? (
        <Body1>
          You requested an alternative selection process or accommodation on {formatDate(existing.requested_at)}.{" "}
          {existing.status === "handled" ? "Your request has been handled." : "A recruiter will contact you."}
        </Body1>
      ) : (
        <>
          <Body1 className={styles.muted}>
            If automated tools are used to assess your application, you can ask for an alternative selection process or an accommodation.
          </Body1>
          <div className={styles.actions}>
            <Button className={styles.button} onClick={() => setOpen(true)}>
              Request an alternative process
            </Button>
          </div>
        </>
      )}
      <Dialog open={open} onOpenChange={(_, d) => !d.open && !m.isPending && setOpen(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Request an alternative process</DialogTitle>
            <DialogContent className={styles.form}>
              <Field label="Note (optional)" hint="For example, the accommodation you need.">
                <Textarea value={note} maxLength={1000} onChange={(_, d) => setNote(d.value)} />
              </Field>
              {error && (
                <MessageBar intent="error" layout="multiline" role="alert">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button className={styles.button} disabled={m.isPending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" className={styles.button} disabled={m.isPending} icon={m.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
                Send request
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}
