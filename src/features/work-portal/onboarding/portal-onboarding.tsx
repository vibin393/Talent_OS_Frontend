"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Link,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type FieldValues, type Resolver, useForm, useWatch } from "react-hook-form";
import { PortalCeremonyEmbed } from "@/features/work-portal/onboarding/esign-embed";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { type PortalCase, type PortalTask, workOnboardingApi, workOnboardingKeys } from "./api";
import {
  AADHAAR_LAST4_RE,
  bankSchema,
  chipFor,
  createDebouncer,
  emergencySchema,
  isOpen,
  looksLikeFullAadhaar,
  personalSchema,
  safeDraft,
  sortTasks,
  taxPayload,
  taxSchema,
} from "./logic";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalM, maxWidth: "720px" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginTop: tokens.spacingVerticalS },
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: tokens.spacingHorizontalM },
  returned: { borderLeft: `4px solid ${tokens.colorPaletteMarigoldBorderActive}` },
  saved: { color: tokens.colorNeutralForeground3 },
  progress: { maxWidth: "720px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

/** `/portal/work/onboarding`: the Worker's onboarding checklist (mobile-first, 360 px). */
export function WorkOnboarding() {
  const portal = usePortalStyles();
  const q = useQuery({ queryKey: workOnboardingKeys.cases, queryFn: ({ signal }) => workOnboardingApi.cases(signal), retry: false });
  if (q.isPending) return <LoadingBlock label="Loading your onboarding" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0)
    return (
      <div className={portal.page}>
        <PortalPageHeader title="Onboarding" />
        <Card className={portal.card}>
          <Body1 className={portal.empty}>You have nothing to complete right now.</Body1>
        </Card>
      </div>
    );
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Onboarding" subtitle="Complete these before your start date. Your progress is saved as you type." />
      {q.data.map((c) => (
        <CaseChecklist key={c.id} id={c.id} />
      ))}
    </div>
  );
}

function CaseChecklist({ id }: { id: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: workOnboardingKeys.case(id), queryFn: ({ signal }) => workOnboardingApi.case(id, signal) });
  if (q.isPending) return <LoadingBlock label="Loading tasks" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const c: PortalCase = q.data;
  return (
    <section aria-label={`Onboarding ${c.human_id ?? ""}`} className={styles.list}>
      <div className={styles.progress}>
        <Text weight="semibold">
          {c.progress_pct}% complete{c.planned_start_date ? ` · starts ${new Date(`${c.planned_start_date}T00:00:00`).toLocaleDateString()}` : ""}
        </Text>
        <ProgressBar value={c.progress_pct / 100} thickness="large" aria-label={`${c.progress_pct}% complete`} />
        <Caption1>{c.open_tasks === 0 ? "Nothing left for you to do." : `${c.open_tasks} task(s) left for you.`}</Caption1>
      </div>
      {sortTasks(c.tasks).map((t) => (
        <TaskCard key={t.id} caseId={c.id} task={t} />
      ))}
    </section>
  );
}

