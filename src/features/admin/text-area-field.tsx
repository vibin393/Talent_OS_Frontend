"use client";

import { Field, Textarea } from "@fluentui/react-components";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

/** react-hook-form bound Fluent `Field` + `Textarea` (counterpart of `TextField`). */
export function TextAreaField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          validationState={fieldState.error ? "error" : "none"}
          validationMessage={fieldState.error?.message}
        >
          <Textarea
            ref={field.ref}
            name={field.name}
            value={(field.value as string | undefined) ?? ""}
            onChange={(_, d) => field.onChange(d.value)}
            onBlur={field.onBlur}
            disabled={disabled}
            resize="vertical"
          />
        </Field>
      )}
    />
  );
}
