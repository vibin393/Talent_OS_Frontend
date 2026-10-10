"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  Input,
  makeStyles,
  Subtitle2,
  type TableColumnDefinition,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { formatDate, formatHours, formatMoney } from "../format";
import type { PoConsumptionOut, PoPlacementOut } from "../types";
import { PoConsumptionBar, PoValidityBadge } from "./purchase-orders-view";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, margin: `${tokens.spacingVerticalS} 0 ${tokens.spacingVerticalM}` },
  grow: { flex: 1 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalL },
});

const DOC_LABELS: Record<PoConsumptionOut["source_doc_kind"], string> = { invoice: "Invoice", credit_note: "Credit note", debit_note: "Debit note" };

/** `/purchase-orders/[id]`: header, consumption, the append-only ledger, linked placements, cap edit,
 * close / cancel and the PO document. */
export function PurchaseOrderDetail({ poId }: { poId: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const canRead = usePermission("po:read");
  const canWrite = usePermission("po:write");
  const [cap, setCap] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"close" | "cancel" | null>(null);
  const po = useQuery({ queryKey: commercialsKeys.purchaseOrder(poId), queryFn: ({ signal }) => commercialsApi.purchaseOrder(poId, signal), enabled: canRead });
  const ledger = useQuery({ queryKey: commercialsKeys.consumptions(poId), queryFn: ({ signal }) => commercialsApi.consumptions(poId, signal), enabled: canRead });
  const placements = useQuery({ queryKey: commercialsKeys.poPlacements(poId), queryFn: ({ signal }) => commercialsApi.poPlacements(poId, signal), enabled: canRead });
  const refresh = () => queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
  const saveCap = useMutation({
    mutationFn: () => commercialsApi.updatePurchaseOrder(poId, { value_cap: cap }),
    onSuccess: async () => {
      setCap(null);
      toast.success("Cap updated");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = useMutation({ mutationFn: (f: File) => commercialsApi.uploadPurchaseOrderDocument(poId, f), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });

  if (!canRead) return <NoAccess what="purchase orders" />;
  if (po.isPending) return <GridSkeleton rows={6} />;
  if (po.isError) return <ErrorBar title="Could not load this purchase order." message={errorMessage(po.error)} />;
  const p = po.data;
  const open = p.status === "active";

  const ledgerColumns: TableColumnDefinition<PoConsumptionOut>[] = [
    createTableColumn({ columnId: "when", renderHeaderCell: () => "Recorded", renderCell: (r) => formatDateTime(r.recorded_at) }),
    createTableColumn({ columnId: "doc", renderHeaderCell: () => "Document", renderCell: (r) => DOC_LABELS[r.source_doc_kind] }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (r) => formatMoney(r.amount, r.currency) }),
    createTableColumn({ columnId: "hours", renderHeaderCell: () => "Hours", renderCell: (r) => formatHours(r.hours) }),
    createTableColumn({
      columnId: "exception",
      renderHeaderCell: () => "",
      renderCell: (r) => (r.exception_approval_id ? <Badge appearance="tint" color="warning">Approved exception</Badge> : null),
    }),
  ];
  const placementColumns: TableColumnDefinition<PoPlacementOut>[] = [
    createTableColumn({ columnId: "id", renderHeaderCell: () => "Placement", renderCell: (r) => r.human_id ?? r.placement_id }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (r) => r.status ?? "—" }),
  ];

  return (
    <>
      <AppLink href="/purchase-orders">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Purchase orders
      </AppLink>
      <div className={styles.header}>
        <Title2 as="h1">PO {p.po_number}</Title2>
        <PoValidityBadge po={p} />
        <span className={styles.grow} />
        {canWrite && (
          <>
            <Button icon={<ArrowUpload20Regular />} disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
              {p.file_id ? "Replace document" : "Upload document"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            {open && <Button onClick={() => setConfirm("close")}>Close PO</Button>}
            {open && Number(p.consumed_amount) === 0 && Number(p.consumed_hours) === 0 && <Button onClick={() => setConfirm("cancel")}>Cancel PO</Button>}
          </>
        )}
      </div>
      <div className={styles.cards}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Consumption</Subtitle2>} />
          <PoConsumptionBar po={p} />
          <dl className={admin.detailList}>
            <dt>Remaining</dt>
            <dd>
              {[p.remaining_amount !== null ? formatMoney(p.remaining_amount, p.currency) : null, p.remaining_hours !== null ? formatHours(p.remaining_hours) : null]
                .filter(Boolean)
                .join(" · ")}
            </dd>
            <dt>Valid</dt>
            <dd>
              {formatDate(p.valid_from)} – {formatDate(p.valid_to)}
            </dd>
            <dt>Contract</dt>
            <dd>{p.contract_id ? <AppLink href={`/contracts/${p.contract_id}`}>Open contract</AppLink> : "—"}</dd>
            <dt>Client</dt>
            <dd>
              <AppLink href={`/clients/${p.client_id}`}>Open client</AppLink>
            </dd>
          </dl>
        </Card>
        {canWrite && open && (
          <Card className={styles.card}>
            <CardHeader header={<Subtitle2 as="h2">Value cap</Subtitle2>} description="Caps can rise any time; they never go below what is consumed." />
            <Field label="Value cap">
              <Input value={cap ?? p.value_cap ?? ""} inputMode="decimal" contentAfter={p.currency} onChange={(_, d) => setCap(d.value)} />
            </Field>
            <div className={admin.footer}>
              <Button appearance="primary" disabled={cap === null || !cap.trim() || saveCap.isPending} onClick={() => saveCap.mutate()}>
                Save cap
              </Button>
            </div>
          </Card>
        )}
      </div>
      <Subtitle2 as="h2" className={admin.sectionTitle}>
        Consumption ledger
      </Subtitle2>
      <AdminGrid items={ledger.data} columns={ledgerColumns} getRowId={(r) => r.id} loading={ledger.isPending} error={ledger.error} emptyText="Nothing invoiced against this PO yet." label="Consumption ledger" />
      <Subtitle2 as="h2" className={admin.sectionTitle}>
        Linked placements
      </Subtitle2>
      <AdminGrid items={placements.data} columns={placementColumns} getRowId={(r) => r.placement_id} loading={placements.isPending} error={placements.error} emptyText="No placements use this PO." label="Linked placements" />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "cancel" ? "Cancel this PO?" : "Close this PO?"}
        confirmLabel={confirm === "cancel" ? "Cancel PO" : "Close PO"}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          (confirm === "cancel" ? commercialsApi.cancelPurchaseOrder(poId) : commercialsApi.closePurchaseOrder(poId))
            .then(refresh)
            .catch((e) => {
              toast.error(errorMessage(e));
              throw e;
            })
        }
      >
        {confirm === "cancel" ? "A cancelled PO cannot be used again." : "A closed PO no longer appears as a default PO for new invoices."}
      </ConfirmDialog>
    </>
  );
}
