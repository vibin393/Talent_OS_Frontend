"use client";

import { Field, Input, type InputProps } from "@fluentui/react-components";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

/**
 * A react-hook-form bound Fluent `Field` + `Input`. `Field` wires the label, hint and validation
 * message to the input (`aria-describedby`, `aria-invalid`); the input ref is registered with the
 * form so the first invalid field receives focus on submit.
 */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  ...inputProps
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
} & Omit<InputProps, "name" | "value" | "defaultValue" | "onChange" | "onBlur">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          required={inputProps.required}
          hint={hint}
          validationState={fieldState.error ? "error" : "none"}
          validationMessage={fieldState.error?.message}
        >
          <Input
            {...inputProps}
            ref={field.ref}
            name={field.name}
            value={(field.value as string | undefined) ?? ""}
            onChange={(_, data) => field.onChange(data.value)}
            onBlur={field.onBlur}
            disabled={field.disabled || inputProps.disabled}
          />
        </Field>
      )}
    />
  );
}
