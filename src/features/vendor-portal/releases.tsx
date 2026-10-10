"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Text,
} from "@fluentui/react-components";
import { ArrowUpload20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { formatDate, formatDateTime, formatDecimalMoney } from "@/features/vendors/format";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { FilePickButton, Loading, PortalError, PortalPage, usePortalStyles } from "./portal-ui";
import {
  ATTESTATION_TEXT,
  EMPTY_SUBMIT,
  type SubmitValues,
  submitErrorCopy,
  toFormData,
  validateSubmission,
} from "./submit-logic";
import type { PortalReleaseOut } from "./types";
import { useVendorPortalMutations, useVendorRelease, useVendorReleases } from "./use-vendor-portal";

/** `/vendor/releases`: the vendor's releases (snapshot of the requirement; client confidential unless revealed). */
export function VendorReleasesView() {
  const styles = usePortalStyles();
  const q = useVendorReleases();
  return (
    <PortalPage title="Releases">
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <PortalError error={q.error} />
      ) : !q.data?.length ? (
        <Text>No requirements have been released to you yet.</Text>
      ) : (
        <div className={styles.cards}>
          {q.data.map((r) => (
            <Card key={r.id} className={styles.card}>
              <CardHeader
                header={
                  <AppLink href={`/vendor/releases/${r.id}`}>
                    <Subtitle2>{r.title}</Subtitle2>
                  </AppLink>
                }
                description={<Text size={200}>{`${r.client_name} · ${r.location ?? "Location open"}`}</Text>}
                action={<Badge appearance="tint">{r.status}</Badge>}
              />
              <Text size={200}>
                {r.max_vendor_rate ? `Up to ${formatDecimalMoney(r.max_vendor_rate, r.currency)} / ${r.rate_unit ?? ""}` : "Rate open"}
                {r.remaining_slots !== null && ` · ${r.remaining_slots} slot(s) left`}
                {r.deadline_at && ` · due ${formatDateTime(r.deadline_at)}`}
              </Text>
            </Card>
          ))}
        </div>
      )}
    </PortalPage>
  );
}

/** `/vendor/releases/[id]`: JD snapshot, limits, remaining slots and "Submit candidate". */
export function VendorReleaseDetail({ id }: { id: string }) {
  const styles = usePortalStyles();
  const q = useVendorRelease(id);
  const [submitting, setSubmitting] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <PortalError error={q.error} />;
  const r = q.data;
  const canSubmit = r.status === "active" && (r.remaining_slots === null || r.remaining_slots > 0);
  return (
    <PortalPage title={r.title}>
      <dl className={styles.dl}>
        <dt>Client</dt>
        <dd>{r.client_name}</dd>
        <dt>Positions</dt>
        <dd>{r.positions}</dd>
        <dt>Location</dt>
        <dd>{r.location ?? "—"}</dd>
        <dt>Experience</dt>
        <dd>{r.experience_range ?? "—"}</dd>
        <dt>Skills</dt>
        <dd>{r.skills.join(", ") || "—"}</dd>
        <dt>Maximum rate</dt>
        <dd>{r.max_vendor_rate ? `${formatDecimalMoney(r.max_vendor_rate, r.currency)} / ${r.rate_unit ?? ""}` : "—"}</dd>
        <dt>Submissions</dt>
        <dd>
          {r.submissions_used}
          {r.submission_limit !== null && ` of ${r.submission_limit} (${r.remaining_slots} left)`}
        </dd>
        <dt>Deadline</dt>
        <dd>{formatDateTime(r.deadline_at)}</dd>
      </dl>
      {r.instructions && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>{r.instructions}</MessageBarBody>
        </MessageBar>
      )}
      {r.jd_public_text && <Text style={{ whiteSpace: "pre-wrap" }}>{r.jd_public_text}</Text>}
      {!submitting ? (
        <div className={styles.row}>
          <Button appearance="primary" className={styles.target} disabled={!canSubmit} onClick={() => setSubmitting(true)}>
            Submit candidate
          </Button>
          <AppLink href={`/vendor/submissions?release=${r.id}`}>My submissions for this release</AppLink>
        </div>
      ) : (
        <SubmitForm release={r} onCancel={() => setSubmitting(false)} />
      )}
      <Text size={200} className={styles.muted}>
        Released {formatDate(r.released_at)}
      </Text>
    </PortalPage>
  );
}

