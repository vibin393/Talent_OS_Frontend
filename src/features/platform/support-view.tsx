"use client";

import { Badge, Button, createTableColumn, Switch, type TableColumnDefinition, Toolbar } from "@fluentui/react-components";
import { Open20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { formatCountdown, humanize, SUPPORT_STATUS_COLORS } from "@/features/privacy/format";
import { useNow } from "@/features/privacy/use-now";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { SupportGrantOut } from "@/lib/api/types";
import { platformErrorMessage } from "./errors";

/** Only http(s) URLs (same origin or absolute) are opened from `app_url`. */
export function safeAppUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return /^https?:\/\//i.test(url) ? url : null;
}

/** `/platform/support`: my support-access requests; "Start session" opens the tenant app read-only. */
export function SupportView() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const now = useNow(30_000);
  const [mine, setMine] = useState(true);
  const list = useQuery({
    queryKey: [...platformKeys.support, mine],
    queryFn: ({ signal }) => platformApi.supportRequests(mine, signal),
    refetchInterval: 30_000,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => platformApi.cancelSupport(id),
    onSuccess: async () => {
      toast.success("Request cancelled");
      await queryClient.invalidateQueries({ queryKey: platformKeys.support });
    },
    onError: (e) => toast.error(platformErrorMessage(e)),
  });
  const start = useMutation({
    mutationFn: (id: string) => platformApi.startSupportSession(id),
    onSuccess: (s) => {
      const url = safeAppUrl(s.app_url) ?? "/dashboard";
      window.open(url, "_blank", "noopener");
      toast.info(`Support session started; it ends ${formatDateTime(s.expires_at)}`);
    },
    onError: (e) => toast.error(platformErrorMessage(e)),
  });
  const tenants = useQuery({ queryKey: [...platformKeys.tenants, "all"], queryFn: ({ signal }) => platformApi.tenants(1, 100, signal) });
  const tenantName = (id: string) => tenants.data?.items.find((t) => t.id === id)?.name ?? "Open tenant";
  const live = (g: SupportGrantOut) => g.status === "approved" && !!g.expires_at && Date.parse(g.expires_at) > now.getTime();

  const columns: TableColumnDefinition<SupportGrantOut>[] = [
    createTableColumn({
      columnId: "tenant",
      renderHeaderCell: () => "Tenant",
      renderCell: (g) => <AppLink href={`/platform/tenants/${g.tenant_id}`}>{tenantName(g.tenant_id)}</AppLink>,
    }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (g) => g.reason }),
    createTableColumn({ columnId: "ticket", renderHeaderCell: () => "Ticket", renderCell: (g) => g.ticket_ref ?? "—" }),
    createTableColumn({ columnId: "hours", renderHeaderCell: () => "Hours", renderCell: (g) => g.requested_hours }),
    createTableColumn({
      columnId: "status",
      compare: (a, b) => a.status.localeCompare(b.status),
      renderHeaderCell: () => "Status",
      renderCell: (g) => (
        <Badge appearance="tint" color={SUPPORT_STATUS_COLORS[g.status]}>
          {live(g) ? `Active · ${formatCountdown(g.expires_at, now)} left` : humanize(g.status)}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "requested",
      compare: (a, b) => a.created_at.localeCompare(b.created_at),
      renderHeaderCell: () => "Requested",
      renderCell: (g) => formatDateTime(g.created_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (g) =>
        live(g) ? (
          <Button size="small" appearance="primary" icon={<Open20Regular />} disabled={start.isPending} onClick={() => start.mutate(g.id)}>
            Start session
          </Button>
        ) : g.status === "pending" ? (
          <Button size="small" disabled={cancel.isPending} onClick={() => cancel.mutate(g.id)}>
            Cancel
          </Button>
        ) : null,
    }),
  ];

  return (
    <>
      <PageHeader title="Support access" subtitle="Read-only access to a tenant, approved by its admins, for at most 24 hours." />
      <Toolbar aria-label="Support filters" className={styles.toolbar}>
        <Switch label="Only my requests" checked={mine} onChange={(_, d) => setMine(d.checked)} />
      </Toolbar>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(g) => g.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No support requests. Request access from a tenant's page."
        label="Support requests"
        sortable
      />
    </>
  );
}
