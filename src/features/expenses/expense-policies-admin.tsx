"use client";

import {
  Badge,
  Button,
  Card,
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
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Save20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { CATEGORY_LABELS, completeCategories, expenseErrorMessage, formatDate, isoDate, policyErrors, REBILL_LABELS, TAX_MODE_LABELS } from "./format";
import type { PolicyCategory, PolicyOut, RebillMethod, RebillTaxMode } from "./types";
import { useExpensePolicies, useExpensePolicy, useExpenseSettings } from "./use-expense-policies";

const useStyles = makeStyles({
  layout: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  section: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  scroll: { overflowX: "auto" },
  table: { minWidth: "1150px" },
  num: { width: "110px" },
  ccy: { width: "70px" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
});

/** Empty strings -> null so the API receives decimals or null. */
function normalize(cats: PolicyCategory[]): PolicyCategory[] {
  const n = (v: string | null) => (v === null || v.trim() === "" ? null : v.trim());
  return cats.map((c) => ({
    ...c,
    daily_limit: n(c.daily_limit),
    claim_limit: n(c.claim_limit),
    receipt_required_above: n(c.receipt_required_above),
    mileage_rate_per_km: n(c.mileage_rate_per_km),
    markup_pct: c.rebill_method === "markup" ? n(c.markup_pct) : null,
    limit_currency: c.limit_currency.trim().toUpperCase() || "INR",
  }));
}

/** `/admin/expense-policies`: tenant policy and Client overrides, versioned category editor, expense settings. */
export function ExpensePoliciesAdmin() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const perms = usePermissions();
  const canManage = hasAnyPermission(perms, ["expense:policy"]);
  const { query } = useExpensePolicies(canManage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (!canManage) return <NoAccess what="expense policies" />;
  const policies = query.data ?? [];
  const selected = policies.find((p) => p.id === selectedId) ?? policies[0] ?? null;

  return (
    <div className={styles.layout}>
      <PageHeader title="Expense policies" subtitle="Category limits, receipt rules, mileage rates and client re-billing — versioned by effective date" />
      <div className={admin.toolbar}>
        <span className={admin.grow} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          New policy
        </Button>
      </div>
      {query.error && !query.data ? (
        <ErrorBar title="Could not load expense policies." message={errorMessage(query.error)} />
      ) : !query.data ? (
        <GridSkeleton />
      ) : policies.length === 0 ? (
        <Card className={styles.section}>
          <Text>No expense policy yet. Create the tenant policy first; add Client overrides where a client has different rules.</Text>
        </Card>
      ) : (
        <div className={admin.surface}>
          <Table aria-label="Expense policies">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Scope</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                <TableHeaderCell>Effective from</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow
                  key={p.id}
                  className={selected?.id === p.id ? styles.selected : undefined}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  onClick={() => setSelectedId(p.id)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedId(p.id)}
                >
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    {p.scope === "tenant" ? <Badge appearance="tint">Tenant default</Badge> : `Client: ${p.client_name ?? p.client_id}`}
                  </TableCell>
                  <TableCell>v{p.version}</TableCell>
                  <TableCell>{formatDate(p.effective_from)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {selected && <PolicyEditor key={`${selected.id}:${selected.version}`} policy={selected} />}
      <SettingsCard />
      {creating && (
        <CreatePolicyDialog
          hasTenant={policies.some((p) => p.scope === "tenant")}
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setSelectedId(p.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function PolicyEditor({ policy }: { policy: PolicyOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { newVersion } = useExpensePolicies(false);
  const [version, setVersion] = useState<number>(policy.version);
  const old = useExpensePolicy(policy.id, version === policy.version ? undefined : version);
  const viewing = version === policy.version ? policy : old.data;
  const readOnly = version !== policy.version;
  const [name, setName] = useState(policy.name);
  const [effectiveFrom, setEffectiveFrom] = useState(isoDate(1));
  const [cats, setCats] = useState<PolicyCategory[]>(() => completeCategories(policy.categories));
  const [touched, setTouched] = useState(false);
  const errors = policyErrors(normalize(cats));
  const shown = readOnly ? (viewing ? completeCategories(viewing.categories) : null) : cats;
  const setCat = (i: number, patch: Partial<PolicyCategory>) => setCats((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const versions = [...policy.versions].sort((a, b) => b.version - a.version);

  return (
    <Card className={styles.section}>
      <div className={styles.row}>
        <Subtitle2 as="h2">
          {policy.scope === "tenant" ? "Tenant policy" : `Client override — ${policy.client_name ?? policy.client_id}`}
        </Subtitle2>
        <span style={{ flex: 1 }} />
        <Field label="Version">
          <Dropdown
            value={`v${version}${version === policy.version ? " (latest)" : ""}`}
            selectedOptions={[String(version)]}
            onOptionSelect={(_, d) => d.optionValue && setVersion(Number(d.optionValue))}
          >
            {(versions.length ? versions : [{ id: policy.id, version: policy.version, effective_from: policy.effective_from, superseded_at: null }]).map((v) => (
              <Option key={v.version} value={String(v.version)} text={`v${v.version}`}>
                v{v.version} · from {formatDate(v.effective_from)}
                {v.superseded_at ? " (superseded)" : ""}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {readOnly && (
        <MessageBar intent="info">
          <MessageBarBody>
            Viewing v{version} (read-only). Lines dated in its effective period are evaluated against it. Switch to the latest version to edit.
          </MessageBarBody>
        </MessageBar>
      )}
      {!shown ? (
        <GridSkeleton rows={3} />
      ) : (
        <div className={styles.scroll}>
          <Table aria-label="Category rules" size="small" className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Enabled</TableHeaderCell>
                <TableHeaderCell>Daily limit</TableHeaderCell>
                <TableHeaderCell>Claim limit</TableHeaderCell>
                <TableHeaderCell>Currency</TableHeaderCell>
                <TableHeaderCell>Receipt above</TableHeaderCell>
                <TableHeaderCell>Rate / km</TableHeaderCell>
                <TableHeaderCell>Billable by default</TableHeaderCell>
                <TableHeaderCell>Re-bill</TableHeaderCell>
                <TableHeaderCell>Markup %</TableHeaderCell>
                <TableHeaderCell>Tax mode</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c, i) => {
                const err = (f: string) => (touched ? errors[`${c.category}.${f}`] : undefined);
                const num = (f: "daily_limit" | "claim_limit" | "receipt_required_above" | "mileage_rate_per_km" | "markup_pct", label: string) => (
                  <Field validationMessage={err(f)} className={styles.num}>
                    <Input
                      aria-label={`${CATEGORY_LABELS[c.category]} ${label}`}
                      inputMode="decimal"
                      disabled={readOnly}
                      value={c[f] ?? ""}
                      placeholder="—"
                      onChange={(_, d) => setCat(i, { [f]: d.value })}
                    />
                  </Field>
                );
                return (
                  <TableRow key={c.category}>
                    <TableCell>{CATEGORY_LABELS[c.category]}</TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`${CATEGORY_LABELS[c.category]} enabled`}
                        checked={c.enabled}
                        disabled={readOnly}
                        onChange={(_, d) => setCat(i, { enabled: d.checked })}
                      />
                    </TableCell>
                    <TableCell>{num("daily_limit", "daily limit")}</TableCell>
                    <TableCell>{num("claim_limit", "claim limit")}</TableCell>
                    <TableCell>
                      <Field validationMessage={err("limit_currency")} className={styles.ccy}>
                        <Input
                          aria-label={`${CATEGORY_LABELS[c.category]} limit currency`}
                          maxLength={3}
                          disabled={readOnly}
                          value={c.limit_currency}
                          onChange={(_, d) => setCat(i, { limit_currency: d.value.toUpperCase() })}
                        />
                      </Field>
                    </TableCell>
                    <TableCell>{num("receipt_required_above", "receipt threshold")}</TableCell>
                    <TableCell>{c.category === "mileage" ? num("mileage_rate_per_km", "rate per km") : "—"}</TableCell>
                    <TableCell>
                      <Switch
                        aria-label={`${CATEGORY_LABELS[c.category]} billable by default`}
                        checked={c.default_billable}
                        disabled={readOnly}
                        onChange={(_, d) => setCat(i, { default_billable: d.checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Dropdown
                        aria-label={`${CATEGORY_LABELS[c.category]} re-bill method`}
                        disabled={readOnly}
                        value={REBILL_LABELS[c.rebill_method]}
                        selectedOptions={[c.rebill_method]}
                        onOptionSelect={(_, d) => d.optionValue && setCat(i, { rebill_method: d.optionValue as RebillMethod })}
                      >
                        {Object.entries(REBILL_LABELS).map(([k, v]) => (
                          <Option key={k} value={k}>
                            {v}
                          </Option>
                        ))}
                      </Dropdown>
                    </TableCell>
                    <TableCell>{c.rebill_method === "markup" ? num("markup_pct", "markup %") : "—"}</TableCell>
                    <TableCell>
                      <Dropdown
                        aria-label={`${CATEGORY_LABELS[c.category]} tax mode`}
                        disabled={readOnly}
                        value={TAX_MODE_LABELS[c.rebill_tax_mode]}
                        selectedOptions={[c.rebill_tax_mode]}
                        onOptionSelect={(_, d) => d.optionValue && setCat(i, { rebill_tax_mode: d.optionValue as RebillTaxMode })}
                      >
                        {Object.entries(TAX_MODE_LABELS).map(([k, v]) => (
                          <Option key={k} value={k}>
                            {v}
                          </Option>
                        ))}
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Text size={200}>Receipt above 0 means a receipt is always required; leave limits empty for no limit.</Text>
      {!readOnly && (
        <div className={styles.row}>
          <Field label="Name">
            <Input value={name} onChange={(_, d) => setName(d.value)} />
          </Field>
          <Field label="Effective from" hint="Default: tomorrow">
            <Input type="date" value={effectiveFrom} onChange={(_, d) => setEffectiveFrom(d.value)} />
          </Field>
          <Button
            appearance="primary"
            icon={<Save20Regular />}
            disabled={newVersion.isPending}
            onClick={async () => {
              setTouched(true);
              if (Object.keys(errors).length) return;
              try {
                await newVersion.mutateAsync({
                  id: policy.id,
                  body: { name: name.trim() || null, effective_from: effectiveFrom || null, categories: normalize(cats) },
                });
                toast.success("New policy version saved");
              } catch (e) {
                toast.error(expenseErrorMessage(e, errorMessage));
              }
            }}
          >
            Save as new version
          </Button>
        </div>
      )}
    </Card>
  );
}

function CreatePolicyDialog({ hasTenant, onClose, onCreated }: { hasTenant: boolean; onClose: () => void; onCreated: (p: PolicyOut) => void }) {
  const admin = useAdminStyles();
  const { create } = useExpensePolicies(false);
  const [scope, setScope] = useState<"tenant" | "client">(hasTenant ? "client" : "tenant");
  const [name, setName] = useState(hasTenant ? "" : "Standard expense policy");
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(isoDate(0));
  const valid = name.trim() !== "" && (scope === "tenant" || !!client);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New expense policy</DialogTitle>
          <DialogContent className={admin.form}>
            <Field label="Applies to">
              <RadioGroup value={scope} onChange={(_, d) => setScope(d.value as "tenant" | "client")}>
                <Radio value="tenant" label="All placements (tenant default)" disabled={hasTenant} />
                <Radio value="client" label="One client (override)" />
              </RadioGroup>
            </Field>
            {scope === "client" && <ClientPicker value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} required />}
            <Field label="Name" required>
              <Input value={name} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Effective from">
              <Input type="date" value={effectiveFrom} onChange={(_, d) => setEffectiveFrom(d.value)} />
            </Field>
            <Text size={200}>All categories start enabled with no limits; edit the rules after creating.</Text>
            <ErrorBar message={create.isError ? expenseErrorMessage(create.error, errorMessage) : null} />
          </DialogContent>
          <DialogActions>
            <Button disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!valid || create.isPending}
              onClick={async () => {
                try {
                  const p = await create.mutateAsync({
                    name: name.trim(),
                    scope,
                    client_id: scope === "client" ? (client?.id ?? null) : null,
                    effective_from: effectiveFrom || null,
                    categories: completeCategories([]),
                  });
                  onCreated(p);
                } catch {
                  // shown inline
                }
              }}
            >
              Create
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SettingsCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const { query, update } = useExpenseSettings();
  const s = query.data;
  const [days, setDays] = useState<string | null>(null);
  const [mb, setMb] = useState<string | null>(null);
  if (!s) return query.error ? <ErrorBar title="Could not load expense settings." message={errorMessage(query.error)} /> : null;
  const save = (body: Parameters<typeof update.mutate>[0]) =>
    update.mutate(body, { onSuccess: () => toast.success("Settings saved"), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Card className={styles.section}>
      <Subtitle2 as="h2">Expense settings</Subtitle2>
      <Switch
        label="Let workers read receipts with AI (suggestions only — workers confirm every field)"
        checked={s.ai_receipt_read_enabled}
        disabled={update.isPending}
        onChange={(_, d) => save({ ai_receipt_read_enabled: d.checked })}
      />
      <div className={styles.row}>
        <Field label="Duplicate receipt window (days)">
          <Input type="number" min={0} value={days ?? String(s.duplicate_receipt_window_days)} onChange={(_, d) => setDays(d.value)} />
        </Field>
        <Field label="Max receipt size (MB)">
          <Input type="number" min={1} value={mb ?? String(s.max_receipt_mb)} onChange={(_, d) => setMb(d.value)} />
        </Field>
        <Button
          disabled={update.isPending || (days === null && mb === null)}
          onClick={() =>
            save({
              ...(days !== null && /^\d+$/.test(days) ? { duplicate_receipt_window_days: Number(days) } : {}),
              ...(mb !== null && /^\d+$/.test(mb) ? { max_receipt_mb: Number(mb) } : {}),
            })
          }
        >
          Save
        </Button>
      </div>
      <Text size={200}>Accepted receipt types: {s.allowed_receipt_types.join(", ") || "—"}</Text>
    </Card>
  );
}
