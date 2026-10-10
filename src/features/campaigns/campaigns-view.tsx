"use client";

import { Badge, Button, createTableColumn, Dropdown, Link, Option, type TableColumnDefinition } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { campaignsApi, marketingKeys } from "./api";
import { CAMPAIGN_STATUSES, channelLabel, STATUS_COLORS, STATUS_LABELS } from "./logic";
import type { CampaignOut, CampaignStatus } from "./types";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge appearance="tint" color={STATUS_COLORS[status] ?? "subtle"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function countOf(c: CampaignOut, key: string): string {
  const v = c.counts?.[key];
  return typeof v === "number" ? v.toLocaleString() : "—";
}

/** `/marketing/campaigns`: campaigns list with a status filter. */
export function CampaignsView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("campaign:read");
  const canWrite = usePermission("campaign:write");
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const campaigns = useQuery({
    queryKey: marketingKeys.campaignList(status),
    queryFn: ({ signal }) => campaignsApi.list(status, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="campaigns" />;

  const open = (c: CampaignOut) => router.push(`/marketing/campaigns/${c.id}`);
  const columns: TableColumnDefinition<CampaignOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <Link
          as="button"
          onClick={(e) => {
            e.stopPropagation();
            open(c);
          }}
        >
          {c.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (c) => <CampaignStatusBadge status={c.status} /> }),
    createTableColumn({ columnId: "channel", renderHeaderCell: () => "Channel", renderCell: (c) => channelLabel(c.channel) }),
    createTableColumn({ columnId: "audience", renderHeaderCell: () => "Audience", renderCell: (c) => c.audience_name ?? "—" }),
    createTableColumn({ columnId: "sent", renderHeaderCell: () => "Sent", renderCell: (c) => countOf(c, "sent") }),
    createTableColumn({
      columnId: "when",
      renderHeaderCell: () => "Scheduled / started",
      renderCell: (c) => formatDateTime(c.started_at ?? c.scheduled_at),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? STATUS_LABELS[status] : "All statuses"}
          selectedOptions={[status ?? ""]}
          onOptionSelect={(_, d) => setStatus((d.optionValue || null) as CampaignStatus | null)}
        >
          <Option value="">All statuses</Option>
          {CAMPAIGN_STATUSES.map((s) => (
            <Option key={s} value={s}>
              {STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/marketing/campaigns/new")}>
            New campaign
          </Button>
        )}
      </div>
      <AdminGrid
        items={campaigns.data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={campaigns.isPending}
        error={campaigns.error}
        emptyText="No campaigns match this filter."
        label="Campaigns"
        onRowClick={open}
      />
    </>
  );
}
