"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Link as FluentLink,
  makeStyles,
  Option,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { PortalApplicationDetail } from "@/lib/api/types";
import { PortalAlternativeRequest } from "@/features/fairness/portal-alternative-request";
import { formatDate, formatDateTime } from "./format";
import { validateWithdraw, type WithdrawDraft } from "./forms";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";

const useStyles = makeStyles({
  timeline: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  step: {
    position: "relative",
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingBottom: tokens.spacingVerticalL,
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    marginLeft: tokens.spacingHorizontalS,
    ":last-child": { borderLeftColor: "transparent", paddingBottom: 0 },
    "::before": {
      content: '""',
      position: "absolute",
      left: "-7px",
      top: "2px",
      width: "12px",
      height: "12px",
      borderRadius: tokens.borderRadiusCircular,
      backgroundColor: tokens.colorBrandBackground,
    },
  },
  current: { fontWeight: tokens.fontWeightSemibold },
});

function WithdrawDialog({ app, open, onClose }: { app: PortalApplicationDetail; open: boolean; onClose: () => void }) {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const reasons = useQuery({ queryKey: portalKeys.withdrawReasons, queryFn: ({ signal }) => portalApi.withdrawReasons(signal), enabled: open, staleTime: 10 * 60_000 });
  const [draft, setDraft] = useState<WithdrawDraft>({ reason: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const withdraw = useMutation({
    mutationFn: () => portalApi.withdraw(app.id, { reason_code: draft.reason, note: draft.note.trim() || null }),
    onSuccess: (data) => {
      queryClient.setQueryData(portalKeys.application(app.id), data);
      void queryClient.invalidateQueries({ queryKey: portalKeys.applications });
    },
  });
  const list = reasons.data ?? [];
  const selected = list.find((r) => r.code === draft.reason);

  const submit = async () => {
    setServerError(null);
    const e = validateWithdraw(draft, list);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await withdraw.mutateAsync();
      toast.success("Your application was withdrawn");
      onClose();
    } catch (err) {
      setServerError(isApiError(err) && err.code === "application_closed" ? "This application is already closed and can no longer be withdrawn." : errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !withdraw.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Withdraw your application?</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>
              You are withdrawing from <strong>{app.title}</strong>. The hiring team will stop considering you for this job. This can&apos;t be undone.
            </Body1>
            <InlineError message={serverError} />
            <Field label="Reason" required validationState={errors.reason ? "error" : "none"} validationMessage={errors.reason}>
              <Dropdown
                placeholder={reasons.isPending ? "Loading…" : "Choose a reason"}
                value={selected?.label ?? ""}
                selectedOptions={draft.reason ? [draft.reason] : []}
                onOptionSelect={(_, d) => setDraft((x) => ({ ...x, reason: d.optionValue ?? "" }))}
                disabled={reasons.isPending}
                className={styles.input}
              >
                {list.map((r) => (
                  <Option key={r.code} value={r.code}>
                    {r.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Anything you'd like to add (optional)" validationState={errors.note ? "error" : "none"} validationMessage={errors.note}>
              <Textarea value={draft.note} maxLength={2000} resize="vertical" onChange={(_, d) => setDraft((x) => ({ ...x, note: d.value }))} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} onClick={onClose} disabled={withdraw.isPending}>
              Keep my application
            </Button>
            <Button appearance="primary" className={styles.button} onClick={submit} disabled={withdraw.isPending} icon={withdraw.isPending ? <Spinner size="tiny" /> : undefined}>
              Withdraw
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** One application: candidate-facing stage label, a label timeline and the Withdraw dialog. */
export function ApplicationDetailView({ id }: { id: string }) {
  const styles = usePortalStyles();
  const local = useStyles();
  const [withdrawing, setWithdrawing] = useState(false);
  const q = useQuery({ queryKey: portalKeys.application(id), queryFn: ({ signal }) => portalApi.application(id, signal), retry: false });

  return (
    <div className={styles.page}>
      <FluentLink href="/portal" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> My applications
      </FluentLink>
      {q.isPending ? (
        <LoadingBlock label="Loading application" />
      ) : q.isError ? (
        isApiError(q.error) && q.error.status === 404 ? (
          <Card className={styles.card}>
            <Subtitle1 as="h1">Application not found</Subtitle1>
            <Body1>It may have been removed. Go back to your applications.</Body1>
          </Card>
        ) : (
          <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
        )
      ) : (
        <>
          <PortalPageHeader title={q.data.title} subtitle={q.data.client_name ? `Client: ${q.data.client_name}` : undefined} />
          <Card className={styles.card}>
            <div className={styles.actions} style={{ justifyContent: "space-between" }}>
              <div className={styles.rowMain}>
                <Text className={styles.muted}>Current status</Text>
                <Badge size="extra-large" appearance="tint" color={q.data.status === "active" ? "brand" : "subtle"}>
                  {q.data.stage_label}
                </Badge>
              </div>
              {q.data.can_withdraw && (
                <Button className={styles.button} onClick={() => setWithdrawing(true)}>
                  Withdraw application
                </Button>
              )}
            </div>
            <dl className={styles.dl}>
              <dt>Applied</dt>
              <dd>{formatDate(q.data.applied_at)}</dd>
              <dt>Last update</dt>
              <dd>{formatDate(q.data.updated_at)}</dd>
            </dl>
          </Card>
          <Card className={styles.card} role="region" aria-labelledby="timeline-title">
            <Subtitle1 as="h2" id="timeline-title">
              Progress
            </Subtitle1>
            <ol className={local.timeline}>
              {q.data.timeline.map((t, i) => (
                <li key={`${t.label}-${t.at}`} className={local.step} aria-current={i === q.data.timeline.length - 1 ? "step" : undefined}>
                  <Text block className={i === q.data.timeline.length - 1 ? local.current : undefined}>
                    {t.label}
                    {i === q.data.timeline.length - 1 ? " (current)" : ""}
                  </Text>
                  <Text size={200} className={styles.muted}>
                    {formatDateTime(t.at)}
                  </Text>
                </li>
              ))}
            </ol>
          </Card>
          <PortalAlternativeRequest applicationId={q.data.id} active={q.data.status === "active"} />
          {withdrawing && <WithdrawDialog app={q.data} open={withdrawing} onClose={() => setWithdrawing(false)} />}
        </>
      )}
    </div>
  );
}
