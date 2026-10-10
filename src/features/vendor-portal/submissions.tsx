"use client";

import { Button, Card, CardHeader, MessageBar, MessageBarBody, Subtitle2, Text } from "@fluentui/react-components";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { formatDate, formatDateTime, formatDecimalMoney } from "@/features/vendors/format";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { vendorPortalApi } from "./client";
import { FilePickButton, LabelBadge, Loading, PortalError, PortalPage, usePortalStyles } from "./portal-ui";
import { submitErrorCopy } from "./submit-logic";
import { useVendorPortalMutations, useVendorSubmission, useVendorSubmissions } from "./use-vendor-portal";

/** `/vendor/submissions`: the vendor's submissions with their vendor-facing label. */
export function VendorSubmissionsView({ releaseId }: { releaseId?: string | null }) {
  const styles = usePortalStyles();
  const q = useVendorSubmissions(releaseId);
  return (
    <PortalPage title="Submissions">
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <PortalError error={q.error} />
      ) : !q.data?.length ? (
        <Text>No submissions yet.</Text>
      ) : (
        <div className={styles.cards}>
          {q.data.map((s) => (
            <Card key={s.id} className={styles.card}>
              <CardHeader
                header={
                  <AppLink href={`/vendor/submissions/${s.id}`}>
                    <Subtitle2>{s.full_name ?? s.human_id}</Subtitle2>
                  </AppLink>
                }
                description={<Text size={200}>{`${s.release_title ?? ""} · ${formatDate(s.created_at)}`}</Text>}
                action={<LabelBadge label={s.label} />}
              />
              {s.next_interview_at && <Text size={200}>Interview {formatDateTime(s.next_interview_at)}</Text>}
            </Card>
          ))}
        </div>
      )}
    </PortalPage>
  );
}

/** `/vendor/submissions/[id]`: status + label, timeline, next interview, outcome category (never reason text). */
export function VendorSubmissionDetail({ id }: { id: string }) {
  const styles = usePortalStyles();
  const q = useVendorSubmission(id);
  const { withdraw, reviseResume } = useVendorPortalMutations();
  const [error, setError] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <PortalError error={q.error} />;
  const s = q.data;
  const fail = (e: unknown) => setError(submitErrorCopy(isApiError(e) ? e.code : undefined, errorMessage(e)));
  return (
    <PortalPage title={s.full_name ?? s.human_id}>
      <div className={styles.row}>
        <LabelBadge label={s.label} />
        {s.outcome_category && <Text>{s.outcome_category}</Text>}
      </div>
      <div aria-live="assertive">
        {error && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <dl className={styles.dl}>
        <dt>Requirement</dt>
        <dd>{s.release_title ?? "—"}</dd>
        <dt>Email</dt>
        <dd>{s.email ?? "—"}</dd>
        <dt>Your rate</dt>
        <dd>
          {formatDecimalMoney(s.vendor_rate, s.currency)} / {s.rate_unit ?? "—"}
        </dd>
        <dt>Next interview</dt>
        <dd>{formatDateTime(s.next_interview_at)}</dd>
        <dt>Resume</dt>
        <dd>{s.resume_file_id ? <a href={vendorPortalApi.fileUrl(s.resume_file_id)}>Download</a> : "—"}</dd>
      </dl>
      <Subtitle2 as="h2">Timeline</Subtitle2>
      <ol className={styles.timeline}>
        {s.timeline.map((t, i) => (
          <li key={i}>
            <LabelBadge label={t.label} /> <Text size={200}>{formatDateTime(t.at)}</Text>
          </li>
        ))}
      </ol>
      <div className={styles.row}>
        {s.status === "submitted" && (
          <Button className={styles.target} onClick={() => withdraw.mutateAsync(s.id).catch(fail)} disabled={withdraw.isPending}>
            Withdraw
          </Button>
        )}
        {!s.resume_locked && (
          <FilePickButton
            label="Upload revised resume"
            accept=".pdf,.docx"
            className={styles.target}
            onFile={(f) => {
              if (!f) return;
              const form = new FormData();
              form.set("resume", f);
              reviseResume.mutateAsync({ id: s.id, form }).catch(fail);
            }}
          />
        )}
      </div>
    </PortalPage>
  );
}
