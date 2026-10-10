"use client";

import { Badge, Body1, Button, Caption1, makeStyles, MessageBar, MessageBarActions, MessageBarBody, Spinner, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppToast } from "@/components/toast";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { hrmsApi, hrmsKeys } from "./api";
import { HRMS_STATUS_LABELS, statusBadge } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  grid: { display: "grid", gridTemplateColumns: "auto 1fr", gap: tokens.spacingHorizontalM, rowGap: tokens.spacingVerticalXS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** The "HRMS" panel on a Placement: employee code, HRMS status, mismatches, eligibility and record actions. */
export function PlacementHrmsPanel({ placementId }: { placementId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({ queryKey: hrmsKeys.placement(placementId), queryFn: ({ signal }) => hrmsApi.placement(placementId, signal) });

  const include = useMutation({
    mutationFn: () => hrmsApi.include(placementId, true),
    onSuccess: () => void qc.invalidateQueries({ queryKey: hrmsKeys.placement(placementId) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const retry = useMutation({
    mutationFn: (id: string) => hrmsApi.retry(id),
    onSuccess: () => toast.success("Retry queued."),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isPending) return <Spinner label="Loading" size="tiny" />;
  if (q.error || !q.data) return <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar>;
  const p = q.data;

  if (!p.eligible && !p.record) {
    return (
      <div className={styles.root}>
        <Subtitle2 as="h3">HRMS</Subtitle2>
        <Caption1>Not pushed: this worker isn&apos;t on your payroll.</Caption1>
        <div>
          <Button size="small" disabled={include.isPending} onClick={() => include.mutate()}>
            Include in HRMS sync
          </Button>
        </div>
      </div>
    );
  }

  const r = p.record;
  const badge = r ? statusBadge(r.status) : null;
  return (
    <div className={styles.root}>
      <Subtitle2 as="h3">HRMS</Subtitle2>
      {r?.mismatch && r.mismatch !== "none" ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            HRMS shows {HRMS_STATUS_LABELS[r.hrms_status ?? "unknown"] ?? r.hrms_status}
            {r.hrms_exit_date ? ` (exit ${r.hrms_exit_date})` : ""}; Talent OS shows {p.placement_status}.
          </MessageBarBody>
          {r.mismatch_task_id ? (
            <MessageBarActions>
              <Button size="small" onClick={() => router.push(`/tasks/${r.mismatch_task_id}`)}>
                Open task
              </Button>
            </MessageBarActions>
          ) : null}
        </MessageBar>
      ) : null}
      <div className={styles.grid}>
        <Caption1>Employee code</Caption1>
        <Body1>{r?.employee_code ?? "—"}</Body1>
        <Caption1>HRMS status</Caption1>
        <Body1>{r?.hrms_status ? HRMS_STATUS_LABELS[r.hrms_status] ?? r.hrms_status : "—"}</Body1>
        <Caption1>Exit date (HRMS)</Caption1>
        <Body1>{r?.hrms_exit_date ?? "—"}</Body1>
        <Caption1>Last sync</Caption1>
        <Body1>{r?.last_pushed_at ? formatDateTime(r.last_pushed_at) : "—"}</Body1>
        <Caption1>Status</Caption1>
        <Body1>{badge ? <Badge appearance="tint" color={badge.color}>{badge.label}</Badge> : "—"}</Body1>
      </div>
      {r ? (
        <div className={styles.row}>
          <Button size="small" onClick={() => retry.mutate(r.id)}>
            Retry
          </Button>
          <Button size="small" onClick={() => router.push("/hrms/sync")}>
            Open in sync queue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
