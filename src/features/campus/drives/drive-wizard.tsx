"use client";

import {
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  SpinButton,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, Checkmark16Regular, Delete20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { assessmentsApi } from "@/features/assessments/api";
import { interviewsApi } from "@/features/interviews/api";
import { offersApi } from "@/features/offers/api";
import { SegmentBuilder } from "@/features/segments/segment-builder";
import type { Definition } from "@/features/segments/types";
import { errorMessage } from "@/lib/api/errors";
import { campusApi } from "../api";
import { isoToLocal, localToIso, normalizeSchema, schemaBody, validateFormSchema } from "../logic";
import { DemandPicker, InstitutionPicker } from "../pickers";
import type { DriveOut, FormField } from "../types";
import { useCampusStyles } from "../ui";
import { useCampusPermissions, useDrive, useDriveMutation } from "../use-campus";
import { FormBuilder } from "./form-builder";

const STEPS = [
  "Details",
  "Institutions",
  "Demands",
  "Registration form",
  "Eligibility rules",
  "Assessment & interviews",
  "Offer template",
] as const;

const useStyles = makeStyles({
  layout: { display: "grid", gap: tokens.spacingHorizontalXL, gridTemplateColumns: "220px minmax(0, 1fr)", "@media (max-width: 767px)": { gridTemplateColumns: "1fr" } },
  steps: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, "@media (max-width: 767px)": { flexDirection: "row", flexWrap: "wrap" } },
  step: { width: "100%", justifyContent: "flex-start", textAlign: "start" },
  current: { backgroundColor: tokens.colorBrandBackground2, fontWeight: tokens.fontWeightSemibold },
  nav: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", marginTop: tokens.spacingVerticalL },
});

/** `/campus/drives/new` and `/campus/drives/[id]/setup`: the drive set-up wizard. */
export function DriveWizard({ driveId }: { driveId: string | null }) {
  const { canManage } = useCampusPermissions();
  const drive = useDrive(driveId);
  if (!canManage) return <NoAccess what="campus drive set-up" />;
  if (driveId && drive.isPending) return <GridSkeleton rows={8} />;
  if (driveId && drive.isError) return <ErrorBar title="Could not load the drive." message={errorMessage(drive.error)} />;
  return <Wizard initial={drive.data ?? null} />;
}

