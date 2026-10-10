"use client";

import {
  Badge,
  Button,
  createTableColumn,
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
  Subtitle2,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { checksLabel, type PlatformListing, type QueueItem, reviewApi, reviewKeys, VERSION_STATUS_LABELS } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  row: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
});

/** `/platform/marketplace`: the review queue and the listings (suspend / reinstate / delist). */
export function MarketplaceReviewQueue() {
  const styles = useStyles();
  const router = useRouter();
  const queue = useQuery({ queryKey: reviewKeys.queue, queryFn: ({ signal }) => reviewApi.queue(signal) });
  const listings = useQuery({ queryKey: reviewKeys.listings, queryFn: ({ signal }) => reviewApi.listings(signal) });
  const [action, setAction] = useState<{ listing: PlatformListing; kind: "suspend" | "reinstate" | "delist" } | null>(null);
  const columns: TableColumnDefinition<QueueItem>[] = [
    createTableColumn({ columnId: "app", renderHeaderCell: () => "App", renderCell: (v) => v.app_name }),
    createTableColumn({ columnId: "partner", renderHeaderCell: () => "Partner", renderCell: (v) => v.partner_name ?? "—" }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (v) => String(v.version_no) }),
    createTableColumn({ columnId: "submitted", renderHeaderCell: () => "Submitted", renderCell: (v) => formatDateTime(v.submitted_at) }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (v) => VERSION_STATUS_LABELS[v.status] ?? v.status }),
    createTableColumn({
      columnId: "checks",
      renderHeaderCell: () => "Checks",
      renderCell: (v) => (
        <Badge appearance="tint" color={v.checks_failed ? "danger" : "success"}>
          {checksLabel(v.checks_failed)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "reviewer", renderHeaderCell: () => "Reviewer", renderCell: (v) => (v.reviewer_id ? "Claimed" : "—") }),
  ];
  const listingColumns: TableColumnDefinition<PlatformListing>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Listing", renderCell: (l) => l.name }),
    createTableColumn({ columnId: "partner", renderHeaderCell: () => "Partner", renderCell: (l) => l.partner_name ?? "Talent OS" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (l) => l.status }),
    createTableColumn({ columnId: "installs", renderHeaderCell: () => "Installs", renderCell: (l) => String(l.install_count) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (l) =>
        l.kind !== "app" ? null : (
          <div className={styles.row}>
            {l.status === "suspended" ? (
              <Button size="small" onClick={() => setAction({ listing: l, kind: "reinstate" })}>
                Reinstate
              </Button>
            ) : l.status === "published" ? (
              <Button size="small" onClick={() => setAction({ listing: l, kind: "suspend" })}>
                Suspend listing
              </Button>
            ) : null}
            {l.status !== "delisted" ? (
              <Button size="small" onClick={() => setAction({ listing: l, kind: "delist" })}>
                Delist
              </Button>
            ) : null}
          </div>
        ),
    }),
  ];
  return (
    <div className={styles.root}>
      <PageHeader title="Marketplace review" subtitle="Partner versions pass automated checks before a reviewer works the checklist." />
      <AdminGrid
        items={queue.data}
        columns={columns}
        getRowId={(v) => v.version_id}
        loading={queue.isPending}
        error={queue.error}
        emptyText="Nothing is waiting for review."
        label="Review queue"
        onRowClick={(v) => router.push(`/platform/marketplace/${v.version_id}`)}
      />
      <Subtitle2 as="h2">Listings</Subtitle2>
      <AdminGrid items={listings.data} columns={listingColumns} getRowId={(l) => l.id} loading={listings.isPending} error={listings.error} emptyText="No listings yet." label="Listings" />
      {action ? <ListingActionDialog action={action} onClose={() => setAction(null)} /> : null}
    </div>
  );
}

const ACTION_LABELS = { suspend: "Suspend listing", reinstate: "Reinstate", delist: "Delist" } as const;

function ListingActionDialog({ action, onClose }: { action: { listing: PlatformListing; kind: "suspend" | "reinstate" | "delist" }; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => reviewApi.listingAction(action.listing.id, action.kind, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reviewKeys.listings });
      onClose();
    },
  });
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {ACTION_LABELS[action.kind]}: {action.listing.name}
          </DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea maxLength={500} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
              {ACTION_LABELS[action.kind]}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
