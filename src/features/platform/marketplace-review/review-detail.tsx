"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Textarea,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { CHECKLIST, type ChecklistEntry, reviewApi, reviewKeys, VERSION_STATUS_LABELS } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1000px" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  pre: { whiteSpace: "pre-wrap", fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200, maxHeight: "320px", overflow: "auto" },
});

/** `/platform/marketplace/[versionId]`: automated checks, conformance report, manifest, checklist and decisions. */
export function MarketplaceReviewDetail({ versionId }: { versionId: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: reviewKeys.version(versionId), queryFn: ({ signal }) => reviewApi.version(versionId, signal) });
  const [items, setItems] = useState<Record<string, ChecklistEntry>>({});
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (q.data) setItems(q.data.checklist ?? {});
  }, [q.data]);
  const done = (data: unknown) => {
    qc.setQueryData(reviewKeys.version(versionId), data);
    void qc.invalidateQueries({ queryKey: reviewKeys.queue });
  };
  const claim = useMutation({ mutationFn: () => reviewApi.claim(versionId), onSuccess: done });
  const saveChecklist = useMutation({ mutationFn: () => reviewApi.checklist(versionId, items, note.trim() || null), onSuccess: done });
  const decide = useMutation({
    mutationFn: (action: "approve" | "request-changes" | "reject") => reviewApi.decide(versionId, action, message.trim(), note.trim() || null),
    onSuccess: done,
  });
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.error || !q.data)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  const v = q.data;
  const error = claim.error ?? saveChecklist.error ?? decide.error;
  const inReview = v.status === "in_review";
  const report = v.conformance_report;
  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <Title3 as="h1">
          {v.app_name} · version {v.version_no}
        </Title3>
        <Badge appearance="tint">{VERSION_STATUS_LABELS[v.status] ?? v.status}</Badge>
      </div>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Automated checks</Subtitle2>
          {v.check_results.map((c) => (
            <Body1 key={c.key}>
              {c.passed ? "✓" : "✗"} {c.key}
              {c.detail ? ` — ${c.detail}` : ""}
            </Body1>
          ))}
          {!v.check_results.length ? <Caption1>Not run yet.</Caption1> : null}
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Conformance report</Subtitle2>
          {report ? (
            <>
              {(report.checks ?? []).map((c) => (
                <Body1 key={c.key}>
                  {c.passed ? "✓" : "✗"} {c.key}
                </Body1>
              ))}
              <Caption1>Observed scopes: {(report.observed_scopes ?? []).join(", ") || "—"}</Caption1>
              <Caption1>Observed hosts: {(report.observed_hosts ?? []).join(", ") || "—"}</Caption1>
            </>
          ) : (
            <Caption1>No report attached.</Caption1>
          )}
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Manifest</Subtitle2>
          <pre className={styles.pre}>{JSON.stringify(v.manifest_snapshot, null, 2)}</pre>
        </div>
      </Card>
      <Card>
        <div className={styles.section}>
          <Subtitle2 as="h2">Checklist</Subtitle2>
          {CHECKLIST.map((c) => (
            <div key={c.key} className={styles.row}>
              <Checkbox
                label={c.label}
                disabled={!inReview}
                checked={!!items[c.key]?.ok}
                onChange={(_, d) => setItems({ ...items, [c.key]: { ok: Boolean(d.checked), note: items[c.key]?.note ?? null } })}
              />
              <Field label="Note">
                <Input
                  disabled={!inReview}
                  value={items[c.key]?.note ?? ""}
                  onChange={(_, d) => setItems({ ...items, [c.key]: { ok: !!items[c.key]?.ok, note: d.value || null } })}
                />
              </Field>
            </div>
          ))}
          <Field label="Message to the partner">
            <Textarea maxLength={4000} value={message} onChange={(_, d) => setMessage(d.value)} />
          </Field>
          <Field label="Internal note">
            <Textarea maxLength={4000} value={note} onChange={(_, d) => setNote(d.value)} />
          </Field>
          <div className={styles.row}>
            <Button disabled={!inReview || claim.isPending} onClick={() => claim.mutate()}>
              Claim
            </Button>
            <Button disabled={!inReview || saveChecklist.isPending} onClick={() => saveChecklist.mutate()}>
              Save checklist
            </Button>
            <Button appearance="primary" disabled={!inReview || decide.isPending} onClick={() => decide.mutate("approve")}>
              Approve and publish
            </Button>
            <Button disabled={!inReview || !message.trim() || decide.isPending} onClick={() => decide.mutate("request-changes")}>
              Request changes
            </Button>
            <Button disabled={!inReview || !message.trim() || decide.isPending} onClick={() => decide.mutate("reject")}>
              Reject
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
