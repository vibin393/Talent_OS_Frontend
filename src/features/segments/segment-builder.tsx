"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  OptionGroup,
  Radio,
  RadioGroup,
  Slider,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tag,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, LockClosed16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SkillPicker } from "@/features/candidates/skill-picker";
import { useDebounced } from "@/lib/use-debounced";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { segmentKeys, segmentsApi } from "./api";
import {
  coerceList,
  coerceScalar,
  countConditions,
  defaultValue,
  definitionToTree,
  emptyCondition,
  emptyGroup,
  groupFields,
  MAX_CONDITIONS,
  MAX_DEPTH,
  nodeIdAtPath,
  operatorLabel,
  operatorsForField,
  PREVIEW_DEBOUNCE_MS,
  treeToDefinition,
  unavailableFields,
  updateNode,
  valueKind,
  withinDaysParts,
  type BuilderCondition,
  type BuilderGroup,
  type BuilderNode,
} from "./logic";
import type { BuilderSourceKey, Definition, SemanticField, SemanticSource, SkillMatchValue } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  nested: { backgroundColor: tokens.colorNeutralBackground2 },
  groupHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1 },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusMedium,
  },
  rowError: { outline: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}` },
  field: { minWidth: "220px", flex: "1 1 220px", maxWidth: "320px" },
  op: { minWidth: "160px" },
  value: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center", flex: "2 1 240px" },
  small: { width: "120px" },
  skill: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minWidth: "260px", flex: "2 1 260px" },
  preview: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  previewHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  tableWrap: { overflowX: "auto", maxHeight: "320px", overflowY: "auto" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * Segment builder (Epic 38): a nested AND/OR tree of `{field, operator, value}` rows fed by the semantic
 * catalogue, plus a live preview (count + first 50 rows, debounced 600 ms). There is no free-text input
 * of expressions: every value editor is typed by its field.
 */
export function SegmentBuilder({
  sourceKey,
  initial,
  onChange,
  disabled,
  showPreview = true,
}: {
  sourceKey: BuilderSourceKey;
  initial?: Definition | null;
  onChange?: (definition: Definition) => void;
  disabled?: boolean;
  showPreview?: boolean;
}) {
  const styles = useStyles();
  const [tree, setTree] = useState<BuilderGroup>(() => definitionToTree(initial));
  const catalogue = useQuery({
    queryKey: segmentKeys.source(sourceKey),
    queryFn: ({ signal }) => segmentsApi.source(sourceKey, signal),
    staleTime: 5 * 60_000,
  });

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const definition = useMemo(() => treeToDefinition(tree), [tree]);
  const json = JSON.stringify(definition);
  useEffect(() => {
    onChangeRef.current?.(JSON.parse(json) as Definition);
  }, [json]);

  const previewDefn = useMemo(() => treeToDefinition(tree, { dropIncomplete: true }), [tree]);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const errorNodeId = nodeIdAtPath(tree, errorPath);
  const missing = unavailableFields(definition, catalogue.data);
  const total = countConditions(tree);

  const set = (id: string, fn: (n: BuilderNode) => BuilderNode | null) => setTree((t) => updateNode(t, id, fn));

  if (catalogue.isPending) return <Spinner size="small" label="Loading fields…" />;
  if (catalogue.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>Could not load the fields: {errorMessage(catalogue.error)}</MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className={styles.root}>
      {missing.length > 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Some conditions use fields that are not available to you or no longer exist: {missing.join(", ")}. Change or
            remove them before saving.
          </MessageBarBody>
        </MessageBar>
      )}
      <GroupEditor
        group={tree}
        depth={1}
        source={catalogue.data}
        total={total}
        disabled={disabled}
        errorNodeId={errorPath ? errorNodeId : null}
        set={set}
        isRoot
      />
      {showPreview && <SegmentPreviewPanel sourceKey={sourceKey} definition={previewDefn} onErrorPath={setErrorPath} />}
    </div>
  );
}

function GroupEditor({
  group,
  depth,
  source,
  total,
  disabled,
  errorNodeId,
  set,
  isRoot,
}: {
  group: BuilderGroup;
  depth: number;
  source: SemanticSource;
  total: number;
  disabled?: boolean;
  errorNodeId: string | null;
  set: (id: string, fn: (n: BuilderNode) => BuilderNode | null) => void;
  isRoot?: boolean;
}) {
  const styles = useStyles();
  const full = total >= MAX_CONDITIONS;
  const addChild = (child: BuilderNode) =>
    set(group.id, (n) => (n.kind === "group" ? { ...n, children: [...n.children, child] } : n));
  return (
    <div className={mergeClasses(styles.group, !isRoot && styles.nested)} role="group" aria-label={isRoot ? "Conditions" : "Condition group"}>
      <div className={styles.groupHead}>
        <Text weight="semibold">Match</Text>
        <RadioGroup
          layout="horizontal"
          value={group.combinator}
          disabled={disabled}
          aria-label="Combine conditions with"
          onChange={(_, d) => set(group.id, (n) => (n.kind === "group" ? { ...n, combinator: d.value as "and" | "or" } : n))}
        >
          <Radio value="and" label="All (AND)" />
          <Radio value="or" label="Any (OR)" />
        </RadioGroup>
        <span className={styles.grow} />
        {!isRoot && (
          <Button size="small" appearance="subtle" icon={<Delete16Regular />} disabled={disabled} onClick={() => set(group.id, () => null)}>
            Remove group
          </Button>
        )}
      </div>
      {group.children.length === 0 && <Caption1 className={styles.muted}>No conditions: every record matches.</Caption1>}
      {group.children.map((child) =>
        child.kind === "group" ? (
          <GroupEditor
            key={child.id}
            group={child}
            depth={depth + 1}
            source={source}
            total={total}
            disabled={disabled}
            errorNodeId={errorNodeId}
            set={set}
          />
        ) : (
          <ConditionRow
            key={child.id}
            cond={child}
            source={source}
            disabled={disabled}
            highlighted={errorNodeId === child.id}
            onChange={(next) => set(child.id, () => next)}
            onRemove={() => set(child.id, () => null)}
          />
        ),
      )}
      <div className={styles.groupHead}>
        <Button size="small" icon={<Add16Regular />} disabled={disabled || full} onClick={() => addChild(emptyCondition())}>
          Add condition
        </Button>
        <Tooltip
          content={depth >= MAX_DEPTH ? `Groups can be nested ${MAX_DEPTH} levels deep.` : "Add a nested group"}
          relationship="description"
        >
          <Button
            size="small"
            icon={<Add16Regular />}
            disabled={disabled || full || depth >= MAX_DEPTH}
            onClick={() => addChild(emptyGroup(group.combinator === "and" ? "or" : "and"))}
          >
            Add group
          </Button>
        </Tooltip>
        {full && <Caption1 className={styles.muted}>Up to {MAX_CONDITIONS} conditions.</Caption1>}
      </div>
    </div>
  );
}

function FieldCombobox({
  source,
  value,
  disabled,
  onSelect,
}: {
  source: SemanticSource;
  value: string;
  disabled?: boolean;
  onSelect: (field: SemanticField) => void;
}) {
  const styles = useStyles();
  const groups = useMemo(() => groupFields(source), [source]);
  const selected = source.fields.find((f) => f.key === value);
  const [query, setQuery] = useState<string | null>(null);
  const q = (query ?? "").trim().toLowerCase();
  return (
    <Combobox
      className={styles.field}
      aria-label="Field"
      placeholder="Choose a field"
      disabled={disabled}
      value={query ?? selected?.label ?? value}
      selectedOptions={value ? [value] : []}
      onChange={(e) => setQuery(e.target.value)}
      onOpenChange={(_, d) => !d.open && setQuery(null)}
      onOptionSelect={(_, d) => {
        const f = source.fields.find((x) => x.key === d.optionValue);
        setQuery(null);
        if (f) onSelect(f);
      }}
    >
      {groups.map((g) => {
        const fields = g.fields.filter((f) => !q || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q));
        if (fields.length === 0) return null;
        return (
          <OptionGroup key={g.key || "base"} label={g.label}>
            {fields.map((f) => (
              <Option key={f.key} value={f.key} text={f.label}>
                {f.label}
              </Option>
            ))}
          </OptionGroup>
        );
      })}
    </Combobox>
  );
}

function ConditionRow({
  cond,
  source,
  disabled,
  highlighted,
  onChange,
  onRemove,
}: {
  cond: BuilderCondition;
  source: SemanticSource;
  disabled?: boolean;
  highlighted?: boolean;
  onChange: (next: BuilderCondition) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const field = source.fields.find((f) => f.key === cond.field && f.ops.length > 0) ?? null;
  const ops = operatorsForField(field);
  return (
    <div className={mergeClasses(styles.row, highlighted && styles.rowError)}>
      <FieldCombobox
        source={source}
        value={cond.field}
        disabled={disabled}
        onSelect={(f) => {
          const op = operatorsForField(f)[0] ?? "";
          onChange({ ...cond, field: f.key, op, value: op ? defaultValue(f, op) : null });
        }}
      />
      <Dropdown
        className={styles.op}
        aria-label="Operator"
        placeholder="Operator"
        disabled={disabled || !field}
        value={cond.op ? operatorLabel(cond.op, field?.type) : ""}
        selectedOptions={cond.op ? [cond.op] : []}
        onOptionSelect={(_, d) => {
          if (!field || !d.optionValue) return;
          const sameKind = cond.op && valueKind(field, cond.op) === valueKind(field, d.optionValue);
          onChange({ ...cond, op: d.optionValue, value: sameKind ? cond.value : defaultValue(field, d.optionValue) });
        }}
      >
        {ops.map((op) => (
          <Option key={op} value={op}>
            {operatorLabel(op, field?.type)}
          </Option>
        ))}
      </Dropdown>
      {field && cond.op ? (
        <ValueEditor field={field} op={cond.op} value={cond.value} disabled={disabled} onChange={(value) => onChange({ ...cond, value })} />
      ) : (
        <span className={styles.value} />
      )}
      <Button appearance="subtle" icon={<Delete16Regular />} aria-label="Remove condition" disabled={disabled} onClick={onRemove} />
    </div>
  );
}

/** Text input whose raw text is kept locally and parsed into the typed value on every change. */
function ParsedInput({
  initial,
  parse,
  onValue,
  type = "text",
  label,
  className,
  disabled,
  placeholder,
}: {
  initial: string;
  parse: (raw: string) => unknown;
  onValue: (v: unknown) => void;
  type?: "text" | "number" | "date" | "datetime-local";
  label: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(initial);
  return (
    <Input
      className={className}
      aria-label={label}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      value={raw}
      onChange={(_, d) => {
        setRaw(d.value);
        onValue(parse(d.value));
      }}
    />
  );
}

function ValueEditor({
  field,
  op,
  value,
  disabled,
  onChange,
}: {
  field: SemanticField;
  op: string;
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const styles = useStyles();
  const kind = valueKind(field, op);
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  // `key` resets local text state when the editor kind changes.
  const k = `${field.key}:${kind}`;
  switch (kind) {
    case "is_null":
      return (
        <div className={styles.value}>
          <Dropdown
            aria-label="Empty or not"
            disabled={disabled}
            value={value === false ? "is not empty" : "is empty"}
            selectedOptions={[value === false ? "no" : "yes"]}
            onOptionSelect={(_, d) => onChange(d.optionValue === "yes")}
          >
            <Option value="yes">is empty</Option>
            <Option value="no">is not empty</Option>
          </Dropdown>
        </div>
      );
    case "bool":
      return (
        <div className={styles.value}>
          <Dropdown
            aria-label="Value"
            disabled={disabled}
            value={value === false ? "No" : "Yes"}
            selectedOptions={[value === false ? "false" : "true"]}
            onOptionSelect={(_, d) => onChange(d.optionValue === "true")}
          >
            <Option value="true">Yes</Option>
            <Option value="false">No</Option>
          </Dropdown>
        </div>
      );
    case "enum":
      return (
        <div className={styles.value}>
          <Dropdown
            aria-label="Value"
            placeholder="Choose a value"
            disabled={disabled}
            value={str(value)}
            selectedOptions={value ? [String(value)] : []}
            onOptionSelect={(_, d) => onChange(d.optionValue ?? null)}
          >
            {(field.enum_values ?? []).map((v) => (
              <Option key={v} value={v}>
                {v}
              </Option>
            ))}
          </Dropdown>
        </div>
      );
    case "enum_multi": {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className={styles.value}>
          <Dropdown
            multiselect
            aria-label="Values"
            placeholder="Choose values"
            disabled={disabled}
            value={selected.join(", ")}
            selectedOptions={selected}
            onOptionSelect={(_, d) => onChange(d.selectedOptions)}
          >
            {(field.enum_values ?? []).map((v) => (
              <Option key={v} value={v}>
                {v}
              </Option>
            ))}
          </Dropdown>
        </div>
      );
    }
    case "text_multi":
    case "number_multi":
      return (
        <div className={styles.value}>
          <ParsedInput
            key={k}
            label="Values, comma separated"
            placeholder="value 1, value 2"
            disabled={disabled}
            initial={Array.isArray(value) ? value.join(", ") : ""}
            parse={(raw) => coerceList(kind, raw, field.type)}
            onValue={onChange}
          />
        </div>
      );
    case "number_range":
    case "date_range": {
      const pair = Array.isArray(value) ? value : [null, null];
      const type = kind === "date_range" ? "date" : "number";
      return (
        <div className={styles.value}>
          <ParsedInput
            key={`${k}:lo`}
            label="From"
            type={type}
            className={styles.small}
            disabled={disabled}
            initial={str(pair[0])}
            parse={(raw) => coerceScalar(kind, raw, field.type)}
            onValue={(v) => onChange([v, pair[1] ?? null])}
          />
          <Text>and</Text>
          <ParsedInput
            key={`${k}:hi`}
            label="To"
            type={type}
            className={styles.small}
            disabled={disabled}
            initial={str(pair[1])}
            parse={(raw) => coerceScalar(kind, raw, field.type)}
            onValue={(v) => onChange([pair[0] ?? null, v])}
          />
        </div>
      );
    }
    case "within_days": {
      const { days, direction } = withinDaysParts(value);
      return (
        <div className={styles.value}>
          <Dropdown
            aria-label="Direction"
            disabled={disabled}
            value={direction === "future" ? "the next" : "the last"}
            selectedOptions={[direction]}
            onOptionSelect={(_, d) => onChange({ days: days ?? 0, direction: d.optionValue === "future" ? "future" : "past" })}
          >
            <Option value="past">the last</Option>
            <Option value="future">the next</Option>
          </Dropdown>
          <ParsedInput
            key={k}
            label="Days"
            type="number"
            className={styles.small}
            disabled={disabled}
            initial={str(days)}
            parse={(raw) => coerceScalar("number", raw, "int")}
            onValue={(v) => onChange({ days: typeof v === "number" ? Math.max(0, v) : null, direction })}
          />
          <Text>days</Text>
        </div>
      );
    }
    case "skill":
      return <SkillValueEditor value={value as SkillDraft | null} disabled={disabled} onChange={onChange} />;
    case "number":
      return (
        <div className={styles.value}>
          <ParsedInput
            key={k}
            label="Value"
            type="number"
            disabled={disabled}
            initial={str(value)}
            parse={(raw) => coerceScalar("number", raw, field.type)}
            onValue={onChange}
          />
        </div>
      );
    case "date":
      return (
        <div className={styles.value}>
          <ParsedInput
            key={k}
            label="Date"
            type="date"
            disabled={disabled}
            initial={str(value)}
            parse={(raw) => coerceScalar("date", raw)}
            onValue={onChange}
          />
        </div>
      );
    default:
      return (
        <div className={styles.value}>
          <ParsedInput key={k} label="Value" disabled={disabled} initial={str(value)} parse={(raw) => coerceScalar("text", raw)} onValue={onChange} />
        </div>
      );
  }
}

/** A `skill_match` value while it is being edited (no skill picked yet). */
type SkillDraft = Omit<SkillMatchValue, "ref"> & { ref: SkillMatchValue["ref"] | null };

/** Skill value: catalogue picker + minimum proficiency (1-5) + "Include related skills". */
function SkillValueEditor({
  value,
  disabled,
  onChange,
}: {
  value: SkillDraft | null;
  disabled?: boolean;
  onChange: (v: SkillDraft) => void;
}) {
  const styles = useStyles();
  const v: SkillDraft = {
    ref: value?.ref ?? null,
    min_proficiency: value?.min_proficiency ?? null,
    expand: value?.expand ?? true,
    label: value?.label,
  };
  return (
    <div className={styles.skill}>
      {v.ref?.id ? (
        <div className={styles.previewHead}>
          <Tag size="small" appearance="brand">
            {v.label ?? "Selected skill"}
          </Tag>
          <Button size="small" appearance="subtle" disabled={disabled} onClick={() => onChange({ ...v, ref: null, label: undefined })}>
            Change
          </Button>
        </div>
      ) : (
        <SkillPicker
          label="Skill"
          allowNew={false}
          disabled={disabled}
          onPick={(skill) => {
            if (skill) onChange({ ...v, ref: { kind: skill.kind, id: skill.id }, label: skill.name });
          }}
        />
      )}
      <Checkbox
        label="Minimum proficiency"
        disabled={disabled}
        checked={v.min_proficiency !== null}
        onChange={(_, d) => onChange({ ...v, min_proficiency: d.checked ? (v.min_proficiency ?? 3) : null })}
      />
      {v.min_proficiency !== null && (
        <Field label={`At least ${v.min_proficiency} of 5`}>
          <Slider
            min={1}
            max={5}
            step={1}
            disabled={disabled}
            value={v.min_proficiency}
            onChange={(_, d) => onChange({ ...v, min_proficiency: d.value })}
          />
        </Field>
      )}
      <Switch label="Include related skills" disabled={disabled} checked={v.expand} onChange={(_, d) => onChange({ ...v, expand: d.checked })} />
    </div>
  );
}

function cellText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(cellText).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Live preview: matching count and the first 50 rows of `definition`, debounced 600 ms. */
export function SegmentPreviewPanel({
  sourceKey,
  definition,
  onErrorPath,
}: {
  sourceKey: BuilderSourceKey;
  definition: Definition;
  onErrorPath?: (path: string | null) => void;
}) {
  const styles = useStyles();
  const json = useDebounced(JSON.stringify(definition), PREVIEW_DEBOUNCE_MS);
  const preview = useQuery({
    queryKey: segmentKeys.preview(sourceKey, json),
    queryFn: ({ signal }) => segmentsApi.preview(sourceKey, JSON.parse(json) as Definition, signal),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 30_000,
  });
  const errPath = preview.isError && isApiError(preview.error) && typeof preview.error.details.path === "string" ? preview.error.details.path : null;
  const onErrorPathRef = useRef(onErrorPath);
  useEffect(() => {
    onErrorPathRef.current = onErrorPath;
  });
  useEffect(() => {
    onErrorPathRef.current?.(errPath);
  }, [errPath]);

  const data = preview.data;
  return (
    <section className={styles.preview} aria-label="Preview">
      <div className={styles.previewHead}>
        <Subtitle2 as="h3">Preview</Subtitle2>
        {preview.isFetching && <Spinner size="extra-tiny" aria-label="Updating preview" />}
        {data && !preview.isError && (
          <Badge appearance="tint" color="brand" aria-live="polite">
            {data.count.toLocaleString()} {data.count === 1 ? "match" : "matches"}
          </Badge>
        )}
      </div>
      {preview.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {errorMessage(preview.error)}
            {errPath ? ` (at ${errPath})` : ""}
          </MessageBarBody>
        </MessageBar>
      ) : data ? (
        data.rows.length === 0 ? (
          <Body1 className={styles.muted}>No records match these conditions.</Body1>
        ) : (
          <div className={styles.tableWrap}>
            <Table size="small" aria-label="Preview rows">
              <TableHeader>
                <TableRow>
                  {data.columns.map((c) => (
                    <TableHeaderCell key={c.key}>
                      {c.label}
                      {(c.masked || data.masked_fields.includes(c.key)) && (
                        <Tooltip content="Masked for your role" relationship="label">
                          <LockClosed16Regular style={{ marginLeft: 4, verticalAlign: "middle" }} />
                        </Tooltip>
                      )}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.subject_id}>
                    {data.columns.map((c) => (
                      <TableCell key={c.key}>{cellText(r[c.key])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.count > data.rows.length && (
              <Caption1 className={styles.muted}>
                Showing the first {data.rows.length} of {data.count.toLocaleString()}.
              </Caption1>
            )}
          </div>
        )
      ) : (
        <Spinner size="tiny" label="Computing preview…" />
      )}
    </section>
  );
}