function Wizard({ initial }: { initial: DriveOut | null }) {
  const styles = useStyles();
  const c = useCampusStyles();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<DriveOut | null>(initial);
  // Prefer the live cache once the drive exists (other steps update it).
  const live = useDrive(created?.id ?? null);
  const drive = live.data ?? created;

  return (
    <>
      <AppLink href={drive ? `/campus/drives/${drive.id}` : "/campus/drives"}>
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> {drive ? drive.name : "Campus drives"}
      </AppLink>
      <PageHeader title={drive ? `Set up ${drive.name}` : "New campus drive"} subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} />
      <div className={styles.layout}>
        <nav aria-label="Set-up steps">
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s}>
                <Button
                  appearance="subtle"
                  className={mergeClasses(styles.step, i === step && styles.current)}
                  aria-current={i === step ? "step" : undefined}
                  disabled={!drive && i > 0}
                  icon={drive && i < step ? <Checkmark16Regular /> : undefined}
                  onClick={() => setStep(i)}
                >
                  {i + 1}. {s}
                </Button>
              </li>
            ))}
          </ol>
        </nav>
        <section className={c.card} aria-labelledby="wizard-step">
          <Subtitle2 as="h2" id="wizard-step">
            {STEPS[step]}
          </Subtitle2>
          {step === 0 && (
            <DetailsStep
              drive={drive}
              onSaved={(d) => {
                setCreated(d);
                setStep(1);
              }}
            />
          )}
          {drive && step === 1 && <InstitutionsStep drive={drive} />}
          {drive && step === 2 && <DemandsStep drive={drive} />}
          {drive && step === 3 && <FormStep drive={drive} onSaved={() => setStep(4)} />}
          {drive && step === 4 && <EligibilityStep drive={drive} onSaved={() => setStep(5)} />}
          {drive && step === 5 && <PlanStep drive={drive} onSaved={() => setStep(6)} />}
          {drive && step === 6 && <OfferStep drive={drive} onSaved={() => router.push(`/campus/drives/${drive.id}`)} />}
          {drive && step > 0 && (
            <div className={styles.nav}>
              <Button onClick={() => setStep(step - 1)}>Back</Button>
              {step < STEPS.length - 1 && [1, 2].includes(step) && (
                <Button appearance="primary" onClick={() => setStep(step + 1)}>
                  Next
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <MessageBar intent="error" role="alert">
      <MessageBarBody>{error}</MessageBarBody>
    </MessageBar>
  );
}

function DetailsStep({ drive, onSaved }: { drive: DriveOut | null; onSaved: (d: DriveOut) => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const [name, setName] = useState(drive?.name ?? "");
  const [batch, setBatch] = useState<number>(drive?.batch_year ?? new Date().getFullYear() + 1);
  const [opens, setOpens] = useState(isoToLocal(drive?.registration_opens_at));
  const [closes, setCloses] = useState(isoToLocal(drive?.registration_closes_at));
  const [notes, setNotes] = useState(drive?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useDriveMutation((body: Parameters<typeof campusApi.createDrive>[0]) =>
    drive ? campusApi.updateDrive(drive.id, body) : campusApi.createDrive(body),
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Give the drive a name of at least 2 characters.");
    if (!Number.isInteger(batch) || batch < 2000 || batch > 2100) return setError("Batch year is between 2000 and 2100.");
    const o = localToIso(opens);
    const cl = localToIso(closes);
    if (o && cl && Date.parse(cl) <= Date.parse(o)) return setError("Registration must close after it opens.");
    setError(null);
    save.mutate(
      { name: name.trim(), batch_year: batch, registration_opens_at: o, registration_closes_at: cl, notes: notes.trim() || null },
      {
        onSuccess: (d) => {
          toast.success(drive ? "Drive saved" : "Drive created as a draft");
          onSaved(d);
        },
        onError: (e2) => setError(errorMessage(e2)),
      },
    );
  };
  return (
    <form className={c.stack} onSubmit={submit} noValidate>
      <div className={c.grid2}>
        <Field label="Drive name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Batch (graduation year)" required>
          <SpinButton value={batch} min={2000} max={2100} onChange={(_, d) => setBatch(Number(d.value ?? d.displayValue ?? batch))} />
        </Field>
        <Field label="Registration opens">
          <Input type="datetime-local" value={opens} onChange={(_, d) => setOpens(d.value)} />
        </Field>
        <Field label="Registration closes">
          <Input type="datetime-local" value={closes} onChange={(_, d) => setCloses(d.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={notes} maxLength={5000} resize="vertical" onChange={(_, d) => setNotes(d.value)} />
      </Field>
      <ErrorText error={error} />
      <div>
        <Button appearance="primary" type="submit" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          {drive ? "Save and continue" : "Create draft and continue"}
        </Button>
      </div>
    </form>
  );
}

function InstitutionsStep({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  const [pick, setPick] = useState<string | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = useDriveMutation(({ id, cap: n }: { id: string; cap: number | null }) => campusApi.addInstitution(drive.id, id, n));
  const remove = useDriveMutation((diid: string) => campusApi.removeInstitution(drive.id, diid));
  const linked = drive.institutions.map((i) => i.institution_id);
  return (
    <div className={c.stack}>
      <Caption1 className={c.muted}>Each Institution gets its own registration link and QR code.</Caption1>
      <div className={c.row}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <InstitutionPicker label="Institution" value={pick} excludeIds={linked} onChange={(id) => setPick(id)} />
        </div>
        <Field label="Registration cap (optional)">
          <SpinButton value={cap} min={1} max={100000} onChange={(_, d) => setCap(d.value ?? (d.displayValue ? Number(d.displayValue) : null))} />
        </Field>
        <Button
          appearance="primary"
          disabled={!pick || add.isPending}
          onClick={() =>
            pick &&
            add.mutate(
              { id: pick, cap },
              { onSuccess: () => {
                  setPick(null);
                  setCap(null);
                  setError(null);
                }, onError: (e) => setError(errorMessage(e)) },
            )
          }
        >
          Add
        </Button>
      </div>
      <ErrorText error={error} />
      {drive.institutions.length === 0 ? (
        <span className={c.muted}>No Institutions yet.</span>
      ) : (
        <div className={c.tableWrap}>
          <Table aria-label="Drive institutions" style={{ minWidth: 480 }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Institution</TableHeaderCell>
                <TableHeaderCell>Cap</TableHeaderCell>
                <TableHeaderCell>Link</TableHeaderCell>
                <TableHeaderCell aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drive.institutions.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.institution_name}</TableCell>
                  <TableCell>{i.registration_cap ?? "No cap"}</TableCell>
                  <TableCell>{i.link_active ? "Active" : "Not active yet"}</TableCell>
                  <TableCell>
                    <Button
                      appearance="subtle"
                      icon={<Delete20Regular />}
                      aria-label={`Remove ${i.institution_name}`}
                      disabled={remove.isPending || i.registration_count > 0}
                      onClick={() => remove.mutate(i.id, { onError: (e) => setError(errorMessage(e)) })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DemandsStep({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  const [error, setError] = useState<string | null>(null);
  const add = useDriveMutation((id: string) => campusApi.addDemand(drive.id, id));
  const remove = useDriveMutation((id: string) => campusApi.removeDemand(drive.id, id));
  return (
    <div className={c.stack}>
      <Caption1 className={c.muted}>Shortlisted students join the pipeline of the Demand you choose when you confirm the shortlist.</Caption1>
      <div style={{ maxWidth: 480 }}>
        <DemandPicker
          label="Add a Demand"
          excludeIds={drive.demands.map((d) => d.id)}
          disabled={add.isPending}
          onPick={(d) => add.mutate(d.id, { onSuccess: () => setError(null), onError: (e) => setError(errorMessage(e)) })}
        />
      </div>
      <ErrorText error={error} />
      {drive.demands.length === 0 ? (
        <span className={c.muted}>No Demands linked yet.</span>
      ) : (
        <ul>
          {drive.demands.map((d) => (
            <li key={d.id}>
              {d.title}
              {d.req_id ? ` (${d.req_id})` : ""}{" "}
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete20Regular />}
                aria-label={`Unlink ${d.title}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(d.id, { onError: (e) => setError(errorMessage(e)) })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormStep({ drive, onSaved }: { drive: DriveOut; onSaved: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const [fields, setFields] = useState<FormField[]>(() => normalizeSchema(drive.form_schema?.fields));
  const [error, setError] = useState<string | null>(null);
  const save = useDriveMutation((f: FormField[]) => campusApi.updateDrive(drive.id, { form_schema: schemaBody(f) }));
  const invalid = Object.keys(validateFormSchema(fields)).length > 0;
  return (
    <div className={c.stack}>
      <FormBuilder fields={fields} onChange={setFields} disabled={save.isPending} />
      <ErrorText error={error ?? (invalid ? "Fix the fields marked in red before saving." : null)} />
      <div>
        <Button
          appearance="primary"
          disabled={save.isPending || invalid}
          onClick={() =>
            save.mutate(fields, {
              onSuccess: () => {
                toast.success("Registration form saved");
                onSaved();
              },
              onError: (e) => setError(errorMessage(e)),
            })
          }
        >
          Save and continue
        </Button>
      </div>
    </div>
  );
}

function EligibilityStep({ drive, onSaved }: { drive: DriveOut; onSaved: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const [definition, setDefinition] = useState<Definition>({ filters: (drive.eligibility_definition?.filters ?? null) as Definition["filters"] });
  const [error, setError] = useState<string | null>(null);
  const save = useDriveMutation((filters: unknown) => campusApi.setEligibility(drive.id, filters));
  const run = (filters: unknown) =>
    save.mutate(filters, {
      onSuccess: () => {
        toast.success(filters ? "Eligibility rules saved: registrations are re-evaluated" : "Eligibility rules cleared");
        onSaved();
      },
      onError: (e) => setError(errorMessage(e)),
    });
  return (
    <div className={c.stack}>
      <Caption1 className={c.muted}>
        Registrations that match every rule are Eligible; the others are Not eligible with the first rule they fail. With
        no rules, everybody is eligible.
      </Caption1>
      <SegmentBuilder sourceKey="campus.registration" initial={definition} onChange={setDefinition} showPreview={false} disabled={save.isPending} />
      <ErrorText error={error} />
      <div className={c.row}>
        <Button appearance="primary" disabled={save.isPending} onClick={() => run(definition.filters)}>
          Save rules
        </Button>
        <Button disabled={save.isPending} onClick={() => run(null)}>
          Clear rules
        </Button>
      </div>
    </div>
  );
}

function windowValue(w: DriveOut["assessment_window"], k: "from" | "to"): string {
  const v = w?.[k];
  return typeof v === "string" ? isoToLocal(v) : "";
}

function PlanStep({ drive, onSaved }: { drive: DriveOut; onSaved: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const assessments = useQuery({ queryKey: ["assessments", "list", "published"], queryFn: ({ signal }) => assessmentsApi.list("published", signal) });
  const templates = useQuery({ queryKey: ["interviews", "stage-templates"], queryFn: ({ signal }) => interviewsApi.templates(false, signal) });
  const [assessmentId, setAssessmentId] = useState<string | null>(drive.assessment_id);
  const [aFrom, setAFrom] = useState(windowValue(drive.assessment_window, "from"));
  const [aTo, setATo] = useState(windowValue(drive.assessment_window, "to"));
  const [templateId, setTemplateId] = useState<string | null>(drive.interview_stage_template_id);
  const [iFrom, setIFrom] = useState(windowValue(drive.interview_window, "from"));
  const [iTo, setITo] = useState(windowValue(drive.interview_window, "to"));
  const [error, setError] = useState<string | null>(null);
  const save = useDriveMutation(() =>
    campusApi.updateDrive(drive.id, {
      assessment_id: assessmentId,
      assessment_window: aFrom || aTo ? { from: localToIso(aFrom), to: localToIso(aTo) } : null,
      interview_stage_template_id: templateId,
      interview_window: iFrom || iTo ? { from: localToIso(iFrom), to: localToIso(iTo) } : null,
    }),
  );
  const aOptions = assessments.data ?? [];
  const tOptions = (templates.data ?? []) as { id: string; name: string }[];
  return (
    <div className={c.stack}>
      <div className={c.grid2}>
        <Field label="Assessment" hint="Published assessments only">
          <Dropdown
            value={aOptions.find((a) => a.id === assessmentId)?.name ?? (assessmentId ? "Selected assessment" : "No assessment")}
            selectedOptions={[assessmentId ?? ""]}
            onOptionSelect={(_, d) => setAssessmentId(d.optionValue || null)}
          >
            <Option value="">No assessment</Option>
            {aOptions.map((a) => (
              <Option key={a.id} value={a.id}>
                {a.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Assessment window opens">
          <Input type="datetime-local" value={aFrom} onChange={(_, d) => setAFrom(d.value)} />
        </Field>
        <Field label="Assessment window closes">
          <Input type="datetime-local" value={aTo} onChange={(_, d) => setATo(d.value)} />
        </Field>
        <Field label="Interview stage template">
          <Dropdown
            value={tOptions.find((t) => t.id === templateId)?.name ?? (templateId ? "Selected template" : "None")}
            selectedOptions={[templateId ?? ""]}
            onOptionSelect={(_, d) => setTemplateId(d.optionValue || null)}
          >
            <Option value="">None</Option>
            {tOptions.map((t) => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Interview window opens">
          <Input type="datetime-local" value={iFrom} onChange={(_, d) => setIFrom(d.value)} />
        </Field>
        <Field label="Interview window closes">
          <Input type="datetime-local" value={iTo} onChange={(_, d) => setITo(d.value)} />
        </Field>
      </div>
      <ErrorText error={error} />
      <div>
        <Button
          appearance="primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(undefined, {
              onSuccess: () => {
                toast.success("Assessment and interview plan saved");
                onSaved();
              },
              onError: (e) => setError(errorMessage(e)),
            })
          }
        >
          Save and continue
        </Button>
      </div>
    </div>
  );
}

function OfferStep({ drive, onSaved }: { drive: DriveOut; onSaved: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const templates = useQuery({ queryKey: ["offers", "templates", false], queryFn: ({ signal }) => offersApi.templates(false, signal) });
  const [templateId, setTemplateId] = useState<string | null>(drive.offer_template_id);
  const [error, setError] = useState<string | null>(null);
  const save = useDriveMutation(() => campusApi.updateDrive(drive.id, { offer_template_id: templateId }));
  const options = templates.data ?? [];
  return (
    <div className={c.stack}>
      <Caption1 className={c.muted}>Bulk offers use this template. Each offer still goes through its own approval and release.</Caption1>
      <Field label="Offer template" style={{ maxWidth: 420 }}>
        <Dropdown
          value={options.find((t) => t.id === templateId)?.name ?? (templateId ? "Selected template" : "None")}
          selectedOptions={[templateId ?? ""]}
          onOptionSelect={(_, d) => setTemplateId(d.optionValue || null)}
        >
          <Option value="">None</Option>
          {options.map((t) => (
            <Option key={t.id} value={t.id}>
              {t.name}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <ErrorText error={error} />
      <div>
        <Button
          appearance="primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(undefined, {
              onSuccess: () => {
                toast.success("Drive set-up complete");
                onSaved();
              },
              onError: (e) => setError(errorMessage(e)),
            })
          }
        >
          Finish
        </Button>
      </div>
    </div>
  );
}
