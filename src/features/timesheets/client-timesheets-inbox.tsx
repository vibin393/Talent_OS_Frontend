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
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
} from "@fluentui/react-components";
import { CheckmarkCircle20Regular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { ClientTimesheetCard } from "./client-timesheet-card";
import { bulkConfirmation, codeLabel, newIdempotencyKey } from "./format";
import { useClientBulkDecide, useClientTimesheets } from "./use-client-timesheets";

/** `/client/timesheets`: pending / all timesheets with multi-select bulk approval (preview, then decide). */
export function ClientTimesheetsInbox() {
  const portal = usePortalStyles();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const list = useClientTimesheets(status);
  const { preview, decide } = useClientBulkDecide();
  // One Idempotency-Key per confirmation dialog (a retry of the same confirmation reuses it).
  const keyRef = useRef<string>("");

  const confirm = bulkConfirmation(selected, preview.data);

  const openConfirm = () => {
    keyRef.current = newIdempotencyKey();
    preview.reset();
    decide.reset();
    setResult(null);
    setConfirmOpen(true);
    preview.mutate(selected);
  };

  const decidable = (list.data ?? []).filter((t) => t.awaiting_client);
  const allSelected = decidable.length > 0 && decidable.every((t) => selected.includes(t.id));

  return (
    <div className={portal.page}>
      <PortalPageHeader title="Timesheets" subtitle="Review and approve your workers' hours." />
      <TabList
        selectedValue={status}
        onTabSelect={(_, d) => {
          setStatus(d.value as "pending" | "all");
          setSelected([]);
        }}
      >
        <Tab value="pending">Awaiting approval</Tab>
        <Tab value="all">All</Tab>
      </TabList>
      {result && (
        <MessageBar intent="success" layout="multiline">
          <MessageBarBody>{result}</MessageBarBody>
        </MessageBar>
      )}
      {list.isPending ? (
        <LoadingBlock label="Loading timesheets" />
      ) : list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <Card className={portal.card}>
          {decidable.length > 0 && (
            <div className={portal.actions}>
              <Button
                className={portal.button}
                onClick={() => setSelected(allSelected ? [] : decidable.map((t) => t.id))}
              >
                {allSelected ? "Clear selection" : "Select all awaiting"}
              </Button>
              <Button
                appearance="primary"
                className={portal.button}
                icon={<CheckmarkCircle20Regular />}
                disabled={selected.length === 0}
                onClick={openConfirm}
              >
                Approve selected ({selected.length})
              </Button>
            </div>
          )}
          {list.data.length === 0 ? (
            <Body1 className={portal.empty}>{status === "pending" ? "Nothing is waiting for your approval." : "No timesheets yet."}</Body1>
          ) : (
            <ul className={portal.list}>
              {list.data.map((t) => (
                <ClientTimesheetCard
                  key={t.id}
                  ts={t}
                  selected={selected.includes(t.id)}
                  onSelect={(checked) => setSelected((s) => (checked ? [...s, t.id] : s.filter((x) => x !== t.id)))}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={(_, d) => !d.open && !decide.isPending && setConfirmOpen(false)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Approve timesheets</DialogTitle>
            <DialogContent>
              {preview.isPending && <Spinner size="small" label="Checking selection…" />}
              {preview.isError && <InlineError message={errorMessage(preview.error)} />}
              {preview.data && <Body1>{confirm.summary}</Body1>}
              <InlineError message={decide.isError ? errorMessage(decide.error) : null} />
            </DialogContent>
            <DialogActions>
              <Button className={portal.button} disabled={decide.isPending} onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                className={portal.button}
                disabled={!confirm.canConfirm || decide.isPending}
                icon={decide.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={async () => {
                  if (!preview.data) return;
                  try {
                    const out = await decide.mutateAsync({
                      body: {
                        timesheet_ids: confirm.decidableIds,
                        action: "approve",
                        comment: null,
                        preview_hash: preview.data.preview_hash,
                      },
                      key: keyRef.current,
                    });
                    const skipped = out.skipped.map((s) => codeLabel(s.code));
                    setResult(
                      `Approved ${out.decided.length} timesheet${out.decided.length === 1 ? "" : "s"}.` +
                        (skipped.length ? ` Skipped ${skipped.length}: ${Array.from(new Set(skipped)).join(", ")}.` : ""),
                    );
                    setSelected([]);
                    setConfirmOpen(false);
                  } catch {
                    // shown in the dialog
                  }
                }}
              >
                Approve
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
