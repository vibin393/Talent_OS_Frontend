"use client";

import {
  Badge,
  Button,
  Caption1,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import { errorMessage } from "@/lib/api/errors";
import { type HrmsFieldOut, hrmsApi, hrmsKeys, type MappingIn, type Transform } from "./api";
import { canToggleSensitive, FIXED_VALUE, TRANSFORM_OPTIONS } from "./logic";
import { SensitiveDialog } from "./sensitive-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  header: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "end", flexWrap: "wrap" },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  wrap: { overflowX: "auto" },
  narrow: { minWidth: "160px" },
});

type Draft = { local_field: string; constant: string; transform: Transform; lookup: Record<string, string> };

function fieldToDraft(f: HrmsFieldOut): Draft {
  const m = f.mapping;
  return {
    local_field: m?.local_field ? m.local_field : m && m.constant != null ? FIXED_VALUE : "",
    constant: m?.constant ?? "",
    transform: (m?.transform as Transform) ?? "none",
    lookup: m?.lookup ?? {},
  };
}

/** HRMS field mapping for one installation × Legal Entity. Opened from the installed integration "Field mapping". */
export function HrmsMappingPage({ installationId, legalEntityIds }: { installationId: string; legalEntityIds: string[] }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canFinance = usePermission("ledger:sync");
  const [le, setLe] = useState<string | null>(legalEntityIds[0] ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [customName, setCustomName] = useState("");
  const [extraFields, setExtraFields] = useState<string[]>([]);
  const [sensitive, setSensitive] = useState<{ mappingId: string; label: string } | null>(null);

  const les = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal) });
  const leName = useMemo(() => (les.data ?? []).find((e) => e.id === le)?.name ?? "", [les.data, le]);

  const q = useQuery({
    queryKey: hrmsKeys.mappings(installationId, le ?? ""),
    queryFn: ({ signal }) => hrmsApi.mappings(installationId, le!, signal),
    enabled: !!le,
  });

  useEffect(() => {
    if (!q.data) return;
    const next: Record<string, Draft> = {};
    for (const f of q.data.fields) next[f.hrms_field] = fieldToDraft(f);
    setDrafts(next);
    setExtraFields([]);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const items: MappingIn[] = Object.entries(drafts)
        .filter(([, d]) => d.local_field || d.constant)
        .map(([hrms_field, d]) => ({
          hrms_field,
          local_field: d.local_field && d.local_field !== FIXED_VALUE ? d.local_field : null,
          constant: d.local_field === FIXED_VALUE ? d.constant : null,
          transform: d.transform,
          lookup: d.transform === "lookup" ? d.lookup : {},
        }));
      return hrmsApi.saveMappings(installationId, le!, items);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrmsKeys.mappings(installationId, le ?? "") });
      toast.success("Mapping saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (les.isPending) return <Spinner label="Loading" />;

  const data = q.data;
  const hrmsName = data?.connector_key ?? "your HR system";
  const setDraft = (field: string, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
  const allFields: HrmsFieldOut[] = [
    ...(data?.fields ?? []),
    ...extraFields.map((name) => ({ hrms_field: name, label: name, required: false, kind: "text", options: [], custom: true, mapping: null })),
  ];
  const regular = allFields.filter((f) => !data?.catalogue.find((c) => c.key === f.hrms_field)?.sensitive);
  // Sensitive catalogue fields are presented in their own section (PAN, bank, Aadhaar).
  const sensitiveFields = (data?.fields ?? []).filter((f) => data?.catalogue.find((c) => c.key === f.mapping?.local_field)?.sensitive || f.mapping?.sensitive);

  const catalogueOptions = (data?.catalogue ?? []).filter((c) => !c.sensitive);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Subtitle2 as="h2">HRMS field mapping — {leName}</Subtitle2>
        <Field label="Legal entity">
          <Dropdown value={leName} selectedOptions={le ? [le] : []} onOptionSelect={(_, d) => d.optionValue && setLe(d.optionValue)}>
            {legalEntityIds.map((id) => (
              <Option key={id} value={id}>
                {(les.data ?? []).find((e) => e.id === id)?.name ?? id}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {q.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {q.isPending && le ? <Spinner label="Loading mapping" /> : null}
      {data ? (
        <>
          <div className={styles.wrap}>
            <Table aria-label="Field mapping">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>HRMS field</TableHeaderCell>
                  <TableHeaderCell>Required</TableHeaderCell>
                  <TableHeaderCell>Talent OS field</TableHeaderCell>
                  <TableHeaderCell>Transform</TableHeaderCell>
                  <TableHeaderCell>Lookup values</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regular.map((f) => {
                  const d = drafts[f.hrms_field] ?? { local_field: "", constant: "", transform: "none" as Transform, lookup: {} };
                  const selectedLabel =
                    d.local_field === FIXED_VALUE ? "Fixed value" : catalogueOptions.find((c) => c.key === d.local_field)?.label ?? "";
                  return (
                    <TableRow key={f.hrms_field}>
                      <TableCell>{f.label}</TableCell>
                      <TableCell>{f.required ? <Badge appearance="tint" color="danger">Required</Badge> : null}</TableCell>
                      <TableCell>
                        <Combobox
                          className={styles.narrow}
                          placeholder="Not mapped"
                          value={selectedLabel}
                          selectedOptions={d.local_field ? [d.local_field] : []}
                          onOptionSelect={(_, o) => setDraft(f.hrms_field, { local_field: o.optionValue ?? "" })}
                        >
                          <Option value={FIXED_VALUE}>Fixed value</Option>
                          {catalogueOptions.map((c) => (
                            <Option key={c.key} value={c.key}>
                              {c.label}
                            </Option>
                          ))}
                        </Combobox>
                        {d.local_field === FIXED_VALUE ? (
                          <Input size="small" placeholder="Value" value={d.constant} onChange={(_, e) => setDraft(f.hrms_field, { constant: e.value })} />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Dropdown
                          className={styles.narrow}
                          value={TRANSFORM_OPTIONS.find((o) => o.value === d.transform)?.label ?? "None"}
                          selectedOptions={[d.transform]}
                          onOptionSelect={(_, o) => o.optionValue && setDraft(f.hrms_field, { transform: o.optionValue as Transform })}
                        >
                          {TRANSFORM_OPTIONS.map((o) => (
                            <Option key={o.value} value={o.value}>
                              {o.label}
                            </Option>
                          ))}
                        </Dropdown>
                      </TableCell>
                      <TableCell>
                        {d.transform === "lookup" ? (
                          <LookupEditor value={d.lookup} onChange={(v) => setDraft(f.hrms_field, { lookup: v })} />
                        ) : (
                          <Caption1>—</Caption1>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {data.custom_fields_allowed ? (
            <div className={styles.row}>
              <Field label="Custom field key">
                <Input value={customName} onChange={(_, e) => setCustomName(e.value)} />
              </Field>
              <Button
                disabled={!/^[A-Za-z0-9_]{1,100}$/.test(customName) || allFields.some((f) => f.hrms_field === customName)}
                onClick={() => {
                  setExtraFields((x) => [...x, customName]);
                  setDrafts((p) => ({ ...p, [customName]: { local_field: "", constant: "", transform: "none", lookup: {} } }));
                  setCustomName("");
                }}
              >
                Add field
              </Button>
            </div>
          ) : null}

          <Subtitle2 as="h2">Sensitive fields</Subtitle2>
          <Caption1>Only Finance can turn these on, with a recorded purpose.</Caption1>
          <Table aria-label="Sensitive fields">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Field</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>On</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SENSITIVE_ROWS.map((row) => {
                const field = sensitiveFields.find((f) => f.mapping?.local_field === row.key);
                const on = !!field?.mapping?.sensitive;
                return (
                  <TableRow key={row.key}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{on ? <Badge appearance="tint" color="success">On</Badge> : <Caption1>Off</Caption1>}</TableCell>
                    <TableCell>
                      <Switch
                        disabled={!canToggleSensitive(canFinance) || !field?.mapping}
                        checked={on}
                        onChange={(_, d) => {
                          if (!field?.mapping) return;
                          if (d.checked) setSensitive({ mappingId: field.mapping.id, label: row.label });
                          else void hrmsApi.disableSensitive(field.mapping.id).then(() => q.refetch());
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className={styles.row}>
            <Button appearance="primary" disabled={!le || save.isPending} onClick={() => save.mutate()}>
              Save mapping
            </Button>
            <Button disabled={!le} onClick={() => void hrmsApi.downloadImportFile(installationId, le!).catch((e) => toast.error(errorMessage(e)))}>
              Download HRMS import file
            </Button>
          </div>
        </>
      ) : null}

      {sensitive ? (
        <SensitiveDialog
          mappingId={sensitive.mappingId}
          fieldLabel={sensitive.label}
          hrmsName={hrmsName}
          onClose={() => setSensitive(null)}
          onDone={() => void q.refetch()}
        />
      ) : null}
    </div>
  );
}

const SENSITIVE_ROWS = [
  { key: "pan", label: "PAN" },
  { key: "bank_account_number", label: "Bank account number" },
  { key: "bank_ifsc", label: "Bank IFSC" },
  { key: "aadhaar_reference", label: "Aadhaar reference" },
];

function LookupEditor({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value);
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([ek, ev]) => (
        <div key={ek} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Caption1>
            {ek} → {ev}
          </Caption1>
          <Button size="small" appearance="subtle" onClick={() => onChange(Object.fromEntries(entries.filter(([x]) => x !== ek)))}>
            Remove
          </Button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 4 }}>
        <Input size="small" placeholder="Talent OS value" value={k} onChange={(_, d) => setK(d.value)} />
        <Input size="small" placeholder="HRMS value" value={v} onChange={(_, d) => setV(d.value)} />
        <Button
          size="small"
          disabled={!k || !v}
          onClick={() => {
            onChange({ ...value, [k]: v });
            setK("");
            setV("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
