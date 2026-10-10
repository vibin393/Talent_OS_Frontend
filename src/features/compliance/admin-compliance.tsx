"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceApi, complianceKeys } from "./api";
import { hasErrors, ITEM_KIND_LABELS, validateRequirement } from "./logic";
import type { CredentialCategory, CredentialTypeIn, ItemKind, NumberKind, Requirement, RequirementIn, RequirementMatch } from "./types";

const useStyles = makeStyles({
  section: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  item: { display: "grid", gridTemplateColumns: "180px 1fr 1fr auto auto", gap: tokens.spacingHorizontalS, alignItems: "end" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

const EMPTY_MATCH: RequirementMatch = { role_keywords: [], industries: [], countries: [], worker_types: [], engagement_kinds: [] };
const MATCH_FIELDS: { key: keyof RequirementMatch; label: string; suggestions: string[] }[] = [
  { key: "industries", label: "Client industries", suggestions: ["Banking", "Insurance", "Healthcare", "IT services", "Manufacturing"] },
  { key: "countries", label: "Countries", suggestions: ["India", "United States", "United Kingdom", "Singapore"] },
  { key: "worker_types", label: "Worker types", suggestions: ["employee", "contractor", "vendor_contractor"] },
  { key: "engagement_kinds", label: "Engagements", suggestions: ["contract", "c2h", "permanent"] },
  { key: "role_keywords", label: "Role keywords", suggestions: [] },
];
const CATEGORIES: CredentialCategory[] = ["passport", "visa_work_permit", "certification", "professional_licence", "insurance", "client_document", "identity", "other"];
const NUMBER_KINDS: { value: NumberKind; label: string }[] = [
  { value: "none", label: "No number" },
  { value: "encrypted", label: "Number (encrypted, last 4 shown)" },
  { value: "aadhaar_last4", label: "Aadhaar (last 4 digits only)" },
];

function ValuesPicker({ label, value, suggestions, onChange }: { label: string; value: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const options = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(typed.toLowerCase()));
  const add = (v: string) => {
    if (v && !value.includes(v)) onChange([...value, v]);
    setQuery("");
  };
  return (
    <Field label={label} hint="Empty means any">
      <TagPicker
        selectedOptions={value}
        onOptionSelect={(_, d) => {
          if (!d.value) return;
          if (value.includes(d.value)) onChange(value.filter((x) => x !== d.value));
          else add(d.value);
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label={`Selected ${label.toLowerCase()}`}>
            {value.map((v) => (
              <Tag key={v} value={v} shape="rounded">
                {v}
              </Tag>
            ))}
          </TagPickerGroup>
          <TagPickerInput
            aria-label={label}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed) {
                e.preventDefault();
                add(typed);
              }
            }}
          />
        </TagPickerControl>
        <TagPickerList>
          {typed && !value.includes(typed) && !options.includes(typed) && (
            <TagPickerOption value={typed} text={typed}>{`Add "${typed}"`}</TagPickerOption>
          )}
          {options.map((o) => (
            <TagPickerOption key={o} value={o} text={o}>
              {o}
            </TagPickerOption>
          ))}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}

function RunPanel({ runId }: { runId: string }) {
  const q = useQuery({
    queryKey: complianceKeys.run(runId),
    queryFn: ({ signal }) => complianceApi.evaluationRun(runId, signal),
    refetchInterval: (query) => (query.state.data?.finished_at ? false : 2000),
  });
  if (!q.data) return <Caption1>Re-evaluating active placements…</Caption1>;
  return (
    <MessageBar intent={q.data.newly_non_compliant.length ? "warning" : "success"}>
      <MessageBarBody>
        {q.data.finished_at ? `Re-evaluated ${q.data.placements_evaluated} active placements. ` : "Re-evaluating… "}
        {q.data.placements.length > 0 ? (
          <>
            Newly non-compliant (not blocked — new requirements never block retroactively):{" "}
            {q.data.placements.map((p) => (
              <NextLink key={p.placement_id} href={`/placements/${p.placement_id}?tab=compliance`}>
                {p.human_id}{" "}
              </NextLink>
            ))}
          </>
        ) : (
          q.data.finished_at && "No placement became non-compliant."
        )}
      </MessageBarBody>
    </MessageBar>
  );
}

function RequirementEditor({ initial, onDone }: { initial?: Requirement; onDone: (runId: string | null) => void }) {
  const s = useStyles();
  const qc = useQueryClient();
  const types = useQuery({ queryKey: complianceKeys.types, queryFn: ({ signal }) => complianceApi.types(false, signal) });
  const [r, setR] = useState<RequirementIn>(
    initial
      ? { name: initial.name, client_id: initial.client_id, match: initial.match, items: initial.items, active: initial.active, effective_from: initial.effective_from }
      : { name: "", client_id: null, match: EMPTY_MATCH, items: [{ kind: "credential", ref: "", mandatory: true, label: "" }], active: true, effective_from: null },
  );
  const [submitted, setSubmitted] = useState(false);
  const errors = validateRequirement(r);
  const save = useMutation({
    mutationFn: () => {
      // The API forbids unknown fields: strip the display-only `unresolved` flag from items, and never send
      // `client_id` on update (a requirement's client cannot change after creation).
      const items = r.items.map(({ kind, ref, mandatory, label }) => ({ kind, ref: ref.trim(), mandatory, label }));
      if (initial) {
        const { name, match, active, effective_from } = r;
        return complianceApi.updateRequirement(initial.id, { name, match, items, active, effective_from });
      }
      return complianceApi.createRequirement({ ...r, items });
    },
    onSuccess: (out) => {
      void qc.invalidateQueries({ queryKey: complianceKeys.requirements });
      onDone(out.evaluation_run_id);
    },
  });
  const setItem = (i: number, patch: Partial<RequirementIn["items"][number]>) =>
    setR((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  return (
    <Card className={s.section}>
      <Subtitle2>{initial ? `Edit ${initial.name}` : "New requirement"}</Subtitle2>
      <Field label="Name" required validationMessage={submitted ? errors.name : undefined}>
        <Input value={r.name} onChange={(_, d) => setR((x) => ({ ...x, name: d.value }))} />
      </Field>
      <div className={s.grid}>
        {MATCH_FIELDS.map((f) => (
          <ValuesPicker key={f.key} label={f.label} value={r.match[f.key]} suggestions={f.suggestions} onChange={(v) => setR((x) => ({ ...x, match: { ...x.match, [f.key]: v } }))} />
        ))}
      </div>
      <Subtitle2>Items</Subtitle2>
      {submitted && errors.items && <ErrorBar message={errors.items} />}
      {r.items.map((it, i) => (
        <div key={i} className={s.item}>
          <Field label="Kind">
            <Dropdown value={ITEM_KIND_LABELS[it.kind]} onOptionSelect={(_, d) => setItem(i, { kind: d.optionValue as ItemKind, ref: "" })}>
              {(Object.keys(ITEM_KIND_LABELS) as ItemKind[]).map((k) => (
                <Option key={k} value={k}>
                  {ITEM_KIND_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          {it.kind === "credential" ? (
            <Field label="Credential type" validationMessage={submitted ? errors.itemErrors[i] : undefined}>
              <Dropdown
                value={types.data?.find((t) => t.key === it.ref)?.label ?? it.ref}
                onOptionSelect={(_, d) => {
                  const t = types.data?.find((x) => x.key === d.optionValue);
                  setItem(i, { ref: d.optionValue ?? "", label: it.label || t?.label || "" });
                }}
              >
                {(types.data ?? []).map((t) => (
                  <Option key={t.key} value={t.key}>
                    {t.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          ) : (
            <Field
              label={it.kind === "document" ? "Document category" : it.kind === "bgv_package" ? "BGV package id" : "Policy template id"}
              validationMessage={submitted ? errors.itemErrors[i] : undefined}
            >
              <Input value={it.ref} onChange={(_, d) => setItem(i, { ref: d.value })} />
            </Field>
          )}
          <Field label="Label">
            <Input value={it.label} onChange={(_, d) => setItem(i, { label: d.value })} />
          </Field>
          <Switch label="Mandatory" checked={it.mandatory} onChange={(_, d) => setItem(i, { mandatory: d.checked })} />
          <Button
            aria-label="Remove item"
            icon={<Delete16Regular />}
            onClick={() => setR((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}
          />
        </div>
      ))}
      <div className={s.row}>
        <Button icon={<Add16Regular />} onClick={() => setR((x) => ({ ...x, items: [...x.items, { kind: "credential", ref: "", mandatory: true, label: "" }] }))}>
          Add item
        </Button>
        <Checkbox label="Active" checked={r.active} onChange={(_, d) => setR((x) => ({ ...x, active: Boolean(d.checked) }))} />
      </div>
      {save.isError && <ErrorBar message={errorMessage(save.error)} />}
      <div className={s.row}>
        <Button
          appearance="primary"
          disabled={save.isPending}
          onClick={() => {
            setSubmitted(true);
            if (!hasErrors(errors)) save.mutate();
          }}
        >
          Save requirement
        </Button>
        <Button onClick={() => onDone(null)}>Cancel</Button>
      </div>
    </Card>
  );
}

function TypesEditor() {
  const s = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...complianceKeys.types, "all"], queryFn: ({ signal }) => complianceApi.types(true, signal) });
  const [draft, setDraft] = useState<CredentialTypeIn>({ key: "", label: "", category: "certification", has_expiry: true, number_kind: "none", requires_document: true, alert_offsets: null });
  const create = useMutation({
    mutationFn: () => complianceApi.createType(draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: complianceKeys.types });
      setDraft((d) => ({ ...d, key: "", label: "" }));
    },
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => complianceApi.updateType(id, { archived }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: complianceKeys.types }),
  });
  return (
    <Card className={s.section}>
      <Subtitle2>Credential types</Subtitle2>
      {q.isPending ? (
        <GridSkeleton rows={4} />
      ) : (
        <Table size="small" aria-label="Credential types">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell>Expiry</TableHeaderCell>
              <TableHeaderCell>Alerts (days)</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  {t.label} <Caption1>({t.key})</Caption1>
                </TableCell>
                <TableCell>{NUMBER_KINDS.find((n) => n.value === t.number_kind)?.label}</TableCell>
                <TableCell>{t.has_expiry ? "Yes" : "No"}</TableCell>
                <TableCell>{t.alert_offsets?.join(", ") ?? "Default"}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => archive.mutate({ id: t.id, archived: !t.archived_at })}>
                    {t.archived_at ? "Restore" : "Archive"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className={s.grid}>
        <Field label="Key" hint="lower_snake_case">
          <Input value={draft.key} onChange={(_, d) => setDraft((x) => ({ ...x, key: d.value }))} />
        </Field>
        <Field label="Label">
          <Input value={draft.label} onChange={(_, d) => setDraft((x) => ({ ...x, label: d.value }))} />
        </Field>
        <Field label="Category">
          <Dropdown value={draft.category.replace(/_/g, " ")} onOptionSelect={(_, d) => setDraft((x) => ({ ...x, category: d.optionValue as CredentialCategory }))}>
            {CATEGORIES.map((c) => (
              <Option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Number">
          <Dropdown
            value={NUMBER_KINDS.find((n) => n.value === draft.number_kind)?.label}
            onOptionSelect={(_, d) => setDraft((x) => ({ ...x, number_kind: d.optionValue as NumberKind }))}
          >
            {NUMBER_KINDS.map((n) => (
              <Option key={n.value} value={n.value}>
                {n.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Has expiry" checked={draft.has_expiry} onChange={(_, d) => setDraft((x) => ({ ...x, has_expiry: d.checked }))} />
        <Switch label="Document required" checked={draft.requires_document} onChange={(_, d) => setDraft((x) => ({ ...x, requires_document: d.checked }))} />
      </div>
      {create.isError && <ErrorBar message={errorMessage(create.error)} />}
      <div>
        <Button appearance="primary" disabled={!draft.key || !draft.label || create.isPending} onClick={() => create.mutate()}>
          Add credential type
        </Button>
      </div>
    </Card>
  );
}

/** `/admin/compliance`: credential types, requirements (match + items) and the re-evaluation result panel. */
export function ComplianceAdmin() {
  const s = useStyles();
  const canConfigure = usePermission("compliance:configure");
  const reqs = useQuery({ queryKey: complianceKeys.requirements, queryFn: ({ signal }) => complianceApi.requirements(signal), enabled: canConfigure });
  const [editing, setEditing] = useState<Requirement | "new" | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  if (!canConfigure) return <NoAccess what="compliance settings" />;
  return (
    <>
      <PageHeader title="Compliance" subtitle="What each placement needs: credentials, documents, BGV packages and policy acknowledgements." />
      {runId && <RunPanel runId={runId} />}
      {editing ? (
        <RequirementEditor
          initial={editing === "new" ? undefined : editing}
          onDone={(id) => {
            setEditing(null);
            if (id) setRunId(id);
          }}
        />
      ) : (
        <Card className={s.section}>
          <div className={s.row}>
            <Subtitle2>Requirements</Subtitle2>
            <Button appearance="primary" icon={<Add16Regular />} onClick={() => setEditing("new")}>
              New requirement
            </Button>
          </div>
          {reqs.isError && <ErrorBar message={errorMessage(reqs.error)} />}
          {(reqs.data ?? []).length === 0 && !reqs.isPending && <Body1>No requirements yet.</Body1>}
          <Table size="small" aria-label="Requirements">
            <TableBody>
              {(reqs.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Button appearance="transparent" onClick={() => setEditing(r)}>
                      {r.name}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <span className={s.row}>
                      {r.items.map((it) => (
                        <Badge key={`${it.kind}:${it.ref}`} appearance="tint" color={it.unresolved ? "danger" : it.mandatory ? "brand" : "informative"}>
                          {it.label}
                          {it.unresolved ? " (unresolved)" : ""}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>{r.active ? "Active" : "Inactive"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <TypesEditor />
    </>
  );
}
