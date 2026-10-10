"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Field,
  Link,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { onboardingApi, onboardingKeys } from "./api";
import {
  approvable,
  canReturn,
  canWaive,
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  groupTasks,
  KIND_LABELS,
  maskedSummary,
  needsPanCheck,
  needsRedaction,
  progressLabel,
  RETURN_MIN,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  WAIVE_MIN,
} from "./logic";
import type { OnboardingCase, OnboardingTask } from "./types";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalM },
  meta: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM, flexGrow: 1 },
  progress: { minWidth: "200px" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalL },
  row: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto auto",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  overdue: { color: tokens.colorPaletteRedForeground1 },
  dl: { display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: tokens.spacingHorizontalL, rowGap: tokens.spacingVerticalXS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** `/onboarding/[id]`: case header, Worker / Internal task groups, per-task review drawer and bulk approve. */
export function OnboardingCaseView({ id }: { id: string }) {
  const canRead = usePermission("onboarding:read");
  const q = useQuery({ queryKey: onboardingKeys.case(id), queryFn: ({ signal }) => onboardingApi.get(id, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="onboarding" />;
  if (q.isPending) return <Spinner label="Loading onboarding" />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  return (
    <>
      <PageHeader title={`${q.data.human_id ?? "Onboarding"} · ${q.data.worker_name ?? "Worker"}`} subtitle={q.data.client_name ?? undefined} />
      <CasePanel c={q.data} />
    </>
  );
}

/** The Placement "Onboarding" tab: the same panel for the placement's case (or a Start button). */
export function PlacementOnboardingTab({ placementId }: { placementId: string }) {
  const canRead = usePermission("onboarding:read");
  const canManage = usePermission("onboarding:manage");
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({
    queryKey: onboardingKeys.byPlacement(placementId),
    queryFn: ({ signal }) => onboardingApi.byPlacement(placementId, signal),
    enabled: canRead,
    retry: false,
  });
  const start = useMutation({
    mutationFn: () => onboardingApi.start(placementId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onboardingKeys.all }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canRead) return <NoAccess what="onboarding" />;
  if (q.isPending) return <Spinner label="Loading onboarding" />;
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404)
      return (
        <Card>
          <Body1>No onboarding case yet.</Body1>
          {canManage && (
            <Button appearance="primary" disabled={start.isPending} onClick={() => start.mutate()}>
              Start onboarding
            </Button>
          )}
        </Card>
      );
    return <ErrorBar message={errorMessage(q.error)} />;
  }
  return <CasePanel c={q.data} />;
}

function CasePanel({ c }: { c: OnboardingCase }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canManage = usePermission("onboarding:manage");
  const [open, setOpen] = useState<OnboardingTask | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const groups = groupTasks(c.tasks);
  const refresh = () => void qc.invalidateQueries({ queryKey: onboardingKeys.all });
  const invite = useMutation({
    mutationFn: () => onboardingApi.invite(c.id),
    onSuccess: () => {
      toast.success("Invitation sent to the Worker");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bulk = useMutation({
    mutationFn: () => onboardingApi.bulkApprove(c.id, selected),
    onSuccess: (r) => {
      const failed = Object.keys(r.failed).length;
      if (failed) toast.error(`${r.approved.length} approved, ${failed} could not be approved`);
      else toast.success(`${r.approved.length} approved`);
      setSelected([]);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const closed = c.status === "complete" || c.status === "cancelled";
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const renderRow = (t: OnboardingTask) => (
    <div
      key={t.id}
      className={styles.row}
      role="button"
      tabIndex={0}
      aria-label={`Review ${t.label}`}
      onClick={() => setOpen(t)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(t);
        }
      }}
    >
      {canManage && approvable(t) ? (
        <Checkbox
          aria-label={`Select ${t.label}`}
          checked={selected.includes(t.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={(_, d) => toggle(t.id, Boolean(d.checked))}
        />
      ) : (
        <span />
      )}
      <div>
        <Text weight="semibold">{t.label}</Text>
        <br />
        <Caption1>
          {KIND_LABELS[t.kind]}
          {t.mandatory ? "" : " · optional"}
          {t.reused_from_task_id ? " · reused" : ""}
          {t.source === "compliance" ? " · compliance" : ""}
        </Caption1>
      </div>
      <Caption1 className={mergeClasses(t.overdue && styles.overdue)}>
        {t.due_on ? `Due ${formatDate(t.due_on)}${t.overdue ? " (overdue)" : ""}` : ""}
      </Caption1>
      <Badge appearance="tint" color={TASK_STATUS_COLORS[t.status]}>
        {TASK_STATUS_LABELS[t.status]}
      </Badge>
    </div>
  );
  return (
    <>
      <Card className={styles.header}>
        <div className={styles.meta}>
          <div>
            <Caption1>Placement</Caption1>
            <br />
            <Link as="a" href={`/placements/${c.placement_id}`}>
              {c.placement_human_id ?? "Placement"}
            </Link>
          </div>
          <div>
            <Caption1>Planned start</Caption1>
            <br />
            <Text>{formatDate(c.planned_start_date)}</Text>
          </div>
          <div>
            <Caption1>Status</Caption1>
            <br />
            <Badge appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
              {CASE_STATUS_LABELS[c.status]}
            </Badge>
          </div>
          <div>
            <Caption1>Start gate</Caption1>
            <br />
            <Text>{c.gate_status ?? "—"}</Text>
          </div>
          <div>
            <Caption1>Bank / PAN</Caption1>
            <br />
            <Text>
              {c.bank_last4 ? `•••• ${c.bank_last4}` : "—"} / {c.pan_last4 ? `•••• ${c.pan_last4}` : "—"}
            </Text>
            <br />
            <NextLink href={`/workers/${c.candidate_id}`}>Worker 360</NextLink>
          </div>
          <div className={styles.progress}>
            <Caption1>{progressLabel(c.progress_pct)}</Caption1>
            <ProgressBar value={c.progress_pct / 100} thickness="large" aria-label={progressLabel(c.progress_pct)} />
          </div>
        </div>
        <div className={styles.actions}>
          {canManage && !closed && (
            <Button disabled={invite.isPending} onClick={() => invite.mutate()}>
              {c.invited_at ? "Re-invite" : "Invite"}
            </Button>
          )}
          {canManage && selected.length > 0 && (
            <Button appearance="primary" disabled={bulk.isPending} onClick={() => bulk.mutate()}>
              Approve selected ({selected.length})
            </Button>
          )}
        </div>
        {c.invited_at && <Caption1>Invited {formatDateTime(c.invited_at)}</Caption1>}
      </Card>
      <section className={styles.section} aria-label="Worker tasks">
        <Subtitle2>Worker tasks</Subtitle2>
        <Card>{groups.worker.length ? groups.worker.map(renderRow) : <Body1>No Worker tasks.</Body1>}</Card>
      </section>
      <section className={styles.section} aria-label="Internal tasks">
        <Subtitle2>Internal tasks</Subtitle2>
        <Card>{groups.internal.length ? groups.internal.map(renderRow) : <Body1>No internal tasks.</Body1>}</Card>
      </section>
      {open && <ReviewDrawer task={c.tasks.find((t) => t.id === open.id) ?? open} onClose={() => setOpen(null)} onChanged={refresh} />}
    </>
  );
}

function ReviewDrawer({ task, onClose, onChanged }: { task: OnboardingTask; onClose: () => void; onChanged: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const canManage = usePermission("onboarding:manage");
  const canWaivePerm = usePermission("onboarding:waive");
  const [panChecked, setPanChecked] = useState(false);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (action: "approve" | "return" | "waive" | "redaction" | "reissue") => {
      if (action === "approve") return onboardingApi.approve(task.id, needsPanCheck(task) ? { pan_name_checked: panChecked } : {});
      if (action === "return") return onboardingApi.returnTask(task.id, comment.trim());
      if (action === "waive") return onboardingApi.waive(task.id, reason.trim());
      if (action === "redaction") return onboardingApi.confirmRedaction(task.id);
      return onboardingApi.reissueSignature(task.id);
    },
    onSuccess: () => {
      toast.success("Saved");
      setError(null);
      onChanged();
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const summary = maskedSummary(task);
  return (
    <DetailsDrawer
      open
      title={task.label}
      onClose={onClose}
      footer={
        canManage ? (
          <div className={styles.actions}>
            {approvable(task) && (
              <Button appearance="primary" disabled={run.isPending || (needsPanCheck(task) && !panChecked)} onClick={() => run.mutate("approve")}>
                Approve
              </Button>
            )}
            {canReturn(task) && task.kind !== "esign" && (
              <Button disabled={run.isPending || comment.trim().length < RETURN_MIN} onClick={() => run.mutate("return")}>
                Return
              </Button>
            )}
            {canWaivePerm && canWaive(task) && (
              <Button disabled={run.isPending || reason.trim().length < WAIVE_MIN} onClick={() => run.mutate("waive")}>
                Waive
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        <Badge appearance="tint" color={TASK_STATUS_COLORS[task.status]}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
        {task.instructions && <Body1>{task.instructions}</Body1>}
        {summary.length > 0 && (
          <dl className={styles.dl}>
            {summary.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>
                  <Caption1>{k}</Caption1>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {task.kind === "bank_details" || task.kind === "tax_details" ? (
          <Caption1>Full numbers are never shown here. Unmask on Worker 360 (needs identity:view).</Caption1>
        ) : null}
        {task.document_ids.length > 0 && (
          <Caption1>
            {task.document_ids.length} document(s) — open them from the Worker&apos;s documents on Worker 360.
          </Caption1>
        )}
        {task.kind === "esign" && (
          <div className={styles.stack}>
            <Caption1>Signature request: {task.signature_request_id ?? "not created yet"}</Caption1>
            {canManage && task.status === "returned" && (
              <Button disabled={run.isPending} onClick={() => run.mutate("reissue")}>
                Re-issue signature request
              </Button>
            )}
          </div>
        )}
        {task.return_comment && (
          <Field label="Returned with">
            <Body1>{task.return_comment}</Body1>
          </Field>
        )}
        {task.waived_reason && (
          <Field label="Waived because">
            <Body1>{task.waived_reason}</Body1>
          </Field>
        )}
        {task.decided_at && (
          <Caption1>
            Decided {formatDateTime(task.decided_at)} by {task.decided_by_kind === "system" ? "the system" : "a user"}
          </Caption1>
        )}
        {canManage && needsRedaction(task) && (
          <MessageBar intent="warning">
            <MessageBarBody>
              Check that the Aadhaar image shows only the last 4 digits.{" "}
              <Button size="small" disabled={run.isPending} onClick={() => run.mutate("redaction")}>
                Confirm masked
              </Button>
            </MessageBarBody>
          </MessageBar>
        )}
        {canManage && approvable(task) && needsPanCheck(task) && (
          <Checkbox
            checked={panChecked}
            onChange={(_, d) => setPanChecked(Boolean(d.checked))}
            label="I checked that the name on the PAN matches the Worker's name"
          />
        )}
        {canManage && canReturn(task) && task.kind !== "esign" && (
          <Field label="Return comment" hint={`At least ${RETURN_MIN} characters; the Worker sees it.`}>
            <Textarea value={comment} onChange={(_, d) => setComment(d.value)} resize="vertical" />
          </Field>
        )}
        {canWaivePerm && canWaive(task) && (
          <Field label="Waive reason" hint={`At least ${WAIVE_MIN} characters. Waiving is recorded in the audit log.`}>
            <Textarea value={reason} onChange={(_, d) => setReason(d.value)} resize="vertical" />
          </Field>
        )}
      </div>
    </DetailsDrawer>
  );
}
