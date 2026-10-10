"use client";

import {
  Avatar,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  type TableColumnDefinition,
  type TableRowId,
  Text,
  tokens,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
} from "@fluentui/react-components";
import { ArrowForward20Regular, DismissCircle20Regular, PersonArrowLeft20Regular, Send20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, GridSkeleton, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import type { ApplicationOut, PipelineStageOut } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "./api";
import { ApplicationBadges } from "./badges";
import { daysLabel, SOURCE_LABELS } from "./format";
import { isTerminalKey } from "./transitions";
import { InviteToAssessmentToolbarButton } from "@/features/assessments/invite-dialog";

const useStyles = makeStyles({
  bulk: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    marginBottom: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
  },
  name: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, minWidth: 0 },
  link: { padding: 0, minWidth: 0, height: "auto", fontWeight: tokens.fontWeightSemibold, justifyContent: "flex-start" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXXS },
});

export type BulkRequest =
  | { kind: "move"; apps: ApplicationOut[]; stage: PipelineStageOut }
  | { kind: "reject"; apps: ApplicationOut[] }
  | { kind: "withdraw"; apps: ApplicationOut[] }
  | { kind: "submit"; apps: ApplicationOut[] };

/** List view of a demand's applications: paged multiselect `DataGrid` with bulk actions. */
export function PipelineList({
  demandId,
  q,
  stageId,
  stages,
  onOpen,
  onBulk,
  canMove,
  canSubmit,
  canReject,
}: {
  demandId: string;
  q: string;
  stageId: string | null;
  stages: PipelineStageOut[];
  onOpen: (app: ApplicationOut) => void;
  onBulk: (request: BulkRequest, clearSelection: () => void) => void;
  canMove: boolean;
  canSubmit: boolean;
  canReject: boolean;
}) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<TableRowId>>(new Set());
  const filters = useMemo(() => ({ q, stageId }), [q, stageId]);
  // Reset paging and selection when the filters change.
  const [lastFilters, setLastFilters] = useState(filters);
  if (lastFilters !== filters) {
    setLastFilters(filters);
    setPage(1);
    setSelected(new Set());
  }
  const list = useQuery({
    queryKey: pipelineKeys.list(demandId, filters, page),
    queryFn: ({ signal }) => pipelineApi.applications(demandId, filters, page, DEFAULT_PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const items = list.data?.items;
  const selectedApps = (items ?? []).filter((a) => selected.has(a.id));
  const clear = () => setSelected(new Set());
  const allShortlisted = selectedApps.length > 0 && selectedApps.every((a) => a.stage.key === "shortlisted");
  const anyTerminal = selectedApps.some((a) => isTerminalKey(a.stage.key));
  const moveStages = stages.filter((s) => !["submitted", "rejected", "withdrawn", "offered", "hired"].includes(s.key));

  const columns: TableColumnDefinition<ApplicationOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => (a.candidate.full_name ?? "").localeCompare(b.candidate.full_name ?? ""),
      renderHeaderCell: () => "Candidate",
      renderCell: (a) => (
        <span className={styles.name}>
          <Avatar name={a.candidate.full_name ?? undefined} size={24} color="colorful" aria-hidden />
          <span className={admin.cellStack}>
            <Button appearance="transparent" className={styles.link} onClick={() => onOpen(a)}>
              {a.candidate.full_name || a.candidate.human_id}
            </Button>
            <Text size={200} className={admin.muted}>
              {a.candidate.current_title || a.human_id}
            </Text>
          </span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "stage",
      compare: (a, b) => a.stage.label.localeCompare(b.stage.label),
      renderHeaderCell: () => "Stage",
      renderCell: (a) => a.stage.label,
    }),
    createTableColumn({
      columnId: "days",
      compare: (a, b) => a.days_in_stage - b.days_in_stage,
      renderHeaderCell: () => "In stage",
      renderCell: (a) => daysLabel(a.days_in_stage),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (a) => (
        <span className={styles.badges}>
          <ApplicationBadges app={a} />
        </span>
      ),
    }),
    createTableColumn({
      columnId: "source",
      renderHeaderCell: () => "Source",
      renderCell: (a) => SOURCE_LABELS[a.source] ?? a.source,
    }),
  ];

  return (
    <>
      {selectedApps.length > 0 && (
        <div className={styles.bulk} role="region" aria-label="Bulk actions">
          <Text weight="semibold" aria-live="polite">
            {selectedApps.length} selected
          </Text>
          <ToolbarDivider />
          <Toolbar aria-label="Bulk actions" size="small">
            {canMove && (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <ToolbarButton icon={<ArrowForward20Regular />} disabled={anyTerminal}>
                    Move to
                  </ToolbarButton>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {moveStages.map((s) => (
                      <MenuItem key={s.id} onClick={() => onBulk({ kind: "move", apps: selectedApps, stage: s }, clear)}>
                        {s.label}
                      </MenuItem>
                    ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            )}
            {canReject && (
              <ToolbarButton icon={<DismissCircle20Regular />} disabled={anyTerminal} onClick={() => onBulk({ kind: "reject", apps: selectedApps }, clear)}>
                Reject
              </ToolbarButton>
            )}
            {canMove && (
              <ToolbarButton icon={<PersonArrowLeft20Regular />} disabled={anyTerminal} onClick={() => onBulk({ kind: "withdraw", apps: selectedApps }, clear)}>
                Withdraw
              </ToolbarButton>
            )}
            {canSubmit && (
              <ToolbarButton
                icon={<Send20Regular />}
                disabled={!allShortlisted}
                title={allShortlisted ? undefined : "Select shortlisted candidates only"}
                onClick={() => onBulk({ kind: "submit", apps: selectedApps }, clear)}
              >
                Submit to client
              </ToolbarButton>
            )}
            <InviteToAssessmentToolbarButton
              apps={selectedApps.map((a) => ({ applicationId: a.id, candidateId: a.candidate.id, name: a.candidate.full_name || a.candidate.human_id || "Candidate" }))}
              onDone={clear}
            />
          </Toolbar>
          <Button appearance="transparent" size="small" onClick={clear}>
            Clear selection
          </Button>
        </div>
      )}
      {list.error && !items ? (
        <ErrorBar title="Could not load applications." message={errorMessage(list.error)} />
      ) : (
        <div className={admin.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <DataGrid
              items={items ?? []}
              columns={columns}
              getRowId={(a) => a.id}
              aria-label="Applications"
              className={admin.grid}
              sortable
              selectionMode="multiselect"
              selectedItems={selected}
              onSelectionChange={(_, d) => setSelected(new Set(d.selectedItems))}
            >
              <DataGridHeader>
                <DataGridRow selectionCell={{ checkboxIndicator: { "aria-label": "Select all rows" } }}>
                  {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<ApplicationOut>>
                {({ item, rowId }) => (
                  <DataGridRow<ApplicationOut>
                    key={rowId}
                    selectionCell={{ checkboxIndicator: { "aria-label": `Select ${item.candidate.full_name ?? item.human_id}` } }}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
          {items && items.length === 0 && (
            <div className={admin.empty}>{q || stageId ? "No applications match these filters." : "No candidates in this pipeline yet."}</div>
          )}
          {list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              busy={list.isFetching}
              onPageChange={(p) => {
                setPage(p);
                clear();
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
