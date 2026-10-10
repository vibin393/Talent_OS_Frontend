"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Caption1,
  Checkbox,
  Divider,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  mergeClasses,
  Option,
  OverlayDrawer,
  Radio,
  RadioGroup,
  SpinButton,
  Subtitle2,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  Add16Regular,
  ArrowDown16Regular,
  ArrowUp16Regular,
  Delete16Regular,
  Dismiss24Regular,
  ReOrderDotsVertical16Regular,
} from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import {
  changeKind,
  CHOICE_KINDS,
  codeLines,
  emptyItemForm,
  isCodeKind,
  ITEM_KIND_LABELS,
  ITEM_KINDS,
  type ItemForm,
  itemFormErrors,
  itemFormFromItem,
  moveInList,
  nextChoiceId,
  parseBlankMarkers,
  RUBRIC_KINDS,
  shortId,
  toggleIn,
  toItemBody,
} from "./logic";
import type { ItemKind, ItemOut } from "./types";
import { ListInput, useAsmStyles } from "./ui";
import { useItemVersions } from "./use-assessments";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  fill: { flex: 1, minWidth: 0 },
  codeArea: { "& textarea": { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200, whiteSpace: "pre", overflowWrap: "normal" } },
  optionRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  optionId: { fontFamily: tokens.fontFamilyMonospace, minWidth: "2ch", color: tokens.colorNeutralForeground3 },
  listRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalXXS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  dragging: { boxShadow: tokens.shadow8, zIndex: 1 },
  handle: { cursor: "grab", touchAction: "none" },
  lineList: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  bugLines: {
    margin: 0,
    padding: tokens.spacingVerticalXS,
    listStyleType: "none",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: "320px",
    overflowY: "auto",
  },
  bugLine: { display: "flex", alignItems: "center", fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200, whiteSpace: "pre" },
  bugMarked: { backgroundColor: tokens.colorPaletteRedBackground1 },
  criterion: {
    display: "grid",
    gridTemplateColumns: "minmax(80px, 1fr) minmax(140px, 2fr) 90px auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr" },
  },
  blank: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingHorizontalS, border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
});

