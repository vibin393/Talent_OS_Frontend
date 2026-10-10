"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  type TableColumnDefinition,
  Toolbar,
  ToolbarButton,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, MoreHorizontal20Regular, Pulse20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ecosystemApi, ecosystemKeys } from "@/features/ecosystem/api";
import { errorMessage } from "@/lib/api/errors";
import { type Subscription, webhookKeys, webhooksApi } from "./api";
import { endpointLabel } from "./logic";
import { SecretOnceDialog } from "./secret-once-dialog";
import { StatusBadge } from "./status-badge";
import { SubscriptionForm } from "./subscription-form";
import { TestEventDialog } from "./test-event-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  surface: { maxWidth: "640px", width: "100%" },
  empty: { padding: tokens.spacingVerticalXL },
});

/** Settings → Integrations → Webhooks (Epic 68, B2). */
export function SubscriptionsList() {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canManage = usePermission("webhook:manage");
  const canView = usePermission("integration:view") || canManage;
  const list = useQuery({ queryKey: webhookKeys.list, queryFn: ({ signal }) => webhooksApi.list(signal), enabled: canView });
  const eco = useQuery({ queryKey: ecosystemKeys.state, queryFn: ({ signal }) => ecosystemApi.state(signal), enabled: canView });
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ value: string; id: string } | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [testing, setTesting] = useState<Subscription | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: webhookKeys.all });
  const toggle = useMutation({
    mutationFn: (s: Subscription) => (s.status === "disabled" ? webhooksApi.enable(s.id) : webhooksApi.disable(s.id)),
    onSuccess: (s) => {
      toast.success(s.status === "disabled" ? "Webhook turned off." : "Webhook turned on.");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canView)
    return (
      <>
        <PageHeader title="Webhooks" />
        <NoAccess what="webhooks" />
      </>
    );

  const columns: TableColumnDefinition<Subscription>[] = [
    createTableColumn<Subscription>({
      columnId: "endpoint",
      renderHeaderCell: () => "Endpoint",
      renderCell: (s) => (
        <Tooltip content={s.url.split("?")[0]} relationship="description">
          <span>{s.description || endpointLabel(s.url)}</span>
        </Tooltip>
      ),
    }),
    createTableColumn<Subscription>({
      columnId: "events",
      renderHeaderCell: () => "Events",
      renderCell: (s) =>
        s.all_events ? (
          "All events"
        ) : (
          <Tooltip content={s.event_types.join(", ")} relationship="description">
            <span>{s.event_types.length === 1 ? s.event_types[0] : `${s.event_types.length} events`}</span>
          </Tooltip>
        ),
    }),
    createTableColumn<Subscription>({
      columnId: "owner",
      renderHeaderCell: () => "Owner",
      renderCell: (s) =>
        s.owner_kind === "tenant" ? (
          "Your organisation"
        ) : (
          <Badge appearance="outline" color="brand">
            App
          </Badge>
        ),
    }),
    createTableColumn<Subscription>({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (s) => <StatusBadge sub={s} /> }),
    createTableColumn<Subscription>({
      columnId: "last",
      renderHeaderCell: () => "Last delivery",
      renderCell: (s) => {
        const ok = s.last_success_at && (!s.last_failure_at || s.last_success_at >= s.last_failure_at);
        const at = ok ? s.last_success_at : s.last_failure_at;
        return at ? (
          <span>
            <Badge size="tiny" color={ok ? "success" : "danger"} aria-label={ok ? "Delivered" : "Failed"} /> {formatDateTime(at)}
          </span>
        ) : (
          "—"
        );
      },
    }),
    createTableColumn<Subscription>({
      columnId: "failures",
      renderHeaderCell: () => "Failures (24 h)",
      renderCell: (s) => String(s.consecutive_failures),
    }),
    createTableColumn<Subscription>({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (s) => (
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" aria-label="More actions" icon={<MoreHorizontal20Regular />} onClick={(e) => e.stopPropagation()} />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => router.push(`/settings/integrations/webhooks/${s.id}`)}>Open</MenuItem>
              {canManage && <MenuItem onClick={() => setTesting(s)}>Send test event</MenuItem>}
              {canManage && <MenuItem onClick={() => toggle.mutate(s)}>{s.status === "disabled" ? "Turn on" : "Turn off"}</MenuItem>}
              {canManage && <MenuItem onClick={() => setDeleting(s)}>Delete</MenuItem>}
            </MenuList>
          </MenuPopover>
        </Menu>
      ),
    }),
  ];

  const rows = list.data?.data ?? [];
  return (
    <div className={styles.root}>
      <PageHeader title="Webhooks" subtitle="Send signed notifications to your systems when records change." />
      {eco.data?.kill_switch_on && (
        <MessageBar intent="warning">
          <MessageBarBody>External access is paused. Deliveries are queued and will resume when access is restored.</MessageBarBody>
        </MessageBar>
      )}
      <Toolbar aria-label="Webhook actions">
        {canManage && (
          <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New webhook
          </ToolbarButton>
        )}
        {canManage && eco.data?.sandbox && (
          <ToolbarButton icon={<Pulse20Regular />} onClick={() => router.push("/settings/integrations/webhooks/echo")}>
            Echo endpoint
          </ToolbarButton>
        )}
      </Toolbar>
      {list.error && (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(list.error)}</MessageBarBody>
        </MessageBar>
      )}
      {list.isLoading ? (
        <GridSkeleton />
      ) : rows.length === 0 ? (
        <Body1 className={styles.empty}>
          No webhooks yet. Create one to receive events such as new candidates or approved timesheets.
        </Body1>
      ) : (
        <DataGrid items={rows} columns={columns} getRowId={(s) => s.id} aria-label="Webhooks">
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<Subscription>>
            {({ item, rowId }) => (
              <DataGridRow<Subscription> key={rowId} onClick={() => router.push(`/settings/integrations/webhooks/${item.id}`)}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
      <Dialog open={creating} onOpenChange={(_, d) => setCreating(d.open)}>
        <DialogSurface className={styles.surface}>
          <DialogBody>
            <DialogTitle>New webhook</DialogTitle>
            <DialogContent>
              <SubscriptionForm
                submitLabel="Create webhook"
                onCancel={() => setCreating(false)}
                onSubmit={async (body) => {
                  const created = await webhooksApi.create(body);
                  setCreating(false);
                  setSecret({ value: created.signing_secret, id: created.subscription.id });
                  void refresh();
                }}
              />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <SecretOnceDialog
        secret={secret?.value ?? null}
        onDone={() => {
          const id = secret?.id;
          setSecret(null);
          if (id) router.push(`/settings/integrations/webhooks/${id}?created=1`);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this webhook?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await webhooksApi.remove(deleting.id);
            toast.success("Webhook deleted.");
            void refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Queued and paused deliveries are cancelled. The delivery log stays available for 30 days.
      </ConfirmDialog>
      <TestEventDialog sub={testing} onClose={() => setTesting(null)} />
    </div>
  );
}
