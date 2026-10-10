"use client";

import {
  Body1,
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  makeStyles,
  mergeClasses,
  Option,
  OptionGroup,
  SpinButton,
  TagGroup,
  Text,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { ArrowDown16Regular, ArrowUp16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { PersonPicker } from "@/features/activity/person-picker";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { useUserNames } from "@/features/approvals/use-user-names";
import { usePermission } from "@/features/auth/use-permission";
import { useTemplates } from "@/features/comms/use-templates";
import type { WorkflowActionTypeOut } from "@/lib/api/types";
import { TagsInput } from "./inputs";
import { type ActionDraft, humanize, moveStageOptions } from "./rule-model";
import { usePipelineStages } from "./use-workflow";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  error: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}` },
  head: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  step: {
    width: "24px",
    height: "24px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: "6px",
  },
  type: { flex: "1 1 220px" },
  params: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: tokens.spacingHorizontalM,
    alignItems: "start",
  },
  wide: { gridColumn: "1 / -1" },
  muted: { color: tokens.colorNeutralForeground3 },
  chips: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

/** Actions each trigger entity may use (mirrors the server's validation). */
const ACTION_ENTITIES: Record<string, readonly string[] | undefined> = {
  assign: ["demand"],
  move_stage: ["application"],
  add_tag: ["candidate", "application"],
  refresh_matches: ["demand", "application"],
};

export function actionAllowedFor(type: string, entityType: string | undefined): boolean {
  const allowed = ACTION_ENTITIES[type];
  return !allowed || (!!entityType && allowed.includes(entityType));
}

type Schema = {
  properties?: Record<string, SchemaProp>;
  required?: string[];
};
type SchemaProp = {
  title?: string;
  type?: string;
  enum?: string[];
  default?: unknown;
  maxLength?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  items?: { type?: string };
  anyOf?: SchemaProp[];
};

/** A property's effective type, looking through `anyOf: [T, null]`. */
function propType(p: SchemaProp): { type: string | undefined; nullable: boolean; prop: SchemaProp } {
  if (p.anyOf) {
    const main = p.anyOf.find((x) => x.type !== "null") ?? {};
    return { type: main.type, nullable: p.anyOf.some((x) => x.type === "null"), prop: { ...main, title: p.title, default: p.default } };
  }
  return { type: p.type, nullable: false, prop: p };
}

const PARAM_LABELS: Record<string, string> = {
  user_ids: "Recruiters",
  team_ids: "Teams",
  primary_user_id: "Primary recruiter",
  title: "Task title",
  owner: "Owner",
  due_in_hours: "Due in (hours)",
  priority: "Priority",
  reminder_before_minutes: "Remind before due (minutes)",
  recipients: "Recipients",
  message: "Message",
  template_id: "Email template",
  to: "Send to",
  to_stage_key: "Move to stage",
  names: "Tags",
};

const SELECTOR_LABELS: Record<string, string> = {
  primary_recruiter: "Primary recruiter",
  entity_owner: "Record owner",
  candidate: "The candidate",
  primary_contact: "Primary client contact",
};

function useLookups() {
  const canTeams = usePermission("team:read");
  const canRoles = usePermission("role:read");
  const teams = useQuery({
    queryKey: [...adminKeys.teams, "lookup"],
    queryFn: ({ signal }) => adminApi.listTeams(1, LOOKUP_PAGE_SIZE, signal),
    enabled: canTeams,
    staleTime: 5 * 60_000,
  });
  const roles = useQuery({
    queryKey: [...adminKeys.roles, "lookup"],
    queryFn: ({ signal }) => adminApi.listRoles(signal),
    enabled: canRoles,
    staleTime: 5 * 60_000,
  });
  const userName = useUserNames();
  return { teams: teams.data?.items ?? [], roles: roles.data ?? [], userName };
}

type Lookups = ReturnType<typeof useLookups>;

function selectorLabel(sel: string, l: Lookups): string {
  if (SELECTOR_LABELS[sel]) return SELECTOR_LABELS[sel];
  const cut = sel.indexOf(":");
  const kind = cut < 0 ? sel : sel.slice(0, cut);
  const id = cut < 0 ? "" : sel.slice(cut + 1);
  if (kind === "user") return l.userName(id) ?? "A person";
  if (kind === "team") return `Team: ${l.teams.find((t) => t.id === id)?.name ?? "team"}`;
  if (kind === "role") return `Role: ${l.roles.find((r) => r.key === id)?.name ?? id}`;
  return sel;
}

function Chips({ values, label, onRemove }: { values: { value: string; text: string }[]; label: string; onRemove: (v: string) => void }) {
  if (values.length === 0) return null;
  return (
    <TagGroup aria-label={label} onDismiss={(_, d) => onRemove(String(d.value))} style={{ flexWrap: "wrap" }}>
      {values.map((v) => (
        <InteractionTag key={v.value} value={v.value} size="small" shape="circular">
          <InteractionTagPrimary hasSecondaryAction>{v.text}</InteractionTagPrimary>
          <InteractionTagSecondary aria-label={`Remove ${v.text}`} />
        </InteractionTag>
      ))}
    </TagGroup>
  );
}

/** Owner selector for `create_task`: primary recruiter, record owner or a specific person (`user:<id>`). */
function OwnerField({ value, onChange, l }: { value: string; onChange: (v: string) => void; l: Lookups }) {
  const mode = value.startsWith("user:") ? "user" : value || "primary_recruiter";
  const userId = value.startsWith("user:") ? value.slice(5) : null;
  return (
    <>
      <Field label="Owner">
        <Dropdown
          value={mode === "user" ? "A specific person" : SELECTOR_LABELS[mode]}
          selectedOptions={[mode]}
          onOptionSelect={(_, d) => onChange(d.optionValue === "user" ? (userId ? `user:${userId}` : "user:") : String(d.optionValue))}
        >
          <Option value="primary_recruiter">Primary recruiter</Option>
          <Option value="entity_owner">Record owner</Option>
          <Option value="user">A specific person</Option>
        </Dropdown>
      </Field>
      {mode === "user" && (
        <PersonPicker
          label="Person"
          value={userId || null}
          valueLabel={userId ? (l.userName(userId) ?? "") : ""}
          onChange={(p) => p && onChange(`user:${p.id}`)}
        />
      )}
    </>
  );
}

/** Recipient selectors for `notify`: primary recruiter, record owner, people, teams and roles. */
function RecipientsField({ value, onChange, l, invalid }: { value: string[]; onChange: (v: string[]) => void; l: Lookups; invalid?: boolean }) {
  const styles = useStyles();
  const add = (sel: string) => !value.includes(sel) && value.length < 20 && onChange([...value, sel]);
  return (
    <div className={mergeClasses(styles.wide, styles.chips)}>
      <Field label="Recipients" required validationState={invalid ? "error" : "none"}>
        <Chips
          label="Recipients"
          values={value.map((v) => ({ value: v, text: selectorLabel(v, l) }))}
          onRemove={(v) => onChange(value.filter((x) => x !== v))}
        />
      </Field>
      <div className={styles.params}>
        <Field label="Add a role or team">
          <Dropdown placeholder="Choose recipients" value="" selectedOptions={[]} onOptionSelect={(_, d) => d.optionValue && add(d.optionValue)}>
            <Option value="primary_recruiter">Primary recruiter</Option>
            <Option value="entity_owner">Record owner</Option>
            {l.teams.length > 0 && (
              <OptionGroup label="Teams">
                {l.teams.map((t) => (
                  <Option key={t.id} value={`team:${t.id}`}>
                    {t.name}
                  </Option>
                ))}
              </OptionGroup>
            )}
            {l.roles.length > 0 && (
              <OptionGroup label="Roles">
                {l.roles.map((r) => (
                  <Option key={r.id} value={`role:${r.key}`}>
                    {r.name}
                  </Option>
                ))}
              </OptionGroup>
            )}
          </Dropdown>
        </Field>
        <PersonPicker label="Add a person" value={null} onChange={(p) => p && add(`user:${p.id}`)} />
      </div>
    </div>
  );
}

function PeopleField({ label, value, onChange, l }: { label: string; value: string[]; onChange: (v: string[]) => void; l: Lookups }) {
  const styles = useStyles();
  return (
    <div className={styles.chips}>
      <PersonPicker label={label} value={null} onChange={(p) => p && !value.includes(p.id) && onChange([...value, p.id])} />
      <Chips
        label={label}
        values={value.map((id) => ({ value: id, text: l.userName(id) ?? "A person" }))}
        onRemove={(id) => onChange(value.filter((x) => x !== id))}
      />
    </div>
  );
}

/**
 * Parameters form for one action, generated from its JSON schema (`/workflow/registry`) with friendlier
 * inputs for people, teams, recipients, templates and pipeline stages.
 */
function ParamsForm({
  action,
  schema,
  onChange,
  entityType,
  blockedStages,
  errorParam,
}: {
  action: ActionDraft;
  schema: Schema;
  onChange: (params: Record<string, unknown>) => void;
  entityType: string | undefined;
  blockedStages: readonly string[];
  errorParam: string | null;
}) {
  const styles = useStyles();
  const l = useLookups();
  const templates = useTemplates(null, false, action.type === "send_email");
  const stages = usePipelineStages(action.type === "move_stage");
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const set = (k: string, v: unknown) => onChange({ ...action.params, [k]: v });

  if (props.length === 0) return <Body1 className={styles.muted}>No settings needed.</Body1>;

  return (
    <div className={styles.params}>
      {props.map(([name, raw]) => {
        const { type, nullable, prop } = propType(raw);
        const label = PARAM_LABELS[name] ?? prop.title ?? humanize(name);
        const value = action.params[name] ?? prop.default ?? null;
        const invalid = errorParam === name;
        const vs = invalid ? ("error" as const) : ("none" as const);
        const vm = invalid ? "Check this value" : undefined;

        // --- friendlier inputs by action + param
        if (action.type === "create_task" && name === "owner")
          return <OwnerField key={name} value={String(value ?? "")} onChange={(v) => set(name, v)} l={l} />;
        if (action.type === "notify" && name === "recipients")
          return <RecipientsField key={name} value={(value as string[] | null) ?? []} onChange={(v) => set(name, v)} l={l} invalid={invalid} />;
        if (action.type === "assign" && name === "user_ids")
          return <PeopleField key={name} label={label} value={(value as string[] | null) ?? []} onChange={(v) => set(name, v)} l={l} />;
        if (action.type === "assign" && name === "primary_user_id") {
          const id = typeof value === "string" ? value : null;
          return (
            <PersonPicker
              key={name}
              label={label}
              value={id}
              valueLabel={id ? (l.userName(id) ?? "") : ""}
              clearLabel="No primary recruiter"
              onChange={(p) => set(name, p?.id ?? null)}
            />
          );
        }
        if (action.type === "assign" && name === "team_ids") {
          const list = (value as string[] | null) ?? [];
          return (
            <Field key={name} label={label} hint={l.teams.length === 0 ? "You cannot browse teams." : undefined}>
              <Dropdown
                multiselect
                placeholder="Choose teams"
                value={l.teams.filter((t) => list.includes(t.id)).map((t) => t.name).join(", ")}
                selectedOptions={list}
                onOptionSelect={(_, d) => set(name, d.selectedOptions)}
              >
                {l.teams.map((t) => (
                  <Option key={t.id} value={t.id}>
                    {t.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        }
        if (action.type === "send_email" && name === "template_id") {
          const list = templates.data ?? [];
          const current = list.find((t) => t.id === value);
          return (
            <Field key={name} label={label} required validationState={vs} validationMessage={vm}>
              <Dropdown
                placeholder={templates.isPending ? "Loading templates…" : "Choose a template"}
                value={current?.name ?? ""}
                selectedOptions={typeof value === "string" ? [value] : []}
                onOptionSelect={(_, d) => set(name, d.optionValue)}
              >
                {list.map((t) => (
                  <Option key={t.id} value={t.id}>
                    {t.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        }
        if (action.type === "move_stage" && name === "to_stage_key") {
          const options = moveStageOptions(stages.data?.items ?? [], blockedStages);
          const current = options.find((s) => s.key === value);
          return (
            <Field
              key={name}
              label={label}
              required
              validationState={vs}
              validationMessage={vm}
              hint="Only stages a rule may move to are listed. Shortlisting, submitting, selecting, offering, hiring and rejecting stay with people."
            >
              <Dropdown
                placeholder="Choose a stage"
                value={current?.label ?? (typeof value === "string" ? value : "")}
                selectedOptions={typeof value === "string" ? [value] : []}
                onOptionSelect={(_, d) => set(name, d.optionValue)}
              >
                {options.map((s) => (
                  <Option key={s.key} value={s.key}>
                    {s.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        }
        if (action.type === "notify" && name === "message") {
          return (
            <Field key={name} label={label} required className={styles.wide} validationState={vs} validationMessage={vm}>
              <Textarea value={String(value ?? "")} maxLength={prop.maxLength} onChange={(_, d) => set(name, d.value)} />
            </Field>
          );
        }
        if (action.type === "send_email" && name === "to") {
          const opts = (prop.enum ?? []).filter(
            (o) =>
              (o !== "candidate" || entityType === "candidate" || entityType === "application") &&
              (o !== "primary_contact" || ["demand", "application", "submission"].includes(entityType ?? "")),
          );
          return (
            <Field key={name} label={label} required validationState={vs} validationMessage={vm}>
              <Dropdown
                placeholder="Choose a recipient"
                value={value ? (SELECTOR_LABELS[String(value)] ?? humanize(String(value))) : ""}
                selectedOptions={value ? [String(value)] : []}
                onOptionSelect={(_, d) => set(name, d.optionValue)}
              >
                {opts.map((o) => (
                  <Option key={o} value={o}>
                    {SELECTOR_LABELS[o] ?? humanize(o)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        }

        // --- generic inputs from the schema
        if (prop.enum) {
          return (
            <Field key={name} label={label} required={required.has(name)} validationState={vs} validationMessage={vm}>
              <Dropdown
                value={value ? humanize(String(value)) : ""}
                selectedOptions={value ? [String(value)] : []}
                onOptionSelect={(_, d) => set(name, d.optionValue)}
              >
                {prop.enum.map((o) => (
                  <Option key={o} value={o}>
                    {humanize(o)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        }
        if (type === "integer" || type === "number") {
          return (
            <Field
              key={name}
              label={label}
              required={required.has(name)}
              validationState={vs}
              validationMessage={vm}
              hint={nullable ? "Leave empty for none." : undefined}
            >
              <SpinButton
                value={typeof value === "number" ? value : null}
                displayValue={typeof value === "number" ? String(value) : ""}
                min={prop.minimum}
                max={prop.maximum}
                onChange={(_, d) => {
                  const n = d.value ?? (d.displayValue !== undefined && d.displayValue !== "" ? Number(d.displayValue) : null);
                  set(name, n === null || Number.isNaN(n) ? null : Math.round(n));
                }}
              />
            </Field>
          );
        }
        if (type === "array") {
          return (
            <Field
              key={name}
              label={label}
              required={required.has(name)}
              validationState={vs}
              validationMessage={vm}
              hint={prop.maxItems ? `Up to ${prop.maxItems}. Press Enter after each.` : "Press Enter after each."}
            >
              <TagsInput
                ariaLabel={label}
                value={(value as string[] | null) ?? []}
                onChange={(v) => set(name, v)}
                max={prop.maxItems}
                invalid={invalid}
              />
            </Field>
          );
        }
        return (
          <Field
            key={name}
            label={label}
            required={required.has(name)}
            validationState={vs}
            validationMessage={vm}
            hint={action.type === "create_task" && name === "title" ? "Merge fields work here, e.g. {{ demand.title }}." : undefined}
            className={name === "title" ? styles.wide : undefined}
          >
            <Input value={String(value ?? "")} maxLength={prop.maxLength} onChange={(_, d) => set(name, d.value)} />
          </Field>
        );
      })}
    </div>
  );
}

/** One "Then" step: type `Dropdown`, the generated params form, reorder and remove. */
export function ActionCard({
  index,
  count,
  action,
  types,
  entityType,
  blockedStages,
  error,
  errorParam,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  action: ActionDraft;
  types: readonly WorkflowActionTypeOut[];
  entityType: string | undefined;
  blockedStages: readonly string[];
  error: boolean;
  errorParam: string | null;
  onChange: (a: ActionDraft) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const def = types.find((t) => t.type === action.type);
  const available = types.filter((t) => actionAllowedFor(t.type, entityType));
  return (
    <Card className={mergeClasses(styles.card, error && styles.error)} data-row-id={action.id}>
      <div className={styles.head}>
        <span className={styles.step} aria-hidden>
          {index + 1}
        </span>
        <Field label={`Action ${index + 1}`} className={styles.type}>
          <Dropdown
            placeholder="Choose an action"
            value={def?.label ?? action.type}
            selectedOptions={action.type ? [action.type] : []}
            onOptionSelect={(_, d) => d.optionValue && onChange({ ...action, type: d.optionValue, params: {} })}
          >
            {available.map((t) => (
              <Option key={t.type} value={t.type}>
                {t.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Tooltip content="Move up" relationship="label">
          <Button appearance="subtle" icon={<ArrowUp16Regular />} disabled={index === 0} onClick={() => onMove(-1)} />
        </Tooltip>
        <Tooltip content="Move down" relationship="label">
          <Button appearance="subtle" icon={<ArrowDown16Regular />} disabled={index === count - 1} onClick={() => onMove(1)} />
        </Tooltip>
        <Tooltip content="Remove action" relationship="label">
          <Button appearance="subtle" icon={<Delete16Regular />} onClick={onRemove} />
        </Tooltip>
      </div>
      {def ? (
        <ParamsForm
          action={action}
          schema={def.params_schema as Schema}
          entityType={entityType}
          blockedStages={blockedStages}
          errorParam={errorParam}
          onChange={(params) => onChange({ ...action, params })}
        />
      ) : (
        action.type && <Text className={styles.muted}>This action is no longer available.</Text>
      )}
    </Card>
  );
}
