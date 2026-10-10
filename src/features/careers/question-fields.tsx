"use client";

import { Field, Input, makeStyles, Radio, RadioGroup, Select, Textarea, tokens } from "@fluentui/react-components";
import type { PublicApplyQuestion } from "@/lib/api/types";
import { type AnswerDrafts, questionFieldId, RATING_VALUES } from "./questions";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  control: { minHeight: "44px" },
  radio: { minHeight: "44px", display: "flex", alignItems: "center" },
});

/** One Fluent `Field` per question (text, number, yes/no, choice, 1–5 rating, amount, date). */
export function QuestionFields({
  questions,
  drafts,
  errors,
  onChange,
  disabled,
}: {
  questions: readonly PublicApplyQuestion[];
  drafts: AnswerDrafts;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <div className={styles.list}>
      {questions.map((q) => {
        const id = questionFieldId(q.key);
        const value = drafts[q.key] ?? "";
        const error = errors[q.key];
        const common = {
          label: q.label,
          required: q.required,
          validationState: error ? ("error" as const) : ("none" as const),
          validationMessage: error,
        };
        const set = (v: string) => onChange(q.key, v);
        switch (q.type) {
          case "boolean":
            return (
              <Field key={q.key} {...common}>
                <RadioGroup id={id} value={value} onChange={(_, d) => set(d.value)} disabled={disabled} layout="horizontal">
                  <Radio value="yes" label="Yes" className={styles.radio} />
                  <Radio value="no" label="No" className={styles.radio} />
                </RadioGroup>
              </Field>
            );
          case "rating":
            return (
              <Field key={q.key} {...common} hint="1 = lowest, 5 = highest">
                <RadioGroup id={id} value={value} onChange={(_, d) => set(d.value)} disabled={disabled} layout="horizontal">
                  {RATING_VALUES.map((r) => (
                    <Radio key={r} value={r} label={r} className={styles.radio} />
                  ))}
                </RadioGroup>
              </Field>
            );
          case "choice": {
            const options = q.options ?? [];
            if (options.length <= 5) {
              return (
                <Field key={q.key} {...common}>
                  <RadioGroup id={id} value={value} onChange={(_, d) => set(d.value)} disabled={disabled}>
                    {options.map((o) => (
                      <Radio key={o} value={o} label={o} className={styles.radio} />
                    ))}
                  </RadioGroup>
                </Field>
              );
            }
            return (
              <Field key={q.key} {...common}>
                <Select id={id} value={value} onChange={(_, d) => set(d.value)} disabled={disabled} className={styles.control}>
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }
          case "number":
          case "money":
            return (
              <Field key={q.key} {...common}>
                <Input
                  id={id}
                  inputMode="decimal"
                  value={value}
                  onChange={(_, d) => set(d.value)}
                  disabled={disabled}
                  className={styles.control}
                />
              </Field>
            );
          case "date":
            return (
              <Field key={q.key} {...common}>
                <Input id={id} type="date" value={value} onChange={(_, d) => set(d.value)} disabled={disabled} className={styles.control} />
              </Field>
            );
          default:
            return (
              <Field key={q.key} {...common}>
                <Textarea id={id} value={value} onChange={(_, d) => set(d.value)} disabled={disabled} resize="vertical" maxLength={4000} />
              </Field>
            );
        }
      })}
    </div>
  );
}
