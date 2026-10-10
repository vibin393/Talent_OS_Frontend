"use client";

import { Badge, Button, createTableColumn, Dropdown, Link, Option, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { EventEditorDialog } from "./event-editor";
import { EVENT_STATUS_COLORS, EVENT_STATUS_LABELS, EVENT_STATUSES, KIND_LABELS } from "./logic";
import type { EventOut, EventStatus } from "./types";
import { useEventPermissions, useEvents } from "./use-events";

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge appearance="tint" color={EVENT_STATUS_COLORS[status]}>
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** `/campus/events`: job fairs, walk-in drives, hackathons and virtual events. */
export function EventsList() {
  const admin = useAdminStyles();
  const router = useRouter();
  const { canRead, canManage } = useEventPermissions();
  const [status, setStatus] = useState<EventStatus | "">("");
  const [creating, setCreating] = useState(false);
  const events = useEvents(status, canRead);
  if (!canRead) return <NoAccess what="recruitment events" />;

  const open = (e: EventOut) => router.push(`/campus/events/${e.id}`);
  const columns: TableColumnDefinition<EventOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Event",
      renderCell: (e) => (
        <Link
          as="button"
          onClick={(ev) => {
            ev.stopPropagation();
            open(e);
          }}
        >
          {e.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (e) => KIND_LABELS[e.kind] }),
    createTableColumn({ columnId: "when", renderHeaderCell: () => "Starts", renderCell: (e) => formatDateTime(e.starts_at) }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (e) => <EventStatusBadge status={e.status} /> }),
    createTableColumn({
      columnId: "counts",
      renderHeaderCell: () => "Registered / checked in",
      renderCell: (e) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>
          {e.counts.registered.toLocaleString()} / {e.counts.checked_in.toLocaleString()}
        </Text>
      ),
    }),
    createTableColumn({ columnId: "stations", renderHeaderCell: () => "Stations", renderCell: (e) => e.station_count }),
  ];

  return (
    <>
      <PageHeader title="Recruitment events" subtitle="Walk-in drives and job fairs with check-in, a live queue and interviewer stations" />
      <div className={admin.toolbar}>
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? EVENT_STATUS_LABELS[status] : "All statuses"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus((d.optionValue ?? "") as EventStatus | "")}
        >
          <Option value="">All statuses</Option>
          {EVENT_STATUSES.map((s) => (
            <Option key={s} value={s}>
              {EVENT_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New event
          </Button>
        )}
      </div>
      <AdminGrid
        items={events.data}
        columns={columns}
        getRowId={(e) => e.id}
        loading={events.isPending}
        error={events.error}
        emptyText="No events yet."
        label="Recruitment events"
        onRowClick={open}
      />
      {creating && <EventEditorDialog event={null} onClose={() => setCreating(false)} />}
    </>
  );
}
