"use client";

import {
  Body1,
  Button,
  Dropdown,
  Input,
  makeStyles,
  mergeClasses,
  Option,
  OptionGroup,
  SpinButton,
  Text,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { Add16Regular, Delete16Regular, GroupList20Regular } from "@fluentui/react-icons";
import type { WorkflowFieldOut } from "@/lib/api/types";
import { TagsInput } from "./inputs";
import {
  type ClauseDraft,
  coerceValue,
  type ConditionsDraft,
  fieldByPath,
  type GroupDraft,
  humanize,
  type Match,
  newClause,
  newGroup,
  OP_LABELS,
  valueEditorKind,
} from "./rule-model";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  matchRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  clause: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1.2fr) minmax(130px, 0.8fr) minmax(160px, 1.4fr) auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "start",
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusMedium,
    "@media (max-width: 767px)": { gridTemplateColumns: "1fr" },
  },
  error: {
    outline: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    paddingInlineStart: tokens.spacingHorizontalM,
    borderLeft: `${tokens.strokeWidthThicker} solid ${tokens.colorBrandStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  always: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  control: { minWidth: 0, width: "100%" },
});

function MatchPicker({ value, onChange, label }: { value: Match; onChange: (m: Match) => void; label: string }) {
  return (
    <Dropdown
      aria-label={label}
      value={value === "all" ? "all" : "any"}
      selectedOptions={[value]}
      onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue as Match)}
      style={{ minWidth: 90, width: 90 }}
    >
      <Option value="all">all</Option>
      <Option value="any">any</Option>
    </Dropdown>
  );
}

/** The value input for a clause, chosen from the field type and operator (see `valueEditorKind`). */
export function ValueEditor({
  field,
  op,
  value,
  onChange,
  invalid,
}: {
  field: WorkflowFieldOut | undefined;
  op: string;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
}) {
  const styles = useStyles();
  const kind = valueEditorKind(field?.type, op);
  const label = `Value for ${field?.label ?? "condition"}`;
  const v = coerceValue(kind, value);
  switch (kind) {
    case "none":
      return <span aria-hidden />;
    case "enum":
      return (
        <Dropdown
          className={styles.control}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={v ? humanize(String(v)) : ""}
          placeholder="Choose a value"
          selectedOptions={v ? [String(v)] : []}
          onOptionSelect={(_, d) => onChange(d.optionValue ?? "")}
        >
          {(field?.values ?? []).map((x) => (
            <Option key={x} value={x}>
              {humanize(x)}
            </Option>
          ))}
        </Dropdown>
      );
    case "enum-multi": {
      const list = v as string[];
      return (
        <Dropdown
          multiselect
          className={styles.control}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={list.map(humanize).join(", ")}
          placeholder="Choose values"
          selectedOptions={list}
          onOptionSelect={(_, d) => onChange(d.selectedOptions)}
        >
          {(field?.values ?? []).map((x) => (
            <Option key={x} value={x}>
              {humanize(x)}
            </Option>
          ))}
        </Dropdown>
      );
    }
    case "number":
      return (
        <SpinButton
          className={styles.control}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={v as number}
          step={field?.type === "decimal" ? 0.5 : 1}
          onChange={(_, d) => {
            const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : NaN);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
      );
    case "date": {
      const s = String(v ?? "");
      const [y, m, d] = s.split("-").map(Number);
      return (
        <DatePicker
          className={styles.control}
          aria-label={label}
          value={s && y ? new Date(y, m - 1, d) : null}
          placeholder="Choose a date"
          onSelectDate={(date) =>
            onChange(
              date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                : "",
            )
          }
        />
      );
    }
    case "bool":
      return (
        <Dropdown
          className={styles.control}
          aria-label={label}
          value={v ? "Yes" : "No"}
          selectedOptions={[v ? "true" : "false"]}
          onOptionSelect={(_, d) => onChange(d.optionValue === "true")}
        >
          <Option value="true">Yes</Option>
          <Option value="false">No</Option>
        </Dropdown>
      );
    case "tags":
      return (
        <TagsInput
          ariaLabel={label}
          value={v as string[]}
          onChange={onChange}
          placeholder={field?.type === "uuid" ? "Paste IDs, press Enter" : "Type a value, press Enter"}
          invalid={invalid}
        />
      );
    default:
      return (
        <Input
          className={styles.control}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={String(v ?? "")}
          placeholder={field?.type === "uuid" ? "Record ID" : "Value"}
          onChange={(_, d) => onChange(d.value)}
        />
      );
  }
}

function ClauseRow({
  clause,
  fields,
  onChange,
  onRemove,
  errorRowId,
}: {
  clause: ClauseDraft;
  fields: readonly WorkflowFieldOut[];
  onChange: (c: ClauseDraft) => void;
  onRemove: () => void;
  errorRowId: string | null;
}) {
  const styles = useStyles();
  const field = fieldByPath(fields, clause.field);
  const ops = field?.ops ?? [];
  const entityFields = fields.filter((f) => !f.path.startsWith("event."));
  const eventFields = fields.filter((f) => f.path.startsWith("event."));
  const invalid = errorRowId === clause.id;

  return (
    <div className={mergeClasses(styles.clause, invalid && styles.error)} data-row-id={clause.id}>
      <Dropdown
        className={styles.control}
        aria-label="Field"
        placeholder="Choose a field"
        value={field?.label ?? clause.field}
        selectedOptions={clause.field ? [clause.field] : []}
        onOptionSelect={(_, d) => {
          const next = fieldByPath(fields, d.optionValue ?? "");
          if (!next) return;
          const op = next.ops.includes(clause.op) ? clause.op : (next.ops.includes("eq") ? "eq" : next.ops[0]);
          onChange({ ...clause, field: next.path, op, value: coerceValue(valueEditorKind(next.type, op), null) });
        }}
      >
        <OptionGroup label="Record">
          {entityFields.map((f) => (
            <Option key={f.path} value={f.path}>
              {f.label}
            </Option>
          ))}
        </OptionGroup>
        {eventFields.length > 0 && (
          <OptionGroup label="Event">
            {eventFields.map((f) => (
              <Option key={f.path} value={f.path}>
                {f.label}
              </Option>
            ))}
          </OptionGroup>
        )}
      </Dropdown>
      <Dropdown
        className={styles.control}
        aria-label="Operator"
        disabled={!field}
        value={OP_LABELS[clause.op] ?? clause.op}
        selectedOptions={[clause.op]}
        onOptionSelect={(_, d) => {
          const op = d.optionValue ?? clause.op;
          onChange({ ...clause, op, value: coerceValue(valueEditorKind(field?.type, op), clause.value) });
        }}
      >
        {ops.map((op) => (
          <Option key={op} value={op}>
            {OP_LABELS[op] ?? op}
          </Option>
        ))}
      </Dropdown>
      <ValueEditor
        field={field}
        op={clause.op}
        value={clause.value}
        invalid={invalid}
        onChange={(value) => onChange({ ...clause, value })}
      />
      <Tooltip content="Remove condition" relationship="label">
        <Button appearance="subtle" icon={<Delete16Regular />} onClick={onRemove} />
      </Tooltip>
    </div>
  );
}

/** "If" card body: match all / any of rows `field → operator → value`, with one nested group level. */
export function ConditionEditor({
  value,
  onChange,
  fields,
  errorRowId,
  maxClauses,
}: {
  value: ConditionsDraft;
  onChange: (d: ConditionsDraft) => void;
  fields: readonly WorkflowFieldOut[];
  errorRowId: string | null;
  maxClauses: number;
}) {
  const styles = useStyles();
  const clauseCount = value.items.reduce((n, i) => n + (i.kind === "clause" ? 1 : i.clauses.length), 0);
  const full = clauseCount >= maxClauses;
  const setItems = (items: ConditionsDraft["items"]) => onChange({ ...value, items });
  const setGroup = (g: GroupDraft) => setItems(value.items.map((i) => (i.id === g.id ? g : i)));

  return (
    <div className={styles.root}>
      {value.items.length === 0 ? (
        <Body1 className={styles.always}>Always — the rule runs for every event of this trigger.</Body1>
      ) : (
        <div className={styles.matchRow}>
          <Text>Match</Text>
          <MatchPicker label="Match all or any" value={value.match} onChange={(match) => onChange({ ...value, match })} />
          <Text>of these conditions</Text>
        </div>
      )}
      {value.items.map((item) =>
        item.kind === "clause" ? (
          <ClauseRow
            key={item.id}
            clause={item}
            fields={fields}
            errorRowId={errorRowId}
            onChange={(c) => setItems(value.items.map((i) => (i.id === c.id ? c : i)))}
            onRemove={() => setItems(value.items.filter((i) => i.id !== item.id))}
          />
        ) : (
          <div
            key={item.id}
            className={mergeClasses(styles.group, errorRowId === item.id && styles.error)}
            data-row-id={item.id}
          >
            <div className={styles.matchRow}>
              <GroupList20Regular aria-hidden />
              <Text>Group: match</Text>
              <MatchPicker label="Group match all or any" value={item.match} onChange={(match) => setGroup({ ...item, match })} />
              <Text>of</Text>
              <div style={{ flex: 1 }} />
              <Tooltip content="Remove group" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Delete16Regular />}
                  onClick={() => setItems(value.items.filter((i) => i.id !== item.id))}
                />
              </Tooltip>
            </div>
            {item.clauses.map((c) => (
              <ClauseRow
                key={c.id}
                clause={c}
                fields={fields}
                errorRowId={errorRowId}
                onChange={(next) => setGroup({ ...item, clauses: item.clauses.map((x) => (x.id === next.id ? next : x)) })}
                onRemove={() => {
                  const clauses = item.clauses.filter((x) => x.id !== c.id);
                  if (clauses.length === 0) setItems(value.items.filter((i) => i.id !== item.id));
                  else setGroup({ ...item, clauses });
                }}
              />
            ))}
            <div>
              <Button
                size="small"
                appearance="subtle"
                icon={<Add16Regular />}
                disabled={full}
                onClick={() => setGroup({ ...item, clauses: [...item.clauses, newClause()] })}
              >
                Add condition to group
              </Button>
            </div>
          </div>
        ),
      )}
      <div className={styles.actions}>
        <Button icon={<Add16Regular />} disabled={full} onClick={() => setItems([...value.items, newClause()])}>
          Add condition
        </Button>
        <Button
          appearance="subtle"
          icon={<GroupList20Regular />}
          disabled={full}
          onClick={() => setItems([...value.items, newGroup(value.match === "all" ? "any" : "all")])}
        >
          Add group
        </Button>
      </div>
    </div>
  );
}
