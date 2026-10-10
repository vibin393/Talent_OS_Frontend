"use client";

import {
  Button,
  Checkbox,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Radio,
  RadioGroup,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowDown20Regular, ArrowUp20Regular } from "@fluentui/react-icons";
import { useId, useState } from "react";
import { codeLines, isCodeKind, moveInList, splitBlanks, toggleIn } from "./logic";
import type { CodeLine, DeliveryItem } from "./types";

const useStyles = makeStyles({
  target: { "& .fui-Radio, & .fui-Checkbox": { minHeight: "44px", alignItems: "center" } },
  mono: { "& textarea, & input": { fontFamily: tokens.fontFamilyMonospace } },
  code: {
    margin: 0,
    padding: tokens.spacingHorizontalS,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: "auto",
    whiteSpace: "pre",
  },
  lineNo: { display: "inline-block", minWidth: "3ch", marginRight: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3, textAlign: "right", userSelect: "none" },
  blankInput: { minWidth: "8ch", maxWidth: "24ch", fontFamily: tokens.fontFamilyMonospace, verticalAlign: "baseline" },
  orderList: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  orderRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  orderText: { flex: 1, minWidth: 0, fontFamily: tokens.fontFamilyMonospace, whiteSpace: "pre", overflowX: "auto" },
  moveBtn: { minWidth: "44px", minHeight: "44px" },
  bugList: {
    listStyleType: "none",
    margin: 0,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: "auto",
  },
  bugRow: { display: "flex", alignItems: "center", minHeight: "44px", fontFamily: tokens.fontFamilyMonospace, whiteSpace: "pre" },
  bugOn: { backgroundColor: tokens.colorPaletteYellowBackground1 },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
});

type Resp = Record<string, unknown>;
const asRec = (v: unknown): Resp => (v && typeof v === "object" && !Array.isArray(v) ? (v as Resp) : {});

