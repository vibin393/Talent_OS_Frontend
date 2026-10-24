"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Subtitle2,
  Text,
  Toolbar,
  ToolbarButton,
  tokens, mergeClasses } from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  CheckmarkCircle16Filled,
  Circle16Regular,
  DismissCircle16Filled,
  Play20Regular,
  PersonAvailable20Regular,
  Prohibited20Regular,
  ArrowClockwise20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import type { DsrDetailOut } from "@/lib/api/types";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { ReasonDialog, TypedConfirmDialog } from "./dialogs";
import {
  CONSENT_PURPOSE_LABELS,
  DSR_CHANNEL_LABELS,
  DSR_KIND_LABELS,
  DSR_STATUS_COLORS,
  DSR_STATUS_LABELS,
  dsrDueBadge,
  dsrSteps,
  erasureProgress,
  ERASURE_CONFIRM_WORD,
  humanize,
  isDsrClosed,
  isErasureActive,
  MIN_REFUSAL_REASON,
} from "./format";
import { useUserNames } from "./use-user-names";
import { DSR_SUBJECT_KIND_LABELS } from "./retention-classes/format";
import { RetainedSummary } from "./retention-classes/retained-summary";
import type { DsrSubjectKind, RetainedSummaryRow } from "./retention-classes/types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "980px" },
  columns: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
    "@media (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  steps: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL, alignItems: "center", margin: 0, padding: 0, listStyle: "none" },
  step: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  done: { color: tokens.colorPaletteGreenForeground1 },
  refused: { color: tokens.colorPaletteRedForeground1 },
  todo: { color: tokens.colorNeutralForeground3 },
  current: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  dl: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, minWidth: 0, overflowWrap: "anywhere" },
  },
  timeline: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  handlers: { width: "100%", borderCollapse: "collapse", "& td, & th": { textAlign: "start", padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` } },
  header: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
});

/** `/admin/privacy/requests/[id]`: DSR detail with verification, refusal, execution and erasure progress. */
export function DsrDetail({ id }: { id: string }) {
  const canRead = usePermission("dsr:read");
  const dsr = useQuery({
    queryKey: privacyKeys.dsr(id),
    queryFn: ({ signal }) => privacyApi.dsr(id, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="data subject requests" />;
  if (dsr.isPending) return <GridSkeleton rows={8} />;
  if (dsr.isError) return <ErrorBar title="Could not load the request." message={privacyErrorMessage(dsr.error)} />;
  return <DsrDetailView dsr={dsr.data} />;
}

function DsrDetailView({ dsr }: { dsr: DsrDetailOut }) {
  // Epic 35: the subject kind (not yet in the generated DsrDetailOut).
  const subjectKind = (dsr as DsrDetailOut & { subject_kind?: DsrSubjectKind | null }).subject_kind ?? null;
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canProcess = usePermission("dsr:process");
  const userName = useUserNames();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "refuse" | "execute" | "complete">(null);
  const closed = isDsrClosed(dsr.status);
  const hold = dsr.legal_hold && !dsr.legal_hold.released_at ? dsr.legal_hold : null;
  const due = dsrDueBadge(dsr);

  const refresh = async (out?: DsrDetailOut) => {
    if (out) queryClient.setQueryData(privacyKeys.dsr(dsr.id), out);
    await queryClient.invalidateQueries({ queryKey: privacyKeys.dsrs });
  };
  const act = useMutation({
    mutationFn: (fn: () => Promise<DsrDetailOut>) => fn(),
    onSuccess: (out) => refresh(out),
    onError: (e) => toast.error(privacyErrorMessage(e)),
  });

  const needsVerification = dsr.kind === "access" || dsr.kind === "erasure";
  const verified = !!dsr.identity_verified_at;
  const executeBlocked =
    closed ||
    !dsr.candidate_id ||
    (needsVerification && !verified) ||
    (dsr.kind === "erasure" && !!hold) ||
    isErasureActive(dsr.erasure_run);
  const executeLabel =
    dsr.kind === "erasure" ? "Erase candidate data" : dsr.kind === "access" ? "Send data export" : "Withdraw consent";

  return (
    <div className={styles.root}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => router.push("/admin/privacy")}>
          Privacy center
        </Button>
      </div>
      <PageHeader
        title={`${dsr.human_id} · ${DSR_KIND_LABELS[dsr.kind]} request`}
        subtitle={
          <span className={styles.header}>
            <Badge appearance="tint" color={DSR_STATUS_COLORS[dsr.status]}>
              {DSR_STATUS_LABELS[dsr.status]}
            </Badge>
            {due && (
              <Badge appearance="filled" color={due.color}>
                {due.label}
              </Badge>
            )}
            <span>Due {formatDateTime(dsr.due_at)}</span>
          </span>
        }
      />

      <ol className={styles.steps} aria-label="Request progress">
        {dsrSteps(dsr.status).map((s) => (
          <li key={s.key} className={mergeClasses(styles.step, styles[s.state])} aria-current={s.state === "current" ? "step" : undefined}>
            {s.state === "done" ? <CheckmarkCircle16Filled /> : s.state === "refused" ? <DismissCircle16Filled /> : <Circle16Regular />}
            <Text>{s.label}</Text>
          </li>
        ))}
      </ol>

      {hold && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Legal hold</MessageBarTitle>
            This candidate is under a legal hold ({hold.reason}), placed {formatDateTime(hold.placed_at)}. Erasure is
            blocked until the hold is released.
          </MessageBarBody>
        </MessageBar>
      )}
      {dsr.kind === "correction" && !closed && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            Correct the data on the candidate&apos;s profile
            {dsr.candidate_id && (
              <>
                {" "}
                (<AppLink href={`/candidates/${dsr.candidate_id}`}>open candidate</AppLink>)
              </>
            )}
            , then complete this request with a note.
          </MessageBarBody>
        </MessageBar>
      )}

      {canProcess && !closed && (
        <Toolbar aria-label="Request actions">
          {needsVerification && !verified && (
            <ToolbarButton
              icon={<PersonAvailable20Regular />}
              disabled={act.isPending}
              onClick={() => act.mutate(() => privacyApi.verifyIdentity(dsr.id))}
            >
              Verify identity
            </ToolbarButton>
          )}
          {dsr.status === "received" && (
            <ToolbarButton
              disabled={act.isPending}
              onClick={() => act.mutate(() => privacyApi.transitionDsr(dsr.id, { to: "in_progress" }))}
            >
              Start processing
            </ToolbarButton>
          )}
          {dsr.kind === "correction" ? (
            <ToolbarButton
              appearance="primary"
              icon={<Play20Regular />}
              disabled={dsr.status !== "in_progress"}
              onClick={() => setDialog("complete")}
            >
              Complete with note
            </ToolbarButton>
          ) : (
            <ToolbarButton
              appearance="primary"
              icon={<Play20Regular />}
              disabled={executeBlocked}
              onClick={() => setDialog("execute")}
            >
              {executeLabel}
            </ToolbarButton>
          )}
          <ToolbarButton icon={<Prohibited20Regular />} onClick={() => setDialog("refuse")}>
            Refuse
          </ToolbarButton>
          {act.isPending && <Spinner size="tiny" aria-label="Working" />}
        </Toolbar>
      )}
      {canProcess && !closed && needsVerification && !verified && (
        <Caption1>Verify the requester&apos;s identity before executing an {dsr.kind} request.</Caption1>
      )}

      <div className={styles.columns}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
          <dl className={styles.dl}>
            <dt>Requester</dt>
            <dd>
              {dsr.requester_name ?? "—"}
              {dsr.requester_email ? ` · ${dsr.requester_email}` : ""}
            </dd>
            <dt>Candidate</dt>
            <dd>
              {dsr.candidate_id ? (
                <AppLink href={`/candidates/${dsr.candidate_id}`}>{dsr.candidate_human_id ?? "Open candidate"}</AppLink>
              ) : (
                "Not linked"
              )}
            </dd>
            {subjectKind && (
              <>
                <dt>Subject</dt>
                <dd>{DSR_SUBJECT_KIND_LABELS[subjectKind] ?? subjectKind}</dd>
              </>
            )}
            <dt>Received by</dt>
            <dd>{DSR_CHANNEL_LABELS[dsr.channel]}</dd>
            <dt>Received</dt>
            <dd>{formatDateTime(dsr.received_at)}</dd>
            <dt>Identity</dt>
            <dd>
              {verified
                ? `Verified ${formatDateTime(dsr.identity_verified_at)}${dsr.identity_verified_by ? ` by ${userName(dsr.identity_verified_by) ?? "a user"}` : ""}`
                : needsVerification
                  ? "Not verified"
                  : "Not required"}
            </dd>
            {dsr.refusal_reason && (
              <>
                <dt>Refusal reason</dt>
                <dd>{dsr.refusal_reason}</dd>
              </>
            )}
            {dsr.completed_at && (
              <>
                <dt>Completed</dt>
                <dd>{formatDateTime(dsr.completed_at)}</dd>
              </>
            )}
            {typeof dsr.details?.notes === "string" && (
              <>
                <dt>Notes</dt>
                <dd>{dsr.details.notes}</dd>
              </>
            )}
          </dl>
          {canProcess && !closed && (
            <UserPicker
              label="Assigned to"
              value={dsr.assigned_to}
              valueLabel={userName(dsr.assigned_to) ?? (dsr.assigned_to ? "Assigned" : "")}
              clearLabel="Unassigned"
              onChange={(userId) => act.mutate(() => privacyApi.updateDsr(dsr.id, { assigned_to: userId }))}
            />
          )}
          {!dsr.candidate_id && canProcess && !closed && (
            <Body1>Link a candidate from the candidate&apos;s profile or recreate the request with a candidate.</Body1>
          )}
          {dsr.result && Object.keys(dsr.result).length > 0 && <ResultSummary result={dsr.result} />}
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Timeline</Subtitle2>} />
          {dsr.timeline.length === 0 ? (
            <Body1>No activity yet.</Body1>
          ) : (
            <ol className={styles.timeline}>
              {dsr.timeline.map((t, i) => (
                <li key={`${t.occurred_at}-${i}`}>
                  <Text weight="semibold">{humanize(t.action.replace(/^dsr\./, ""))}</Text>
                  <br />
                  <Caption1>
                    {formatDateTime(t.occurred_at)} ·{" "}
                    {t.actor_type === "user" ? (userName(t.actor_id) ?? "A user") : humanize(t.actor_type)}
                  </Caption1>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {dsr.erasure_run && <ErasureProgress dsrId={dsr.id} runId={dsr.erasure_run.id} canRetry={canProcess} />}

      <ReasonDialog
        open={dialog === "refuse"}
        title={`Refuse ${dsr.human_id}?`}
        description="The requester's request is closed as refused. Record why; the reason is kept in the audit log."
        label="Refusal reason"
        minLength={MIN_REFUSAL_REASON}
        confirmLabel="Refuse request"
        errorMessage={privacyErrorMessage}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => refresh(await privacyApi.transitionDsr(dsr.id, { to: "refused", refusal_reason: reason }))}
      />
      <ReasonDialog
        open={dialog === "complete"}
        title={`Complete ${dsr.human_id}`}
        description="Confirm the candidate's data was corrected."
        label="Note"
        minLength={3}
        confirmLabel="Complete request"
        errorMessage={privacyErrorMessage}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => refresh(await privacyApi.transitionDsr(dsr.id, { to: "completed", note }))}
      />
      {dsr.kind === "erasure" ? (
        <TypedConfirmDialog
          open={dialog === "execute"}
          title="Erase this candidate's personal data?"
          word={ERASURE_CONFIRM_WORD}
          confirmLabel="Erase"
          errorMessage={privacyErrorMessage}
          onClose={() => setDialog(null)}
          onConfirm={async (typed) => {
            await refresh(await privacyApi.executeDsr(dsr.id, { confirm: typed }));
            toast.success("Erasure started");
          }}
        >
          <Body1>
            The profile, files, screenings, notes, AI outputs, search indexes and audit-log personal data are anonymized
            or deleted. Submission facts are kept without personal data. This cannot be undone.
          </Body1>
        </TypedConfirmDialog>
      ) : (
        <ConfirmDialog
          open={dialog === "execute"}
          title={dsr.kind === "access" ? "Send the data export?" : "Withdraw the candidate's consents?"}
          confirmLabel={executeLabel}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            privacyApi
              .executeDsr(dsr.id, {})
              .then(async (out) => {
                await refresh(out);
                toast.success(dsr.kind === "access" ? "Export requested; the requester is emailed a link" : "Consent withdrawn");
              })
              .catch((e) => {
                toast.error(privacyErrorMessage(e));
                throw e;
              })
          }
        >
          {dsr.kind === "access"
            ? "A zip of everything held about the candidate is prepared and a secure download link (7 days, 3 uses) is emailed to the requester."
            : "Every granted consent purpose is withdrawn. AI-derived data is purged within an hour."}
        </ConfirmDialog>
      )}
    </div>
  );
}

function ResultSummary({ result }: { result: Record<string, unknown> }) {
  const purposes = Array.isArray(result.purposes) ? (result.purposes as string[]) : null;
  return (
    <div>
      <Subtitle2 as="h3">Outcome</Subtitle2>
      {purposes ? (
        <Body1>Withdrawn: {purposes.map((p) => CONSENT_PURPOSE_LABELS[p] ?? p).join(", ") || "none"}</Body1>
      ) : (
        <Body1>
          {Object.entries(result)
            .filter(([, v]) => typeof v !== "object")
            .map(([k, v]) => `${humanize(k)}: ${String(v)}`)
            .join(" · ") || "Completed"}
        </Body1>
      )}
    </div>
  );
}

function ErasureProgress({ dsrId, runId, canRetry }: { dsrId: string; runId: string; canRetry: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const run = useQuery({
    queryKey: privacyKeys.erasureRun(runId),
    queryFn: ({ signal }) => privacyApi.erasureRun(runId, signal),
    // Poll every 3 s while the run is working; refresh the DSR when it settles.
    refetchInterval: (q) => (isErasureActive(q.state.data ?? { status: "pending" }) ? 3000 : false),
  });
  const retry = useMutation({
    mutationFn: () => privacyApi.retryErasure(runId),
    onSuccess: async (out) => { // NOSONAR
      queryClient.setQueryData(privacyKeys.erasureRun(runId), out);
      toast.success("Retrying the failed steps");
    },
    onError: (e) => toast.error(privacyErrorMessage(e)),
  });
  const status = run.data?.status;
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status === "completed" || status === "failed") void queryClient.invalidateQueries({ queryKey: privacyKeys.dsr(dsrId) });
  }
  const rows = erasureProgress(run.data);
  // Epic 35 (AD-34): what the erasure kept and why.
  const retained = (run.data as { retained_summary?: RetainedSummaryRow[] | null } | undefined)?.retained_summary;
  const findings = (run.data?.verification as { findings?: Record<string, string[]> } | null)?.findings;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Erasure progress</Subtitle2>}
        description={
          run.data && (
            <Caption1>
              {humanize(run.data.status)}
              {run.data.finished_at ? ` · finished ${formatDateTime(run.data.finished_at)}` : ""}
            </Caption1>
          )
        }
        action={
          status === "failed" && canRetry ? (
            <Button icon={<ArrowClockwise20Regular />} disabled={retry.isPending} onClick={() => retry.mutate()}>
              Retry failed steps
            </Button>
          ) : isErasureActive(run.data) ? (
            <Spinner size="tiny" aria-label="Erasing" />
          ) : undefined
        }
      />
      {run.isError && <ErrorBar message={privacyErrorMessage(run.error)} />}
      {rows.length === 0 ? (
        <Body1>{isErasureActive(run.data) || run.isPending ? "Waiting for the first step…" : "No steps recorded."}</Body1>
      ) : (
        <table className={styles.handlers}>
          <thead>
            <tr>
              <th>Step</th>
              <th>Status</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>
                  <Badge appearance="tint" color={r.status === "ok" ? "success" : r.status === "failed" ? "danger" : "informative"}>
                    {r.status === "ok" ? "Done" : r.status === "failed" ? "Failed" : "Pending"}
                  </Badge>
                </td>
                <td>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {findings && Object.keys(findings).length > 0 && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Verification found residual personal data</MessageBarTitle>
            {Object.entries(findings)
              .map(([h, f]) => `${h}: ${f.join("; ")}`)
              .join(" · ")}
          </MessageBarBody>
        </MessageBar>
      )}
      {retained && <RetainedSummary rows={retained} />}
    </Card>
  );
}
