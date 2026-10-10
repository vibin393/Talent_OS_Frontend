"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  Tag,
  TagGroup,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { referralsApi } from "./api";
import {
  cleanProgram,
  EMPLOYMENT_TYPE_LABELS,
  emptyProgram,
  formatDate,
  formatMoney,
  programErrors,
  programToInput,
  type RuleMatchKey,
  ruleMatchKey,
  SENIORITY_LABELS,
} from "./logic";
import { DemandSearch } from "./referrals-list";
import type { EligibleReferrers, ProgramIn, ProgramOut, ReferralSettings, RewardRule, SeniorityLevel } from "./types";
import { referralKeys, usePrograms, useReferralPermissions, useReferralSettings } from "./use-referrals";

const useStyles = makeStyles({
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  settings: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalXL },
  tableWrap: { overflowX: "auto" },
  cellInput: { minWidth: "110px" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const REFERRER_LABELS: Record<EligibleReferrers, string> = { users: "Employees only", workers: "Workers only", both: "Employees and workers" };
const MATCH_LABELS: Record<RuleMatchKey, string> = { seniority_level: "Seniority", demand_id: "Opening", employment_type: "Employment type" };

/** `/admin/referrals`: referral programs and the referral settings (needs `referral:configure`). */
export function ProgramsAdmin() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const { canConfigure } = useReferralPermissions();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ProgramOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<ProgramOut | null>(null);
  const q = usePrograms(showArchived, canConfigure);
  if (!canConfigure) return <NoAccess what="referral programs" />;

  const columns: TableColumnDefinition<ProgramOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Program",
      renderCell: (p) => (
        <div className={admin.cellStack}>
          <Text weight="semibold">{p.name}</Text>
          <Caption1 className={admin.muted}>Priority {p.priority}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) =>
        p.archived_at ? (
          <Badge appearance="tint" color="subtle">
            Archived
          </Badge>
        ) : p.active ? (
          <Badge appearance="tint" color="success">
            Active
          </Badge>
        ) : (
          <Badge appearance="tint" color="informative">
            Inactive
          </Badge>
        ),
    }),
    createTableColumn({
      columnId: "validity",
      renderHeaderCell: () => "Valid",
      renderCell: (p) => `${formatDate(p.valid_from)} – ${p.valid_to ? formatDate(p.valid_to) : "no end"}`,
    }),
    createTableColumn({ columnId: "who", renderHeaderCell: () => "Referrers", renderCell: (p) => REFERRER_LABELS[p.eligible_referrers] ?? p.eligible_referrers }),
    createTableColumn({
      columnId: "reward",
      renderHeaderCell: () => "Default reward",
      renderCell: (p) => `${formatMoney(p.default_amount, p.currency)}${p.reward_rules.length ? ` + ${p.reward_rules.length} rule${p.reward_rules.length === 1 ? "" : "s"}` : ""}`,
    }),
    createTableColumn({ columnId: "days", renderHeaderCell: () => "Joining condition", renderCell: (p) => `${p.joining_condition_days} days` }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (p) => (
        <div className={styles.row}>
          <Button size="small" onClick={() => setEditing(p)} disabled={!!p.archived_at}>
            Edit
          </Button>
          {!p.archived_at && (
            <Button size="small" onClick={() => setArchiving(p)}>
              Archive
            </Button>
          )}
        </div>
      ),
    }),
  ];

  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Referral programs" subtitle="Who can refer, for which openings, and the reward once the hire completes the joining condition" />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New program
        </Button>
      </div>
      <div className={admin.toolbar}>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
      </div>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(p) => p.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No referral programs yet. Create one to start rewarding referrals."
        label="Referral programs"
      />
      <SettingsCard />
      {editing && <ProgramEditor program={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={archiving !== null}
        title="Archive this program?"
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await referralsApi.archiveProgram(archiving.id);
            toast.success("Program archived.");
            await qc.invalidateQueries({ queryKey: ["referrals", "programs"] });
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        <Body1>New referrals will no longer match {archiving?.name}. Existing referrals and rewards keep it.</Body1>
      </ConfirmDialog>
    </>
  );
}

