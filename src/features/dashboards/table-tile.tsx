"use client";

import {
  Badge,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import type { TileOut } from "@/lib/api/types";
import { rowHref } from "./links";
import { formatCell, type TableColumn, tableColumns, type TileRow } from "./tile-format";

export const MAX_TABLE_ROWS = 10;

const useStyles = makeStyles({
  wrap: { overflowX: "auto" },
  empty: { color: tokens.colorNeutralForeground3, paddingBlock: tokens.spacingVerticalS },
  num: { justifyContent: "flex-end", textAlign: "right" },
});

const SLA_COLORS = { healthy: "success", at_risk: "warning", breached: "danger", met: "success" } as const;

export function SlaStatusBadge({ status }: { status: unknown }) {
  if (typeof status !== "string" || !status) return <span aria-label="No SLA">—</span>;
  const color = SLA_COLORS[status as keyof typeof SLA_COLORS] ?? "informative";
  return (
    <Badge appearance="tint" color={color}>
      {formatCell(status, "sla")}
    </Badge>
  );
}

type Row = { index: number; data: TileRow };

/** Compact grid (≤ 10 rows) of a table tile; the first column links to the row's drill-down. */
export function TableTile({ tile, timeZone }: { tile: TileOut; timeZone?: string }) {
  const styles = useStyles();
  const rows: Row[] = (tile.rows ?? []).slice(0, MAX_TABLE_ROWS).map((data, index) => ({ index, data }));
  const cols = tableColumns(tile.key, tile.rows ?? []);
  if (rows.length === 0) return <Text className={styles.empty}>Nothing to show yet.</Text>;

  const cell = (c: TableColumn, r: Row) => {
    if (c.kind === "sla") return <SlaStatusBadge status={r.data[c.key]} />;
    const text = formatCell(r.data[c.key], c.kind, timeZone);
    if (c.primary) {
      const href = rowHref(tile.row_links, r.index, tile.link);
      return <TableCellLayout truncate>{href ? <AppLink href={href}>{text}</AppLink> : text}</TableCellLayout>;
    }
    const numeric = c.kind === "number" || c.kind === "percent";
    return (
      <TableCellLayout truncate className={numeric ? styles.num : undefined}>
        {text}
      </TableCellLayout>
    );
  };

  const columns: TableColumnDefinition<Row>[] = cols.map((c) =>
    createTableColumn<Row>({ columnId: c.key, renderHeaderCell: () => c.label, renderCell: (r) => cell(c, r) }),
  );

  return (
    <div className={styles.wrap}>
      <DataGrid items={rows} columns={columns} getRowId={(r) => r.index} size="extra-small" aria-label={tile.title} focusMode="composite">
        <DataGridHeader>
          <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
        </DataGridHeader>
        <DataGridBody<Row>>
          {({ item, rowId }) => <DataGridRow<Row> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
        </DataGridBody>
      </DataGrid>
    </div>
  );
}
