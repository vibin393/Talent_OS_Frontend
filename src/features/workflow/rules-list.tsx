"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, Flow20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { WorkflowRuleOut } from "@/lib/api/types";
import { workflowApi, workflowKeys } from "./api";
import { useWorkflowRegistry, useWorkflowRules } from "./use-workflow";

export function activationError(e: unknown): string {
  if (isApiError(e) && e.code === "rule_limit") return "You already have the maximum number of active rules (100).";
  return errorMessage(e);
}

/** `/admin/workflows`: workflow rules with activation switches, last run and recent failures. */
export function RulesList() {
  const styles = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("workflow:read");
  const canManage = usePermission("workflow:manage");
  const [archived, setArchived] = useState(false);
  const [activating, setActivating] = useState<WorkflowRuleOut | null>(null);
  const rules = useWorkflowRules(archived);
  const registry = useWorkflowRegistry();

  const toggle = useMutation({
    mutationFn: ({ rule, on }: { rule: WorkflowRuleOut; on: boolean }) =>
      on ? workflowApi.activate(rule.id) : workflowApi.deactivate(rule.id),
    onSuccess: (r) => {
      toast.success(r.is_active ? `${r.name} is active` : `${r.name} is off`);
      void queryClient.invalidateQueries({ queryKey: workflowKeys.rules });
    },
    onError: (e) => toast.error(activationError(e)),
  });

  if (!canRead) return <NoAccess what="workflow rules" />;

  const triggerLabel = (key: string) => registry.data?.triggers.find((t) => t.key === key)?.label ?? key;

  const columns: TableColumnDefinition<WorkflowRuleOut>[] = [
    createTableColumn<WorkflowRuleOut>({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Name",
      renderCell: (r) => (
        <TableCellLayout media={<Flow20Regular aria-hidden />} description={r.description ?? undefined}>
          <Text weight="semibold">{r.name}</Text>
          {r.archived_at && (
            <Badge appearance="tint" color="subtle" style={{ marginInlineStart: 8 }}>
              Archived
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn<WorkflowRuleOut>({
      columnId: "trigger",
      compare: (a, b) => triggerLabel(a.trigger).localeCompare(triggerLabel(b.trigger)),
      renderHeaderCell: () => "Trigger",
      renderCell: (r) => triggerLabel(r.trigger),
    }),
    createTableColumn<WorkflowRuleOut>({
      columnId: "active",
      compare: (a, b) => Number(b.is_active) - Number(a.is_active),
      renderHeaderCell: () => "Active",
      renderCell: (r) => (
        <span/* NOSONAR */ onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Switch
            checked={r.is_active}
            disabled={!canManage || !!r.archived_at || toggle.isPending}
            aria-label={`${r.is_active ? "Turn off" : "Turn on"} ${r.name}`}
            onChange={(_, d) => (d.checked ? setActivating(r) : toggle.mutate({ rule: r, on: false }))}
          />
        </span>
      ),
    }),
    createTableColumn<WorkflowRuleOut>({
      columnId: "fired",
      compare: (a, b) => (a.last_fired_at ?? "").localeCompare(b.last_fired_at ?? ""),
      renderHeaderCell: () => "Last fired",
      renderCell: (r) => (r.last_fired_at ? formatDateTime(r.last_fired_at) : "Never"),
    }),
    createTableColumn<WorkflowRuleOut>({
      columnId: "failures",
      compare: (a, b) => a.failures_24h - b.failures_24h,
      renderHeaderCell: () => "Failures (24 h)",
      renderCell: (r) =>
        r.failures_24h > 0 ? (
          <Badge color="danger" appearance="filled">
            {r.failures_24h}
          </Badge>
        ) : (
          <Text className={styles.muted}>0</Text>
        ),
    }),
    createTableColumn<WorkflowRuleOut>({
      columnId: "updated",
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
      renderHeaderCell: () => "Updated",
      renderCell: (r) => formatDateTime(r.updated_at),
    }),
  ];

  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle="Automate routine steps: when something happens and conditions match, assign, create tasks, notify or email. Decisions stay with people."
      />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/admin/workflows/new")}>
            New rule
          </Button>
        )}
        <div className={styles.grow} />
        <Switch checked={archived} onChange={(_, d) => setArchived(d.checked)} label="Show archived" />
      </div>
      <AdminGrid
        items={rules.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={rules.isPending}
        error={rules.error}
        emptyText="No rules yet. New rules start switched off, so you can test them first."
        label="Workflow rules"
        sortable
        onRowClick={(r) => router.push(`/admin/workflows/${r.id}`)}
      />
      <ConfirmDialog
        open={activating !== null}
        title="Turn on this rule?"
        confirmLabel="Turn on"
        onClose={() => setActivating(null)}
        onConfirm={() => (activating ? toggle.mutateAsync({ rule: activating, on: true }) : Promise.resolve())}
      >
        {`${activating?.name ?? "The rule"} will run automatically for new events within about a minute. Use Test run first to check what it would do.`}
      </ConfirmDialog>
    </>
  );
}