/** Read-only numbered code listing for the candidate. */
export function CandidateCode({ code, label }: { code: string; label: string }) {
  const styles = useStyles();
  return (
    <pre className={styles.code} tabIndex={0} aria-label={label}>
      {codeLines(code).map((l, i) => (
        <div key={i}>
          <span className={styles.lineNo} aria-hidden>
            {i + 1}
          </span>
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

/** Renders the answer control for one delivered item; `value` is the candidate's response shape for the kind. */
export function ItemResponse({
  item,
  value,
  onChange,
  disabled,
  labelId,
}: {
  item: DeliveryItem;
  value: unknown;
  onChange: (response: unknown) => void;
  disabled?: boolean;
  /** Id of the element holding the question stem (labels the control). */
  labelId: string;
}) {
  const styles = useStyles();
  const r = asRec(value);
  const options = item.options ?? [];
  switch (item.kind) {
    case "single":
    case "true_false":
      return (
        <RadioGroup
          className={styles.target}
          aria-labelledby={labelId}
          value={typeof r.choice === "string" ? r.choice : ""}
          disabled={disabled}
          onChange={(_, d) => onChange({ choice: d.value })}
        >
          {options.map((o) => (
            <Radio key={o.id} value={o.id} label={o.text} />
          ))}
        </RadioGroup>
      );
    case "multi": {
      const chosen = Array.isArray(r.choices) ? (r.choices as string[]) : [];
      return (
        <div role="group" aria-labelledby={labelId} className={styles.target}>
          <Text size={200} block>
            Select all that apply.
          </Text>
          {options.map((o) => (
            <div key={o.id}>
              <Checkbox
                label={o.text}
                checked={chosen.includes(o.id)}
                disabled={disabled}
                onChange={(_, d) => onChange({ choices: toggleIn(chosen, o.id, Boolean(d.checked)) })}
              />
            </div>
          ))}
        </div>
      );
    }
    case "numeric":
      return (
        <Field label="Your answer">
          <Input
            aria-describedby={labelId}
            inputMode="decimal"
            value={typeof r.value === "string" ? r.value : ""}
            disabled={disabled}
            onChange={(_, d) => onChange({ value: d.value })}
          />
        </Field>
      );
    case "code_fill":
      return <CodeFill item={item} value={r} onChange={onChange} disabled={disabled} />;
    case "code_order":
      return <CodeOrder item={item} value={r} onChange={onChange} disabled={disabled} labelId={labelId} />;
    case "code_find_bug":
      return <FindBug item={item} value={r} onChange={onChange} disabled={disabled} labelId={labelId} />;
    default: {
      // short_text, code_output, essay, code_freeform
      const code = isCodeKind(item.kind);
      return (
        <>
          {item.code && <CandidateCode code={item.code} label="Code" />}
          <Field label={item.kind === "code_output" ? "Expected output" : "Your answer"}>
            <Textarea
              className={code ? styles.mono : undefined}
              aria-describedby={labelId}
              value={typeof r.text === "string" ? r.text : ""}
              rows={item.kind === "short_text" ? 3 : 8}
              resize="vertical"
              spellCheck={!code}
              disabled={disabled}
              onChange={(_, d) => onChange({ text: d.value })}
            />
          </Field>
        </>
      );
    }
  }
}

function CodeFill({ item, value, onChange, disabled }: { item: DeliveryItem; value: Resp; onChange: (r: unknown) => void; disabled?: boolean }) {
  const styles = useStyles();
  const blanks = asRec(value.blanks) as Record<string, string>;
  const set = (n: number, v: string) => onChange({ blanks: { ...blanks, [String(n)]: v } });
  const parts = splitBlanks(item.code ?? "");
  const hasMarkers = parts.some((p) => typeof p === "number");
  if (!hasMarkers) {
    // No inline markers: list one input per blank under the code.
    return (
      <>
        {item.code && <CandidateCode code={item.code} label="Code" />}
        {Array.from({ length: item.blanks ?? 0 }, (_, i) => i + 1).map((n) => (
          <Field key={n} label={`Blank ${n}`}>
            <Input className={styles.blankInput} value={blanks[String(n)] ?? ""} disabled={disabled} onChange={(_, d) => set(n, d.value)} />
          </Field>
        ))}
      </>
    );
  }
  return (
    <pre className={styles.code} aria-label="Code with blanks to fill">
      {parts.map((p, i) =>
        typeof p === "number" ? (
          <input
            key={i}
            className={styles.blankInput}
            aria-label={`Blank ${p}`}
            value={blanks[String(p)] ?? ""}
            disabled={disabled}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => set(p, e.target.value)}
          />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </pre>
  );
}

function CodeOrder({ item, value, onChange, disabled, labelId }: { item: DeliveryItem; value: Resp; onChange: (r: unknown) => void; disabled?: boolean; labelId: string }) {
  const styles = useStyles();
  const lines = item.lines ?? [];
  const saved = Array.isArray(value.order) ? (value.order as string[]) : [];
  const byId = new Map(lines.map((l) => [l.id, l]));
  const ordered: CodeLine[] = saved.length
    ? [...saved.map((id) => byId.get(id)).filter((l): l is CodeLine => Boolean(l)), ...lines.filter((l) => !saved.includes(l.id))]
    : lines;
  const [announce, setAnnounce] = useState("");
  const move = (from: number, to: number) => {
    const next = moveInList(ordered, from, to);
    onChange({ order: next.map((l) => l.id) });
    setAnnounce(`Line moved to position ${to + 1} of ${next.length}.`);
    requestAnimationFrame(() => document.getElementById(`ord-${item.position}-${next[to].id}-${to < from ? "up" : "down"}`)?.focus());
  };
  return (
    <>
      <Text size={200} block>
        Put the lines in the correct order with the move up and move down buttons.
      </Text>
      <ol className={styles.orderList} aria-labelledby={labelId}>
        {ordered.map((l, i) => (
          <li key={l.id} className={styles.orderRow}>
            <span className={styles.lineNo} aria-hidden>
              {i + 1}
            </span>
            <span className={styles.orderText}>{l.text}</span>
            <Button
              id={`ord-${item.position}-${l.id}-up`}
              className={styles.moveBtn}
              appearance="subtle"
              icon={<ArrowUp20Regular />}
              aria-label={`Move line ${i + 1} up: ${l.text}`}
              disabled={disabled || i === 0}
              onClick={() => move(i, i - 1)}
            />
            <Button
              id={`ord-${item.position}-${l.id}-down`}
              className={styles.moveBtn}
              appearance="subtle"
              icon={<ArrowDown20Regular />}
              aria-label={`Move line ${i + 1} down: ${l.text}`}
              disabled={disabled || i === ordered.length - 1}
              onClick={() => move(i, i + 1)}
            />
          </li>
        ))}
      </ol>
      <div aria-live="polite" className={styles.srOnly}>
        {announce}
      </div>
    </>
  );
}

function FindBug({ item, value, onChange, disabled, labelId }: { item: DeliveryItem; value: Resp; onChange: (r: unknown) => void; disabled?: boolean; labelId: string }) {
  const styles = useStyles();
  const picked = Array.isArray(value.lines) ? (value.lines as number[]) : [];
  const hint = useId();
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={hint}>
      <Text id={hint} size={200} block>
        Tick every line that contains a bug.
      </Text>
      <ol className={styles.bugList}>
        {codeLines(item.code).map((l, i) => {
          const n = i + 1;
          const on = picked.includes(n);
          return (
            <li key={n} className={mergeClasses(styles.bugRow, on && styles.bugOn)}>
              <Checkbox aria-label={`Line ${n}: ${l.trim() || "blank line"}`} checked={on} disabled={disabled} onChange={(_, d) => onChange({ lines: toggleIn(picked, n, Boolean(d.checked)).sort((a, b) => a - b) })} />
              <span className={styles.lineNo} aria-hidden>
                {n}
              </span>
              <span aria-hidden>{l || " "}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
