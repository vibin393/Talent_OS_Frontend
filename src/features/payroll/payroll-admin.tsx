"use client";

import {
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDown20Regular, ArrowUp20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import { mappingErrors, moveColumn, payrollErrorMessage } from "./format";
import type { FileFormat, LateItemMapping, MappingColumn, MappingOut, PayrollWorkerType } from "./types";
import { usePayCalendar, usePayrollMappings, usePayrollSettings } from "./use-payroll-mappings";

const useStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  colRow: { display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", gap: tokens.spacingHorizontalS, alignItems: "center" },
  excluded: { opacity: 0.55 },
  placeholderField: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

/** `/admin/payroll`: pay calendars per Legal Entity, file mapping templates, connector, settings. */
export function PayrollAdmin() {
  const canConfigure = usePermission("payroll:configure");
  if (!canConfigure) return <NoAccess what="payroll configuration" />;
  return (
    <>
      <PageHeader title="Payroll" subtitle="Pay calendars, payroll file mappings, the payroll connector and late-item rules" />
      <CalendarCard />
      <SettingsCard />
      <MappingsCard />
    </>
  );
}

function CalendarCard() {
  const styles = useStyles();
  const entities = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal) });
  const [picked, setPicked] = useState<string | null>(null);
  const le = picked ?? entities.data?.[0]?.id ?? null;
  const { query, connector, save, setConnector } = usePayCalendar(le);
  const [cutoffEdit, setCutoff] = useState<string | null>(null);
  const cutoff = cutoffEdit ?? String(query.data?.cutoff_day ?? "last");
  const [from, setFrom] = useState("");
  return (
    <section className={styles.card} aria-label="Pay calendar">
      <Text weight="semibold">Pay calendar</Text>
      <div className={styles.row}>
        <Field label="Legal entity">
          <Dropdown
            selectedOptions={le ? [le] : []}
            value={entities.data?.find((e) => e.id === le)?.name ?? ""}
            onOptionSelect={(_, d) => {
              setPicked(d.optionValue ?? null);
              setCutoff(null);
            }}
          >
            {(entities.data ?? []).map((e) => (
              <Option key={e.id} value={e.id}>
                {e.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Cut-off day" hint="Monthly; 'Last day' = calendar month">
          <Dropdown
            selectedOptions={[cutoff]}
            value={cutoff === "last" ? "Last day of month" : `Day ${cutoff}`}
            onOptionSelect={(_, d) => setCutoff(d.optionValue ?? "last")}
          >
            <Option value="last">Last day of month</Option>
            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
              <Option key={d} value={d}>{`Day ${d}`}</Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Generate from (optional)">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Button
          appearance="primary"
          disabled={!le || save.isPending}
          onClick={() => save.mutate({ cutoff_day: cutoff === "last" ? "last" : Number(cutoff), active: true, generate_from: from || null })}
        >
          Save and generate periods
        </Button>
      </div>
      {query.data && <Text size={200}>{`Timezone: ${query.data.timezone}`}</Text>}
      {save.error && <ErrorBar message={payrollErrorMessage(save.error)} />}
      <Field label="Payroll connector">
        <RadioGroup
          value={connector.data?.provider_key ?? "manual"}
          onChange={(_, d) => setConnector.mutate(d.value)}
          disabled={!le || setConnector.isPending}
        >
          <Radio value="manual" label="Manual — download the file, then mark it processed" />
        </RadioGroup>
      </Field>
    </section>
  );
}

function SettingsCard() {
  const styles = useStyles();
  const { query, update } = usePayrollSettings();
  const s = query.data;
  if (!s) return <GridSkeleton rows={2} />;
  const toggle = (t: PayrollWorkerType, on: boolean) => {
    const next = on ? [...new Set([...s.include_worker_types, t])] : s.include_worker_types.filter((x) => x !== t);
    if (next.length) update.mutate({ include_worker_types: next });
  };
  return (
    <section className={styles.card} aria-label="Payroll settings">
      <Text weight="semibold">Settings</Text>
      <Field label="Items approved after their period was locked go to">
        <RadioGroup value={s.late_item_mapping} onChange={(_, d) => update.mutate({ late_item_mapping: d.value as LateItemMapping })}>
          <Radio value="item_date" label="The period of the work date (supplementary export)" />
          <Radio value="approval_date" label="The period of the approval date" />
        </RadioGroup>
      </Field>
      <div className={styles.row}>
        <Switch label="Employees" checked={s.include_worker_types.includes("employee")} onChange={(_, d) => toggle("employee", d.checked)} />
        <Switch label="Own contractors" checked={s.include_worker_types.includes("contractor")} onChange={(_, d) => toggle("contractor", d.checked)} />
      </div>
      <Text size={200}>Vendor-supplied workers are paid through vendor statements and never appear in payroll.</Text>
    </section>
  );
}

function MappingsCard() {
  const styles = useStyles();
  const { query, catalogue } = usePayrollMappings();
  const [editing, setEditing] = useState<MappingOut | "new" | null>(null);
  return (
    <section className={styles.card} aria-label="File mappings">
      <div className={styles.row}>
        <Text weight="semibold">File mappings</Text>
        <Button onClick={() => setEditing("new")}>New mapping</Button>
      </div>
      {!query.data || !catalogue.data ? (
        <GridSkeleton rows={2} />
      ) : (
        <>
          {query.data.map((m) => (
            <div key={m.id} className={styles.row}>
              <Text>{`${m.name} (${m.format.toUpperCase()})${m.is_default ? " · default" : ""}`}</Text>
              <Button appearance="subtle" onClick={() => setEditing(m)}>
                Edit
              </Button>
            </div>
          ))}
          {editing && <MappingEditor key={editing === "new" ? "new" : editing.id} mapping={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </>
      )}
    </section>
  );
}

function MappingEditor({ mapping, onDone }: { mapping: MappingOut | null; onDone: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const { catalogue, create, update } = usePayrollMappings();
  const cat = catalogue.data ?? [];
  const [name, setName] = useState(mapping?.name ?? "");
  const [format, setFormat] = useState<FileFormat>(mapping?.format ?? "csv");
  const [isDefault, setIsDefault] = useState(mapping?.is_default ?? false);
  const [columns, setColumns] = useState<MappingColumn[]>(
    mapping?.columns ?? cat.map((c) => ({ source_field: c.key, header: c.label, include: true })),
  );
  const errors = mappingErrors(name, columns, cat);
  const mutation = mapping ? update : create;
  const submit = () => {
    const body = { name: name.trim(), format, columns, is_default: isDefault };
    if (mapping) update.mutate({ id: mapping.id, body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };
  const set = (i: number, patch: Partial<MappingColumn>) => setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const placeholder = new Set(cat.filter((c) => c.placeholder).map((c) => c.key));
  return (
    <div className={admin.form}>
      <div className={styles.row}>
        <Field label="Name" required>
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Format">
          <Dropdown selectedOptions={[format]} value={format.toUpperCase()} onOptionSelect={(_, d) => setFormat((d.optionValue as FileFormat) ?? "csv")}>
            <Option value="csv">CSV</Option>
            <Option value="xlsx">XLSX</Option>
          </Dropdown>
        </Field>
        <Checkbox label="Default mapping" checked={isDefault} onChange={(_, d) => setIsDefault(!!d.checked)} />
      </div>
      {columns.map((c, i) => (
        <div key={c.source_field} className={mergeClasses(styles.colRow, !c.include && styles.excluded)}>
          <Checkbox aria-label={`Include ${c.source_field}`} checked={c.include} onChange={(_, d) => set(i, { include: !!d.checked })} />
          <Text className={mergeClasses(placeholder.has(c.source_field) && styles.placeholderField)}>
            {cat.find((x) => x.key === c.source_field)?.label ?? c.source_field}
          </Text>
          <Input aria-label={`Header for ${c.source_field}`} value={c.header} onChange={(_, d) => set(i, { header: d.value })} />
          <span>
            <Button appearance="subtle" aria-label="Move up" icon={<ArrowUp20Regular />} onClick={() => setColumns((cs) => moveColumn(cs, i, -1))} />
            <Button appearance="subtle" aria-label="Move down" icon={<ArrowDown20Regular />} onClick={() => setColumns((cs) => moveColumn(cs, i, 1))} />
          </span>
        </div>
      ))}
      {errors.length > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>{errors.join(" ")}</MessageBarBody>
        </MessageBar>
      )}
      {mutation.error && <ErrorBar message={payrollErrorMessage(mutation.error)} />}
      <div className={admin.footer}>
        <Button onClick={onDone}>Cancel</Button>
        <Button appearance="primary" disabled={errors.length > 0 || mutation.isPending} onClick={submit}>
          Save mapping
        </Button>
      </div>
    </div>
  );
}
