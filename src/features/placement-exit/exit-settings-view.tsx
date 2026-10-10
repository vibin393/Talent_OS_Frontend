"use client";

import {
  Body1,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { exitApi, exitKeys } from "./api";
import { CASE_REASON_LABELS, exitErrorMessage, OWNER_ROLE_LABELS, templateErrors } from "./logic";
import type { CaseReason, ExitSettingsOut, OwnerRole, TemplateItem, TemplateOut } from "./types";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  table: { minWidth: "760px" },
  scroll: { overflowX: "auto" },
  small: { width: "90px" },
  reasons: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM },
});

const ROLES = Object.keys(OWNER_ROLE_LABELS) as OwnerRole[];
const REASONS = Object.keys(CASE_REASON_LABELS) as CaseReason[];

function TemplateEditor({ template, onDone }: { template: TemplateOut | null; onDone: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [name, setName] = useState(template?.name ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [items, setItems] = useState<TemplateItem[]>(
    template?.items ?? [{ kind: "", label: "", mandatory: true, owner_role: "account_manager", due_offset_days: 0 }],
  );
  const problem = templateErrors(name, items);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), is_default: isDefault, items };
      return template ? exitApi.updateTemplate(template.id, body) : exitApi.createTemplate(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: exitKeys.templates });
      toast.success("Template saved");
      onDone();
    },
    onError: (e) => toast.error(exitErrorMessage(e)),
  });
  const patch = (i: number, p: Partial<TemplateItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <Card className={styles.card}>
      <div className={styles.row}>
        <Field label="Template name" required>
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Switch checked={isDefault} onChange={(_, d) => setIsDefault(d.checked)} label="Default template" />
      </div>
      <div className={styles.scroll}>
        <Table className={styles.table} aria-label="Checklist items">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Kind</TableHeaderCell>
              <TableHeaderCell>Label</TableHeaderCell>
              <TableHeaderCell>Mandatory</TableHeaderCell>
              <TableHeaderCell>Owner role</TableHeaderCell>
              <TableHeaderCell>Due offset (days)</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input aria-label="Kind" value={it.kind} disabled={!!it.verifier} onChange={(_, d) => patch(i, { kind: d.value })} />
                </TableCell>
                <TableCell>
                  <Input aria-label="Label" value={it.label} onChange={(_, d) => patch(i, { label: d.value })} />
                </TableCell>
                <TableCell>
                  <Checkbox aria-label="Mandatory" checked={it.mandatory} onChange={(_, d) => patch(i, { mandatory: !!d.checked })} />
                </TableCell>
                <TableCell>
                  <Dropdown
                    aria-label="Owner role"
                    value={OWNER_ROLE_LABELS[it.owner_role]}
                    selectedOptions={[it.owner_role]}
                    onOptionSelect={(_, d) => patch(i, { owner_role: (d.optionValue as OwnerRole) ?? "account_manager" })}
                  >
                    {ROLES.map((r) => (
                      <Option key={r} value={r}>
                        {OWNER_ROLE_LABELS[r]}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label="Due offset days"
                    className={styles.small}
                    type="number"
                    value={String(it.due_offset_days)}
                    onChange={(_, d) => patch(i, { due_offset_days: Number(d.value || 0) })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    appearance="subtle"
                    aria-label="Remove item"
                    icon={<Delete20Regular />}
                    onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className={styles.row}>
        <Button
          icon={<Add20Regular />}
          onClick={() => setItems((xs) => [...xs, { kind: "", label: "", mandatory: false, owner_role: "account_manager", due_offset_days: 0 }])}
        >
          Add item
        </Button>
      </div>
      {problem && <Body1>{problem}</Body1>}
      <div className={styles.row}>
        <Button appearance="primary" disabled={!!problem || save.isPending} onClick={() => save.mutate()}>
          Save template
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

function SettingsForm({ settings }: { settings: ExitSettingsOut }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [offsets, setOffsets] = useState(settings.alert_offsets_days.join(", "));
  const [notify, setNotify] = useState(settings.notify_client_users);
  const [excluded, setExcluded] = useState<string[]>(settings.bench_excluded_reasons);
  const [attrition, setAttrition] = useState(String(settings.early_attrition_days));
  const [grace, setGrace] = useState(String(settings.auto_case_grace_days));
  const parsed = offsets
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  const offsetsOk = parsed.length <= 6 && parsed.every((n) => Number.isInteger(n) && n >= 1 && n <= 365);
  const save = useMutation({
    mutationFn: () =>
      exitApi.updateSettings({
        alert_offsets_days: parsed,
        notify_client_users: notify,
        bench_excluded_reasons: excluded as CaseReason[],
        early_attrition_days: Number(attrition),
        auto_case_grace_days: Number(grace),
      }),
    onSuccess: (data) => {
      qc.setQueryData(exitKeys.settings, data);
      toast.success("Exit settings saved");
    },
    onError: (e) => toast.error(exitErrorMessage(e)),
  });
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Exit settings</Subtitle2>
      <Field label="Ending-soon alert offsets (days before end, comma separated)" validationMessage={offsetsOk ? undefined : "Up to 6 values between 1 and 365."}>
        <Input value={offsets} onChange={(_, d) => setOffsets(d.value)} />
      </Field>
      <Switch checked={notify} onChange={(_, d) => setNotify(d.checked)} label="Notify client users of ending placements" />
      <Field label="Reasons excluded from the bench">
        <div className={styles.reasons}>
          {REASONS.map((r) => (
            <Checkbox
              key={r}
              label={CASE_REASON_LABELS[r]}
              checked={excluded.includes(r)}
              onChange={(_, d) => setExcluded((xs) => (d.checked ? [...xs, r] : xs.filter((x) => x !== r)))}
            />
          ))}
        </div>
      </Field>
      <div className={styles.row}>
        <Field label="Early attrition within (days)">
          <Input type="number" min={0} max={365} value={attrition} onChange={(_, d) => setAttrition(d.value)} />
        </Field>
        <Field label="Auto end-of-term case grace (days)">
          <Input type="number" min={0} max={60} value={grace} onChange={(_, d) => setGrace(d.value)} />
        </Field>
      </div>
      <div>
        <Button appearance="primary" disabled={!offsetsOk || save.isPending} onClick={() => save.mutate()}>
          Save settings
        </Button>
      </div>
    </Card>
  );
}

/** `/settings/offboarding`: checklist templates and exit settings. */
export function ExitSettingsView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const canConfigure = usePermission("offboarding:configure");
  const [editing, setEditing] = useState<TemplateOut | "new" | null>(null);
  const settings = useQuery({ queryKey: exitKeys.settings, queryFn: ({ signal }) => exitApi.settings(signal), enabled: canConfigure });
  const templates = useQuery({ queryKey: exitKeys.templates, queryFn: ({ signal }) => exitApi.templates(signal), enabled: canConfigure });
  if (!canConfigure) return <NoAccess what="offboarding settings" />;
  return (
    <div className={styles.stack}>
      <PageHeader title="Offboarding" subtitle="Checklist templates, alerts and bench rules for placement exits." />
      {settings.isError && <ErrorBar message={exitErrorMessage(settings.error)} />}
      {settings.isPending ? <Spinner label="Loading settings" /> : settings.data && <SettingsForm settings={settings.data} />}
      <Subtitle2 as="h2">Checklist templates</Subtitle2>
      {templates.isError && <ErrorBar message={exitErrorMessage(templates.error)} />}
      {editing ? (
        <TemplateEditor key={editing === "new" ? "new" : editing.id} template={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <>
          {(templates.data ?? []).map((t) => (
            <Card key={t.id} className={styles.card}>
              <div className={styles.row}>
                <Subtitle2>
                  {t.name}
                  {t.is_default ? " (default)" : ""}
                </Subtitle2>
                <Body1 className={admin.muted}>{t.items.length} items</Body1>
                <Button onClick={() => setEditing(t)}>Edit</Button>
              </div>
            </Card>
          ))}
          <div>
            <Button icon={<Add20Regular />} onClick={() => setEditing("new")}>
              New template
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
