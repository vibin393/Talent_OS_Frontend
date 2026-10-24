"use client";

import { Badge, Body1, Button, Caption1, Card, Checkbox, makeStyles, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useId, useState } from "react";
import { FileDrop } from "@/features/candidates/file-drop";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { workImmigrationApi } from "./api";
import { countryName, fileError, formatDate, PORTAL_REQUEST_LABELS, portalUploadGate, UPLOAD_ACCEPT } from "./logic";
import type { PortalCasesOut, PortalNoticeOut, PortalRequestOut } from "./types";
import { useWorkImmigration, useWorkImmigrationCase, workImmigrationKeys } from "./use-immigration";

const useStyles = makeStyles({
  notice: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  noticeBody: { maxHeight: "320px", overflowY: "auto" },
  request: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  checkbox: { minHeight: "44px", alignItems: "center" },
});

const STATUS_COLORS: Record<string, "brand" | "success" | "danger" | "informative" | "subtle"> = {
  open: "informative",
  in_stage: "brand",
  approved: "success",
  refused: "danger",
  withdrawn: "subtle",
};

const REQUEST_COLORS: Record<string, "brand" | "success" | "danger" | "informative" | "subtle"> = {
  requested: "informative",
  uploaded: "brand",
  verified: "success",
  rejected: "danger",
  waived: "subtle",
};

