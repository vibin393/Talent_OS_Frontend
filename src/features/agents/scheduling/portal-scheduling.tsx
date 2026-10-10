"use client";

import {
  Button,
  Card,
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
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { portalSchedulingApi, schedulingKeys } from "./api";
import { SlotPicker } from "./slot-picker";

const useStyles = makeStyles({
  cards: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** "Pick a time" cards of the signed-in Candidate's open offers (Candidate Portal). Renders nothing without offers. */
export function PickTimeCards() {
  const styles = useStyles();
  const portal = usePortalStyles();
  const q = useQuery({ queryKey: schedulingKeys.portal, queryFn: ({ signal }) => portalSchedulingApi.list(signal), retry: false });
  if (!q.data || q.data.length === 0) return null;
  return (
    <ul className={styles.cards} aria-label="Pick a time">
      {q.data.map((offer) => (
        <li key={offer.offer_id}>
          <Card className={portal.card}>
            <SlotPicker source={portalSchedulingApi.source(offer)} initial={offer} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** `/portal/scheduling`: the Candidate's open "Pick a time" requests. */
export function PortalScheduling() {
  const portal = usePortalStyles();
  const q = useQuery({ queryKey: schedulingKeys.portal, queryFn: ({ signal }) => portalSchedulingApi.list(signal) });
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Pick a time" subtitle="Choose a time for your interview, or tell us what works better." />
      {q.isPending ? (
        <LoadingBlock label="Loading" />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Card className={portal.card}>You have no interview times to pick right now.</Card>
      ) : (
        <PickTimeCards />
      )}
    </div>
  );
}

/** "Need a different time?" on an upcoming interview (Candidate Portal): a reschedule request with a reason. */
export function NeedDifferentTime({ interviewId }: { interviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const send = useMutation({
    mutationFn: () => portalSchedulingApi.requestReschedule(interviewId, reason.trim()),
    onSuccess: () => setDone(true),
  });
  if (done) {
    return (
      <MessageBar intent="success" layout="multiline">
        <MessageBarBody>Thanks. We&apos;ll send you new times to pick from.</MessageBarBody>
      </MessageBar>
    );
  }
  return (
    <>
      <Button appearance="secondary" onClick={() => setOpen(true)}>
        Need a different time?
      </Button>
      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Request a new time</DialogTitle>
            <DialogContent>
              <Field label="Reason" required validationState={send.isError ? "error" : "none"} validationMessage={send.isError ? errorMessage(send.error) : undefined}>
                <Textarea value={reason} maxLength={300} onChange={(_, d) => setReason(d.value)} resize="vertical" />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={!reason.trim() || send.isPending} icon={send.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => send.mutate()}>
                Send
              </Button>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
