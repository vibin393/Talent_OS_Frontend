"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { errorMessage } from "@/lib/api/errors";
import { type ReconciliationRowOut, ledgerApi, ledgerKeys, type ReconFlag } from "./api";
import { RECON_FLAG_LABELS, reconFlagLabels } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  filters: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "end" },
  chips: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
});

/** The "Reconciliation" tab: per-invoice differences between Talent OS and the ledger, with flag chips and export. */
export function ReconciliationTab({ legalEntityId }: { legalEntityId: string | null }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [flag, setFlag] = useState<ReconFlag | null>(null);
  const q = useQuery({
    queryKey: ledgerKeys.reconciliation(legalEntityId ?? "", from, to, flag ?? ""),
    queryFn: ({ signal }) => ledgerApi.reconciliation(legalEntityId!, from || undefined, to || undefined, flag ?? undefined, signal),
    enabled: !!legalEntityId,
  });

  const columns: TableColumnDefinition<ReconciliationRowOut>[] = [
    createTableColumn({ columnId: "invoice", renderHeaderCell: () => "Invoice", renderCell: (r) => r.invoice_number }),
    createTableColumn({ columnId: "tos_amount", renderHeaderCell: () => "Talent OS amount", renderCell: (r) => r.talent_os_amount ?? "—" }),
    createTableColumn({ columnId: "ledger_amount", renderHeaderCell: () => "Ledger amount", renderCell: (r) => r.ledger_amount ?? "—" }),
    createTableColumn({ columnId: "tos_status", renderHeaderCell: () => "Talent OS status", renderCell: (r) => r.talent_os_status ?? "—" }),
    createTableColumn({ columnId: "ledger_status", renderHeaderCell: () => "Ledger status", renderCell: (r) => r.ledger_status ?? "—" }),
    createTableColumn({ columnId: "difference", renderHeaderCell: () => "Difference", renderCell: (r) => (r.flags.length ? reconFlagLabels(r.flags) : r.difference ?? "—") }),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        <Field label="From">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
        <div className={styles.chips}>
          {RECON_FLAG_LABELS.map((f) => (
            <Badge
              key={f.key}
              appearance={flag === f.key ? "filled" : "outline"}
              color={flag === f.key ? "brand" : "informative"}
              style={{ cursor: "pointer" }}
              onClick={() => setFlag(flag === (f.key as ReconFlag) ? null : (f.key as ReconFlag))}
            >
              {f.label}
            </Badge>
          ))}
        </div>
        <Button disabled={!legalEntityId} onClick={() => void ledgerApi.exportReconciliation(legalEntityId!, from || undefined, to || undefined, flag ?? undefined).catch((e) => toast.error(errorMessage(e)))}>
          Export
        </Button>
      </div>
      {q.data && !q.data.ledger_available ? (
        <MessageBar intent="info">
          <MessageBarBody>The ledger is not available for live comparison; showing Talent OS values only.</MessageBarBody>
        </MessageBar>
      ) : null}
      {!legalEntityId ? <Caption1>Pick a legal entity.</Caption1> : null}
      <AdminGrid items={q.data?.rows} columns={columns} getRowId={(r) => r.invoice_id ?? r.invoice_number} loading={q.isPending} error={q.error} emptyText="No differences." label="Reconciliation" />
    </div>
  );
}
