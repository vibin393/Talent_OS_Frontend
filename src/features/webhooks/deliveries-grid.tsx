"use client";

import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  type TableColumnDefinition,
  Toolbar,
  ToolbarButton,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowRepeatAll20Regular, Copy16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { type Delivery, type DeliveryFilter, type Subscription, webhookKeys, webhooksApi } from "./api";
import { DeliveryDrawer } from "./delivery-drawer";
import { DELIVERY_STATUS_LABELS, pollInterval, STATUS_FILTERS } from "./logic";
import { ReplayRangeDialog } from "./replay-range-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  filters: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", alignItems: "end" },
  mono: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
});

const COLOR: Record<string, "success" | "danger" | "warning" | "informative" | "subtle"> = {
  succeeded: "success",
  failed: "danger",
  retrying: "warning",
  in_flight: "informative",
  pending: "informative",
  held: "subtle",
  cancelled: "subtle",
};

/** "Deliveries" tab (Epic 68, B4): 30-day log; refreshes every 15 s only while a row is still moving. */
export function DeliveriesGrid({ sub, canManage }: { sub: Subscription; canManage: boolean }) {
  const styles = useStyles();
  const [statusLabel, setStatusLabel] = useState("All");
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const filter: DeliveryFilter = {
    status: STATUS_FILTERS.find((f) => f.label === statusLabel)?.statuses,
    event_type: eventType || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  };
  const q = useQuery({
    queryKey: webhookKeys.deliveries(sub.id, filter),
    queryFn: ({ signal }) => webhooksApi.deliveries(sub.id, filter, signal),
    refetchInterval: (query) => pollInterval(query.state.data?.data),
  });
  const columns: TableColumnDefinition<Delivery>[] = [
    createTableColumn<Delivery>({ columnId: "event", renderHeaderCell: () => "Event", renderCell: (d) => d.event_type }),
    createTableColumn<Delivery>({
      columnId: "id",
      renderHeaderCell: () => "Event ID",
      renderCell: (d) => (
        <span className={styles.mono}>
          {d.event_id.slice(0, 8)}…
          <Tooltip content="Copy event ID" relationship="label">
            <Button
              size="small"
              appearance="subtle"
              icon={<Copy16Regular />}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(d.event_id);
              }}
            />
          </Tooltip>
        </span>
      ),
    }),
    createTableColumn<Delivery>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => (
        <Badge appearance="tint" color={COLOR[d.status] ?? "subtle"}>
          {d.kind === "replay" ? `${DELIVERY_STATUS_LABELS[d.status]} (replay)` : DELIVERY_STATUS_LABELS[d.status]}
        </Badge>
      ),
    }),
    createTableColumn<Delivery>({ columnId: "attempts", renderHeaderCell: () => "Attempts", renderCell: (d) => String(d.attempt_count) }),
    createTableColumn<Delivery>({
      columnId: "code",
      renderHeaderCell: () => "Response",
      renderCell: (d) => (d.last_status_code !== null ? String(d.last_status_code) : (d.last_error ?? "—")),
    }),
    createTableColumn<Delivery>({
      columnId: "latency",
      renderHeaderCell: () => "Latency",
      renderCell: (d) => (d.latency_ms !== null ? `${d.latency_ms} ms` : "—"),
    }),
    createTableColumn<Delivery>({ columnId: "created", renderHeaderCell: () => "Created", renderCell: (d) => formatDateTime(d.created_at) }),
    createTableColumn<Delivery>({
      columnId: "next",
      renderHeaderCell: () => "Next attempt",
      renderCell: (d) => formatDateTime(d.next_attempt_at),
    }),
  ];
  const rows = q.data?.data ?? [];
  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        <Field label="Status">
          <Dropdown value={statusLabel} selectedOptions={[statusLabel]} onOptionSelect={(_, d) => setStatusLabel(d.optionValue ?? "All")}>
            {STATUS_FILTERS.map((f) => (
              <Option key={f.label} value={f.label}>
                {f.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Event type">
          <Input value={eventType} onChange={(_, d) => setEventType(d.value.trim())} placeholder="placement.started" />
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
      </div>
      <Toolbar aria-label="Delivery actions">
        {canManage && (
          <ToolbarButton icon={<ArrowRepeatAll20Regular />} onClick={() => setReplaying(true)} disabled={sub.status !== "active"}>
            Replay failed…
          </ToolbarButton>
        )}
        <ToolbarButton icon={<ArrowDownload20Regular />} onClick={() => window.open(webhooksApi.exportUrl(sub.id), "_blank")}>
          Export CSV
        </ToolbarButton>
      </Toolbar>
      {q.error && <ErrorBar message={errorMessage(q.error)} />}
      {q.isLoading ? (
        <GridSkeleton />
      ) : (
        <DataGrid items={rows} columns={columns} getRowId={(d) => d.id} aria-label="Deliveries">
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<Delivery>>
            {({ item, rowId }) => (
              <DataGridRow<Delivery> key={rowId} onClick={() => setOpen(item.id)}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
      <DeliveryDrawer deliveryId={open} canManage={canManage && sub.status === "active"} onClose={() => setOpen(null)} />
      <ReplayRangeDialog subscriptionId={sub.id} open={replaying} onClose={() => setReplaying(false)} />
    </div>
  );
}
