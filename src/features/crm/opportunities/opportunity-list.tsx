"use client";

import {
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  TableCellLayout,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorBar, GridSkeleton, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import type { OpportunityFilters } from "../api";
import { formatDate, formatMoney, formatTotals, formatWeighted } from "../format";
import type { OpportunityOut, SummaryGroupBy } from "../types";
import { StageBadge } from "../ui";
import { OPPORTUNITY_PAGE_SIZE, useOpportunityList, useOpportunitySummary } from "../use-opportunity-board";

const useStyles = makeStyles({
  summary: { marginTop: tokens.spacingVerticalL, maxWidth: "720px" },
  head: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
});

const GROUP_LABELS: Record<SummaryGroupBy | "none", string> = { none: "No grouping", owner: "Owner", stage: "Stage", close_month: "Close month" };

/** Opportunity list (DataGrid with weighted column) and a group-by summary. */
export function OpportunityList({ filters }: { filters: OpportunityFilters }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const [page, setPage] = useState(1);
  const [groupBy, setGroupBy] = useState<SummaryGroupBy | null>("stage");
  const list = useOpportunityList(filters, page);
  const summary = useOpportunitySummary(groupBy, filters);
  const items = list.data?.items;

  const columns: TableColumnDefinition<OpportunityOut>[] = useMemo(
    () => [
      createTableColumn<OpportunityOut>({
        columnId: "id",
        renderHeaderCell: () => "Opportunity",
        renderCell: (o) => (
          <TableCellLayout truncate description={o.human_id}>
            <AppLink href={`/opportunities/${o.id}`}>{o.name}</AppLink>
          </TableCellLayout>
        ),
      }),
      createTableColumn<OpportunityOut>({
        columnId: "client",
        renderHeaderCell: () => "Client",
        renderCell: (o) => <AppLink href={`/clients/${o.client_id}`}>{o.client_name ?? "Client"}</AppLink>,
      }),
      createTableColumn<OpportunityOut>({ columnId: "stage", renderHeaderCell: () => "Stage", renderCell: (o) => <StageBadge stage={o.stage} /> }),
      createTableColumn<OpportunityOut>({
        columnId: "revenue",
        renderHeaderCell: () => "Est. revenue",
        renderCell: (o) => formatMoney(o.estimated_revenue, o.currency),
      }),
      createTableColumn<OpportunityOut>({
        columnId: "weighted",
        renderHeaderCell: () => "Weighted",
        renderCell: (o) => formatWeighted(o.weighted_revenue, o.currency, o.probability_pct),
      }),
      createTableColumn<OpportunityOut>({ columnId: "close", renderHeaderCell: () => "Close date", renderCell: (o) => formatDate(o.expected_close_date) }),
      createTableColumn<OpportunityOut>({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (o) => o.owner?.name ?? "—" }),
    ],
    [],
  );

  return (
    <>
      {list.error && !items ? (
        <ErrorBar title="Could not load opportunities." message={errorMessage(list.error)} />
      ) : (
        <div className={admin.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <>
              <DataGrid items={items ?? []} columns={columns} getRowId={(o) => o.id} aria-label="Opportunities" className={admin.grid} focusMode="composite" resizableColumns>
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<OpportunityOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<OpportunityOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              {items && items.length === 0 && <div className={admin.empty}>No opportunities match these filters.</div>}
            </>
          )}
          {list.data && (
            <PagingBar page={page} pageSize={OPPORTUNITY_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )}
        </div>
      )}
      <div className={styles.summary}>
        <div className={styles.head}>
          <Field label="Group summary by">
            <Dropdown
              value={GROUP_LABELS[groupBy ?? "none"]}
              selectedOptions={[groupBy ?? "none"]}
              onOptionSelect={(_, d) => setGroupBy(d.optionValue === "none" ? null : (d.optionValue as SummaryGroupBy))}
            >
              {(Object.keys(GROUP_LABELS) as (SummaryGroupBy | "none")[]).map((k) => (
                <Option key={k} value={k}>
                  {GROUP_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
        {groupBy && summary.data && (
          <Table size="small" aria-label="Pipeline summary">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>{GROUP_LABELS[groupBy]}</TableHeaderCell>
                <TableHeaderCell>Count</TableHeaderCell>
                <TableHeaderCell>Estimated · weighted</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.data.groups.map((g) => (
                <TableRow key={g.key}>
                  <TableCell>{g.label}</TableCell>
                  <TableCell>{g.count}</TableCell>
                  <TableCell>
                    {formatTotals(g.totals, false).map((t) => (
                      <Text key={t} block>
                        {t}
                      </Text>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
