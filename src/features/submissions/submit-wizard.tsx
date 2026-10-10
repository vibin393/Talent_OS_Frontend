"use client";

import {
  Avatar,
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dropdown,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  mergeClasses,
  Option,
  OverlayDrawer,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Tag,
  TagGroup,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Checkmark16Regular, Dismiss24Regular, MailArrowUp20Regular } from "@fluentui/react-icons";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { CURRENCIES } from "@/features/settings/catalog";
import { pipelineApi, pipelineKeys } from "@/features/pipeline/api";
import { pipelineErrorMessage } from "@/features/pipeline/transitions";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useDemandSubmissions, useInvalidatePipeline, usePipelineSettings } from "@/features/pipeline/use-pipeline";
import { isApiError } from "@/lib/api/errors";
import type {
  ApplicationOut,
  DemandOut,
  SubmissionRateUnit,
  SubmissionsCreate,
  SubmissionsCreateOut,
} from "@/lib/api/types";
import { RateCheckBadge } from "@/features/commercials/rate-cards/rate-check-badge";
import { prefillFromPack, prefillNotice } from "@/features/agents/submission/logic";
import { submissionPacksApi } from "@/features/agents/submission/api";
import type { PackDetailOut } from "@/features/agents/submission/types";
import { MarginPreview } from "./margin-preview";
import { EmailPreview, ResumePreview } from "./preview-frames";
import {
  applyBlockedResult,
  ATTESTATION_MIN,
  type ConsentState,
  itemBlockers,
  PRIOR_REASON_MIN,
  rateErrors,
  remainingSubmissions,
  RESULT_LABELS,
  type WizardItem,
  wizardBlockers,
} from "./wizard-logic";

