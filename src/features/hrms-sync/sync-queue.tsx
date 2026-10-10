"use client";

import {
  Button,
  Badge,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Tab,
  TabList,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { type HrmsRecordOut, hrmsApi, hrmsKeys } from "./api";
import { PUSH_KIND_LABELS, QUEUE_TABS, statusBadge, tabFilter } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  toolbar: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** `/hrms/sync`: the HRMS sync queue — waiting, blocked, failed, synced and mismatched records with row actions. */
export function HrmsSyncQueue() {
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [tab, setTab] = useState("pending");
  const [skip, setSkip] = useState<HrmsRecordOut | null>(null);
  const filter = tabFilter(tab);
  const q = useQuery({
    queryKey: hrmsKeys.records(filter.status, undefined, filter.mismatch),
    queryFn: ({ signal }) => hrmsApi.records(filter, signal),
  });

  const retry = useMutation({
    mutationFn: (id: string) => hrmsApi.retry(id),
    onSuccess: () => {
      toast.success("Retry queued.");
      void qc.invalidateQueries({ queryKey: hrmsKeys.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pull = useMutation({
    mutationFn: async () => {
      const ids = [...new Set((q.data?.items ?? []).map((r) => r.installation_id))];
      await Promise.all(ids.map((id) => hrmsApi.pullNow(id)));
    },
    onSuccess: () => toast.success("Status pull queued."),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: TableColumnDefinition<HrmsRecordOut>[] = [
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.worker_name ?? r.candidate_id.slice(0, 8) }),
    createTableColumn({ columnId: "placement", renderHeaderCell: () => "Placement", renderCell: (r) => r.placement_human_id ?? r.placement_id.slice(0, 8) }),
    createTableColumn({ columnId: "le", renderHeaderCell: () => "Legal entity", renderCell: (r) => r.legal_entity_id.slice(0, 8) }),
    createTableColumn({ columnId: "push", renderHeaderCell: () => "Last push", renderCell: (r) => (r.last_push_kind ? PUSH_KIND_LABELS[r.last_push_kind] ?? r.last_push_kind : "—") }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => {
        const b = statusBadge(r.status);
        return (
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        );
      },
    }),
    createTableColumn({ columnId: "message", renderHeaderCell: () => "Message", renderCell: (r) => r.last_message ?? (r.blocked_fields.length ? `Map: ${r.blocked_fields.join(", ")}` : "—") }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Updated", renderCell: (r) => formatDateTime(r.updated_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) => (
        <div className={styles.toolbar}>
          {r.status === "blocked" ? (
            <Button size="small" onClick={() => router.push(`/settings/integrations/installed/${r.installation_id}`)}>
              Fix mapping
            </Button>
          ) : null}
          {r.status === "failed" || r.status === "blocked" || r.status === "pending" ? (
            <Button size="small" onClick={() => retry.mutate(r.id)}>
              Retry
            </Button>
          ) : null}
          <Button size="small" onClick={() => setSkip(r)}>
            Skip
          </Button>
          <Button size="small" onClick={() => router.push(`/placements/${r.placement_id}`)}>
            Open placement
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className={styles.root}>
      <PageHeader title="HRMS sync" subtitle="Workers pushed to your HR system, and anything waiting or disagreeing." />
      <div className={styles.toolbar}>
        <Button disabled={pull.isPending || !(q.data?.items?.length)} onClick={() => pull.mutate()}>
          Pull status now
        </Button>
      </div>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as string)}>
        {QUEUE_TABS.map((t) => (
          <Tab key={t.key} value={t.key}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <AdminGrid
        items={q.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={q.isPending}
        error={q.error}
        emptyText="Nothing here."
        label="HRMS sync records"
      />
      {skip ? <SkipDialog record={skip} onClose={() => setSkip(null)} onDone={() => void qc.invalidateQueries({ queryKey: hrmsKeys.all })} /> : null}
    </div>
  );
}

function SkipDialog({ record, onClose, onDone }: { record: HrmsRecordOut; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => hrmsApi.skip(record.id, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Skip this worker?</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea maxLength={40} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={reason.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
              Skip
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
