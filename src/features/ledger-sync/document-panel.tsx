"use client";

import { Badge, Body1, Button, Caption1, makeStyles, MessageBar, MessageBarBody, Spinner, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { ledgerApi, ledgerKeys } from "./api";
import { recordStatusBadge } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  grid: { display: "grid", gridTemplateColumns: "auto 1fr", gap: tokens.spacingHorizontalM, rowGap: tokens.spacingVerticalXS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** The "Ledger sync" panel on an Invoice / Credit note: status, external id, synced-on and record actions. */
export function DocumentLedgerPanel({ kind, documentId }: { kind: "invoice" | "credit_note" | "debit_note" | "payment"; documentId: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({ queryKey: ledgerKeys.document(kind, documentId), queryFn: ({ signal }) => ledgerApi.document(kind, documentId, signal) });
  const retry = useMutation({
    mutationFn: (id: string) => ledgerApi.retry(id),
    onSuccess: () => {
      toast.success("Retry queued.");
      void qc.invalidateQueries({ queryKey: ledgerKeys.document(kind, documentId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isPending) return <Spinner size="tiny" label="Loading" />;
  if (q.error || !q.data) return <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar>;
  const r = q.data.record;
  if (!r) {
    return (
      <div className={styles.root}>
        <Subtitle2 as="h3">Ledger sync</Subtitle2>
        <Caption1>Not synced yet.</Caption1>
      </div>
    );
  }
  const b = recordStatusBadge(r.status);
  return (
    <div className={styles.root}>
      <Subtitle2 as="h3">Ledger sync</Subtitle2>
      <div className={styles.grid}>
        <Caption1>Status</Caption1>
        <Body1>
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        </Body1>
        <Caption1>External ID</Caption1>
        <Body1>{r.external_number ?? r.external_ref ?? "—"}</Body1>
        <Caption1>Synced on</Caption1>
        <Body1>{r.synced_at ? formatDateTime(r.synced_at) : "—"}</Body1>
      </div>
      <div className={styles.row}>
        <Button size="small" onClick={() => retry.mutate(r.id)}>
          Retry
        </Button>
      </div>
    </div>
  );
}
