"use client";

import { Badge, createTableColumn, type TableColumnDefinition, TableCellLayout, Text } from "@fluentui/react-components";
import { AdminGrid } from "@/features/admin/admin-grid";
import { useAdminStyles } from "@/features/admin/ui";
import { formatInZone } from "@/lib/time/zones";
import { interviewerNames, MODE_LABELS, scorecardCount, STATUS_LABELS } from "./format";
import type { InterviewOut } from "./types";

/** `DataGrid` of interviews: candidate, stage, time in the viewer's zone, mode, interviewers, scorecards, status. */
export function InterviewsGrid({
  items,
  loading,
  error,
  timeZone,
  onOpen,
  renderAction,
  emptyText = "No interviews yet.",
  label = "Interviews",
  hideDemand = true,
}: {
  items: InterviewOut[] | undefined;
  loading: boolean;
  error: unknown;
  timeZone: string;
  onOpen: (i: InterviewOut) => void;
  renderAction?: (i: InterviewOut) => React.ReactNode;
  emptyText?: string;
  label?: string;
  hideDemand?: boolean;
}) {
  const styles = useAdminStyles();
  const columns: TableColumnDefinition<InterviewOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Candidate",
      compare: (a, b) => (a.candidate_name ?? "").localeCompare(b.candidate_name ?? ""),
      renderCell: (i) => (
        <TableCellLayout truncate description={hideDemand ? i.human_id : (i.demand_title ?? i.human_id)}>
          {i.candidate_name ?? "Candidate"}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "stage",
      renderHeaderCell: () => "Stage",
      renderCell: (i) => <TableCellLayout truncate>{i.round > 1 ? `${i.stage_name} (round ${i.round})` : i.stage_name}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "time",
      renderHeaderCell: () => "Time",
      compare: (a, b) => a.starts_at.localeCompare(b.starts_at),
      renderCell: (i) => (
        <div className={styles.cellStack}>
          <Text>{formatInZone(i.starts_at, timeZone)}</Text>
          {i.timezone !== timeZone && (
            <Text size={200} className={styles.muted}>
              Organiser: {i.display_time}
            </Text>
          )}
        </div>
      ),
    }),
    createTableColumn({ columnId: "mode", renderHeaderCell: () => "Mode", renderCell: (i) => MODE_LABELS[i.mode] }),
    createTableColumn({
      columnId: "interviewers",
      renderHeaderCell: () => "Interviewers",
      renderCell: (i) => <TableCellLayout truncate>{interviewerNames(i)}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "scorecards",
      renderHeaderCell: () => "Scorecards",
      renderCell: (i) =>
        i.scorecards_required > 0 ? (
          <Badge
            appearance="tint"
            color={i.scorecards_submitted >= i.scorecards_required ? "success" : "informative"}
            aria-label={`${i.scorecards_submitted} of ${i.scorecards_required} scorecards submitted`}
          >
            {scorecardCount(i)}
          </Badge>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <Badge appearance="tint" color={STATUS_LABELS[i.status].color}>
          {STATUS_LABELS[i.status].label}
        </Badge>
      ),
    }),
    ...(renderAction
      ? [
          createTableColumn<InterviewOut>({
            columnId: "action",
            renderHeaderCell: () => "",
            renderCell: (i) => <div/* NOSONAR */ onClick={(e) => e.stopPropagation()}>{renderAction(i)}</div>,
          }),
        ]
      : []),
  ];
  return (
    <AdminGrid
      items={items}
      columns={columns}
      getRowId={(i) => i.id}
      loading={loading}
      error={error}
      emptyText={emptyText}
      label={label}
      sortable
      onRowClick={onOpen}
      columnSizing={{
        candidate: { minWidth: 160, idealWidth: 200 },
        stage: { minWidth: 110, idealWidth: 140 },
        time: { minWidth: 170, idealWidth: 200 },
        mode: { minWidth: 80, idealWidth: 90 },
        interviewers: { minWidth: 140, idealWidth: 180 },
        scorecards: { minWidth: 90, idealWidth: 90 },
        status: { minWidth: 90, idealWidth: 100 },
        action: { minWidth: 150, idealWidth: 160 },
      }}
    />
  );
}