const useStyles = makeStyles({
  steps: {
    display: "flex",
    gap: tokens.spacingHorizontalXS,
    listStyle: "none",
    margin: 0,
    padding: 0,
    flexWrap: "wrap",
    marginBottom: tokens.spacingVerticalM,
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusCircular,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: "pointer",
    fontSize: tokens.fontSizeBase200,
  },
  stepCurrent: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandBackground}`,
  },
  stepNum: { fontWeight: tokens.fontWeightSemibold },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", alignItems: "flex-start" },
  amount: { flex: "1 1 140px", minWidth: "120px" },
  small: { width: "110px" },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", justifyContent: "space-between", width: "100%", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  results: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  result: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const STEPS = ["Resume", "Rates", "Checks", "Recipients", "Preview"] as const;
const UNITS: SubmissionRateUnit[] = ["hour", "day", "month", "year"];
const UNIT_LABELS: Record<SubmissionRateUnit, string> = { hour: "per hour", day: "per day", month: "per month", year: "per year" };

type Result = SubmissionsCreateOut["items"][number];

function initialItem(app: ApplicationOut, demand: DemandOut): WizardItem {
  const unit = (demand.rate_unit ?? "hour") as SubmissionRateUnit;
  return {
    applicationId: app.id,
    candidateId: app.candidate.id,
    candidateName: app.candidate.full_name || app.candidate.human_id || "Candidate",
    resumeKind: "client_formatted",
    payAmount: "",
    billAmount: demand.bill_rate != null ? String(demand.bill_rate) : "",
    currency: demand.currency ?? "INR",
    payUnit: unit,
    billUnit: unit,
    consent: "unknown",
    attest: false,
    attestText: "",
    consentRequested: false,
    priorWarning: null,
    priorReason: "",
    consentRequiredByServer: false,
  };
}

/** Epic 61 (additive): a Submission pack pre-fills the item of its application (resume kind, rates, units, currency). */
function withPack(item: WizardItem, pack: PackDetailOut | undefined): WizardItem {
  if (!pack || pack.application_id !== item.applicationId) return item;
  const p = prefillFromPack(pack);
  return {
    ...item,
    resumeKind: p.resumeKind,
    payAmount: p.payAmount ?? item.payAmount,
    billAmount: p.billAmount ?? item.billAmount,
    currency: p.currency ?? item.currency,
    payUnit: p.payUnit ?? item.payUnit,
    billUnit: p.billUnit ?? item.billUnit,
  };
}

/** Submit-to-client wizard: Resume → Rates (live margin) → Checks (consent, prior submission, limit) → Recipients → Preview. */
export function SubmitWizard({
  demand,
  apps,
  onClose,
  initialPack,
}: {
  demand: DemandOut;
  apps: ApplicationOut[];
  onClose: () => void;
  /** Epic 61: pre-fill from a Submission pack (all P1 checks still run on submit). */
  initialPack?: PackDetailOut;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const canViewComp = usePermission("compensation:view");
  const canReadConsent = usePermission("consent:read");
  const canWriteConsent = usePermission("consent:write");
  const canReadUsers = usePermission("user:read");
  const settings = usePipelineSettings();
  const submissions = useDemandSubmissions(demand.id);
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<WizardItem[]>(() => apps.map((a) => withPack(initialItem(a, demand), initialPack)));
  const [recipients, setRecipients] = useState<string[]>([]);
  const [cc, setCc] = useState<{ id: string; name: string }[]>([]);
  const [subject, setSubject] = useState(initialPack?.email_subject || `Candidate submission for ${demand.title}`);
  const [note, setNote] = useState(initialPack?.summary_text ?? "");
  const packId = initialPack?.id;
  useEffect(() => {
    if (packId) void submissionPacksApi.opened(packId).catch(() => undefined);
  }, [packId]);
  const [previewFor, setPreviewFor] = useState(apps[0]?.id ?? "");
  const [results, setResults] = useState<Result[] | null>(null);
  const [attestationOverride, setAttestationOverride] = useState<boolean | null>(null);
  const attestationAllowed = attestationOverride ?? (settings.data ? settings.data.submission_consent_mode === "attestation_allowed" : true);

  // Consent per candidate (client_submission for this client).
  const consents = useQueries({
    queries: items.map((i) => ({
      queryKey: pipelineKeys.consents(i.candidateId),
      queryFn: ({ signal }: { signal: AbortSignal }) => pipelineApi.consents(i.candidateId, signal),
      enabled: canReadConsent,
      staleTime: 30_000,
    })),
  });
  const consentState = (index: number): ConsentState => {
    const q = consents[index];
    if (!canReadConsent || !q?.data) return "unknown";
    return q.data.some((c) => c.purpose === "client_submission" && c.client_id === demand.client_id && c.status === "granted")
      ? "granted"
      : "missing";
  };
  const effective = items.map((i, idx) => ({ ...i, consent: consentState(idx) }));

  const contacts = useQuery({
    queryKey: [...clientKeys.contacts(demand.client_id), "submission-recipients"],
    queryFn: ({ signal }) => clientsApi.listContacts(demand.client_id, false, 1, 100, signal),
  });
  const contactOptions = (contacts.data?.items ?? []).filter((c) => !c.archived_at && c.email);

  const used = (submissions.data ?? []).filter((s) => ["sent", "pending_approval", "approved"].includes(s.status)).length;
  const remaining = remainingSubmissions(demand.submission_limit, used);
  const blockers = wizardBlockers(effective, { attestationAllowed, recipientCount: recipients.length, remaining });

  const update = (id: string, patch: Partial<WizardItem>) =>
    setItems((prev) => prev.map((i) => (i.applicationId === id ? { ...i, ...patch } : i)));

  const requestConsent = useMutation({
    mutationFn: (item: WizardItem) =>
      pipelineApi.requestConsent(item.candidateId, { purpose: "client_submission", client_id: demand.client_id }),
    onSuccess: (r, item) => {
      const outcome = r.items[0]?.status ?? "sent";
      update(item.applicationId, { consentRequested: true });
      toast.success(outcome === "sent" ? `Consent request emailed to ${item.candidateName}.` : `Consent request: ${String(outcome).replace(/_/g, " ")}.`);
    },
    onError: (e) => toast.error(pipelineError(e)),
  });

  const submit = useMutation({
    mutationFn: async (): Promise<SubmissionsCreateOut> => {
      const body: SubmissionsCreate = {
        application_ids: effective.map((i) => i.applicationId),
        per_application: Object.fromEntries(
          effective.map((i) => [
            i.applicationId,
            {
              pay_rate: { amount: i.payAmount.trim(), currency: i.currency },
              bill_rate: { amount: i.billAmount.trim(), currency: i.currency },
              pay_rate_unit: i.payUnit,
              bill_rate_unit: i.billUnit,
              resume_kind: i.resumeKind,
              prior_submission_reason: i.priorWarning ? i.priorReason.trim() || null : null,
              consent_attestation:
                attestationAllowed && i.attest && i.attestText.trim().length >= ATTESTATION_MIN
                  ? { text: i.attestText.trim(), confirmed: true }
                  : null,
            },
          ]),
        ),
        note: note.trim() || null,
        recipient_contact_ids: recipients,
        cc_user_ids: cc.map((u) => u.id),
        subject: subject.trim() || null,
      };
      try {
        return await pipelineApi.createSubmissions(demand.id, body);
      } catch (e) {
        // A single application raises its error instead of a per-item result: fold it into one.
        if (isApiError(e) && effective.length === 1 && (e.status === 409 || e.status === 422) && e.code !== "invalid_recipients") {
          return {
            items: [
              {
                application_id: effective[0].applicationId,
                status: "blocked",
                error: { code: e.code, message: e.message, details: e.details, status: e.status },
              },
            ],
            counts: { blocked: 1 },
          };
        }
        throw e;
      }
    },
    onSuccess: (out) => {
      setResults(out.items);
      const byApp = new Map(out.items.map((r) => [r.application_id, r]));
      setItems((prev) =>
        prev.map((i) => {
          const r = byApp.get(i.applicationId);
          const err = r?.error as { code?: string; details?: Record<string, unknown> } | null | undefined;
          if (err?.code === "submission_consent_required" && err.details?.attestation_allowed === false) setAttestationOverride(false);
          return r?.status === "blocked" ? applyBlockedResult(i, err) : i;
        }),
      );
      const sent = out.counts.sent ?? 0;
      const pending = out.counts.pending_approval ?? 0;
      if (sent || pending) toast.success(`${sent} sent${pending ? `, ${pending} pending margin approval` : ""}.`);
    },
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: () => invalidate(demand.id),
  });

  const blockedIds = new Set((results ?? []).filter((r) => r.status === "blocked").map((r) => r.application_id));
  const retryBlocked = () => {
    setItems((prev) => prev.filter((i) => blockedIds.has(i.applicationId)));
    setResults(null);
    setStep(2);
  };

  const stepValid = (s: number): boolean => {
    if (s === 1) return effective.every((i) => { const e = rateErrors(i); return !e.pay && !e.bill && !e.currency; });
    if (s === 2) return effective.every((i) => itemBlockers(i, attestationAllowed).length === 0);
    if (s === 3) return recipients.length > 0;
    return true;
  };

  const nameOf = (id: string) => effective.find((i) => i.applicationId === id)?.candidateName ?? apps.find((a) => a.id === id)?.candidate.full_name ?? "Candidate";

  return (
    <OverlayDrawer position="end" size="large" open onOpenChange={(_, d) => !d.open && !submit.isPending && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} disabled={submit.isPending} />}>
          Submit to {demand.client_name ?? "client"}
        </DrawerHeaderTitle>
        <Caption1 className={styles.muted}>
          {demand.title} · {effective.length} candidate{effective.length === 1 ? "" : "s"}
        </Caption1>
      </DrawerHeader>
      <DrawerBody>
        {initialPack && !results && (
          <MessageBar intent="info" layout="multiline">
            <MessageBarBody>{prefillNotice(initialPack.human_id)}</MessageBarBody>
          </MessageBar>
        )}
        {results ? (
          <ResultsView results={results} nameOf={nameOf} />
        ) : (
          <>
            <nav aria-label="Submission steps">
              <ol className={styles.steps}>
                {STEPS.map((label, i) => (
                  <li key={label}>
                    <button
                      type="button"
                      className={mergeClasses(styles.step, i === step && styles.stepCurrent)}
                      aria-current={i === step ? "step" : undefined}
                      disabled={i > step && !Array.from({ length: i }, (_, k) => stepValid(k)).every(Boolean)}
                      onClick={() => setStep(i)}
                    >
                      <span className={styles.stepNum}>{i < step ? <Checkmark16Regular aria-label="done" /> : i + 1}</span> {label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className={styles.body} role="group" aria-label={STEPS[step]}>
              {step === 0 &&
                effective.map((i) => (
                  <Card key={i.applicationId} className={styles.card}>
                    <CardHeader image={<Avatar name={i.candidateName} size={32} color="colorful" aria-hidden />} header={<Subtitle2 as="h3">{i.candidateName}</Subtitle2>} />
                    <Field label="Resume to send">
                      <RadioGroup layout="horizontal" value={i.resumeKind} onChange={(_, d) => update(i.applicationId, { resumeKind: d.value as WizardItem["resumeKind"] })}>
                        <Radio value="client_formatted" label="Client-formatted PDF (no contact details)" />
                        <Radio value="original" label="Original resume" />
                      </RadioGroup>
                    </Field>
                    <ResumePreview applicationId={i.applicationId} resumeKind={i.resumeKind} name={i.candidateName} />
                  </Card>
                ))}

              {step === 1 &&
                effective.map((i) => {
                  const errs = rateErrors(i);
                  return (
                    <Card key={i.applicationId} className={styles.card}>
                      <CardHeader header={<Subtitle2 as="h3">{i.candidateName}</Subtitle2>} />
                      <div className={styles.row}>
                        <Field label="Pay rate" required className={styles.amount} validationState={errs.pay && i.payAmount ? "error" : "none"} validationMessage={i.payAmount ? errs.pay : undefined}>
                          <Input inputMode="decimal" value={i.payAmount} onChange={(_, d) => update(i.applicationId, { payAmount: d.value })} />
                        </Field>
                        <Field label="Pay unit" className={styles.small}>
                          <UnitDropdown value={i.payUnit} onChange={(u) => update(i.applicationId, { payUnit: u })} />
                        </Field>
                        <Field label="Bill rate" required className={styles.amount} validationState={errs.bill && i.billAmount ? "error" : "none"} validationMessage={i.billAmount ? errs.bill : undefined}>
                          <Input inputMode="decimal" value={i.billAmount} onChange={(_, d) => update(i.applicationId, { billAmount: d.value })} />
                        </Field>
                        <Field label="Bill unit" className={styles.small}>
                          <UnitDropdown value={i.billUnit} onChange={(u) => update(i.applicationId, { billUnit: u })} />
                        </Field>
                        <Field label="Currency" className={styles.small} hint={demand.currency ? `Demand: ${demand.currency}` : undefined}>
                          <Dropdown value={i.currency} selectedOptions={[i.currency]} onOptionSelect={(_, d) => update(i.applicationId, { currency: d.optionValue ?? i.currency })}>
                            {CURRENCIES.map((c) => (
                              <Option key={c} value={c}>
                                {c}
                              </Option>
                            ))}
                          </Dropdown>
                        </Field>
                      </div>
                      {canViewComp ? (
                        <>
                          <MarginPreview demandId={demand.id} item={i} />
                          {/* Epic 16: the submission bill rate is checked against the client's rate card. */}
                          <RateCheckBadge
                            input={{
                              subject_kind: "submission",
                              subject_id: i.applicationId,
                              client_id: demand.client_id,
                              role: demand.title,
                              location: demand.location ?? null,
                              bill_rate: i.billAmount.trim() || null,
                              currency: i.currency,
                              rate_unit: i.billUnit,
                            }}
                          />
                        </>
                      ) : (
                        <Caption1 className={styles.muted}>Margin is hidden for your role. Submissions below the minimum margin wait for approval.</Caption1>
                      )}
                    </Card>
                  );
                })}

              {step === 2 && (
                <>
                  {remaining !== null && (
                    <MessageBar intent={remaining < effective.length ? "error" : "info"}>
                      <MessageBarBody>
                        Submission limit: {used} of {demand.submission_limit} used, {remaining} remaining.
                      </MessageBarBody>
                    </MessageBar>
                  )}
                  {effective.map((i) => (
                    <ChecksCard
                      key={i.applicationId}
                      item={i}
                      clientName={demand.client_name ?? "the client"}
                      attestationAllowed={attestationAllowed}
                      canRequest={canWriteConsent}
                      requesting={requestConsent.isPending && requestConsent.variables?.applicationId === i.applicationId}
                      onRequest={() => requestConsent.mutate(i)}
                      onChange={(patch) => update(i.applicationId, patch)}
                    />
                  ))}
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Client contacts" required hint="Each contact gets their own email with Interested / Not a fit / On hold buttons." validationState={recipients.length ? "none" : "warning"}>
                    <ContactsPicker
                      options={contactOptions.map((c) => ({ id: c.id, name: c.name, email: c.email ?? "", title: c.title ?? "" }))}
                      selected={recipients}
                      onChange={setRecipients}
                      loading={contacts.isPending}
                    />
                  </Field>
                  {canReadUsers && (
                    <>
                      <UserPicker
                        label="CC colleagues"
                        value={null}
                        excludeIds={cc.map((u) => u.id)}
                        onChange={(id, user) => id && user && setCc((prev) => (prev.some((u) => u.id === id) ? prev : [...prev, { id, name: user.name || user.email }]))}
                      />
                      {cc.length > 0 && (
                        <TagGroup aria-label="CC" onDismiss={(_, d) => setCc((prev) => prev.filter((u) => u.id !== d.value))}>
                          {cc.map((u) => (
                            <Tag key={u.id} value={u.id} dismissible dismissIcon={{ "aria-label": `Remove ${u.name}` }}>
                              {u.name}
                            </Tag>
                          ))}
                        </TagGroup>
                      )}
                    </>
                  )}
                  <Field label="Subject">
                    <Input value={subject} maxLength={300} onChange={(_, d) => setSubject(d.value)} />
                  </Field>
                  <Field label="Note to the client" hint="Pay rate and margin are never included in the email.">
                    <Textarea value={note} maxLength={5000} resize="vertical" rows={5} onChange={(_, d) => setNote(d.value)} />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  {effective.length > 1 && (
                    <Field label="Preview the email for">
                      <Dropdown value={nameOf(previewFor)} selectedOptions={[previewFor]} onOptionSelect={(_, d) => setPreviewFor(d.optionValue ?? previewFor)}>
                        {effective.map((i) => (
                          <Option key={i.applicationId} value={i.applicationId}>
                            {i.candidateName}
                          </Option>
                        ))}
                      </Dropdown>
                    </Field>
                  )}
                  {(() => {
                    const i = effective.find((x) => x.applicationId === previewFor) ?? effective[0];
                    if (!i) return null;
                    return (
                      <EmailPreview
                        name={i.candidateName}
                        body={{
                          application_id: i.applicationId,
                          resume_kind: i.resumeKind,
                          bill_rate: rateErrors(i).bill ? null : { amount: i.billAmount.trim(), currency: i.currency },
                          note: note.trim() || null,
                          recipient_contact_ids: recipients,
                          subject: subject.trim() || null,
                        }}
                      />
                    );
                  })()}
                  {blockers.length > 0 ? (
                    <MessageBar intent="error" layout="multiline" role="alert">
                      <MessageBarBody>
                        <MessageBarTitle>Fix these before submitting</MessageBarTitle>
                        <ul>
                          {blockers.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </MessageBarBody>
                    </MessageBar>
                  ) : (
                    <Body1>Submitting emails each contact now, unless a margin approval is required.</Body1>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </DrawerBody>
      <DrawerFooter>
        {results ? (
          <div className={styles.footer}>
            {blockedIds.size > 0 ? <Button onClick={retryBlocked}>Fix and retry blocked ({blockedIds.size})</Button> : <span />}
            <Button appearance="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className={styles.footer}>
            <Button disabled={step === 0 || submit.isPending} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button appearance="primary" disabled={!stepValid(step)} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button
                appearance="primary"
                icon={submit.isPending ? <Spinner size="tiny" /> : <MailArrowUp20Regular />}
                disabled={blockers.length > 0 || submit.isPending}
                onClick={() => submit.mutate()}
              >
                Submit {effective.length > 1 ? `${effective.length} candidates` : ""}
              </Button>
            )}
          </div>
        )}
      </DrawerFooter>
    </OverlayDrawer>
  );
}

function UnitDropdown({ value, onChange }: { value: SubmissionRateUnit; onChange: (u: SubmissionRateUnit) => void }) {
  return (
    <Dropdown value={UNIT_LABELS[value]} selectedOptions={[value]} onOptionSelect={(_, d) => onChange((d.optionValue as SubmissionRateUnit) ?? value)}>
      {UNITS.map((u) => (
        <Option key={u} value={u}>
          {UNIT_LABELS[u]}
        </Option>
      ))}
    </Dropdown>
  );
}

function ChecksCard({
  item,
  clientName,
  attestationAllowed,
  canRequest,
  requesting,
  onRequest,
  onChange,
}: {
  item: WizardItem;
  clientName: string;
  attestationAllowed: boolean;
  canRequest: boolean;
  requesting: boolean;
  onRequest: () => void;
  onChange: (patch: Partial<WizardItem>) => void;
}) {
  const styles = useStyles();
  const needsConsent = item.consent === "missing" || item.consentRequiredByServer;
  const blockers = itemBlockers(item, attestationAllowed);
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h3">{item.candidateName}</Subtitle2>}
        action={
          blockers.length === 0 ? (
            <Badge appearance="tint" color="success">
              Ready
            </Badge>
          ) : (
            <Badge appearance="tint" color="danger">
              {blockers.length} to fix
            </Badge>
          )
        }
      />
      <Text weight="semibold">Consent to share with {clientName}</Text>
      {item.consent === "granted" && !item.consentRequiredByServer ? (
        <Body1>The candidate has consented.</Body1>
      ) : item.consent === "unknown" && !item.consentRequiredByServer ? (
        <Caption1 className={styles.muted}>Consent is checked when you submit.</Caption1>
      ) : null}
      {needsConsent && (
        <>
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              {item.consentRequested
                ? "A consent request was sent. You can submit once the candidate agrees."
                : `The candidate has not consented to be submitted to ${clientName}.`}
            </MessageBarBody>
          </MessageBar>
          <div className={styles.row}>
            {canRequest && (
              <Button icon={requesting ? <Spinner size="tiny" /> : <MailArrowUp20Regular />} disabled={requesting} onClick={onRequest}>
                {item.consentRequested ? "Resend consent request" : "Send consent request"}
              </Button>
            )}
          </div>
          {attestationAllowed && (
            <>
              <Checkbox
                checked={item.attest}
                onChange={(_, d) => onChange({ attest: !!d.checked })}
                label="I confirm the candidate agreed to this submission"
              />
              {item.attest && (
                <Field
                  label="How did the candidate agree?"
                  required
                  validationState={item.attestText.trim().length >= ATTESTATION_MIN ? "none" : "error"}
                  validationMessage={item.attestText.trim().length >= ATTESTATION_MIN ? undefined : `At least ${ATTESTATION_MIN} characters`}
                >
                  <Textarea value={item.attestText} maxLength={2000} onChange={(_, d) => onChange({ attestText: d.value })} placeholder="e.g. Confirmed by phone on 30 Sep, 11:00" />
                </Field>
              )}
            </>
          )}
        </>
      )}
      {item.priorWarning && (
        <>
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              Already submitted to this client
              {item.priorWarning.lastSubmittedAt ? ` on ${new Date(item.priorWarning.lastSubmittedAt).toLocaleDateString()}` : " recently"}. Give a reason to submit again.
            </MessageBarBody>
          </MessageBar>
          <Field
            label="Reason for resubmitting"
            required
            validationState={item.priorReason.trim().length >= PRIOR_REASON_MIN ? "none" : "error"}
            validationMessage={item.priorReason.trim().length >= PRIOR_REASON_MIN ? undefined : `At least ${PRIOR_REASON_MIN} characters`}
          >
            <Textarea value={item.priorReason} maxLength={2000} onChange={(_, d) => onChange({ priorReason: d.value })} />
          </Field>
        </>
      )}
    </Card>
  );
}

function ContactsPicker({
  options,
  selected,
  onChange,
  loading,
}: {
  options: { id: string; name: string; email: string; title: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const visible = options.filter(
    (o) => !selected.includes(o.id) && `${o.name} ${o.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const hint = loading
    ? "Loading contacts…"
    : options.length === 0
      ? "This client has no active contacts with an email address."
      : visible.length === 0 && query.trim()
        ? "No matching contacts."
        : null;
  return (
    <>
    <TagPicker
      selectedOptions={selected}
      onOptionSelect={(_, d) => {
        onChange(d.selectedOptions);
        setQuery("");
      }}
    >
      <TagPickerControl>
        <TagPickerGroup aria-label="Selected contacts">
          {selected.map((id) => (
            <Tag key={id} shape="rounded" value={id} media={<Avatar name={byId.get(id)?.name} size={16} aria-hidden />}>
              {byId.get(id)?.name ?? id}
            </Tag>
          ))}
        </TagPickerGroup>
        <TagPickerInput aria-label="Add client contacts" placeholder={selected.length ? "" : "Choose contacts"} value={query} onChange={(e) => setQuery(e.target.value)} />
      </TagPickerControl>
      <TagPickerList>
        {visible.map((o) => (
          <TagPickerOption key={o.id} value={o.id} text={o.name} secondaryContent={[o.title, o.email].filter(Boolean).join(" · ")} media={<Avatar name={o.name} size={24} aria-hidden color="colorful" />}>
            {o.name}
          </TagPickerOption>
        ))}
      </TagPickerList>
    </TagPicker>
    {hint && <Caption1 aria-live="polite">{hint}</Caption1>}
    </>
  );
}

function ResultsView({ results, nameOf }: { results: Result[]; nameOf: (id: string) => string }) {
  const styles = useStyles();
  return (
    <div className={styles.body}>
      <Subtitle2 as="h3" tabIndex={-1}>
        Submission results
      </Subtitle2>
      <ul className={styles.results} aria-live="polite">
        {results.map((r) => {
          const err = r.error as { code?: string; message?: string } | null | undefined;
          return (
            <li key={r.application_id}>
              <MessageBar intent={r.status === "sent" ? "success" : r.status === "pending_approval" ? "warning" : "error"} layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>
                    {nameOf(r.application_id)}: {RESULT_LABELS[r.status] ?? r.status}
                  </MessageBarTitle>
                  {r.status === "pending_approval" && "The margin is below the minimum. The email is sent after approval — then press Send on the submission."}
                  {r.status === "blocked" && pipelineErrorMessage(err?.code, err?.message ?? "Blocked.")}
                </MessageBarBody>
              </MessageBar>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
