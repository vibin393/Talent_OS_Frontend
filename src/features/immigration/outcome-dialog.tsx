"use client";

import { Button, Field, Input, MessageBar, MessageBarBody, Radio, RadioGroup, Subtitle2, Textarea } from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { isApiError } from "@/lib/api/errors";
import { immigrationApi } from "./api";
import { buildPermit, emptyPermitForm, type PermitForm, permitErrors } from "./logic";
import type { CaseOut, ExpiryFieldDef } from "./types";
import { DialogShell, useAction } from "./ui";

/** Permit fields driven by the pinned version's `expiry_fields` (the primary one is the permit's expiry). */
export function PermitFields({
  fields,
  form,
  onChange,
  errors,
}: {
  fields: ExpiryFieldDef[];
  form: PermitForm;
  onChange: (form: PermitForm) => void;
  errors: Record<string, string>;
}) {
  const set = (patch: Partial<PermitForm>) => onChange({ ...form, ...patch });
  return (
    <>
      <Field label="Permit type" hint="Defaults to the visa type name.">
        <Input value={form.permit_type} maxLength={200} onChange={(_, d) => set({ permit_type: d.value })} />
      </Field>
      <Field label="Permit number" required validationMessage={errors.number} hint="Stored encrypted; shown masked afterwards.">
        <Input value={form.number} maxLength={40} autoComplete="off" onChange={(_, d) => set({ number: d.value })} />
      </Field>
      <Field label="Valid from" required validationMessage={errors.valid_from}>
        <Input type="date" value={form.valid_from} onChange={(_, d) => set({ valid_from: d.value })} />
      </Field>
      {fields.map((f) => (
        <Field
          key={f.key}
          label={f.primary ? `${f.label} (permit expiry)` : f.label}
          required={f.required}
          validationMessage={errors[`expiry.${f.key}`]}
        >
          <Input type="date" value={form.values[f.key] ?? ""} onChange={(_, d) => set({ values: { ...form.values, [f.key]: d.value } })} />
        </Field>
      ))}
      <Field label="Conditions">
        <Textarea value={form.conditions} maxLength={4000} onChange={(_, d) => set({ conditions: d.value })} />
      </Field>
    </>
  );
}

function outcomeError(e: unknown): string | null {
  if (!isApiError(e)) return null;
  if (e.code === "human_only_action") return "Only a person can record a decision — automated actors cannot.";
  if (e.code === "permit_expiry_required") return "The permit expiry date is required for this visa type.";
  return null;
}

/** ★ Record the decision: Approved (with the Permit form) or Refused. Human-only on the backend. */
export function OutcomeDialog({ c, onClose, onDone }: { c: CaseOut; onClose: () => void; onDone: () => void }) {
  const admin = useAdminStyles();
  const canApprove = c.allowed_actions.includes("approve");
  const canRefuse = c.allowed_actions.includes("refuse");
  const [outcome, setOutcome] = useState<"approved" | "refused">(canApprove ? "approved" : "refused");
  const [note, setNote] = useState("");
  const [form, setForm] = useState<PermitForm>(emptyPermitForm);
  const [touched, setTouched] = useState(false);
  const { error, busy, run } = useAction(onDone, onClose, outcomeError);
  const errors = outcome === "approved" ? permitErrors(c.expiry_fields, form) : {};
  const invalid = Object.keys(errors).length > 0;
  const submit = () => {
    setTouched(true);
    if (invalid) return;
    void run(() =>
      immigrationApi.outcome(c.id, {
        outcome,
        note: note.trim() || null,
        permit: outcome === "approved" ? buildPermit(c.expiry_fields, form) : null,
      }),
    );
  };
  return (
    <DialogShell
      title="Record decision"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || (touched && invalid)} onClick={submit}>
            Record {outcome === "approved" ? "approval" : "refusal"}
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>{c.disclaimer}</MessageBarBody>
        </MessageBar>
        <Field label="Decision" required>
          <RadioGroup value={outcome} onChange={(_, d) => setOutcome(d.value as "approved" | "refused")}>
            <Radio value="approved" label="Approved" disabled={!canApprove} />
            <Radio value="refused" label="Refused" disabled={!canRefuse} />
          </RadioGroup>
        </Field>
        <Field label="Note">
          <Textarea value={note} maxLength={4000} onChange={(_, d) => setNote(d.value)} />
        </Field>
        {outcome === "approved" && (
          <>
            <Subtitle2 as="h3">Permit</Subtitle2>
            <PermitFields fields={c.expiry_fields} form={form} onChange={setForm} errors={touched ? errors : {}} />
          </>
        )}
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

/** Amend / renew: records another Permit on an approved case (the previous one is superseded). */
export function PermitDialog({ c, onClose, onDone }: { c: CaseOut; onClose: () => void; onDone: () => void }) {
  const admin = useAdminStyles();
  const [form, setForm] = useState<PermitForm>(emptyPermitForm);
  const [touched, setTouched] = useState(false);
  const { error, busy, run } = useAction(onDone, onClose);
  const errors = permitErrors(c.expiry_fields, form);
  const invalid = Object.keys(errors).length > 0;
  return (
    <DialogShell
      title="Record permit"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy || (touched && invalid)}
            onClick={() => {
              setTouched(true);
              if (!invalid) void run(() => immigrationApi.addPermit(c.id, buildPermit(c.expiry_fields, form)));
            }}
          >
            Record permit
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <PermitFields fields={c.expiry_fields} form={form} onChange={setForm} errors={touched ? errors : {}} />
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}
