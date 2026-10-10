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
  Input,
  makeStyles,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { webhooksApi } from "./api";
import { replayRangeError } from "./logic";

const useStyles = makeStyles({ body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM } });

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Replay failed…" (Epic 68, B4): failed / not-sent deliveries in a range of at most 30 days, with a preview count. */
export function ReplayRangeDialog({ subscriptionId, open, onClose }: { subscriptionId: string; open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [from, setFrom] = useState(() => localInput(new Date(Date.now() - 86_400_000)));
  const [to, setTo] = useState(() => localInput(new Date()));
  const [failed, setFailed] = useState(true);
  const [held, setHeld] = useState(true);
  const [busy, setBusy] = useState(false);
  const statuses = [...(failed ? (["failed"] as const) : []), ...(held ? (["held"] as const) : [])];
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const rangeError = replayRangeError(fromDate, toDate) ?? (statuses.length === 0 ? "Pick what to include." : null);
  const preview = useQuery({
    queryKey: ["webhooks", "replay-preview", subscriptionId, from, to, statuses.join(",")],
    queryFn: () =>
      webhooksApi.replayRange(subscriptionId, { from: fromDate.toISOString(), to: toDate.toISOString(), statuses, preview: true }),
    enabled: open && rangeError === null,
  });
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Replay failed deliveries</DialogTitle>
          <DialogContent className={styles.body}>
            <Field label="From" validationMessage={rangeError ?? undefined}>
              <Input type="datetime-local" value={from} onChange={(_, d) => setFrom(d.value)} />
            </Field>
            <Field label="To">
              <Input type="datetime-local" value={to} onChange={(_, d) => setTo(d.value)} />
            </Field>
            <Field label="Include">
              <Checkbox label="Failed" checked={failed} onChange={(_, d) => setFailed(Boolean(d.checked))} />
              <Checkbox label="Not sent while turned off" checked={held} onChange={(_, d) => setHeld(Boolean(d.checked))} />
            </Field>
            {preview.data && <Body1>{preview.data.count} deliveries will be sent again</Body1>}
            {preview.error && <Body1>{errorMessage(preview.error)}</Body1>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={rangeError !== null || busy || !preview.data?.count}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                try {
                  await webhooksApi.replayRange(subscriptionId, { from: fromDate.toISOString(), to: toDate.toISOString(), statuses });
                  toast.success("Replay started");
                  onClose();
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Replay
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
