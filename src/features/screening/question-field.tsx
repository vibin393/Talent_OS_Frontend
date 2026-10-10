"use client";

import {
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Rating,
  SpinButton,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import type { AnswerValue, MoneyAnswer, QuestionLike } from "./validation";

const useStyles = makeStyles({
  money: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  amount: { flex: "1 1 160px", minWidth: 0 },
  currency: { width: "96px" },
  // Public pages: ≥ 44 px touch targets (WCAG 2.5.5 AAA, our bar for candidate pages).
  large: {
    "& input, & textarea, & button": { minHeight: "44px" },
    "& .fui-Radio": { minHeight: "44px", alignItems: "center" },
  },
  full: { width: "100%" },
});

/**
 * One questionnaire question as a Fluent form control (text, number, yes/no, choice, 1–5 rating,
 * amount, date). Used by the recruiter screening form, the AI-screening preview and the public page.
 */
export function QuestionField({
  question,
  value,
  onChange,
  error,
  disabled,
  large,
  defaultCurrency,
}: {
  question: QuestionLike;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  disabled?: boolean;
  large?: boolean;
  defaultCurrency?: string;
}) {
  const styles = useStyles();
  const q = question;
  const fieldProps = {
    label: q.label,
    required: !!q.required,
    validationState: error ? ("error" as const) : ("none" as const),
    validationMessage: error,
    className: large ? styles.large : undefined,
  };
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";

  switch (q.type) {
    case "number":
      return (
        <Field {...fieldProps}>
          <SpinButton
            value={text === "" || Number.isNaN(Number(text)) ? null : Number(text)}
            displayValue={text}
            min={0}
            disabled={disabled}
            onChange={(_, d) => {
              if (d.value !== undefined && d.value !== null) onChange(String(d.value));
              else if (d.displayValue !== undefined) onChange(d.displayValue.trim());
              else onChange("");
            }}
          />
        </Field>
      );
    case "boolean": {
      const selected = value === true || value === "yes" ? "yes" : value === false || value === "no" ? "no" : "";
      return (
        <Field {...fieldProps}>
          <RadioGroup layout="horizontal" value={selected} disabled={disabled} onChange={(_, d) => onChange(d.value === "yes")}>
            <Radio value="yes" label="Yes" />
            <Radio value="no" label="No" />
          </RadioGroup>
        </Field>
      );
    }
    case "choice": {
      const options = q.options ?? [];
      if (options.length <= 5) {
        return (
          <Field {...fieldProps}>
            <RadioGroup value={text} disabled={disabled} onChange={(_, d) => onChange(d.value)}>
              {options.map((o) => (
                <Radio key={o} value={o} label={o} />
              ))}
            </RadioGroup>
          </Field>
        );
      }
      return (
        <Field {...fieldProps}>
          <Dropdown
            value={text}
            selectedOptions={text ? [text] : []}
            disabled={disabled}
            placeholder="Choose an option"
            onOptionSelect={(_, d) => onChange(d.optionValue ?? "")}
          >
            {options.map((o) => (
              <Option key={o} value={o}>
                {o}
              </Option>
            ))}
          </Dropdown>
        </Field>
      );
    }
    case "rating":
      return (
        <Field {...fieldProps}>
          <Rating
            max={5}
            step={1}
            value={text ? Number(text) : 0}
            aria-label={q.label}
            onChange={(_, d) => {
              if (!disabled) onChange(d.value);
            }}
            size={large ? "extra-large" : "large"}
          />
        </Field>
      );
    case "money": {
      const m: MoneyAnswer =
        typeof value === "object" && value !== null
          ? (value as MoneyAnswer)
          : { amount: text, currency: defaultCurrency ?? null };
      return (
        <Field {...fieldProps}>
          <div className={styles.money}>
            <Input
              className={styles.amount}
              inputMode="decimal"
              value={m.amount ?? ""}
              disabled={disabled}
              aria-label={`${q.label} — amount`}
              onChange={(_, d) => onChange({ amount: d.value, currency: m.currency ?? defaultCurrency ?? null })}
            />
            <Input
              className={styles.currency}
              value={m.currency ?? ""}
              maxLength={3}
              disabled={disabled}
              placeholder="INR"
              aria-label={`${q.label} — currency`}
              onChange={(_, d) => onChange({ amount: m.amount ?? "", currency: d.value.toUpperCase() || null })}
            />
          </div>
        </Field>
      );
    }
    case "date":
      return (
        <Field {...fieldProps}>
          <Input type="date" value={text} disabled={disabled} onChange={(_, d) => onChange(d.value)} />
        </Field>
      );
    default:
      return (
        <Field {...fieldProps}>
          <Textarea
            className={styles.full}
            resize="vertical"
            value={text}
            maxLength={4000}
            disabled={disabled}
            onChange={(_, d) => onChange(d.value)}
          />
        </Field>
      );
  }
}
