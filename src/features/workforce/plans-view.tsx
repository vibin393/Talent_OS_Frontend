"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
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
  Link,
  makeStyles,
  Option,
  SearchBox,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Copy20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate } from "@/features/commercials/format";
import { ClientPicker } from "@/features/demands/client-picker";
import { useDebounced } from "@/lib/use-debounced";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { workforceApi } from "./api";
import { copyPeriodEnd, displayMoney, PERM_APPROVE, PERM_READ, PERM_WRITE, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS } from "./logic";
import type { PlanCreate, PlanFilters, PlanOut, PlanStatus } from "./types";
import { usePlans, useRefreshWorkforce, useWorkforceSettings } from "./use-workforce";

const useStyles = makeStyles({
  num: { fontVariantNumeric: "tabular-nums" },
  settings: { padding: tokens.spacingHorizontalL, marginTop: tokens.spacingVerticalXL, maxWidth: "640px" },
  settingsRow: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
});

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <Badge appearance="tint" color={PLAN_STATUS_COLORS[status]}>
      {PLAN_STATUS_LABELS[status]}
    </Badge>
  );
}

/** `/workforce`: plans with status / origin filters, search, New plan and Copy plan dialogs. */
export function PlansView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const refresh = useRefreshWorkforce();
  const canRead = usePermission(PERM_READ);
  const canWrite = usePermission(PERM_WRITE);
  const canApprove = usePermission(PERM_APPROVE);
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [creating, setCreating] = useState(false);
  const [copying, setCopying] = useState<PlanOut | null>(null);
  const [deleting, setDeleting] = useState<PlanOut | null>(null);
  const filters: PlanFilters = { status: status || undefined, origin: origin || undefined, q: debouncedQ.trim() || undefined };
  const list = usePlans(filters, canRead);
  if (!canRead) return <NoAccess what="workforce plans" />;

  const columns: TableColumnDefinition<PlanOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Plan",
      renderCell: (p) => (
        <span className={admin.cellStack}>
          <Link as="button" onClick={() => router.push(`/workforce/${p.id}`)}>
            {p.name}
          </Link>
          <Text size={200} className={admin.muted}>
            {p.fiscal_label ?? `${formatDate(p.period_start)} – ${formatDate(p.period_end)}`}
          </Text>
        </span>
      ),
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (p) => p.client_name ?? "Internal" }),
    createTableColumn({
      columnId: "origin",
      renderHeaderCell: () => "Origin",
      renderCell: (p) =>
        p.origin === "client_forecast" ? (
          <Badge appearance="outline" color="brand">
            Client forecast
          </Badge>
        ) : (
          "Internal"
        ),
    }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (p) => p.owner_name ?? "—" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (p) => <PlanStatusBadge status={p.status} /> }),
    createTableColumn({
      columnId: "headcount",
      renderHeaderCell: () => "Headcount",
      renderCell: (p) => <span className={styles.num}>{`${p.total_headcount} · ${p.line_count} lines`}</span>,
    }),
    createTableColumn({
      columnId: "budget",
      renderHeaderCell: () => "Budget",
      renderCell: (p) => <span className={styles.num}>{displayMoney(p.total_budget, p.currency)}</span>,
    }),
    createTableColumn({
      columnId: "slots",
      renderHeaderCell: () => "Slots (open / req / filled)",
      renderCell: (p) => <span className={styles.num}>{`${p.slots.open} / ${p.slots.requisitioned} / ${p.slots.filled}`}</span>,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (p) => (
        <span/* NOSONAR */ onClick={(e) => e.stopPropagation()}>
          <RowActions
            label={p.name}
            actions={
              canWrite
                ? [
                    { label: "Copy plan", icon: <Copy20Regular />, onClick: () => setCopying(p) },
                    ...(p.status === "draft" ? [{ label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(p) }] : []),
                  ]
                : []
            }
          />
        </span>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Workforce planning" subtitle="Headcount plans, budgets, approvals and plan vs actual" />
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search plans" value={q} onChange={(_, d) => setQ(d.value)} aria-label="Search plans" />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? PLAN_STATUS_LABELS[status as PlanStatus] : "All statuses"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
        >
          <Option value="">All statuses</Option>
          {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
            <Option key={s} value={s}>
              {PLAN_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          className={admin.filter}
          aria-label="Origin"
          value={origin === "internal" ? "Internal" : origin === "client_forecast" ? "Client forecasts" : "All origins"}
          selectedOptions={[origin]}
          onOptionSelect={(_, d) => setOrigin(d.optionValue ?? "")}
        >
          <Option value="">All origins</Option>
          <Option value="internal">Internal</Option>
          <Option value="client_forecast">Client forecasts</Option>
        </Dropdown>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New plan
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(p) => p.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No workforce plans match these filters."
        label="Workforce plans"
        onRowClick={(p) => router.push(`/workforce/${p.id}`)}
      />
      {canApprove && <SettingsCard />}
      {creating && (
        <CreatePlanDialog
          onClose={() => setCreating(false)}
          onCreated={async (p) => {
            await refresh();
            router.push(`/workforce/${p.id}`);
          }}
        />
      )}
      {copying && (
        <CopyPlanDialog
          plan={copying}
          onClose={() => setCopying(null)}
          onCopied={async (p) => {
            await refresh();
            router.push(`/workforce/${p.id}`);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete plan?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await workforceApi.remove(deleting!.id);
            toast.success("Plan deleted");
            await refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
          setDeleting(null);
        }}
      >
        {deleting?.name} and its lines will be deleted.
      </ConfirmDialog>
    </>
  );
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function CreatePlanDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (p: PlanOut) => Promise<void> }) {
  const admin = useAdminStyles();
  const [form, setForm] = useState<PlanCreate>({ name: "", period_start: "", period_end: "", client_id: null, currency: "", notes: "" });
  const [clientLabel, setClientLabel] = useState<string | undefined>();
  const set = <K extends keyof PlanCreate>(k: K, v: PlanCreate[K]) => setForm((f) => ({ ...f, [k]: v }));
  const create = useMutation({
    mutationFn: () =>
      workforceApi.create({
        name: form.name.trim(),
        period_start: form.period_start,
        period_end: form.period_end,
        client_id: form.client_id || null,
        currency: blank(form.currency)?.toUpperCase() ?? null,
        notes: blank(form.notes),
      }),
    onSuccess: onCreated,
  });
  const errors = fieldErrors(create.error);
  const periodError = form.period_start && form.period_end && form.period_end <= form.period_start ? "End must be after the start" : undefined;
  const valid = !!form.name.trim() && !!form.period_start && !!form.period_end && !periodError;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New workforce plan</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={create.error && !Object.keys(errors).length ? errorMessage(create.error) : null} />
              <Field label="Name" required validationMessage={errors.name}>
                <Input value={form.name} onChange={(_, d) => set("name", d.value)} placeholder="e.g. FY 27-28 Engineering" />
              </Field>
              <Field label="Period start" required validationMessage={errors.period_start}>
                <Input type="date" value={form.period_start} onChange={(_, d) => set("period_start", d.value)} />
              </Field>
              <Field label="Period end" required validationMessage={periodError ?? errors.period_end}>
                <Input type="date" value={form.period_end} onChange={(_, d) => set("period_end", d.value)} />
              </Field>
              <ClientPicker
                label="Client (optional)"
                value={form.client_id ?? null}
                valueLabel={clientLabel}
                clearLabel="Internal plan (no client)"
                onChange={(c) => {
                  set("client_id", c?.id ?? null);
                  setClientLabel(c?.name);
                }}
              />
              <Field label="Currency" hint="Defaults to the tenant currency" validationMessage={errors.currency}>
                <Input value={form.currency ?? ""} maxLength={3} onChange={(_, d) => set("currency", d.value.toUpperCase())} placeholder="INR" />
              </Field>
              <Field label="Notes">
                <Textarea value={form.notes ?? ""} onChange={(_, d) => set("notes", d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
              Create plan
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Copy a plan to a new period: every line month moves by the offset between the two period starts. */
export function CopyPlanDialog({ plan, onClose, onCopied }: { plan: PlanOut; onClose: () => void; onCopied: (p: PlanOut) => Promise<void> }) {
  const admin = useAdminStyles();
  const [name, setName] = useState(`${plan.name} (copy)`);
  const [start, setStart] = useState("");
  const copy = useMutation({ mutationFn: () => workforceApi.copy(plan.id, { name: name.trim(), period_start: start }), onSuccess: onCopied });
  const errors = fieldErrors(copy.error);
  let preview: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    preview = `New period ${formatDate(start)} – ${formatDate(copyPeriodEnd(plan.period_start, plan.period_end, start))}; line months shift accordingly.`;
  }
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Copy "${plan.name}"`}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={copy.error && !Object.keys(errors).length ? errorMessage(copy.error) : null} />
              <Field label="Name" required validationMessage={errors.name}>
                <Input value={name} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="New period start" required validationMessage={errors.period_start} hint={preview ?? undefined}>
                <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!name.trim() || !start || copy.isPending} onClick={() => copy.mutate()}>
              Copy plan
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Workforce settings (approvers): standard hours / days per month and the per-line headcount cap. */
function SettingsCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const q = useWorkforceSettings();
  const [draft, setDraft] = useState<{ hours: string; days: string; max: string } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      workforceApi.saveSettings({
        standard_hours_per_month: draft!.hours.trim(),
        standard_days_per_month: draft!.days.trim(),
        max_headcount_per_line: Number(draft!.max),
      }),
    onSuccess: async () => {
      toast.success("Workforce settings saved");
      setDraft(null);
      await q.refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!q.data) return null;
  const v = draft ?? { hours: q.data.standard_hours_per_month, days: q.data.standard_days_per_month, max: String(q.data.max_headcount_per_line) };
  const set = (k: keyof typeof v, val: string) => setDraft({ ...v, [k]: val });
  const valid = /^\d+(\.\d{1,2})?$/.test(v.hours.trim()) && /^\d+(\.\d{1,2})?$/.test(v.days.trim()) && /^\d+$/.test(v.max) && Number(v.max) >= 1 && Number(v.max) <= 500;
  return (
    <Card className={styles.settings}>
      <CardHeader header={<Subtitle2 as="h2">Workforce settings</Subtitle2>} description="Used to convert bill rates into monthly committed cost." />
      <div className={styles.settingsRow}>
        <Field label="Hours per month">
          <Input value={v.hours} onChange={(_, d) => set("hours", d.value)} inputMode="decimal" />
        </Field>
        <Field label="Days per month">
          <Input value={v.days} onChange={(_, d) => set("days", d.value)} inputMode="decimal" />
        </Field>
        <Field label="Max headcount per line">
          <Input value={v.max} onChange={(_, d) => set("max", d.value)} inputMode="numeric" />
        </Field>
        <Button appearance="primary" disabled={!draft || !valid || save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
    </Card>
  );
}