function TaskCard({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const chip = chipFor(task.status);
  const [open, setOpen] = useState(task.status === "returned");
  return (
    <Card className={mergeClasses(portal.card, styles.card, task.status === "returned" && styles.returned)}>
      <CardHeader
        header={<Text weight="semibold">{task.label}</Text>}
        description={
          <Caption1>
            {task.due_on ? `Due ${new Date(`${task.due_on}T00:00:00`).toLocaleDateString()}` : ""}
            {task.mandatory ? "" : " · optional"}
          </Caption1>
        }
        action={
          <Badge appearance="tint" color={chip.color}>
            {chip.label}
          </Badge>
        }
      />
      {task.status === "returned" && task.return_comment && (
        <MessageBar intent="warning">
          <MessageBarBody>HR asked you to update this: {task.return_comment}</MessageBarBody>
        </MessageBar>
      )}
      {task.instructions && <Body1>{task.instructions}</Body1>}
      {Object.entries(task.masked).filter(([, v]) => v).length > 0 && (
        <Caption1>
          {Object.entries(task.masked)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${k.endsWith("last4") ? `•••• ${v}` : v}`)
            .join(" · ")}
        </Caption1>
      )}
      {(isOpen(task) || task.kind === "esign") && task.status !== "approved" && (
        <>
          {!open ? (
            <Button appearance="primary" onClick={() => setOpen(true)}>
              {task.kind === "esign" ? "Sign" : task.status === "returned" ? "Update" : "Start"}
            </Button>
          ) : (
            <TaskForm caseId={caseId} task={task} />
          )}
        </>
      )}
    </Card>
  );
}

function useTaskActions(caseId: string, task: PortalTask) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: workOnboardingKeys.case(caseId) });
    void qc.invalidateQueries({ queryKey: workOnboardingKeys.cases });
  };
  const submit = useMutation({
    mutationFn: (payload: Record<string, unknown>) => workOnboardingApi.submit(task.id, payload),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (e) => {
      setError(errorMessage(e));
      setFields(fieldErrors(e));
    },
  });
  const debouncer = useMemo(
    () =>
      createDebouncer<Record<string, unknown>>(async (draft) => {
        try {
          await workOnboardingApi.saveDraft(task.id, draft);
          setSavedAt(new Date().toLocaleTimeString());
          setOffline(false);
        } catch (e) {
          setOffline(true);
          throw e;
        }
      }),
    [task.id],
  );
  useEffect(() => () => debouncer.cancel(), [debouncer]);
  return { submit, error, fields, savedAt, offline, autosave: (v: Record<string, unknown>) => debouncer.push(safeDraft(v)), refresh };
}

function SaveState({ savedAt, offline }: { savedAt: string | null; offline: boolean }) {
  const styles = useStyles();
  if (offline) return <Caption1 role="status">You seem to be offline — we will keep trying to save your progress.</Caption1>;
  return savedAt ? (
    <Caption1 role="status" className={styles.saved}>
      Draft saved {savedAt}
    </Caption1>
  ) : null;
}

function ErrorBar({ message }: { message: string | null }) {
  return message ? (
    <MessageBar intent="error" role="alert">
      <MessageBarBody>{message}</MessageBarBody>
    </MessageBar>
  ) : null;
}

function TaskForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  switch (task.kind) {
    case "bank_details":
      return <BankForm caseId={caseId} task={task} />;
    case "tax_details":
      return <TaxForm caseId={caseId} task={task} />;
    case "emergency_contact":
      return <SimpleForm caseId={caseId} task={task} schema={emergencySchema} fields={[["name", "Name"], ["relation", "Relation"], ["phone", "Phone", "tel"]]} />;
    case "personal_details":
      return (
        <SimpleForm
          caseId={caseId}
          task={task}
          schema={personalSchema}
          fields={[
            ["date_of_birth", "Date of birth", "date"],
            ["father_or_spouse_name", "Father's or spouse's name"],
            ["phone", "Phone", "tel"],
            ["current_address", "Current address", "textarea"],
            ["city", "City"],
            ["state", "State"],
            ["permanent_address", "Permanent address", "textarea"],
          ]}
        />
      );
    case "document_upload":
      return <DocumentForm caseId={caseId} task={task} />;
    case "policy_ack":
      return <PolicyForm caseId={caseId} task={task} />;
    case "esign":
      return task.signer_id ? <PortalCeremonyEmbed signerId={task.signer_id} /> : <Body1>Your agreement is being prepared. Check back shortly.</Body1>;
    case "credential":
      return (
        <Body1>
          Provide this credential in <NextLink href={String(task.form?.link ?? "/portal/work")}>My Work &gt; Credentials</NextLink>. This task updates once it is
          recorded.
        </Body1>
      );
    case "client_form":
      return <ClientForm caseId={caseId} task={task} />;
    default:
      return null;
  }
}

type FieldSpec = [name: string, label: string, type?: "date" | "tel" | "textarea"];

function SimpleForm({ caseId, task, schema, fields }: { caseId: string; task: PortalTask; schema: typeof emergencySchema | typeof personalSchema; fields: FieldSpec[] }) {
  const styles = useStyles();
  const a = useTaskActions(caseId, task);
  const form = useForm<FieldValues>({ resolver: zodResolver(schema) as unknown as Resolver<FieldValues>, defaultValues: (task.draft as FieldValues) ?? {} });
  const errs = form.formState.errors;
  return (
    <form
      className={styles.form}
      noValidate
      onChange={() => a.autosave(form.getValues())}
      onSubmit={form.handleSubmit((v) => a.submit.mutate(v))}
    >
      <ErrorBar message={a.error} />
      {fields.map(([name, label, type]) => (
        <Field key={name} label={label} validationMessage={(errs[name]?.message as string | undefined) ?? a.fields[name]}>
          {type === "textarea" ? <Textarea {...form.register(name)} /> : <Input type={type ?? "text"} {...form.register(name)} />}
        </Field>
      ))}
      <SaveState savedAt={a.savedAt} offline={a.offline} />
      <Button appearance="primary" type="submit" disabled={a.submit.isPending}>
        Submit
      </Button>
    </form>
  );
}

function BankForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const a = useTaskActions(caseId, task);
  const form = useForm<FieldValues>({ resolver: zodResolver(bankSchema) as unknown as Resolver<FieldValues>, defaultValues: (task.draft as FieldValues) ?? {} });
  const errs = form.formState.errors;
  const msg = (n: string) => (errs[n]?.message as string | undefined) ?? a.fields[n];
  return (
    <form className={styles.form} noValidate onChange={() => a.autosave(form.getValues())} onSubmit={form.handleSubmit((v) => a.submit.mutate(v))}>
      <ErrorBar message={a.error} />
      <Field label="Account holder name" validationMessage={msg("holder_name")}>
        <Input autoComplete="name" {...form.register("holder_name")} />
      </Field>
      <Field label="Account number" validationMessage={msg("account_number")}>
        <Input inputMode="numeric" autoComplete="off" {...form.register("account_number")} />
      </Field>
      <Field label="Re-enter account number" hint="Type it again — pasting is disabled." validationMessage={msg("account_number_confirm")}>
        <Input inputMode="numeric" autoComplete="off" onPaste={(e) => e.preventDefault()} {...form.register("account_number_confirm")} />
      </Field>
      <div className={styles.row}>
        <Field label="IFSC" validationMessage={msg("ifsc")}>
          <Input autoCapitalize="characters" {...form.register("ifsc")} />
        </Field>
        <Field label="Bank name (optional)">
          <Input {...form.register("bank_name")} />
        </Field>
      </div>
      <Caption1>HR will verify your bank details before they are used for pay.</Caption1>
      <SaveState savedAt={a.savedAt} offline={a.offline} />
      <Button appearance="primary" type="submit" disabled={a.submit.isPending}>
        Submit bank details
      </Button>
    </form>
  );
}

function TaxForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const a = useTaskActions(caseId, task);
  const mode = String(task.form?.declaration_mode ?? "either");
  const [upload, setUpload] = useState(mode === "upload");
  const [uploaded, setUploaded] = useState(false);
  const form = useForm<FieldValues>({ resolver: zodResolver(taxSchema) as unknown as Resolver<FieldValues>, defaultValues: (task.draft as FieldValues) ?? { regime: "new" } });
  const regime = useWatch({ control: form.control, name: "regime" }) as string | undefined;
  const errs = form.formState.errors;
  const msg = (n: string) => (errs[n]?.message as string | undefined) ?? a.fields[n];
  return (
    <form
      className={styles.form}
      noValidate
      onChange={() => a.autosave(form.getValues())}
      onSubmit={form.handleSubmit((v) => a.submit.mutate(taxPayload(v as never, upload ? "upload" : "form")))}
    >
      <ErrorBar message={a.error} />
      <div className={styles.row}>
        <Field label="PAN" validationMessage={msg("pan")}>
          <Input autoCapitalize="characters" autoComplete="off" {...form.register("pan")} />
        </Field>
        <Field label="Name as on PAN">
          <Input {...form.register("pan_name")} />
        </Field>
      </div>
      {mode === "either" && <Switch checked={upload} label="Upload my declaration instead" onChange={(_, d) => setUpload(d.checked)} />}
      {upload ? (
        <FileUpload taskId={task.id} label="Investment declaration" onUploaded={() => setUploaded(true)} />
      ) : (
        <>
          <Field label="Tax regime">
            <RadioGroup value={String(regime ?? "new")} onChange={(_, d) => form.setValue("regime", d.value, { shouldDirty: true })}>
              <Radio value="new" label="New regime" />
              <Radio value="old" label="Old regime" />
            </RadioGroup>
          </Field>
          {regime === "old" && (
            <div className={styles.row}>
              {(
                [
                  ["section_80c", "80C"],
                  ["section_80d", "80D"],
                  ["hra_rent", "Rent paid (HRA)"],
                  ["home_loan_interest", "Home-loan interest"],
                  ["other", "Other"],
                ] as const
              ).map(([n, l]) => (
                <Field key={n} label={`${l} (₹)`} validationMessage={msg(n)}>
                  <Input inputMode="decimal" {...form.register(n)} />
                </Field>
              ))}
            </div>
          )}
        </>
      )}
      <SaveState savedAt={a.savedAt} offline={a.offline} />
      <Button appearance="primary" type="submit" disabled={a.submit.isPending || (upload && !uploaded)}>
        Submit
      </Button>
    </form>
  );
}

function FileUpload({ taskId, label, onUploaded, capture = true }: { taskId: string; label: string; onUploaded: () => void; capture?: boolean }) {
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("The file is larger than 10 MB.");
      return;
    }
    setState("uploading");
    try {
      await workOnboardingApi.upload(taskId, file);
      setState("done");
      setError(null);
      onUploaded();
    } catch (e) {
      setState("error");
      setError(`${errorMessage(e)} Check your connection and try again.`);
    }
  };
  return (
    <Field label={label} validationMessage={error ?? undefined} hint={state === "done" ? "Uploaded" : "PDF or photo, up to 10 MB"}>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        aria-label={label}
        disabled={state === "uploading"}
        onChange={(e) => void onFile(e.currentTarget.files?.[0])}
      />
    </Field>
  );
}

function DocumentForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const a = useTaskActions(caseId, task);
  const aadhaar = Boolean(task.form?.aadhaar);
  const [uploaded, setUploaded] = useState(false);
  const [last4, setLast4] = useState("");
  const [masked, setMasked] = useState(false);
  const last4Error = last4 && !AADHAAR_LAST4_RE.test(last4) ? (looksLikeFullAadhaar(last4) ? "Enter only the last 4 digits" : "Enter 4 digits") : undefined;
  return (
    <div className={styles.form}>
      <ErrorBar message={a.error} />
      {aadhaar && (
        <MessageBar intent="info">
          <MessageBarBody>Cover the first 8 digits of your Aadhaar number before you take the photo. Never type the full number.</MessageBarBody>
        </MessageBar>
      )}
      <FileUpload taskId={task.id} label={aadhaar ? "Photo of your masked Aadhaar" : "Document"} onUploaded={() => setUploaded(true)} />
      {aadhaar && (
        <>
          <Field label="Last 4 digits of your Aadhaar" validationMessage={last4Error}>
            <Input inputMode="numeric" maxLength={4} value={last4} onChange={(_, d) => setLast4(d.value.replace(/\D/g, ""))} />
          </Field>
          <Checkbox checked={masked} onChange={(_, d) => setMasked(Boolean(d.checked))} label="My photo hides the first 8 digits" />
        </>
      )}
      <Button
        appearance="primary"
        disabled={!uploaded || a.submit.isPending || (aadhaar && (!masked || !AADHAAR_LAST4_RE.test(last4)))}
        onClick={() => a.submit.mutate(aadhaar ? { aadhaar_last4: last4, masked_image: masked } : {})}
      >
        Submit
      </Button>
    </div>
  );
}

function PolicyForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const ack = useMutation({
    mutationFn: () => workOnboardingApi.acknowledge(task.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workOnboardingKeys.case(caseId) });
      void qc.invalidateQueries({ queryKey: workOnboardingKeys.cases });
    },
  });
  return (
    <div className={styles.form}>
      <ErrorBar message={ack.isError ? errorMessage(ack.error) : null} />
      <Link href={workOnboardingApi.policyUrl(task.id)} target="_blank" rel="noopener">
        Read the policy (PDF)
      </Link>
      <Checkbox checked={accepted} onChange={(_, d) => setAccepted(Boolean(d.checked))} label="I have read and accept this policy" />
      <Button appearance="primary" disabled={!accepted || ack.isPending} onClick={() => ack.mutate()}>
        Acknowledge
      </Button>
    </div>
  );
}

type FormField = { name: string; label?: string; type: "text" | "number" | "date" | "choice" | "boolean" | "file"; required?: boolean; options?: string[] };

function ClientForm({ caseId, task }: { caseId: string; task: PortalTask }) {
  const styles = useStyles();
  const a = useTaskActions(caseId, task);
  const fields = ((task.form?.fields as FormField[]) ?? []).filter((f) => f && f.name);
  const [values, setValues] = useState<Record<string, unknown>>(() => (task.draft as Record<string, unknown>) ?? {});
  const set = (n: string, v: unknown) => {
    const next = { ...values, [n]: v };
    setValues(next);
    a.autosave(next);
  };
  return (
    <div className={styles.form}>
      <ErrorBar message={a.error} />
      {fields.map((f) => {
        const label = f.label ?? f.name.replace(/_/g, " ");
        if (f.type === "boolean")
          return <Checkbox key={f.name} checked={values[f.name] === true} onChange={(_, d) => set(f.name, Boolean(d.checked))} label={label} />;
        if (f.type === "file") return <FileUpload key={f.name} taskId={task.id} label={label} onUploaded={() => set(f.name, "uploaded")} />;
        if (f.type === "choice")
          return (
            <Field key={f.name} label={label} required={f.required} validationMessage={a.fields[f.name]}>
              <RadioGroup value={String(values[f.name] ?? "")} onChange={(_, d) => set(f.name, d.value)}>
                {(f.options ?? []).map((o) => (
                  <Radio key={o} value={o} label={o} />
                ))}
              </RadioGroup>
            </Field>
          );
        return (
          <Field key={f.name} label={label} required={f.required} validationMessage={a.fields[f.name]}>
            <Input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={String(values[f.name] ?? "")}
              onChange={(_, d) => set(f.name, d.value)}
            />
          </Field>
        );
      })}
      <SaveState savedAt={a.savedAt} offline={a.offline} />
      <Button
        appearance="primary"
        disabled={a.submit.isPending}
        onClick={() => a.submit.mutate(Object.fromEntries(Object.entries(values).filter(([k]) => fields.some((f) => f.name === k && f.type !== "file"))))}
      >
        Submit
      </Button>
    </div>
  );
}