/** Item editor drawer: shared fields plus a kind-specific answer form. Saving an existing item creates a new version. */
export function ItemEditorDrawer({ item, onClose, onSaved }: { item: ItemOut | null; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const [form, setForm] = useState<ItemForm>(() => (item ? itemFormFromItem(item) : emptyItemForm("single")));
  const [errors, setErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versions = useItemVersions(item?.id ?? null);
  const set = (patch: Partial<ItemForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const e = itemFormErrors(form);
    setErrors(e);
    if (e.length) return;
    setBusy(true);
    setError(null);
    try {
      const body = toItemBody(form);
      if (item) {
        const { kind: _kind, ...update } = body;
        void _kind;
        await assessmentsApi.updateItem(item.id, update);
      } else await assessmentsApi.createItem(body);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayDrawer position="end" size="large" open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {item ? `Edit ${item.human_id} (v${item.current_version})` : "New item"}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <div className={styles.form}>
          <Field label="Kind" hint={item ? "The kind cannot change after creation." : undefined}>
            <Dropdown
              value={ITEM_KIND_LABELS[form.kind]}
              selectedOptions={[form.kind]}
              disabled={Boolean(item)}
              onOptionSelect={(_, d) => d.optionValue && setForm((f) => changeKind(f, d.optionValue as ItemKind))}
            >
              {ITEM_KINDS.map((k) => (
                <Option key={k} value={k}>
                  {ITEM_KIND_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Question stem" required hint="Markdown is allowed.">
            <Textarea value={form.stem} rows={4} resize="vertical" maxLength={8000} onChange={(_, d) => set({ stem: d.value })} />
          </Field>
          <div className={asm.row}>
            <div className={asm.grow}>
              <ListInput label="Skill keys" value={form.skillKeys} onChange={(v) => set({ skillKeys: v })} placeholder="python, sql" />
            </div>
            <div className={asm.grow}>
              <ListInput label="Tags" value={form.tags} onChange={(v) => set({ tags: v })} />
            </div>
          </div>
          <div className={asm.row}>
            <Field label="Difficulty (1–5)">
              <SpinButton
                className={asm.narrow}
                value={form.difficulty}
                min={1}
                max={5}
                onChange={(_, d) => {
                  const v = d.value ?? Number(d.displayValue);
                  if (Number.isFinite(v)) set({ difficulty: Math.min(5, Math.max(1, Math.round(Number(v)))) });
                }}
              />
            </Field>
            <Field label="Points">
              <Input className={asm.narrow} value={form.points} inputMode="decimal" onChange={(_, d) => set({ points: d.value })} />
            </Field>
            {isCodeKind(form.kind) && (
              <Field label="Language" hint="Display only; code is never run.">
                <Input value={form.language} placeholder="python" maxLength={40} onChange={(_, d) => set({ language: d.value })} />
              </Field>
            )}
          </div>
          <Divider />
          <KindForm form={form} set={set} />
          {errors.length > 0 && (
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                <ul>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </MessageBarBody>
            </MessageBar>
          )}
          <ErrorBar message={error} />
          {item && (versions.data?.length ?? 0) > 0 && (
            <>
              <Subtitle2 as="h3">Versions</Subtitle2>
              <ul>
                {versions.data?.map((v) => (
                  <li key={v.id}>
                    <Text>
                      v{v.version} · {formatDateTime(v.created_at)} · {v.points} pts
                    </Text>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button appearance="primary" disabled={busy} onClick={() => void save()}>
          {item ? "Save as new version" : "Create item"}
        </Button>
      </DrawerFooter>
    </OverlayDrawer>
  );
}

type SetForm = (patch: Partial<ItemForm>) => void;

function KindForm({ form, set }: { form: ItemForm; set: SetForm }) {
  if (CHOICE_KINDS.has(form.kind)) return <ChoicesEditor form={form} set={set} />;
  switch (form.kind) {
    case "numeric":
      return <NumericEditor form={form} set={set} />;
    case "short_text":
      return <ShortTextEditor form={form} set={set} />;
    case "code_output":
      return <CodeOutputEditor form={form} set={set} />;
    case "code_fill":
      return <CodeFillEditor form={form} set={set} />;
    case "code_order":
      return <CodeOrderEditor form={form} set={set} />;
    case "code_find_bug":
      return <FindBugEditor form={form} set={set} />;
    default:
      return RUBRIC_KINDS.has(form.kind) ? <RubricEditor form={form} set={set} /> : null;
  }
}

function CodeArea({ form, set, label = "Code", hint }: { form: ItemForm; set: SetForm; label?: string; hint?: string }) {
  const styles = useStyles();
  return (
    <Field label={label} hint={hint ?? "Display only; candidate code is never executed."}>
      <Textarea
        className={styles.codeArea}
        value={form.code}
        rows={10}
        resize="vertical"
        spellCheck={false}
        onChange={(_, d) => set({ code: d.value })}
      />
    </Field>
  );
}

function ChoicesEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const multi = form.kind === "multi";
  const fixed = form.kind === "true_false";
  const updateText = (id: string, text: string) => set({ choices: form.choices.map((c) => (c.id === id ? { ...c, text } : c)) });
  const rows = form.choices.map((c, i) => (
    <div key={c.id} className={styles.optionRow}>
      <span className={styles.optionId} aria-hidden>
        {c.id}
      </span>
      {multi ? (
        <Checkbox
          aria-label={`Option ${c.id} is correct`}
          checked={form.correct.includes(c.id)}
          onChange={(_, d) => set({ correct: toggleIn(form.correct, c.id, Boolean(d.checked)) })}
        />
      ) : (
        <Radio value={c.id} aria-label={`Option ${c.id} is correct`} />
      )}
      <Input
        aria-label={`Option ${c.id} text`}
        value={c.text}
        disabled={fixed}
        onChange={(_, d) => updateText(c.id, d.value)}
        className={styles.fill}
      />
      {!fixed && (
        <>
          <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} aria-label={`Move option ${c.id} up`} disabled={i === 0} onClick={() => set({ choices: moveInList(form.choices, i, i - 1) })} />
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowDown16Regular />}
            aria-label={`Move option ${c.id} down`}
            disabled={i === form.choices.length - 1}
            onClick={() => set({ choices: moveInList(form.choices, i, i + 1) })}
          />
          <Button
            size="small"
            appearance="subtle"
            icon={<Delete16Regular />}
            aria-label={`Remove option ${c.id}`}
            disabled={form.choices.length <= 2}
            onClick={() => set({ choices: form.choices.filter((x) => x.id !== c.id), correct: form.correct.filter((x) => x !== c.id) })}
          />
        </>
      )}
    </div>
  ));
  return (
    <Field label={multi ? "Options (tick every correct answer)" : "Options (select the correct answer)"} required>
      <div className={styles.form}>
        {multi ? rows : <RadioGroup value={form.correct[0] ?? ""} onChange={(_, d) => set({ correct: [d.value] })} aria-label="Correct answer">{rows}</RadioGroup>}
        {!fixed && (
          <Button icon={<Add16Regular />} disabled={form.choices.length >= 12} onClick={() => set({ choices: [...form.choices, { id: nextChoiceId(form.choices), text: "" }] })}>
            Add option
          </Button>
        )}
      </div>
    </Field>
  );
}

function NumericEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const asm = useAsmStyles();
  return (
    <div className={asm.row}>
      <Field label="Correct value" required>
        <Input value={form.numericValue} inputMode="decimal" onChange={(_, d) => set({ numericValue: d.value })} />
      </Field>
      <Field label="Tolerance (absolute)" hint="e.g. 0.01">
        <Input value={form.tolAbs} inputMode="decimal" onChange={(_, d) => set({ tolAbs: d.value })} />
      </Field>
      <Field label="Tolerance (%)" hint="e.g. 1">
        <Input value={form.tolPct} inputMode="decimal" onChange={(_, d) => set({ tolPct: d.value })} />
      </Field>
    </div>
  );
}

/** Editable list of accepted answers (one input per answer; multi-line for code output). */
function AcceptedList({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  multiline?: boolean;
}) {
  const styles = useStyles();
  const list = value.length ? value : [""];
  return (
    <Field label={label}>
      <div className={styles.form}>
        {list.map((a, i) => (
          <div key={i} className={styles.optionRow}>
            {multiline ? (
              <Textarea
                className={mergeClasses(styles.codeArea, styles.fill)}
                aria-label={`${label} ${i + 1}`}
                value={a}
                rows={3}
                resize="vertical"
                onChange={(_, d) => onChange(list.map((x, j) => (j === i ? d.value : x)))}
              />
            ) : (
              <Input aria-label={`${label} ${i + 1}`} value={a} onChange={(_, d) => onChange(list.map((x, j) => (j === i ? d.value : x)))} className={styles.fill} />
            )}
            <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} disabled={list.length <= 1} onClick={() => onChange(list.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button size="small" icon={<Add16Regular />} onClick={() => onChange([...list, ""])}>
          Add answer
        </Button>
      </div>
    </Field>
  );
}

function ShortTextEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  return (
    <>
      <AcceptedList label="Accepted answers" value={form.accepted} onChange={(v) => set({ accepted: v })} />
      <div className={asm.rowCenter}>
        <Switch label="Ignore case" checked={form.normCase} onChange={(_, d) => set({ normCase: d.checked })} />
        <Switch label="Ignore extra whitespace" checked={form.normWhitespace} onChange={(_, d) => set({ normWhitespace: d.checked })} />
        <Switch label="Ignore punctuation" checked={form.normPunctuation} onChange={(_, d) => set({ normPunctuation: d.checked })} />
      </div>
      <Field label="Keyword weights" hint="Partial credit for answers that mention these terms. Low-confidence answers go to human review.">
        <div className={styles.form}>
          {form.keywords.map((k, i) => (
            <div key={i} className={styles.optionRow}>
              <Input aria-label={`Keyword ${i + 1}`} placeholder="term" value={k.term} onChange={(_, d) => set({ keywords: form.keywords.map((x, j) => (j === i ? { ...x, term: d.value } : x)) })} />
              <Input
                aria-label={`Keyword ${i + 1} weight`}
                className={asm.narrow}
                placeholder="0.5"
                inputMode="decimal"
                value={k.weight}
                onChange={(_, d) => set({ keywords: form.keywords.map((x, j) => (j === i ? { ...x, weight: d.value } : x)) })}
              />
              <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove keyword ${i + 1}`} onClick={() => set({ keywords: form.keywords.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button size="small" icon={<Add16Regular />} onClick={() => set({ keywords: [...form.keywords, { term: "", weight: "0.5" }] })}>
            Add keyword
          </Button>
        </div>
      </Field>
      <Field label="Minimum keyword score" hint="0–1; below this the answer scores zero from keywords.">
        <Input className={asm.narrow} value={form.minKeywordScore} inputMode="decimal" onChange={(_, d) => set({ minKeywordScore: d.value })} />
      </Field>
    </>
  );
}

function CodeOutputEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const asm = useAsmStyles();
  return (
    <>
      <CodeArea form={form} set={set} hint="The candidate predicts what this prints. Display only; it is never executed." />
      <AcceptedList label="Accepted outputs" value={form.accepted} onChange={(v) => set({ accepted: v })} multiline />
      <div className={asm.rowCenter}>
        <Switch label="Ignore trailing whitespace" checked={form.outTrailingWs} onChange={(_, d) => set({ outTrailingWs: d.checked })} />
        <Switch label="Ignore blank lines" checked={form.outBlankLines} onChange={(_, d) => set({ outBlankLines: d.checked })} />
        <Switch label="Ignore case" checked={form.outCase} onChange={(_, d) => set({ outCase: d.checked })} />
      </div>
      <Field label="Regular expression (optional)" hint="Matched against the whole normalised output.">
        <Input className={asm.mono} value={form.regex} onChange={(_, d) => set({ regex: d.value })} />
      </Field>
    </>
  );
}

function CodeFillEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const ref = useRef<HTMLTextAreaElement>(null);
  const markers = parseBlankMarkers(form.code);
  const insertBlank = () => {
    const n = (markers.at(-1) ?? 0) + 1;
    const el = ref.current;
    const marker = `{{blank:${n}}}`;
    const at = el ? el.selectionStart : form.code.length;
    const end = el ? el.selectionEnd : form.code.length;
    set({ code: form.code.slice(0, at) + marker + form.code.slice(end) });
  };
  const blank = (n: number) => form.blanks[String(n)] ?? { accepted: [""], tokenWs: true };
  const setBlank = (n: number, patch: Partial<{ accepted: string[]; tokenWs: boolean }>) =>
    set({ blanks: { ...form.blanks, [String(n)]: { ...blank(n), ...patch } } });
  return (
    <>
      <Field label="Code with blanks" hint="Mark each blank with {{blank:1}}, {{blank:2}}, … Display only; never executed.">
        <Textarea ref={ref} className={styles.codeArea} value={form.code} rows={10} resize="vertical" spellCheck={false} onChange={(_, d) => set({ code: d.value })} />
      </Field>
      <div>
        <Button size="small" icon={<Add16Regular />} onClick={insertBlank}>
          Insert blank at cursor
        </Button>
      </div>
      {markers.map((n) => (
        <div key={n} className={styles.blank}>
          <Text weight="semibold">Blank {n}</Text>
          <AcceptedList label={`Accepted answers for blank ${n}`} value={blank(n).accepted} onChange={(v) => setBlank(n, { accepted: v })} />
          <Switch label="Ignore whitespace between tokens" checked={blank(n).tokenWs} onChange={(_, d) => setBlank(n, { tokenWs: d.checked })} />
        </div>
      ))}
    </>
  );
}

function SortableLine({
  id,
  index,
  count,
  text,
  onText,
  onMove,
  onRemove,
}: {
  id: string;
  index: number;
  count: number;
  text: string;
  onText: (t: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      className={mergeClasses(styles.listRow, isDragging && styles.dragging)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button size="small" appearance="subtle" className={styles.handle} icon={<ReOrderDotsVertical16Regular />} aria-label={`Drag line ${index + 1}`} {...attributes} {...listeners} />
      <Caption1 className={asm.muted}>{index + 1}</Caption1>
      <Input aria-label={`Line ${index + 1}`} className={mergeClasses(asm.mono, styles.fill)} value={text} onChange={(_, d) => onText(d.value)} />
      <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} aria-label={`Move line ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index - 1)} />
      <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} aria-label={`Move line ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)} />
      <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove line ${index + 1}`} onClick={onRemove} />
    </li>
  );
}

function CodeOrderEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onEnd = (e: DragEndEvent) => {
    const from = form.lines.findIndex((l) => l.id === e.active.id);
    const to = form.lines.findIndex((l) => l.id === e.over?.id);
    if (from >= 0 && to >= 0) set({ lines: moveInList(form.lines, from, to) });
  };
  const pasteLines = (text: string) => set({ lines: codeLines(text).filter((l) => l.trim()).map((t) => ({ id: shortId("l"), text: t })) });
  return (
    <>
      <Field label="Lines in the correct order" hint="Drag or use the arrows. Candidates see them shuffled.">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
          <SortableContext items={form.lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.lineList}>
              {form.lines.map((l, i) => (
                <SortableLine
                  key={l.id}
                  id={l.id}
                  index={i}
                  count={form.lines.length}
                  text={l.text}
                  onText={(t) => set({ lines: form.lines.map((x) => (x.id === l.id ? { ...x, text: t } : x)) })}
                  onMove={(to) => set({ lines: moveInList(form.lines, i, to) })}
                  onRemove={() => set({ lines: form.lines.filter((x) => x.id !== l.id) })}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </Field>
      <div className={styles.optionRow}>
        <Button size="small" icon={<Add16Regular />} disabled={form.lines.length >= 40} onClick={() => set({ lines: [...form.lines, { id: shortId("l"), text: "" }] })}>
          Add line
        </Button>
        {form.lines.length === 0 && <PasteLines onPaste={pasteLines} />}
      </div>
      <Field label="Partial credit">
        <Dropdown
          value={form.partial === "lcs" ? "Longest correct subsequence" : "None (all or nothing)"}
          selectedOptions={[form.partial]}
          onOptionSelect={(_, d) => set({ partial: d.optionValue === "none" ? "none" : "lcs" })}
        >
          <Option value="lcs">Longest correct subsequence</Option>
          <Option value="none">None (all or nothing)</Option>
        </Dropdown>
      </Field>
    </>
  );
}

function PasteLines({ onPaste }: { onPaste: (text: string) => void }) {
  const [text, setText] = useState("");
  const styles = useStyles();
  return (
    <Field label="Or paste code to split into lines">
      <div className={styles.optionRow}>
        <Textarea className={styles.codeArea} value={text} rows={3} onChange={(_, d) => setText(d.value)} />
        <Button size="small" disabled={!text.trim()} onClick={() => onPaste(text)}>
          Split
        </Button>
      </div>
    </Field>
  );
}

function FindBugEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const lines = codeLines(form.code);
  return (
    <>
      <CodeArea form={form} set={set} />
      <Field label="Bug lines" hint="Tick every line that contains a bug.">
        {lines.length === 0 ? (
          <Caption1 className={asm.muted}>Add the code first.</Caption1>
        ) : (
          <ol className={styles.bugLines}>
            {lines.map((l, i) => {
              const n = i + 1;
              const on = form.bugLines.includes(n);
              return (
                <li key={n} className={mergeClasses(styles.bugLine, on && styles.bugMarked)}>
                  <Checkbox aria-label={`Line ${n} has a bug`} checked={on} onChange={(_, d) => set({ bugLines: toggleIn(form.bugLines, n, Boolean(d.checked)) })} />
                  <span className={asm.lineNo}>{n}</span>
                  {l || " "}
                </li>
              );
            })}
          </ol>
        )}
      </Field>
      <Switch label="Penalise wrongly picked lines" checked={form.penaliseWrong} onChange={(_, d) => set({ penaliseWrong: d.checked })} />
    </>
  );
}

function RubricEditor({ form, set }: { form: ItemForm; set: SetForm }) {
  const styles = useStyles();
  const update = (i: number, patch: Partial<ItemForm["criteria"][number]>) => set({ criteria: form.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <>
      {form.kind === "code_freeform" && <CodeArea form={form} set={set} label="Starter code (optional)" />}
      <Field label="Rubric criteria" hint="Answers are scored by a human reviewer against these criteria.">
        <div className={styles.form}>
          {form.criteria.map((c, i) => (
            <div key={i} className={styles.form}>
              <div className={styles.criterion}>
                <Field label="Key" size="small">
                  <Input size="small" value={c.key} onChange={(_, d) => update(i, { key: d.value })} />
                </Field>
                <Field label="Label" size="small">
                  <Input size="small" value={c.label} onChange={(_, d) => update(i, { label: d.value })} />
                </Field>
                <Field label="Max points" size="small">
                  <Input size="small" value={c.max_points} inputMode="decimal" onChange={(_, d) => update(i, { max_points: d.value })} />
                </Field>
                <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove criterion ${i + 1}`} disabled={form.criteria.length <= 1} onClick={() => set({ criteria: form.criteria.filter((_, j) => j !== i) })} />
              </div>
              <Field label="Guidance for reviewers" size="small">
                <Textarea size="small" value={c.guidance} rows={2} onChange={(_, d) => update(i, { guidance: d.value })} />
              </Field>
            </div>
          ))}
          <Button
            size="small"
            icon={<Add16Regular />}
            onClick={() => set({ criteria: [...form.criteria, { key: `c${form.criteria.length + 1}`, label: "", max_points: "5", guidance: "" }] })}
          >
            Add criterion
          </Button>
        </div>
      </Field>
    </>
  );
}
