"use client";

import { Badge, Body1, Button, Caption1, Card, Checkbox, Field, Input, makeStyles, Text, Textarea, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { WorkReferenceChecks } from "@/features/references/referee-form";
import { errorMessage } from "@/lib/api/errors";
import { workBgvApi, workBgvKeys } from "./api";
import { aadhaarLast4Error, CHECK_TYPE_LABELS, consentGate, formatDate, SEVERITY_COLORS } from "./logic";
import type { PortalCase, PortalDiscrepancy, PortalDocument } from "./types";

const useStyles = makeStyles({
  notice: { padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium },
  entry: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: tokens.spacingHorizontalS },
  doc: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingBlock: tokens.spacingVerticalS, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}` },
});

const STATUS: Record<PortalCase["status"], { label: string; color: "brand" | "success" | "danger" }> = {
  in_progress: { label: "In progress", color: "brand" },
  clear: { label: "Clear", color: "success" },
  failed: { label: "Not cleared", color: "danger" },
};

type EntryField = { key: string; label: string; type?: "text" | "date" | "email" | "number" };
const DECLARATION_FIELDS: Record<string, EntryField[]> = {
  employment_history: [
    { key: "employer", label: "Employer" },
    { key: "designation", label: "Designation" },
    { key: "from_date", label: "From", type: "date" },
    { key: "to_date", label: "To", type: "date" },
    { key: "hr_contact_name", label: "HR contact" },
    { key: "hr_contact_email", label: "HR email", type: "email" },
  ],
  education_history: [
    { key: "institution", label: "Institution" },
    { key: "qualification", label: "Qualification" },
    { key: "year", label: "Year", type: "number" },
  ],
  address_history: [
    { key: "line", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "pincode", label: "PIN code" },
  ],
};

/** `/portal/work/bgv`: consent, document checklist (camera upload), Aadhaar last 4, discrepancy responses and
 * referee entry. Mobile-first from 360 px. The worker sees only in progress / clear / not cleared, never reasons. */
export function WorkBgv() {
  const portal = usePortalStyles();
  const cases = useQuery({ queryKey: workBgvKeys.cases, queryFn: ({ signal }) => workBgvApi.cases(signal), retry: false });
  const discrepancies = useQuery({ queryKey: workBgvKeys.discrepancies, queryFn: ({ signal }) => workBgvApi.discrepancies(signal), retry: false });
  if (cases.isPending) return <LoadingBlock label="Loading your verification" />;
  if (cases.isError) return <ErrorBlock error={cases.error} onRetry={() => cases.refetch()} />;
  const open = (discrepancies.data ?? []).filter((d) => d.status === "awaiting_response");
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Background verification" subtitle="Give consent, upload documents and respond to questions about your checks." />
      {cases.data.length === 0 && (
        <Card className={portal.card}>
          <Body1 className={portal.empty}>You have no background verification in progress.</Body1>
        </Card>
      )}
      {cases.data.map((c) => (
        <CaseCard key={c.id} c={c} />
      ))}
      {open.map((d) => (
        <DiscrepancyCard key={d.id} d={d} />
      ))}
      <WorkReferenceChecks ownEmail={null} />
    </div>
  );
}

function CaseCard({ c }: { c: PortalCase }) {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const gate = consentGate(c);
  const submit = useMutation({ mutationFn: () => workBgvApi.submit(c.id), onSuccess: () => void qc.invalidateQueries({ queryKey: workBgvKeys.cases }) });
  const status = STATUS[c.status];
  return (
    <Card className={portal.card}>
      <Text weight="semibold">Verification {c.human_id}</Text>
      <Badge appearance="tint" color={status.color}>
        {status.label}
      </Badge>
      <Caption1>Checks: {c.check_types.map((t) => CHECK_TYPE_LABELS[t]).join(", ")}</Caption1>
      {gate === "waiting" && c.status === "in_progress" && <Body1>We will let you know when there is something for you to do.</Body1>}
      {gate === "consent" && <ConsentCard caseId={c.id} />}
      {gate === "documents" && (
        <>
          {c.documents.map((d) => (
            <DocumentRow key={d.key} caseId={c.id} doc={d} />
          ))}
          {!c.documents_submitted && (
            <Button appearance="primary" className={portal.button} disabled={submit.isPending} onClick={() => submit.mutate()}>
              Submit documents
            </Button>
          )}
          {c.documents_submitted && <Caption1>Documents submitted — thank you.</Caption1>}
          <InlineError message={submit.isError ? errorMessage(submit.error) : null} />
        </>
      )}
    </Card>
  );
}

export function ConsentCard({ caseId }: { caseId: string }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const view = useQuery({ queryKey: workBgvKeys.consent(caseId), queryFn: ({ signal }) => workBgvApi.consent(caseId, signal) });
  const give = useMutation({
    mutationFn: () => workBgvApi.giveConsent(caseId, view.data?.notice_id ?? ""),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workBgvKeys.cases }),
  });
  if (view.isPending) return <LoadingBlock label="Loading the notice" rows={2} />;
  if (view.isError) return <InlineError message={errorMessage(view.error)} />;
  return (
    <div className={styles.notice}>
      <Text weight="semibold">{view.data.title}</Text>
      <MarkdownView source={view.data.body_md} />
      <Caption1>
        Checks: {view.data.check_types.map((t) => CHECK_TYPE_LABELS[t]).join(", ")}
        {view.data.providers.length ? ` · Verification providers: ${view.data.providers.join(", ")}` : ""}
      </Caption1>
      <Checkbox label="I have read the notice and consent to background verification" checked={agreed} onChange={(_, d) => setAgreed(Boolean(d.checked))} />
      <Button appearance="primary" className={portal.button} disabled={!agreed || give.isPending} onClick={() => give.mutate()}>
        Give consent
      </Button>
      <InlineError message={give.isError ? errorMessage(give.error) : null} />
    </div>
  );
}

function DocumentRow({ caseId, doc }: { caseId: string; doc: PortalDocument }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const fields = DECLARATION_FIELDS[doc.key];
  const [files, setFiles] = useState<File[]>([]);
  const [last4, setLast4] = useState("");
  const [entries, setEntries] = useState<Record<string, string>[]>([{}]);
  const [local, setLocal] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      workBgvApi.saveDocument(caseId, doc.key, {
        files,
        aadhaarLast4: doc.key === "aadhaar" ? last4.trim() : undefined,
        declaration: fields
          ? { entries: entries.map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== "").map(([k, v]) => [k, k === "year" ? Number(v) : v]))) }
          : undefined,
      }),
    onSuccess: () => {
      setFiles([]);
      void qc.invalidateQueries({ queryKey: workBgvKeys.cases });
    },
  });
  const onSave = () => {
    const err = doc.key === "aadhaar" ? aadhaarLast4Error(last4) : null;
    setLocal(err);
    if (!err) save.mutate();
  };
  const locked = doc.status === "accepted";
  return (
    <div className={styles.doc}>
      <Text weight="semibold">
        {doc.label} {doc.required ? "" : "(optional)"}
      </Text>
      <Caption1>
        {doc.status === "requested" ? "Needed" : doc.status === "returned" ? `Returned: ${doc.return_note ?? ""}` : doc.status}
        {doc.file_count ? ` · ${doc.file_count} file(s)` : ""}
      </Caption1>
      {!locked && (
        <>
          {doc.key === "aadhaar" && (
            <Field label="Last 4 digits of your Aadhaar" hint="Never enter the full number. Upload a copy with the first 8 digits covered." validationMessage={local ?? undefined}>
              <Input className={portal.input} inputMode="numeric" maxLength={4} value={last4} onChange={(_, d) => setLast4(d.value)} />
            </Field>
          )}
          {fields
            ? entries.map((e, i) => (
                <div key={i} className={styles.entry}>
                  {fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <Input className={portal.input} type={f.type ?? "text"} value={e[f.key] ?? ""} onChange={(_, d) => setEntries((all) => all.map((x, j) => (j === i ? { ...x, [f.key]: d.value } : x)))} />
                    </Field>
                  ))}
                </div>
              ))
            : (
              <Field label="Upload (PDF, JPG or PNG, up to 10 MB)">
                <input type="file" accept="image/*,.pdf" capture="environment" multiple onChange={(ev) => setFiles(Array.from(ev.target.files ?? []))} />
              </Field>
            )}
          <div className={portal.actions}>
            {fields && (
              <Button className={portal.button} onClick={() => setEntries((all) => [...all, {}])}>
                Add another
              </Button>
            )}
            <Button appearance="primary" className={portal.button} disabled={save.isPending || (!fields && files.length === 0 && doc.file_count === 0)} onClick={onSave}>
              Save
            </Button>
          </div>
          <InlineError message={save.isError ? errorMessage(save.error) : null} />
        </>
      )}
    </div>
  );
}

function DiscrepancyCard({ d }: { d: PortalDiscrepancy }) {
  const portal = usePortalStyles();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const respond = useMutation({
    mutationFn: () => workBgvApi.respond(d.id, text.trim(), files),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workBgvKeys.discrepancies }),
  });
  return (
    <Card className={portal.card}>
      <Text weight="semibold">A finding needs your response ({CHECK_TYPE_LABELS[d.check_type]})</Text>
      <Badge appearance="filled" color={SEVERITY_COLORS[d.severity]}>
        {d.severity}
      </Badge>
      <Body1>{d.description}</Body1>
      <Caption1>Respond by {formatDate(d.response_due_on)}</Caption1>
      <Field label="Your explanation" required>
        <Textarea value={text} onChange={(_, v) => setText(v.value)} />
      </Field>
      <Field label="Supporting documents">
        <input type="file" accept="image/*,.pdf" capture="environment" multiple onChange={(ev) => setFiles(Array.from(ev.target.files ?? []))} />
      </Field>
      <Button appearance="primary" className={portal.button} disabled={text.trim().length < 5 || respond.isPending} onClick={() => respond.mutate()}>
        Send response
      </Button>
      <InlineError message={respond.isError ? errorMessage(respond.error) : null} />
    </Card>
  );
}
