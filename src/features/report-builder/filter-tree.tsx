"use client";

import {
  Button,
  Dropdown,
  Input,
  makeStyles,
  mergeClasses,
  Option,
  SpinButton,
  Switch,
  Text,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, AddSquareMultiple16Regular, Delete16Regular } from "@fluentui/react-icons";
import {
  addChild,
  children,
  defaultValue,
  ensureRoot,
  groupKind,
  isGroup,
  newCondition,
  OP_LABELS,
  type Path,
  removeAt,
  replaceAt,
  toggleKind,
  unavailableReason,
  valueEditor,
} from "./logic";
import type { Condition, FieldCatalog, FilterNode, Op } from "./types";

const useStyles = makeStyles({
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingInlineStart: tokens.spacingHorizontalM,
    borderInlineStartWidth: "2px",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: tokens.colorBrandStroke2,
  },
  root: { borderInlineStartStyle: "none", paddingInlineStart: 0 },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  field: { minWidth: "180px" },
  op: { minWidth: "140px" },
  value: { minWidth: "160px" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const MAX_DEPTH = 5;

/** Typed value editor for one condition (number, date, enum, list...) -- never a free-form expression. */
function ValueInput({ field, cond, onChange }: { field: FieldCatalog | undefined; cond: Condition; onChange: (value: unknown) => void }) {
  const styles = useStyles();
  const editor = valueEditor(field, cond.op);
  const label = `${field?.label ?? cond.field} value`;
  switch (editor) {
    case "none":
      return null;
    case "bool":
      return <Switch aria-label={label} checked={cond.value === true} onChange={(_, d) => onChange(d.checked)} label={cond.value === true ? "Yes" : "No"} />;
    case "enum":
      return (
        <Dropdown aria-label={label} className={styles.value} selectedOptions={[String(cond.value ?? "")]} value={String(cond.value ?? "")} onOptionSelect={(_, d) => onChange(d.optionValue)}>
          {(field?.enum_values ?? []).map((v) => (
            <Option key={v} value={v}>
              {v}
            </Option>
          ))}
        </Dropdown>
      );
    case "enum_multi": {
      const selected = Array.isArray(cond.value) ? (cond.value as string[]) : [];
      return (
        <Dropdown
          aria-label={label}
          className={styles.value}
          multiselect
          selectedOptions={selected}
          value={selected.join(", ")}
          placeholder="Choose values"
          onOptionSelect={(_, d) => onChange(d.selectedOptions)}
        >
          {(field?.enum_values ?? []).map((v) => (
            <Option key={v} value={v}>
              {v}
            </Option>
          ))}
        </Dropdown>
      );
    }
    case "text_multi": {
      const list = Array.isArray(cond.value) ? (cond.value as string[]) : [];
      return (
        <Input
          aria-label={label}
          className={styles.value}
          placeholder="Values, separated by commas"
          value={list.join(", ")}
          onChange={(_, d) => onChange(d.value.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      );
    }
    case "number":
      return <SpinButton aria-label={label} className={styles.value} value={Number(cond.value ?? 0)} onChange={(_, d) => onChange(d.value ?? Number(d.displayValue ?? 0))} />;
    case "days":
      return <SpinButton aria-label={label} className={styles.value} min={1} max={3650} value={Number(cond.value ?? 30)} onChange={(_, d) => onChange(d.value ?? Number(d.displayValue ?? 30))} />;
    case "date":
      return <Input aria-label={label} className={styles.value} type="date" value={String(cond.value ?? "")} onChange={(_, d) => onChange(d.value)} />;
    case "range_number":
    case "range_date": {
      const [lo, hi] = Array.isArray(cond.value) ? (cond.value as unknown[]) : [null, null];
      const type = editor === "range_date" ? "date" : "number";
      const parse = (v: string) => (type === "number" ? Number(v) : v);
      return (
        <>
          <Input aria-label={`${label} from`} type={type} value={String(lo ?? "")} onChange={(_, d) => onChange([parse(d.value), hi])} />
          <Text className={styles.muted}>and</Text>
          <Input aria-label={`${label} to`} type={type} value={String(hi ?? "")} onChange={(_, d) => onChange([lo, parse(d.value)])} />
        </>
      );
    }
    default:
      return <Input aria-label={label} className={styles.value} value={String(cond.value ?? "")} onChange={(_, d) => onChange(d.value)} />;
  }
}

function ConditionRow({
  cond,
  fields,
  onChange,
  onRemove,
}: {
  cond: Condition;
  fields: FieldCatalog[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const field = fields.find((f) => f.key === cond.field);
  const filterable = fields.filter((f) => !unavailableReason(f, "filter"));
  return (
    <div className={styles.row}>
      <Dropdown
        aria-label="Filter field"
        className={styles.field}
        value={field?.label ?? cond.field}
        selectedOptions={[cond.field]}
        onOptionSelect={(_, d) => {
          const next = filterable.find((f) => f.key === d.optionValue);
          if (next) onChange(newCondition(next));
        }}
      >
        {filterable.map((f) => (
          <Option key={f.key} value={f.key}>
            {f.label}
          </Option>
        ))}
      </Dropdown>
      <Dropdown
        aria-label="Operator"
        className={styles.op}
        value={OP_LABELS[cond.op]}
        selectedOptions={[cond.op]}
        onOptionSelect={(_, d) => {
          const op = d.optionValue as Op;
          onChange({ field: cond.field, op, value: defaultValue(field, op) });
        }}
      >
        {(field?.ops ?? []).filter((op) => op !== "skill_match").map((op) => (
          <Option key={op} value={op}>
            {OP_LABELS[op]}
          </Option>
        ))}
      </Dropdown>
      <ValueInput field={field} cond={cond} onChange={(value) => onChange({ ...cond, value })} />
      <Button appearance="subtle" icon={<Delete16Regular />} aria-label="Remove condition" onClick={onRemove} />
    </div>
  );
}

function GroupEditor({
  root,
  path,
  fields,
  onChange,
}: {
  root: FilterNode;
  path: Path;
  fields: FieldCatalog[];
  onChange: (root: FilterNode) => void;
}) {
  const styles = useStyles();
  const node = path.reduce<FilterNode>((n, i) => children(n)[i], root);
  const kind = groupKind(node) ?? "and";
  const first = fields.find((f) => !unavailableReason(f, "filter"));
  return (
    <div className={mergeClasses(styles.group, path.length === 0 && styles.root)} role="group" aria-label={`${kind.toUpperCase()} group`}>
      <div className={styles.row}>
        <ToggleButton size="small" checked={kind === "and"} onClick={() => onChange(toggleKind(root, path))} aria-label="Match all or any">
          {kind === "and" ? "Match all (AND)" : "Match any (OR)"}
        </ToggleButton>
        <Button size="small" icon={<Add16Regular />} disabled={!first} onClick={() => first && onChange(addChild(root, path, newCondition(first)))}>
          Condition
        </Button>
        {path.length < MAX_DEPTH - 1 && (
          <Button size="small" icon={<AddSquareMultiple16Regular />} onClick={() => onChange(addChild(root, path, kind === "and" ? { or: [] } : { and: [] }))}>
            Group
          </Button>
        )}
        {path.length > 0 && <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Remove group" onClick={() => onChange(removeAt(root, path))} />}
      </div>
      {children(node).length === 0 && path.length === 0 && <Text className={styles.muted}>No filters: every row you may see is included.</Text>}
      {children(node).map((child, i) =>
        isGroup(child) ? (
          <GroupEditor key={i} root={root} path={[...path, i]} fields={fields} onChange={onChange} />
        ) : (
          <ConditionRow
            key={i}
            cond={child as Condition}
            fields={fields}
            onChange={(c) => onChange(replaceAt(root, [...path, i], c))}
            onRemove={() => onChange(removeAt(root, [...path, i]))}
          />
        ),
      )}
    </div>
  );
}

/** AND / OR filter tree built from typed editors (no expression input). */
export function FilterTree({ value, fields, onChange }: { value: FilterNode | null; fields: FieldCatalog[]; onChange: (next: FilterNode | null) => void }) {
  const root = ensureRoot(value);
  return <GroupEditor root={root} path={[]} fields={fields} onChange={(next) => onChange(children(next).length ? next : null)} />;
}