function IdTags({ ids, labels, onRemove, label }: { ids: string[]; labels: Record<string, string>; onRemove: (id: string) => void; label: string }) {
  if (ids.length === 0) return null;
  return (
    <TagGroup aria-label={label} onDismiss={(_, d) => onRemove(String(d.value))}>
      {ids.map((id) => {
        const text = labels[id] ?? `ID ${id.slice(0, 8)}`;
        return (
          <Tag key={id} value={id} dismissible dismissIcon={{ "aria-label": `Remove ${text}` }}>
            {text}
          </Tag>
        );
      })}
    </TagGroup>
  );
}

function ProgramEditor({ program, onClose }: { program: ProgramOut | null; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [p, setP] = useState<ProgramIn>(() => (program ? programToInput(program) : emptyProgram()));
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [roleKeys, setRoleKeys] = useState(() => (program ? program.exclusions.excluded_role_keys.join(", ") : ""));
  const [touched, setTouched] = useState(false);
  const withRoles: ProgramIn = { ...p, exclusions: { ...p.exclusions, excluded_role_keys: roleKeys.split(",") } };
  const errors = touched ? programErrors(withRoles) : {};
  const save = useMutation({
    mutationFn: () => {
      const body = cleanProgram(withRoles);
      return program ? referralsApi.patchProgram(program.id, body) : referralsApi.createProgram(body);
    },
    onSuccess: () => {
      toast.success(program ? "Program saved." : "Program created.");
      void qc.invalidateQueries({ queryKey: ["referrals", "programs"] });
      onClose();
    },
  });
  const serverFields = fieldErrors(save.error);
  const set = <K extends keyof ProgramIn>(k: K, v: ProgramIn[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const setDemands = (patch: Partial<ProgramIn["eligible_demands"]>) =>
    setP((prev) => ({ ...prev, eligible_demands: { ...prev.eligible_demands, ...patch } }));
  const setRule = (i: number, rule: RewardRule) => setP((prev) => ({ ...prev, reward_rules: prev.reward_rules.map((r, j) => (j === i ? rule : r)) }));
  const err = (k: string) => errors[k] ?? serverFields[k];
  const vs = (k: string) => (err(k) ? "error" : "none");

  const submit = () => {
    setTouched(true);
    if (Object.keys(programErrors(withRoles)).length === 0) save.mutate();
  };

  return (
    <DetailsDrawer
      open
      size="large"
      title={program ? `Edit ${program.name}` : "New referral program"}
      onClose={() => !save.isPending && onClose()}
      footer={
        <div className={styles.row}>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save
          </Button>
          <Button disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <Field label="Name" required validationState={vs("name")} validationMessage={err("name")}>
          <Input value={p.name} maxLength={200} onChange={(_, d) => set("name", d.value)} />
        </Field>
        <Switch label="Active" checked={p.active} onChange={(_, d) => set("active", d.checked)} />
        <div className={styles.grid2}>
          <Field label="Valid from" required validationState={vs("valid_from")} validationMessage={err("valid_from")}>
            <Input type="date" value={p.valid_from} onChange={(_, d) => set("valid_from", d.value)} />
          </Field>
          <Field label="Valid to (optional)" validationState={vs("valid_to")} validationMessage={err("valid_to")}>
            <Input type="date" value={p.valid_to ?? ""} onChange={(_, d) => set("valid_to", d.value || null)} />
          </Field>
          <Field label="Priority" hint="Higher wins when several programs match." validationState={vs("priority")} validationMessage={err("priority")}>
            <Input type="number" value={String(p.priority)} onChange={(_, d) => set("priority", Number(d.value || 0))} />
          </Field>
        </div>

        <Field label="Who can refer">
          <RadioGroup value={p.eligible_referrers} onChange={(_, d) => set("eligible_referrers", d.value as EligibleReferrers)} layout="horizontal">
            {(Object.keys(REFERRER_LABELS) as EligibleReferrers[]).map((k) => (
              <Radio key={k} value={k} label={REFERRER_LABELS[k]} />
            ))}
          </RadioGroup>
        </Field>

        <section className={styles.group} aria-labelledby="prog-demands">
          <Subtitle2 as="h3" id="prog-demands">
            Eligible openings
          </Subtitle2>
          <Switch label="All openings" checked={p.eligible_demands.all} onChange={(_, d) => setDemands({ all: d.checked })} />
          {!p.eligible_demands.all && (
            <>
              <ClientPicker
                label="Add client"
                value={null}
                onChange={(c) => {
                  if (!c || p.eligible_demands.client_ids.includes(c.id)) return;
                  setLabels((l) => ({ ...l, [c.id]: c.name }));
                  setDemands({ client_ids: [...p.eligible_demands.client_ids, c.id] });
                }}
              />
              <IdTags
                label="Clients"
                ids={p.eligible_demands.client_ids}
                labels={labels}
                onRemove={(id) => setDemands({ client_ids: p.eligible_demands.client_ids.filter((x) => x !== id) })}
              />
              <DemandSearch
                label="Add opening"
                value={null}
                onChange={(id, l) => {
                  if (!id || p.eligible_demands.demand_ids.includes(id)) return;
                  setLabels((prev) => ({ ...prev, [id]: l }));
                  setDemands({ demand_ids: [...p.eligible_demands.demand_ids, id] });
                }}
              />
              <IdTags
                label="Openings"
                ids={p.eligible_demands.demand_ids}
                labels={labels}
                onRemove={(id) => setDemands({ demand_ids: p.eligible_demands.demand_ids.filter((x) => x !== id) })}
              />
              <Field label="Employment types">
                <Dropdown
                  multiselect
                  placeholder="Any employment type"
                  value={p.eligible_demands.employment_types.map((t) => EMPLOYMENT_TYPE_LABELS[t] ?? t).join(", ")}
                  selectedOptions={p.eligible_demands.employment_types}
                  onOptionSelect={(_, d) => setDemands({ employment_types: d.selectedOptions })}
                >
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                    <Option key={k} value={k}>
                      {v}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Seniority levels">
                <div className={styles.row}>
                  {(Object.keys(SENIORITY_LABELS) as SeniorityLevel[]).map((s) => (
                    <Checkbox
                      key={s}
                      label={SENIORITY_LABELS[s]}
                      checked={p.eligible_demands.seniority_levels.includes(s)}
                      onChange={(_, d) =>
                        setDemands({
                          seniority_levels: d.checked
                            ? [...p.eligible_demands.seniority_levels, s]
                            : p.eligible_demands.seniority_levels.filter((x) => x !== s),
                        })
                      }
                    />
                  ))}
                </div>
              </Field>
              {err("eligible_demands") && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{err("eligible_demands")}</MessageBarBody>
                </MessageBar>
              )}
            </>
          )}
        </section>

        <section className={styles.group} aria-labelledby="prog-reward">
          <Subtitle2 as="h3" id="prog-reward">
            Reward
          </Subtitle2>
          <div className={styles.grid2}>
            <Field
              label="Default amount"
              hint="Used when no rule below matches. Leave empty for no default reward."
              validationState={vs("default_amount")}
              validationMessage={err("default_amount")}
            >
              <Input inputMode="decimal" value={p.default_amount ?? ""} onChange={(_, d) => set("default_amount", d.value || null)} />
            </Field>
            <Field label="Currency" required validationState={vs("currency")} validationMessage={err("currency")}>
              <Input value={p.currency} maxLength={3} onChange={(_, d) => set("currency", d.value.toUpperCase())} />
            </Field>
            <Field
              label="Joining condition (days)"
              hint="The hire must stay active this long before the reward is eligible."
              validationState={vs("joining_condition_days")}
              validationMessage={err("joining_condition_days")}
            >
              <Input
                type="number"
                min={0}
                max={730}
                value={String(p.joining_condition_days)}
                onChange={(_, d) => set("joining_condition_days", Number(d.value || 0))}
              />
            </Field>
          </div>
          <Text weight="semibold">Reward rules</Text>
          <Caption1 className={styles.muted}>Each rule matches one thing. A rule overrides the default amount.</Caption1>
          {p.reward_rules.length > 0 && (
            <div className={styles.tableWrap}>
              <Table aria-label="Reward rules" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Match on</TableHeaderCell>
                    <TableHeaderCell>Value</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Currency</TableHeaderCell>
                    <TableHeaderCell>Remove</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.reward_rules.map((rule, i) => (
                    <RuleRow
                      key={i}
                      index={i}
                      rule={rule}
                      labels={labels}
                      onLabel={(id, l) => setLabels((prev) => ({ ...prev, [id]: l }))}
                      error={err(`rule_${i}`)}
                      amountError={err(`rule_${i}_amount`)}
                      currencyError={err(`rule_${i}_currency`)}
                      onChange={(r) => setRule(i, r)}
                      onRemove={() => set("reward_rules", p.reward_rules.filter((_, j) => j !== i))}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div>
            <Button
              icon={<Add20Regular />}
              onClick={() => set("reward_rules", [...p.reward_rules, { match: { seniority_level: "senior" }, amount: "", currency: p.currency || "INR" }])}
            >
              Add rule
            </Button>
          </div>
        </section>

        <section className={styles.group} aria-labelledby="prog-excl">
          <Subtitle2 as="h3" id="prog-excl">
            Exclusions
          </Subtitle2>
          <Checkbox
            label="Recruiters assigned to the opening cannot refer for it"
            checked={p.exclusions.assigned_recruiters}
            onChange={(_, d) => set("exclusions", { ...p.exclusions, assigned_recruiters: Boolean(d.checked) })}
          />
          <Checkbox
            label="The opening's owner cannot refer for it"
            checked={p.exclusions.demand_owner}
            onChange={(_, d) => set("exclusions", { ...p.exclusions, demand_owner: Boolean(d.checked) })}
          />
          <Field label="Excluded role keys" hint="Comma-separated role keys whose members are never rewarded, for example: recruiter, hr_admin.">
            <Input value={roleKeys} onChange={(_, d) => setRoleKeys(d.value)} />
          </Field>
        </section>

        {save.isError && (
          <MessageBar intent="error" role="alert" layout="multiline">
            <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
          </MessageBar>
        )}
      </div>
    </DetailsDrawer>
  );
}

function RuleRow({
  index,
  rule,
  labels,
  onLabel,
  error,
  amountError,
  currencyError,
  onChange,
  onRemove,
}: {
  index: number;
  rule: RewardRule;
  labels: Record<string, string>;
  onLabel: (id: string, label: string) => void;
  error?: string;
  amountError?: string;
  currencyError?: string;
  onChange: (r: RewardRule) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const key = ruleMatchKey(rule) ?? "seniority_level";
  const n = index + 1;
  const setKey = (k: RuleMatchKey) =>
    onChange({ ...rule, match: k === "seniority_level" ? { seniority_level: "senior" } : k === "employment_type" ? { employment_type: "permanent" } : { demand_id: null } });
  return (
    <TableRow>
      <TableCell>
        <Dropdown
          aria-label={`Rule ${n}: match on`}
          className={styles.cellInput}
          value={MATCH_LABELS[key]}
          selectedOptions={[key]}
          onOptionSelect={(_, d) => d.optionValue && setKey(d.optionValue as RuleMatchKey)}
        >
          {(Object.keys(MATCH_LABELS) as RuleMatchKey[]).map((k) => (
            <Option key={k} value={k}>
              {MATCH_LABELS[k]}
            </Option>
          ))}
        </Dropdown>
      </TableCell>
      <TableCell>
        <Field validationState={error ? "error" : "none"} validationMessage={error}>
          {key === "seniority_level" ? (
            <Dropdown
              aria-label={`Rule ${n}: seniority`}
              className={styles.cellInput}
              value={SENIORITY_LABELS[rule.match.seniority_level as SeniorityLevel] ?? ""}
              selectedOptions={rule.match.seniority_level ? [rule.match.seniority_level] : []}
              onOptionSelect={(_, d) => onChange({ ...rule, match: { seniority_level: d.optionValue as SeniorityLevel } })}
            >
              {(Object.keys(SENIORITY_LABELS) as SeniorityLevel[]).map((s) => (
                <Option key={s} value={s}>
                  {SENIORITY_LABELS[s]}
                </Option>
              ))}
            </Dropdown>
          ) : key === "employment_type" ? (
            <Dropdown
              aria-label={`Rule ${n}: employment type`}
              className={styles.cellInput}
              value={EMPLOYMENT_TYPE_LABELS[rule.match.employment_type ?? ""] ?? ""}
              selectedOptions={rule.match.employment_type ? [rule.match.employment_type] : []}
              onOptionSelect={(_, d) => onChange({ ...rule, match: { employment_type: d.optionValue ?? null } })}
            >
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>
                  {v}
                </Option>
              ))}
            </Dropdown>
          ) : (
            <>
              {rule.match.demand_id && <Caption1>{labels[rule.match.demand_id] ?? `ID ${rule.match.demand_id.slice(0, 8)}`}</Caption1>}
              <DemandSearch
                label={`Rule ${n}: opening`}
                value={rule.match.demand_id ?? null}
                onChange={(id, l) => {
                  if (id) onLabel(id, l);
                  onChange({ ...rule, match: { demand_id: id } });
                }}
              />
            </>
          )}
        </Field>
      </TableCell>
      <TableCell>
        <Field validationState={amountError ? "error" : "none"} validationMessage={amountError}>
          <Input
            aria-label={`Rule ${n}: amount`}
            className={styles.cellInput}
            inputMode="decimal"
            value={rule.amount}
            onChange={(_, d) => onChange({ ...rule, amount: d.value })}
          />
        </Field>
      </TableCell>
      <TableCell>
        <Field validationState={currencyError ? "error" : "none"} validationMessage={currencyError}>
          <Input
            aria-label={`Rule ${n}: currency`}
            className={styles.cellInput}
            maxLength={3}
            value={rule.currency}
            onChange={(_, d) => onChange({ ...rule, currency: d.value.toUpperCase() })}
          />
        </Field>
      </TableCell>
      <TableCell>
        <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove rule ${n}`} onClick={onRemove} />
      </TableCell>
    </TableRow>
  );
}

function SettingsCard() {
  const styles = useStyles();
  const q = useReferralSettings();
  return (
    <Card className={styles.settings}>
      <Subtitle2 as="h2">Referral settings</Subtitle2>
      {q.isError ? (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : q.isPending ? (
        <Spinner label="Loading settings" />
      ) : (
        <SettingsForm initial={q.data} />
      )}
    </Card>
  );
}

function SettingsForm({ initial }: { initial: ReferralSettings }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canPickUsers = usePermission("user:read");
  const [form, setForm] = useState<ReferralSettings>(initial);
  const save = useMutation({
    mutationFn: (body: ReferralSettings) => referralsApi.saveSettings(body),
    onSuccess: (s) => {
      qc.setQueryData(referralKeys.settings, s);
      setForm(s);
      toast.success("Referral settings saved.");
    },
  });
  const set = <K extends keyof ReferralSettings>(k: K, v: ReferralSettings[K]) => setForm((prev) => ({ ...prev, [k]: v }));
  const serverFields = fieldErrors(save.error);
  return (
    <>
      <div className={styles.grid2}>
        <Field
          label="Duplicate window (months)"
          hint="A referee with candidate activity in this window is recorded as a duplicate."
          validationState={serverFields.duplicate_activity_months ? "error" : "none"}
          validationMessage={serverFields.duplicate_activity_months}
        >
          <Input
            type="number"
            min={1}
            max={60}
            value={String(form.duplicate_activity_months)}
            onChange={(_, d) => set("duplicate_activity_months", Number(d.value || 0))}
          />
        </Field>
        <Field
          label="Referee link valid (days)"
          validationState={serverFields.referee_link_days ? "error" : "none"}
          validationMessage={serverFields.referee_link_days}
        >
          <Input type="number" min={1} max={90} value={String(form.referee_link_days)} onChange={(_, d) => set("referee_link_days", Number(d.value || 0))} />
        </Field>
        <Field
          label="Share link valid (days)"
          validationState={serverFields.share_link_days ? "error" : "none"}
          validationMessage={serverFields.share_link_days}
        >
          <Input type="number" min={1} max={365} value={String(form.share_link_days)} onChange={(_, d) => set("share_link_days", Number(d.value || 0))} />
        </Field>
        <Field
          label="Payout export currency"
          validationState={serverFields.payout_export_currency_default ? "error" : "none"}
          validationMessage={serverFields.payout_export_currency_default}
        >
          <Input
            maxLength={3}
            value={form.payout_export_currency_default}
            onChange={(_, d) => set("payout_export_currency_default", d.value.toUpperCase())}
          />
        </Field>
      </div>
      {canPickUsers ? (
        <UserPicker
          label="Default owner for general referrals"
          value={form.default_owner_user_id}
          valueLabel={form.default_owner_user_id ? "Current owner (search to change)" : undefined}
          clearLabel="No default owner"
          onChange={(id) => set("default_owner_user_id", id)}
        />
      ) : (
        <Caption1 className={styles.muted}>You need permission to view users to change the default owner.</Caption1>
      )}
      {save.isError && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
        </MessageBar>
      )}
      <div>
        <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate(form)}>
          Save settings
        </Button>
      </div>
    </>
  );
}
