"use client";

import {
  Button,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  type TableColumnDefinition,
  type TableColumnSizingOptions,
} from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { ErrorBar, GridSkeleton, useAdminStyles } from "./ui";
import { errorMessage } from "@/lib/api/errors";

/** Fluent `DataGrid` with loading, error and empty states, used by every admin list. */
export function AdminGrid<T>({
  items,
  columns,
  getRowId,
  loading,
  error,
  emptyText,
  label,
  columnSizing,
  footer,
  sortable,
  onRowClick,
}: {
  items: T[] | undefined;
  columns: TableColumnDefinition<T>[];
  getRowId: (item: T) => string;
  loading: boolean;
  error: unknown;
  emptyText: string;
  label: string;
  columnSizing?: TableColumnSizingOptions;
  footer?: React.ReactNode;
  /** Client-side sorting on columns that define `compare`. */
  sortable?: boolean;
  /** Open a row (e.g. its details panel) when it is clicked. */
  onRowClick?: (item: T) => void;
}) {
  const styles = useAdminStyles();
  if (error && !items) return <ErrorBar title="Could not load data." message={errorMessage(error)} />;
  return (
    <div className={styles.surface}>
      {loading && !items ? (
        <GridSkeleton />
      ) : (
        <>
          <DataGrid
            items={items ?? []}
            columns={columns}
            getRowId={getRowId}
            aria-label={label}
            className={styles.grid}
            sortable={sortable}
            resizableColumns={!!columnSizing}
            columnSizingOptions={columnSizing}
            focusMode="composite"
          >
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<T>>
              {({ item, rowId }) => (
                <DataGridRow<T>
                  key={rowId}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
          {items && items.length === 0 && <div className={styles.empty}>{emptyText}</div>}
        </>
      )}
      {footer}
    </div>
  );
}

export type RowAction = {
  label: string;
  icon?: React.ReactElement;
  onClick: () => void;
  disabled?: boolean;
};

/** "More actions" overflow menu for a grid row. Renders nothing when no action is available. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Menu positioning={{ position: "below", align: "end" }}>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label={`More actions for ${label}`} />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {actions.map((a) => (
            <MenuItem key={a.label} icon={a.icon} disabled={a.disabled} onClick={a.onClick}>
              {a.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
