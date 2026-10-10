"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  createTableColumn,
  Dropdown,
  Field,
  Link,
  makeStyles,
  mergeClasses,
  Option,
  ProgressBar,
  type TableColumnDefinition,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type BoardFilters, onboardingApi, onboardingKeys } from "./api";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS, progressLabel } from "./logic";
import type { BoardRow, CaseStatus, UnmatchedPlacement } from "./types";

const useStyles = makeStyles({
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  counts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  progress: { minWidth: "120px" },
  overdue: { marginLeft: tokens.spacingHorizontalXS },
  tabs: { marginBottom: tokens.spacingVerticalM },
});

const WINDOWS = [
  { value: "7", label: "Next 7 days" },
  { value: "14", label: "Next 14 days" },
  { value: "30", label: "Next 30 days" },
  { value: "", label: "Any start date" },
];
const STATUSES: CaseStatus[] = ["not_started", "in_progress", "complete", "cancelled"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** `/onboarding`: progress across Placements starting soon (FR-124), plus the placements no template matched. */
export function OnboardingBoard() {
  const styles = useStyles();
  const router = useRouter();
  const canRead = usePermission("onboarding:read");
  const [tab, setTab] = useState<"board" | "unmatched">("board");
  const [startsWithin, setStartsWithin] = useState("14");
  const [status, setStatus] = useState<string[]>([]);
  const filters: BoardFilters = { starts_within: startsWithin ? Number(startsWithin) : null, status };
  const q = useQuery({
    queryKey: onboardingKeys.board(filters),
    queryFn: ({ signal }) => onboardingApi.board(filters, signal),
    enabled: canRead && tab === "board",
  });
  if (!canRead) return <NoAccess what="onboarding" />;
  const columns: TableColumnDefinition<BoardRow>[] = [
    createTableColumn({
      columnId: "case",
      renderHeaderCell: () => "Case",
      renderCell: (r) => (
        <Link as="button" onClick={() => router.push(`/onboarding/${r.id}`)}>
          {r.human_id ?? "Case"}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.worker_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({
      columnId: "placement",
      renderHeaderCell: () => "Placement",
      renderCell: (r) => (
        <Link as="button" onClick={() => router.push(`/placements/${r.placement_id}`)}>
          {r.placement_human_id ?? "Placement"}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "start", renderHeaderCell: () => "Planned start", renderCell: (r) => formatDate(r.planned_start_date) }),
    createTableColumn({
      columnId: "progress",
      renderHeaderCell: () => "Progress",
      renderCell: (r) => (
        <div className={styles.progress}>
          <ProgressBar value={r.progress_pct / 100} thickness="large" aria-label={progressLabel(r.progress_pct)} />
          <Caption1>{progressLabel(r.progress_pct)}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "counts",
      renderHeaderCell: () => "Tasks",
      renderCell: (r) => (
        <span className={styles.counts}>
          {(r.counts.submitted ?? 0) > 0 && <Badge appearance="tint" color="brand">{r.counts.submitted} to review</Badge>}
          {(r.counts.returned ?? 0) > 0 && <Badge appearance="tint" color="warning">{r.counts.returned} returned</Badge>}
          {(r.counts.pending ?? 0) > 0 && <Badge appearance="tint">{r.counts.pending} to do</Badge>}
          {r.overdue > 0 && (
            <Badge className={mergeClasses(styles.overdue)} appearance="filled" color="danger">
              {r.overdue} overdue
            </Badge>
          )}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "oldest",
      renderHeaderCell: () => "Oldest submitted",
      renderCell: (r) => (r.oldest_submitted_days === null ? "—" : `${r.oldest_submitted_days} d`),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={CASE_STATUS_COLORS[r.status]}>
          {CASE_STATUS_LABELS[r.status]}
        </Badge>
      ),
    }),
  ];
  return (
    <>
      <PageHeader title="Onboarding" subtitle="Joiners' onboarding progress, reviews waiting and overdue items" />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "board" | "unmatched")}>
        <Tab value="board">Cases</Tab>
        <Tab value="unmatched">No template matched</Tab>
      </TabList>
      {tab === "board" ? (
        <>
          <div className={styles.filters}>
            <Field label="Starts within">
              <Dropdown
                value={WINDOWS.find((w) => w.value === startsWithin)?.label}
                selectedOptions={[startsWithin]}
                onOptionSelect={(_, d) => setStartsWithin(d.optionValue ?? "")}
              >
                {WINDOWS.map((w) => (
                  <Option key={w.value || "any"} value={w.value}>
                    {w.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Status">
              <Dropdown
                multiselect
                placeholder="Open cases"
                value={status.map((s) => CASE_STATUS_LABELS[s as CaseStatus]).join(", ")}
                selectedOptions={status}
                onOptionSelect={(_, d) => setStatus(d.selectedOptions)}
              >
                {STATUSES.map((s) => (
                  <Option key={s} value={s}>
                    {CASE_STATUS_LABELS[s]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>
          <AdminGrid
            items={q.data}
            columns={columns}
            getRowId={(r) => r.id}
            loading={q.isPending}
            error={q.error}
            emptyText="No onboarding cases match these filters."
            label="Onboarding cases"
            onRowClick={(r) => router.push(`/onboarding/${r.id}`)}
          />
        </>
      ) : (
        <Unmatched />
      )}
    </>
  );
}

function Unmatched() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canManage = usePermission("onboarding:manage");
  const q = useQuery({ queryKey: onboardingKeys.unmatched, queryFn: ({ signal }) => onboardingApi.unmatched(signal) });
  const start = useMutation({
    mutationFn: (placementId: string) => onboardingApi.start(placementId),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: onboardingKeys.all });
      router.push(`/onboarding/${c.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<UnmatchedPlacement>[] = [
    createTableColumn({
      columnId: "placement",
      renderHeaderCell: () => "Placement",
      renderCell: (r) => (
        <Link as="button" onClick={() => router.push(`/placements/${r.placement_id}`)}>
          {r.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "start", renderHeaderCell: () => "Planned start", renderCell: (r) => formatDate(r.planned_start_date) }),
    createTableColumn({
      columnId: "action",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canManage ? (
          <Button size="small" disabled={start.isPending} onClick={() => start.mutate(r.placement_id)}>
            Start onboarding
          </Button>
        ) : null,
    }),
  ];
  return (
    <>
      <Body1>Placements without an onboarding case. Add a matching template, then start onboarding.</Body1>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(r) => r.placement_id}
        loading={q.isPending}
        error={q.error}
        emptyText="Every upcoming placement has an onboarding case."
        label="Placements without onboarding"
      />
    </>
  );
}
