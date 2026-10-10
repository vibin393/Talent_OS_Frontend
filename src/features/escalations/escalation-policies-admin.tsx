"use client";

import {
  Badge,
  Button,
  Checkbox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  SpinButton,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Archive20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useRoles } from "@/features/admin/use-admin-data";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { escalationKeys, escalationsApi } from "./api";
import {
  ACTION_LABELS,
  describePolicy,
  emptyPolicy,
  type PolicyDraft,
  policyDraft,
  type PolicyErrors,
  policyIn,
  TARGET_LABELS,
  UNIT_LABELS,
  validatePolicy,
} from "./escalation-model";
import type { AfterUnit, EscalationPolicyOut, EscalationTargetKind } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", "& > *": { flex: "1 1 160px" } },
  summary: { color: tokens.colorNeutralForeground3 },
});

export function usePolicies(includeArchived = false) {
  const canRead = usePermission("sla:read");
  return useQuery({
    queryKey: escalationKeys.policies(includeArchived),
    queryFn: ({ signal }) => escalationsApi.policies(includeArchived, signal),
    enabled: canRead,
  });
}

function PolicyDialog({ policy, onClose }: { policy: EscalationPolicyOut | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const [draft, setDraft] = useState<PolicyDraft>(() => (policy ? policyDraft(policy) : emptyPolicy()));
  const [errors, setErrors] = useState<PolicyErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (patch: Partial<PolicyDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = useMutation({
    mutationFn: () => (policy ? escalationsApi.update(policy.id, policyIn(draft)) : escalationsApi.create(policyIn(draft))),
    onSuccess: async (out) => {
      await queryClient.invalidateQueries({ queryKey: escalationKeys.all });
      toast.success(policy ? `Saved ${out.name}` : `Created ${out.name}`);
      onClose();
    },
    onError: (e) => setFormError(errorMessage(e)),
  });
  const submit = () => {
    setFormError(null);
    const v = validatePolicy(draft);
    setErrors(v);
    if (Object.keys(v).length === 0) save.mutate();
  };
  const err = (k: keyof PolicyErrors) => ({ validationMessage: errors[k], validationState: errors[k] ? ("error" as const) : ("none" as const) });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{policy ? "Edit escalation policy" : "New escalation policy"}</DialogTitle>
          <DialogContent>
            <div className={styles.form}>
              <ErrorBar message={formError} />
              <Field label="Name" required {...err("name")}>
                <Input value={draft.name} maxLength={200} onChange={(_, d) => set({ name: d.value })} />
              </Field>
              <div className={styles.row}>
                <Field label="Escalate after" required {...err("afterValue")}>
                  <SpinButton
                    min={1}
                    value={Number(draft.afterValue) || 0}
                    displayValue={draft.afterValue}
                    onChange={(_, d) => set({ afterValue: d.value != null ? String(d.value) : (d.displayValue ?? "") })}
                  />
                </Field>
                <Field label="Unit">
                  <Dropdown value={UNIT_LABELS[draft.afterUnit]} selectedOptions={[draft.afterUnit]} onOptionSelect={(_, d) => set({ afterUnit: d.optionValue as AfterUnit })}>
                    {(Object.keys(UNIT_LABELS) as AfterUnit[]).map((u) => (
                      <Option key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>
              <Field label="Action">
                <RadioGroup layout="horizontal" value={draft.action} onChange={(_, d) => set({ action: d.value as PolicyDraft["action"] })}>
                  <Radio value="notify" label="Notify" />
                  <Radio value="reassign" label="Reassign the step or task" />
                </RadioGroup>
              </Field>
              <Field label="Escalate to" {...err("target")}>
                <Dropdown
                  value={TARGET_LABELS[draft.targetKind]}
                  selectedOptions={[draft.targetKind]}
                  onOptionSelect={(_, d) => set({ targetKind: d.optionValue as EscalationTargetKind, targetUserId: null, targetRoleId: null })}
                >
                  {(Object.keys(TARGET_LABELS) as EscalationTargetKind[]).map((k) => (
                    <Option key={k} value={k}>
                      {TARGET_LABELS[k]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {draft.targetKind === "named_user" && <UserPicker label="User" value={draft.targetUserId} onChange={(id) => set({ targetUserId: id })} />}
              {draft.targetKind === "role" && (
                <Field label="Role">
                  <Dropdown
                    placeholder="Choose a role"
                    value={roles.data?.find((r) => r.id === draft.targetRoleId)?.name ?? ""}
                    selectedOptions={draft.targetRoleId ? [draft.targetRoleId] : []}
                    onOptionSelect={(_, d) => set({ targetRoleId: d.optionValue ?? null })}
                  >
                    {(roles.data ?? []).map((r) => (
                      <Option key={r.id} value={r.id}>
                        {r.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              )}
              {draft.targetKind === "assignee_manager" && (
                <Text size={200} className={styles.summary}>
                  Team leads of the assignee&apos;s teams. When nobody leads them, Tenant Admins are notified instead.
                </Text>
              )}
              <Checkbox checked={draft.repeat} label="Repeat while still pending" onChange={(_, d) => set({ repeat: !!d.checked })} />
              {draft.repeat && (
                <div className={styles.row}>
                  <Field label={`Every (${UNIT_LABELS[draft.afterUnit].toLowerCase()})`} {...err("repeatEvery")}>
                    <SpinButton
                      min={1}
                      value={Number(draft.repeatEvery) || 0}
                      displayValue={draft.repeatEvery}
                      onChange={(_, d) => set({ repeatEvery: d.value != null ? String(d.value) : (d.displayValue ?? "") })}
                    />
                  </Field>
                  <Field label="Repeat times" {...err("maxRepeats")}>
                    <SpinButton
                      min={1}
                      max={4}
                      value={Number(draft.maxRepeats) || 0}
                      displayValue={draft.maxRepeats}
                      onChange={(_, d) => set({ maxRepeats: d.value != null ? String(d.value) : (d.displayValue ?? "") })}
                    />
                  </Field>
                </div>
              )}
              <Switch checked={draft.notifyOriginal} label="Also notify the current assignee" onChange={(_, d) => set({ notifyOriginal: d.checked })} />
              <Switch checked={draft.isActive} label="Active" onChange={(_, d) => set({ isActive: d.checked })} />
              <Text className={styles.summary}>{describePolicy(draft)}. Escalations never approve, reject or close anything.</Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              {policy ? "Save" : "Create policy"}
            </Button>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** `/admin/escalations` (Epic 32 B3): reusable escalation policies for approval steps, workflow approvals and tasks. */
export function EscalationPoliciesAdmin() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("sla:read");
  const canManage = usePermission("sla:manage");
  const [showArchived, setShowArchived] = useState(false);
  const policies = usePolicies(showArchived);
  const [editing, setEditing] = useState<EscalationPolicyOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<EscalationPolicyOut | null>(null);
  if (!canRead) return <NoAccess what="escalation policies" />;

  const columns: TableColumnDefinition<EscalationPolicyOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (p) => (
        <TableCellLayout truncate description={p.summary}>
          {p.name}
        </TableCellLayout>
      ),
    }),
    createTableColumn({ columnId: "action", renderHeaderCell: () => "Action", renderCell: (p) => ACTION_LABELS[p.action] }),
    createTableColumn({ columnId: "target", renderHeaderCell: () => "Escalate to", renderCell: (p) => TARGET_LABELS[p.target_kind] }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) => (
        <Badge appearance="tint" color={p.archived_at ? "subtle" : p.is_active ? "success" : "warning"}>
          {p.archived_at ? "Archived" : p.is_active ? "Active" : "Off"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (p) =>
        canManage && !p.archived_at ? (
          <RowActions
            label={p.name ?? "policy"}
            actions={[
              { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(p) },
              { label: "Archive", icon: <Archive20Regular />, onClick: () => setArchiving(p) },
            ]}
          />
        ) : null,
    }),
  ];

  return (
    <>
      <PageHeader
        title="Escalations"
        subtitle="When an approval step or task waits too long, notify someone or reassign it. Attach policies to approval-chain steps, workflow approvals and workflow tasks."
      />
      <div className={admin.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            New policy
          </Button>
        )}
        <Switch checked={showArchived} label="Show archived" onChange={(_, d) => setShowArchived(d.checked)} />
      </div>
      <AdminGrid
        items={policies.data}
        columns={columns}
        getRowId={(p) => p.id}
        loading={policies.isPending}
        error={policies.error}
        emptyText="No escalation policies yet."
        label="Escalation policies"
        columnSizing={{
          name: { minWidth: 220, idealWidth: 360 },
          action: { minWidth: 90, idealWidth: 100 },
          target: { minWidth: 160, idealWidth: 200 },
          status: { minWidth: 90, idealWidth: 100 },
          actions: { minWidth: 56, idealWidth: 64 },
        }}
      />
      {editing && <PolicyDialog key={editing === "new" ? "new" : editing.id} policy={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title="Archive this policy?"
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          try {
            await escalationsApi.archive(archiving!.id);
            await queryClient.invalidateQueries({ queryKey: escalationKeys.all });
            toast.success(`Archived ${archiving!.name}`);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Running escalations started from this policy stop, and approval-chain steps using it no longer escalate.
      </ConfirmDialog>
    </>
  );
}
