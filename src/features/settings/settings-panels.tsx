"use client";

import { Button, Caption1, Dropdown, Field, makeStyles, Option, Spinner, Subtitle2, tokens } from "@fluentui/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Control, Controller, type FieldPath, type FieldValues, useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { TextAreaField } from "@/features/admin/text-area-field";
import { TextField } from "@/features/auth/text-field";
import { errorMessage } from "@/lib/api/errors";
import type { SettingsSectionsOut } from "@/lib/api/types";
import { settingsApi, settingsKeys } from "./api";
import {
  CURRENCIES,
  DATE_FORMATS,
  ID_PREFIX_KEYS,
  ID_PREFIX_LABELS,
  LINK_EXPIRY_LIMITS,
  NUMBER_FORMATS,
  applySettingsErrors,
  type PanelKey,
  settingsFieldErrors,
} from "./catalog";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  group: { marginTop: tokens.spacingVerticalS },
});

const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const blankToNull = (v: string) => (v.trim() ? v.trim() : null);

function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} validationState={fieldState.error ? "error" : "none"} validationMessage={fieldState.error?.message}>
          <Dropdown
            ref={field.ref}
            value={options.find((o) => o.value === field.value)?.label ?? str(field.value)}
            selectedOptions={field.value ? [String(field.value)] : []}
            onOptionSelect={(_, d) => field.onChange(d.optionValue ?? "")}
            onBlur={field.onBlur}
          >
            {options.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
    />
  );
}

/** Shared panel chrome: drawer, save/cancel footer, server error bar and 422 field mapping. */
function usePanelSave<T extends FieldValues>(opts: {
  save: (values: T) => Promise<unknown>;
  setError: UseFormSetError<T>;
  known: readonly string[];
  onDone: () => void;
  success: string;
}) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [error, setErrorText] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: opts.save,
    onSuccess: async () => {
      toast.success(opts.success);
      await queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      opts.onDone();
    },
    onError: (e) => {
      const unmatched = applySettingsErrors(e, opts.setError, opts.known);
      const fieldCount = Object.keys(settingsFieldErrors(e)).length;
      setErrorText(fieldCount > 0 && unmatched.length === 0 ? "Check the highlighted fields." : unmatched.join(" · ") || errorMessage(e));
    },
  });
  return { mutation, error, clearError: () => setErrorText(null) };
}

function Footer({ pending, onCancel, formId }: { pending: boolean; onCancel: () => void; formId: string }) {
  return (
    <>
      <Button appearance="primary" type="submit" form={formId} disabled={pending} icon={pending ? <Spinner size="tiny" /> : undefined}>
        Save
      </Button>
      <Button onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
    </>
  );
}

// ---------------------------------------------------------------- company
const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");
const companySchema = z.object({
  display_name: z.string().trim().max(200),
  legal_name: z.string().trim().max(200),
  address: z.string().trim().max(1000),
  website: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a full URL starting with https://"),
  grievance_officer: z.object({ name: z.string().trim().max(200), email: optionalEmail }),
});
type CompanyValues = z.infer<typeof companySchema>;
const COMPANY_FIELDS = ["display_name", "legal_name", "address", "website", "grievance_officer.name", "grievance_officer.email"];

function CompanyPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const styles = useStyles();
  const officer = (data.grievance_officer ?? {}) as Record<string, unknown>;
  const form = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      display_name: str(data.display_name),
      legal_name: str(data.legal_name),
      address: str(data.address),
      website: str(data.website),
      grievance_officer: { name: str(officer.name), email: str(officer.email) },
    },
  });
  const { mutation, error, clearError } = usePanelSave<CompanyValues>({
    save: (v) =>
      settingsApi.company({
        display_name: blankToNull(v.display_name),
        legal_name: blankToNull(v.legal_name),
        address: blankToNull(v.address),
        website: blankToNull(v.website),
        grievance_officer: { name: blankToNull(v.grievance_officer.name), email: blankToNull(v.grievance_officer.email) },
      }),
    setError: form.setError,
    known: COMPANY_FIELDS,
    onDone: onClose,
    success: "Company profile saved",
  });
  return (
    <DetailsDrawer open title="Company profile" onClose={onClose} footer={<Footer pending={mutation.isPending} onCancel={onClose} formId="settings-company" />}>
      <form
        id="settings-company"
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((v) => {
          clearError();
          mutation.mutate(v);
        })}
      >
        <ErrorBar message={error} />
        <TextField control={form.control} name="display_name" label="Display name" />
        <TextField control={form.control} name="legal_name" label="Legal name" />
        <TextAreaField control={form.control} name="address" label="Registered address" />
        <TextField control={form.control} name="website" label="Website" placeholder="https://" />
        <Caption1>Logo upload will be available with career-portal branding.</Caption1>
        <Subtitle2 as="h3" className={styles.group}>
          Grievance officer (DPDP)
        </Subtitle2>
        <Caption1>Shown to candidates in privacy notices as the contact for complaints.</Caption1>
        <TextField control={form.control} name="grievance_officer.name" label="Name" />
        <TextField control={form.control} name="grievance_officer.email" label="Email" type="email" />
      </form>
    </DetailsDrawer>
  );
}

// ---------------------------------------------------------------- regional
const regionalSchema = z.object({
  timezone: z.string().trim().min(1, "Enter a time zone").max(64),
  currency: z.string().min(1, "Choose a currency"),
  date_format: z.string().min(1, "Choose a date format"),
  number_format: z.string().min(1, "Choose a number format"),
});
type RegionalValues = z.infer<typeof regionalSchema>;

function RegionalPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const styles = useStyles();
  const form = useForm<RegionalValues>({
    resolver: zodResolver(regionalSchema),
    defaultValues: {
      timezone: str(data.timezone),
      currency: str(data.currency),
      date_format: str(data.date_format) || "DD/MM/YYYY",
      number_format: str(data.number_format) || "indian",
    },
  });
  const { mutation, error, clearError } = usePanelSave<RegionalValues>({
    save: (v) => settingsApi.regional({ ...v, timezone: v.timezone.trim() }),
    setError: form.setError,
    known: ["timezone", "currency", "date_format", "number_format"],
    onDone: onClose,
    success: "Regional settings saved",
  });
  return (
    <DetailsDrawer open title="Regional settings" onClose={onClose} footer={<Footer pending={mutation.isPending} onCancel={onClose} formId="settings-regional" />}>
      <form
        id="settings-regional"
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((v) => {
          clearError();
          mutation.mutate(v);
        })}
      >
        <ErrorBar message={error} />
        <TextField control={form.control} name="timezone" label="Time zone" hint="IANA name, for example Asia/Kolkata" spellCheck={false} />
        <SelectField control={form.control} name="currency" label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <SelectField control={form.control} name="date_format" label="Date format" options={DATE_FORMATS.map((f) => ({ value: f, label: f }))} />
        <SelectField control={form.control} name="number_format" label="Number format" options={NUMBER_FORMATS} />
      </form>
    </DetailsDrawer>
  );
}

// ---------------------------------------------------------------- ID prefixes
const prefix = z
  .string()
  .trim()
  .regex(/^[A-Z]{2,5}$/, "Use 2–5 capital letters");
const idPrefixesSchema = z
  .object({ REQ: prefix, CAN: prefix, APP: prefix, SUB: prefix, DSR: prefix })
  .superRefine((v, ctx) => {
    const seen = new Map<string, string>();
    for (const k of ID_PREFIX_KEYS) {
      const other = seen.get(v[k]);
      if (other) ctx.addIssue({ code: "custom", path: [k], message: `Already used for ${ID_PREFIX_LABELS[other as keyof typeof ID_PREFIX_LABELS]}` });
      else seen.set(v[k], k);
    }
  });
type IdPrefixValues = z.infer<typeof idPrefixesSchema>;

function IdPrefixesPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const styles = useStyles();
  const form = useForm<IdPrefixValues>({
    resolver: zodResolver(idPrefixesSchema),
    defaultValues: Object.fromEntries(ID_PREFIX_KEYS.map((k) => [k, str(data[k]) || k])) as IdPrefixValues,
  });
  const { mutation, error, clearError } = usePanelSave<IdPrefixValues>({
    save: (v) => settingsApi.idPrefixes(v),
    setError: form.setError,
    known: ID_PREFIX_KEYS,
    onDone: onClose,
    success: "ID prefixes saved",
  });
  return (
    <DetailsDrawer open title="ID prefixes" onClose={onClose} footer={<Footer pending={mutation.isPending} onCancel={onClose} formId="settings-prefixes" />}>
      <form
        id="settings-prefixes"
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((v) => {
          clearError();
          mutation.mutate(v);
        })}
      >
        <ErrorBar message={error} />
        <Caption1>Numbering continues where it is: changing CAN to CND makes the next ID CND-000124.</Caption1>
        {ID_PREFIX_KEYS.map((k) => (
          <TextField key={k} control={form.control} name={k} label={ID_PREFIX_LABELS[k]} maxLength={5} autoCapitalize="characters" spellCheck={false} />
        ))}
      </form>
    </DetailsDrawer>
  );
}

// ---------------------------------------------------------------- link expiries
type LinkKey = keyof typeof LINK_EXPIRY_LIMITS;
const LINK_KEYS = Object.keys(LINK_EXPIRY_LIMITS) as LinkKey[];
const days = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of days")
    .refine((v) => Number(v) >= min && Number(v) <= max, `Between ${min} and ${max} days`);
const linkSchema = z.object(
  Object.fromEntries(LINK_KEYS.map((k) => [k, days(LINK_EXPIRY_LIMITS[k].min, LINK_EXPIRY_LIMITS[k].max)])) as Record<
    LinkKey,
    ReturnType<typeof days>
  >,
);
type LinkValues = Record<LinkKey, string>;

function LinkExpiriesPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const styles = useStyles();
  const form = useForm<LinkValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: Object.fromEntries(LINK_KEYS.map((k) => [k, str(data[k])])) as LinkValues,
  });
  const { mutation, error, clearError } = usePanelSave<LinkValues>({
    save: (v) => settingsApi.linkExpiries(Object.fromEntries(LINK_KEYS.map((k) => [k, Number(v[k])]))),
    setError: form.setError,
    known: LINK_KEYS,
    onDone: onClose,
    success: "Link expiries saved",
  });
  return (
    <DetailsDrawer open title="Secure link expiries" onClose={onClose} footer={<Footer pending={mutation.isPending} onCancel={onClose} formId="settings-links" />}>
      <form
        id="settings-links"
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((v) => {
          clearError();
          mutation.mutate(v);
        })}
      >
        <ErrorBar message={error} />
        <Caption1>Days before a link emailed to candidates or clients stops working. New links use the new value.</Caption1>
        {LINK_KEYS.map((k) => (
          <TextField
            key={k}
            control={form.control}
            name={k}
            label={LINK_EXPIRY_LIMITS[k].label}
            hint={`${LINK_EXPIRY_LIMITS[k].min}–${LINK_EXPIRY_LIMITS[k].max} days`}
            inputMode="numeric"
          />
        ))}
      </form>
    </DetailsDrawer>
  );
}

/** Edit panel for one hub-owned settings section. */
export function SettingsPanel({ panel, sections, onClose }: { panel: PanelKey; sections: SettingsSectionsOut; onClose: () => void }) {
  switch (panel) {
    case "company":
      return <CompanyPanel data={sections.company} onClose={onClose} />;
    case "regional":
      return <RegionalPanel data={sections.regional} onClose={onClose} />;
    case "id_prefixes":
      return <IdPrefixesPanel data={sections.id_prefixes} onClose={onClose} />;
    case "link_expiries":
      return <LinkExpiriesPanel data={sections.link_expiries} onClose={onClose} />;
  }
}
