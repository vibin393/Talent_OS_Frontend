"use client";

import { Dropdown, Field, Input, makeStyles, Option, tokens } from "@fluentui/react-components";
import { RATE_UNITS } from "./format";
import type { RateUnit } from "./types";

const useStyles = makeStyles({
  row: { display: "grid", gridTemplateColumns: "minmax(100px, 1fr) 76px minmax(110px, 0.8fr)", gap: tokens.spacingHorizontalXS },
});

/** Amount + ISO currency (+ optional rate unit) on one line (money per AD-12: string decimal + currency). */
export function MoneyInput({
  label,
  amount,
  currency,
  unit,
  onAmount,
  onCurrency,
  onUnit,
  required,
  disabled,
  validationMessage,
  hint,
  currencyLocked,
}: {
  label: string;
  amount: string;
  currency: string;
  unit?: RateUnit | "";
  onAmount: (v: string) => void;
  onCurrency: (v: string) => void;
  onUnit?: (v: RateUnit) => void;
  required?: boolean;
  disabled?: boolean;
  validationMessage?: string;
  hint?: string;
  currencyLocked?: boolean;
}) {
  const styles = useStyles();
  return (
    <Field label={label} required={required} hint={hint} validationState={validationMessage ? "error" : "none"} validationMessage={validationMessage}>
      <div className={styles.row}>
        <Input
          inputMode="decimal"
          value={amount}
          disabled={disabled}
          aria-label={`${label} amount`}
          placeholder="0.00"
          onChange={(_, d) => onAmount(d.value.replace(/[^\d.]/g, ""))}
        />
        <Input
          value={currency}
          disabled={disabled || currencyLocked}
          aria-label={`${label} currency`}
          maxLength={3}
          onChange={(_, d) => onCurrency(d.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        />
        {onUnit ? (
          <Dropdown
            aria-label={`${label} unit`}
            disabled={disabled}
            value={RATE_UNITS.find((u) => u.value === unit)?.label ?? ""}
            selectedOptions={unit ? [unit] : []}
            onOptionSelect={(_, d) => d.optionValue && onUnit(d.optionValue as RateUnit)}
            style={{ minWidth: 0 }}
          >
            {RATE_UNITS.map((u) => (
              <Option key={u.value} value={u.value}>
                {u.label}
              </Option>
            ))}
          </Dropdown>
        ) : (
          <span />
        )}
      </div>
    </Field>
  );
}