/** Candidate submission form (resume drag / drop or button, fields, rate with the maximum, attestation). */
export function SubmitForm({ release, onCancel }: { release: PortalReleaseOut; onCancel: () => void }) {
  const styles = usePortalStyles();
  const router = useRouter();
  const { submit } = useVendorPortalMutations();
  const [v, setV] = useState<SubmitValues>(EMPTY_SUBMIT);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const errors = validateSubmission(v, release.max_vendor_rate);
  const shown = touched ? errors : {};
  const set = <K extends keyof SubmitValues>(k: K, value: SubmitValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const send = async () => {
    setTouched(true);
    setServerError(null);
    if (Object.keys(errors).length) return;
    try {
      const out = await submit.mutateAsync({ releaseId: release.id, form: toFormData(v, release.rate_unit, release.currency) });
      router.push(`/vendor/submissions/${out.id}`);
    } catch (e) {
      setServerError(submitErrorCopy(isApiError(e) ? e.code : undefined, errorMessage(e)));
    }
  };

  return (
    <form
      className={styles.form}
      aria-label="Submit candidate"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div aria-live="assertive">
        {serverError && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{serverError}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <Field label="Resume (PDF or Word)" validationMessage={shown.resume}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) set("resume", f);
          }}
          style={{ border: `1px dashed ${dragging ? "currentColor" : "#8a8886"}`, padding: 16, borderRadius: 4 }}
        >
          <Text>{v.resume ? v.resume.name : "Drag the resume here, or"} </Text>
          <FilePickButton
            label="Choose file"
            accept=".pdf,.docx"
            icon={<ArrowUpload20Regular />}
            className={styles.target}
            onFile={(f) => set("resume", f)}
          />
        </div>
      </Field>
      <Field label="Full name" required validationMessage={shown.fullName}>
        <Input value={v.fullName} onChange={(_, d) => set("fullName", d.value)} maxLength={200} />
      </Field>
      <Field label="Email" required validationMessage={shown.email}>
        <Input type="email" value={v.email} onChange={(_, d) => set("email", d.value)} />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={v.phone} onChange={(_, d) => set("phone", d.value)} />
      </Field>
      <Field label="Current location">
        <Input value={v.location} onChange={(_, d) => set("location", d.value)} />
      </Field>
      <Field label="Total experience (years)" validationMessage={shown.experienceYears}>
        <Input inputMode="decimal" value={v.experienceYears} onChange={(_, d) => set("experienceYears", d.value)} />
      </Field>
      <Field label="Notice period (days)" validationMessage={shown.noticeDays}>
        <Input inputMode="numeric" value={v.noticeDays} onChange={(_, d) => set("noticeDays", d.value)} />
      </Field>
      <Field label="Available from">
        <Input type="date" value={v.availability} onChange={(_, d) => set("availability", d.value)} />
      </Field>
      <Field
        label={`Your rate (${release.currency} / ${release.rate_unit ?? "unit"})`}
        required
        hint={release.max_vendor_rate ? `Maximum ${formatDecimalMoney(release.max_vendor_rate, release.currency)}` : undefined}
        validationMessage={shown.vendorRate}
      >
        <Input inputMode="decimal" value={v.vendorRate} onChange={(_, d) => set("vendorRate", d.value)} />
      </Field>
      <Field validationMessage={shown.attestation}>
        <Checkbox checked={v.attestation} onChange={(_, d) => set("attestation", !!d.checked)} label={ATTESTATION_TEXT} />
      </Field>
      <div className={styles.row}>
        <Button type="submit" appearance="primary" className={styles.target} disabled={submit.isPending}>
          Submit
        </Button>
        <Button className={styles.target} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