/** `/portal/work/immigration`: the Worker's own immigration cases in plain language. Mobile-first from 360 px. */
export function WorkImmigrationList() {
  const portal = usePortalStyles();
  const q = useWorkImmigration();
  if (q.isPending) return <LoadingBlock label="Loading your immigration cases" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Immigration" subtitle="Your visa and work-permit applications and the documents we need from you." />
      {q.data.cases.length === 0 ? (
        <Card className={portal.card}>
          <Body1 className={portal.empty}>You have no immigration cases.</Body1>
        </Card>
      ) : (
        <Card className={portal.card}>
          <ul className={portal.list}>
            {q.data.cases.map((c) => (
              <li key={c.id} className={portal.row}>
                <div className={portal.rowMain}>
                  <NextLink className={portal.rowTitle} href={`/portal/work/immigration/${c.id}`}>
                    {c.visa_type_name} · {countryName(c.country)}
                  </NextLink>
                  <Caption1 className={portal.muted}>
                    Reference {c.reference}
                    {c.stage_label ? ` · ${c.stage_label}` : ""} · updated {formatDate(c.updated_at)}
                  </Caption1>
                </div>
                <div className={portal.actions}>
                  <Badge appearance="tint" color={STATUS_COLORS[c.status] ?? "informative"}>
                    {c.status_label}
                  </Badge>
                  {c.open_requests > 0 && (
                    <Badge appearance="filled" color="warning">
                      {c.open_requests} document{c.open_requests === 1 ? "" : "s"} needed
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** `/portal/work/immigration/[id]`: status, requested documents with upload; notice + consent before the first upload. */
export function WorkImmigrationCase({ id }: { id: string }) {
  const portal = usePortalStyles();
  const list = useWorkImmigration();
  const q = useWorkImmigrationCase(id);
  if (q.isPending || list.isPending) return <LoadingBlock label="Loading your case" />;
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404) {
      return (
        <div className={portal.page}>
          <PortalPageHeader title="Case not found" />
          <Card className={portal.card}>
            <Body1>This case does not exist or is not yours.</Body1>
            <NextLink href="/portal/work/immigration">Back to your immigration cases</NextLink>
          </Card>
        </div>
      );
    }
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  }
  if (list.isError) return <ErrorBlock error={list.error} onRetry={() => list.refetch()} />;
  const c = q.data;
  const consentGiven = list.data.consent_given;
  const needsConsent = !consentGiven && c.requests.some((r) => portalUploadGate(false, r) === "consent");
  return (
    <div className={portal.page}>
      <NextLink href="/portal/work/immigration">Back to your immigration cases</NextLink>
      <PortalPageHeader title={`${c.visa_type_name} · ${countryName(c.country)}`} subtitle={`Reference ${c.reference}`} />
      <Card className={portal.card}>
        <dl className={portal.dl}>
          <dt>Status</dt>
          <dd>
            <Badge appearance="tint" color={STATUS_COLORS[c.status] ?? "informative"}>
              {c.status_label}
            </Badge>
          </dd>
          <dt>Current step</dt>
          <dd>{c.stage_label ?? "—"}</dd>
          <dt>Last updated</dt>
          <dd>{formatDate(c.updated_at)}</dd>
        </dl>
      </Card>
      {needsConsent && <ConsentStep notice={list.data.notice} />}
      <Card className={portal.card}>
        <Text weight="semibold" as="h2">
          Documents we need
        </Text>
        {c.requests.length === 0 ? (
          <Body1 className={portal.empty}>Nothing is needed from you right now.</Body1>
        ) : (
          <ul className={portal.list}>
            {c.requests.map((r) => (
              <RequestRow key={r.id} caseId={c.id} request={r} consentGiven={consentGiven} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ConsentStep({ notice }: { notice: PortalNoticeOut }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const headingId = useId();
  const [agreed, setAgreed] = useState(false);
  const give = useMutation({
    mutationFn: () => workImmigrationApi.consent(),
    onSuccess: () => {
      qc.setQueryData<PortalCasesOut>(workImmigrationKeys.list, (prev) => (prev ? { ...prev, consent_given: true } : prev));
      void qc.invalidateQueries({ queryKey: workImmigrationKeys.list });
    },
  });
  return (
    <Card className={portal.card}>
      <section className={styles.notice} aria-labelledby={headingId}>
        <Text id={headingId} weight="semibold" as="h2">
          {notice.title}
          {notice.version != null ? ` (version ${notice.version})` : ""}
        </Text>
        <div/* NOSONAR */ className={styles.noticeBody} tabIndex={0} role="region" aria-label="Privacy notice text">
          <MarkdownView source={notice.body_md} />
        </div>
        <Checkbox
          className={styles.checkbox}
          label="I have read the notice and agree to my documents being used for my immigration case"
          checked={agreed}
          onChange={(_, d) => setAgreed(Boolean(d.checked))}
        />
        <Button appearance="primary" className={portal.button} disabled={!agreed || give.isPending} onClick={() => give.mutate()}>
          Agree and continue
        </Button>
        <InlineError message={give.isError ? errorMessage(give.error) : null} />
      </section>
    </Card>
  );
}

function RequestRow({ caseId, request, consentGiven }: { caseId: string; request: PortalRequestOut; consentGiven: boolean }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const [local, setLocal] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const gate = portalUploadGate(consentGiven, request);
  const upload = useMutation({
    mutationFn: (file: File) => workImmigrationApi.upload(request.id, file),
    onSuccess: () => {
      setDone(true);
      void qc.invalidateQueries({ queryKey: workImmigrationKeys.case(caseId) });
      void qc.invalidateQueries({ queryKey: workImmigrationKeys.list });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "consent_required") void qc.invalidateQueries({ queryKey: workImmigrationKeys.list });
    },
  });
  const onFiles = ([file]: File[]) => {
    if (!file) return;
    const err = fileError(file);
    setLocal(err);
    setDone(false);
    if (!err) upload.mutate(file);
  };
  return (
    <li className={styles.request}>
      <Text weight="semibold">
        {request.label}
        {request.mandatory ? "" : " (optional)"}
      </Text>
      {request.for_dependant && <Caption1>For {request.for_dependant}</Caption1>}
      <div className={portal.actions}>
        <Badge appearance="tint" color={REQUEST_COLORS[request.status] ?? "informative"}>
          {PORTAL_REQUEST_LABELS[request.status] ?? request.status}
        </Badge>
        {request.due_date && <Caption1>Please upload by {formatDate(request.due_date)}</Caption1>}
      </div>
      {request.status === "rejected" && request.rejection_reason && <Body1>What to change: {request.rejection_reason}</Body1>}
      {gate === "consent" && <Caption1 className={portal.muted}>Agree to the notice above to upload this document.</Caption1>}
      {gate === "upload" && (
        <FileDrop
          accept={UPLOAD_ACCEPT}
          title={upload.isPending ? "Uploading…" : `Upload ${request.label}`}
          hint="PDF, JPG or PNG, up to 10 MB."
          buttonLabel="Choose file"
          disabled={upload.isPending}
          onFiles={onFiles}
        />
      )}
      {done && (
        <Caption1 role="status" aria-live="polite">
          Uploaded — thank you. We will check it shortly.
        </Caption1>
      )}
      <InlineError message={local ?? (upload.isError ? errorMessage(upload.error) : null)} />
    </li>
  );
}
