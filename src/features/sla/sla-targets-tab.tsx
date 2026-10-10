"use client";

import {
  Badge,
  Button,
  Combobox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  mergeClasses,
  Option,
  OptionGroup,
  Spinner,
  SpinButton,
  Subtitle2,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { slaApi, slaKeys } from "./api";
import {
  emptyTarget,
  groupTargets,
  hoursText,
  humanize,
  PRIORITY_OPTIONS,
  SCOPE_LABELS,
  scopeText,
  type TargetDraft,
  targetDraft,
  type TargetErrors,
  targetIn,
  validateTarget,
} from "./sla-model";
import type { GenericSlaTargetOut, SlaMilestoneOut } from "./types";
import { useSlaMilestones, useSlaTargets } from "./use-sla-targets";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px" },
  group: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", "& > *": { flex: "1 1 180px" } },
  muted: { color: tokens.colorNeutralForeground3 },
  unavailable: { opacity: 0.7 },
});

function key(m: Pick<SlaMilestoneOut, "subject_type" | "milestone">): string {
  return `${m.subject_type}:${m.milestone}`;
}

function TargetDialog({
  target,
  milestones,
  onClose,
}: {
  target: GenericSlaTargetOut | null;
  milestones: readonly SlaMilestoneOut[];
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TargetDraft>(() => (target ? targetDraft(target) : emptyTarget(milestones.find((m) => m.available))));
  const [errors, setErrors] = useState<TargetErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const milestone = milestones.find((m) => m.subject_type === draft.subjectType && m.milestone === draft.milestone);
  const set = (patch: Partial<TargetDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const bySubject = useMemo(() => {
    const out = new Map<string, SlaMilestoneOut[]>();
    for (const m of milestones) out.set(m.subject_type, [...(out.get(m.subject_type) ?? []), m]);
    return [...out.entries()];
  }, [milestones]);

  const save = useMutation({
    mutationFn: () => {
      const body = targetIn(draft);
      if (!target) return slaApi.createTarget(body);
      return slaApi.updateTarget(target.id, {
        scope: body.scope,
        priority: body.priority,
        target_hours: body.target_hours,
        at_risk_percent: body.at_risk_percent,
        calendar: body.calendar,
        is_active: body.is_active,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: slaKeys.targets });
      toast.success(target ? "SLA target saved" : "SLA target added");
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "sla_target_exists") setFormError("A target for this milestone, scope and priority already exists.");
      else setFormError(errorMessage(e));
    },
  });

  const submit = () => {
    setFormError(null);
    const v = validateTarget(draft, milestone);
    setErrors(v);
    if (Object.keys(v).length === 0) save.mutate();
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{target ? "Edit SLA target" : "Add SLA target"}</DialogTitle>
          <DialogContent>
            <div className={styles.form}>
              <ErrorBar message={formError} />
              <Field label="Milestone" required validationMessage={errors.milestone} validationState={errors.milestone ? "error" : "none"}>
                <Dropdown
                  disabled={!!target}
                  placeholder="Choose a milestone"
                  value={milestone?.label ?? ""}
                  selectedOptions={draft.milestone ? [key({ subject_type: draft.subjectType, milestone: draft.milestone })] : []}
                  onOptionSelect={(_, d) => {
                    const m = milestones.find((x) => key(x) === d.optionValue);
                    if (m) set({ subjectType: m.subject_type, milestone: m.milestone, scopeKey: null, scopeValue: "", calendar: m.calendar === "calendar" ? "calendar" : "business" });
                  }}
                >
                  {bySubject.map(([subject, items]) => (
                    <OptionGroup key={subject} label={humanize(subject)}>
                      {items.map((m) => (
                        <Option key={key(m)} value={key(m)} text={m.label} disabled={!m.available}>
                          {m.available ? m.label : `${m.label} (available once Epic ${m.owner_epic ?? "?"} ships)`}
                        </Option>
                      ))}
                    </OptionGroup>
                  ))}
                </Dropdown>
              </Field>
              <div className={styles.row}>
                <Field label="Scope" hint="Most specific target wins: scope, then priority, then all.">
                  <Dropdown
                    value={draft.scopeKey ? SCOPE_LABELS[draft.scopeKey] ?? humanize(draft.scopeKey) : "All"}
                    selectedOptions={[draft.scopeKey ?? ""]}
                    disabled={!milestone || milestone.scope_keys.length === 0}
                    onOptionSelect={(_, d) => set({ scopeKey: d.optionValue || null, scopeValue: "" })}
                  >
                    <Option value="" text="All">
                      All
                    </Option>
                    {(milestone?.scope_keys ?? []).map((k) => (
                      <Option key={k} value={k} text={SCOPE_LABELS[k] ?? humanize(k)}>
                        {SCOPE_LABELS[k] ?? humanize(k)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                {draft.scopeKey && (
                  <Field
                    label={SCOPE_LABELS[draft.scopeKey] ?? humanize(draft.scopeKey)}
                    required
                    validationMessage={errors.scope}
                    validationState={errors.scope ? "error" : "none"}
                  >
                    <Combobox
                      freeform
                      placeholder="Search or paste the ID"
                      value={draft.scopeValue}
                      onChange={(e) => set({ scopeValue: e.target.value })}
                      onOptionSelect={(_, d) => set({ scopeValue: d.optionValue ?? "" })}
                    >
                      {draft.scopeValue ? (
                        <Option value={draft.scopeValue} text={draft.scopeValue}>
                          {draft.scopeValue}
                        </Option>
                      ) : (
                        <Option value="" text="" disabled>
                          Type an ID
                        </Option>
                      )}
                    </Combobox>
                  </Field>
                )}
              </div>
              <div className={styles.row}>
                <Field label="Priority">
                  <Dropdown
                    value={draft.priority ? humanize(draft.priority) : "Any"}
                    selectedOptions={[draft.priority ?? ""]}
                    onOptionSelect={(_, d) => set({ priority: (d.optionValue || null) as TargetDraft["priority"] })}
                  >
                    <Option value="" text="Any">
                      Any
                    </Option>
                    {PRIORITY_OPTIONS.map((p) => (
                      <Option key={p} value={p} text={humanize(p)}>
                        {humanize(p)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Clock">
                  <Dropdown
                    value={draft.calendar === "business" ? "Business hours" : "Calendar hours"}
                    selectedOptions={[draft.calendar]}
                    onOptionSelect={(_, d) => set({ calendar: d.optionValue === "calendar" ? "calendar" : "business" })}
                  >
                    <Option value="business">Business hours</Option>
                    <Option value="calendar">Calendar hours</Option>
                  </Dropdown>
                </Field>
              </div>
              <div className={styles.row}>
                <Field label="Target (hours)" required validationMessage={errors.targetHours} validationState={errors.targetHours ? "error" : "none"}>
                  <SpinButton
                    min={0}
                    max={8760}
                    step={1}
                    value={Number(draft.targetHours) || 0}
                    displayValue={draft.targetHours}
                    onChange={(_, d) => set({ targetHours: d.value != null ? String(d.value) : (d.displayValue ?? "") })}
                  />
                </Field>
                <Field label="At risk at (%)" required validationMessage={errors.atRiskPercent} validationState={errors.atRiskPercent ? "error" : "none"}>
                  <SpinButton
                    min={1}
                    max={99}
                    value={Number(draft.atRiskPercent) || 0}
                    displayValue={draft.atRiskPercent}
                    onChange={(_, d) => set({ atRiskPercent: d.value != null ? String(d.value) : (d.displayValue ?? "") })}
                  />
                </Field>
              </div>
              <Switch checked={draft.isActive} label="Active" onChange={(_, d) => set({ isActive: d.checked })} />
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              {target ? "Save" : "Add target"}
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

/** Phase 2 tab of `/admin/sla`: generic SLA targets grouped by subject type (Epic 32 B2). */
export function SlaTargetsTab() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("sla:manage");
  const targets = useSlaTargets();
  const milestones = useSlaMilestones();
  const [editing, setEditing] = useState<GenericSlaTargetOut | "new" | null>(null);
  const [deleting, setDeleting] = useState<GenericSlaTargetOut | null>(null);
  const labels = new Map((milestones.data ?? []).map((m) => [key(m), m.label]));
  const groups = groupTargets(targets.data ?? []);

  const columns: TableColumnDefinition<GenericSlaTargetOut>[] = [
    createTableColumn({
      columnId: "milestone",
      renderHeaderCell: () => "Milestone",
      renderCell: (t) => <TableCellLayout truncate>{labels.get(key(t)) ?? humanize(t.milestone)}</TableCellLayout>,
    }),
    createTableColumn({ columnId: "scope", renderHeaderCell: () => "Scope", renderCell: (t) => scopeText(t) }),
    createTableColumn({ columnId: "priority", renderHeaderCell: () => "Priority", renderCell: (t) => (t.priority ? humanize(t.priority) : "Any") }),
    createTableColumn({ columnId: "target", renderHeaderCell: () => "Target", renderCell: (t) => hoursText(t.target_hours) }),
    createTableColumn({ columnId: "clock", renderHeaderCell: () => "Clock", renderCell: (t) => (t.calendar === "business" ? "Business" : "Calendar") }),
    createTableColumn({ columnId: "risk", renderHeaderCell: () => "At-risk %", renderCell: (t) => `${t.at_risk_percent}%` }),
    createTableColumn({
      columnId: "available",
      renderHeaderCell: () => "Available",
      renderCell: (t) => (
        <Tooltip content={t.available ? "The owning module records these clocks." : "Saved now; clocks start once the owning module ships."} relationship="description">
          <Badge appearance="tint" color={t.available ? (t.is_active ? "success" : "subtle") : "warning"}>
            {!t.available ? "Not yet" : t.is_active ? "Active" : "Off"}
          </Badge>
        </Tooltip>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (t) =>
        canManage ? (
          <RowActions
            label={labels.get(key(t)) ?? t.milestone}
            actions={[
              { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(t) },
              { label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(t) },
            ]}
          />
        ) : null,
    }),
  ];

  return (
    <div className={styles.root}>
      <Text className={styles.muted}>
        Targets for Phase 2 records such as vendor submissions, BGV checks, timesheets, invoices and disputes. Clocks turn At risk at the
        percentage you set and Breached at the target; the people each module names are notified once per change.
      </Text>
      {canManage && (
        <div className={admin.toolbar}>
          <Button appearance="primary" icon={<Add20Regular />} disabled={!milestones.data} onClick={() => setEditing("new")}>
            Add target
          </Button>
        </div>
      )}
      <ErrorBar message={milestones.error ? errorMessage(milestones.error) : null} />
      {groups.length === 0 && !targets.isPending ? (
        <AdminGrid items={[]} columns={columns} getRowId={(t) => t.id} loading={false} error={targets.error} emptyText="No Phase 2 SLA targets yet." label="SLA targets" />
      ) : (
        groups.map((g) => (
          <section key={g.subjectType} className={mergeClasses(styles.group)} aria-label={g.label}>
            <Subtitle2 as="h2">{g.label}</Subtitle2>
            <AdminGrid
              items={g.rows}
              columns={columns}
              getRowId={(t) => t.id}
              loading={targets.isPending}
              error={targets.error}
              emptyText="No targets."
              label={`${g.label} SLA targets`}
            />
          </section>
        ))
      )}
      {editing && milestones.data && (
        <TargetDialog target={editing === "new" ? null : editing} milestones={milestones.data} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete SLA target?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await slaApi.deleteTarget(deleting!.id);
            await queryClient.invalidateQueries({ queryKey: slaKeys.targets });
            toast.success("SLA target deleted");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Clocks already running keep the target they started with.
      </ConfirmDialog>
    </div>
  );
}
