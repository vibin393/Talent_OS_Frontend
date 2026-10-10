"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Checkbox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { Archive20Regular, ArrowLeft20Regular, Pause20Regular, Play20Regular, Rocket20Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { FunnelChart } from "@/features/campaigns/funnel-chart";
import { formatRate } from "@/features/campaigns/logic";
import { useMarketingOptions } from "@/features/campaigns/use-marketing";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { sequenceKeys, sequencesApi } from "./api";
import {
  ENROLLMENT_STATUS_COLORS,
  EXIT_REASON_LABELS,
  hasErrors,
  labelFor,
  stepsFromServer,
  stepsToPayload,
  stepSummary,
  validateSteps,
} from "./logic";
import { SequenceStatusBadge } from "./sequences-view";
import { StepEditor } from "./step-editor";
import type { EnrollmentOut, ExitOn, SequenceOut, StepDraft } from "./types";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  layout: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "920px" },
  row: { display: "flex", gap: tokens.spacingHorizontalL, flexWrap: "wrap", alignItems: "flex-start" },
  checks: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  stepStats: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
});

const EXIT_KEYS: (keyof ExitOn)[] = ["replied", "applied", "hired", "unsubscribed"];

/** `/marketing/sequences/[id]`: step editor with publish, enrolments and per-step analytics. */
export function SequenceDetail({ sequenceId }: { sequenceId: string }) {
  const styles = useStyles();
  const canRead = usePermission("campaign:read");
  const query = useQuery({
    queryKey: sequenceKeys.detail(sequenceId),
    queryFn: ({ signal }) => sequencesApi.get(sequenceId, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="sequences" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/marketing/sequences">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Sequences
      </AppLink>
    </div>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Sequence not found</Subtitle2>} description={<Body1>It may have been removed.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this sequence." message={errorMessage(query.error)} />
        )}
      </>
    );
  return (
    <>
      {back}
      <SequenceBody key={query.data.updated_at} sequence={query.data} />
    </>
  );
}

type SeqTab = "steps" | "enrollments" | "analytics";

function SequenceBody({ sequence: s }: { sequence: SequenceOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canWrite = usePermission("campaign:write");
  const options = useMarketingOptions();
  const [tab, setTab] = useState<SeqTab>("steps");
  const [steps, setSteps] = useState<StepDraft[]>(() => stepsFromServer(s.steps));
  const [name, setName] = useState(s.name);
  const [description, setDescription] = useState(s.description ?? "");
  const [exitOn, setExitOn] = useState<ExitOn>({
    replied: s.exit_on.replied ?? true,
    applied: s.exit_on.applied ?? true,
    hired: s.exit_on.hired ?? true,
    unsubscribed: s.exit_on.unsubscribed ?? true,
  });
  const [gap, setGap] = useState(s.re_enrol_gap_days);
  const [showErrors, setShowErrors] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState<"pause" | "resume" | "archive" | null>(null);
  const readOnly = !canWrite || s.status === "archived";
  const invalidate = () => qc.invalidateQueries({ queryKey: sequenceKeys.all });
  const validation = validateSteps(steps);
  const invalid = hasErrors(validation) || !name.trim();

  const save = useMutation({
    mutationFn: () =>
      sequencesApi.update(s.id, {
        name: name.trim(),
        description: description.trim() || null,
        exit_on: exitOn,
        re_enrol_gap_days: gap,
        steps: stepsToPayload(steps),
      }),
    onError: (e) => toast.error(errorMessage(e, "Could not save the sequence.")),
  });

  const saveDraft = async () => {
    setShowErrors(true);
    if (invalid) return;
    await save.mutateAsync();
    toast.success("Draft saved.");
    invalidate();
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "That did not work."));
      throw e;
    }
  };

  return (
    <>
      <div className={styles.header}>
        <Title2 as="h1">{s.name}</Title2>
        <SequenceStatusBadge status={s.status} />
        <Badge appearance="outline" color="informative">
          {s.current_version ? `Published v${s.current_version}` : "Not published"}
        </Badge>
        <span className={styles.grow} />
        {!readOnly && (
          <div className={styles.actions}>
            {s.status === "active" && (
              <Button icon={<Pause20Regular />} onClick={() => setConfirm("pause")}>
                Pause
              </Button>
            )}
            {s.status === "paused" && (
              <Button icon={<Play20Regular />} onClick={() => setConfirm("resume")}>
                Resume
              </Button>
            )}
            <Button icon={<Archive20Regular />} onClick={() => setConfirm("archive")}>
              Archive
            </Button>
            <Button icon={<Save20Regular />} disabled={save.isPending} onClick={() => saveDraft().catch(() => undefined)}>
              Save draft
            </Button>
            <Button
              appearance="primary"
              icon={<Rocket20Regular />}
              disabled={save.isPending || steps.length === 0}
              onClick={() => {
                setShowErrors(true);
                if (!invalid) setPublishing(true);
              }}
            >
              Publish
            </Button>
          </div>
        )}
      </div>
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as SeqTab)} aria-label="Sequence sections">
        <Tab value="steps">Steps</Tab>
        <Tab value="enrollments">Enrolments ({s.active_enrollments.toLocaleString()} active)</Tab>
        <Tab value="analytics">Analytics</Tab>
      </TabList>
      {tab === "steps" && (
        <div className={styles.layout}>
          {s.current_version > 0 && (
            <MessageBar intent="info">
              <MessageBarBody>
                You are editing draft v{s.draft_version}. Current enrolments stay on v{s.current_version} until they finish.
              </MessageBarBody>
            </MessageBar>
          )}
          <Card>
            <div className={styles.row}>
              <Field label="Name" required style={{ flex: "1 1 280px" }}>
                <Input value={name} maxLength={200} disabled={readOnly} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Re-enrol gap (days)" hint="Wait before the same person can enrol again.">
                <SpinButton
                  min={0}
                  max={365}
                  disabled={readOnly}
                  value={gap}
                  onChange={(_, d) => {
                    const n = d.value ?? Number(d.displayValue);
                    if (n !== null && Number.isFinite(n)) setGap(Math.min(365, Math.max(0, Math.round(n))));
                  }}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={description} maxLength={2000} disabled={readOnly} onChange={(_, d) => setDescription(d.value)} />
            </Field>
            <Field label="Exit when the candidate">
              <div className={styles.checks}>
                {EXIT_KEYS.map((k) => (
                  <Checkbox
                    key={k}
                    label={labelFor(EXIT_REASON_LABELS, k)}
                    checked={exitOn[k]}
                    disabled={readOnly}
                    onChange={(_, d) => setExitOn((e) => ({ ...e, [k]: !!d.checked }))}
                  />
                ))}
              </div>
            </Field>
          </Card>
          <StepEditor steps={steps} onChange={setSteps} options={options.data} readOnly={readOnly} showErrors={showErrors} />
        </div>
      )}
      {tab === "enrollments" && <EnrollmentsGrid sequenceId={s.id} canWrite={canWrite} />}
      {tab === "analytics" && <SequenceAnalytics sequence={s} />}

      {publishing && (
        <PublishDialog
          onClose={() => setPublishing(false)}
          onPublish={async (note) => {
            await save.mutateAsync();
            await act(() => sequencesApi.publish(s.id, note), "Sequence published.");
          }}
        />
      )}
      <ConfirmDialog open={confirm === "pause"} title="Pause this sequence?" confirmLabel="Pause" onClose={() => setConfirm(null)} onConfirm={() => act(() => sequencesApi.pause(s.id), "Sequence paused.")}>
        Enrolments stop advancing until you resume.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "resume"} title="Resume this sequence?" confirmLabel="Resume" onClose={() => setConfirm(null)} onConfirm={() => act(() => sequencesApi.resume(s.id), "Sequence resumed.")}>
        Due steps run on the next cycle.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "archive"} title="Archive this sequence?" confirmLabel="Archive" onClose={() => setConfirm(null)} onConfirm={() => act(() => sequencesApi.archive(s.id), "Sequence archived.")}>
        Active enrolments are exited and no one new can enrol.
      </ConfirmDialog>
    </>
  );
}

function PublishDialog({ onClose, onPublish }: { onClose: () => void; onPublish: (note: string | null) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Publish a new version</DialogTitle>
          <DialogContent>
            <Field label="Version note" hint="What changed? Shown in the version history.">
              <Textarea value={note} maxLength={500} onChange={(_, d) => setNote(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onPublish(note.trim() || null);
                  onClose();
                } catch {
                  // reported by a toast
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function EnrollmentsGrid({ sequenceId, canWrite }: { sequenceId: string; canWrite: boolean }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const enrollments = useQuery({
    queryKey: sequenceKeys.enrollments(sequenceId),
    queryFn: ({ signal }) => sequencesApi.enrollments(sequenceId, signal),
  });
  const run = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "exit" }) =>
      action === "pause" ? sequencesApi.pauseEnrollment(id) : action === "resume" ? sequencesApi.resumeEnrollment(id) : sequencesApi.exitEnrollment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sequenceKeys.all }),
    onError: (e) => toast.error(errorMessage(e, "That did not work.")),
  });
  const columns: TableColumnDefinition<EnrollmentOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Candidate",
      renderCell: (e) => <AppLink href={`/candidates/${e.candidate_id}`}>{e.candidate_name ?? "Candidate"}</AppLink>,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (e) => (
        <span className={admin.cellStack}>
          <Badge appearance="tint" color={ENROLLMENT_STATUS_COLORS[e.status] ?? "subtle"}>
            {e.status.replace(/_/g, " ")}
          </Badge>
          {e.exit_reason && (
            <Text size={200} className={admin.muted}>
              {labelFor(EXIT_REASON_LABELS, e.exit_reason)}
            </Text>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "step", renderHeaderCell: () => "Step", renderCell: (e) => `${e.position} (v${e.version})` }),
    createTableColumn({ columnId: "next", renderHeaderCell: () => "Next step at", renderCell: (e) => formatDateTime(e.next_run_at) }),
    createTableColumn({ columnId: "started", renderHeaderCell: () => "Started", renderCell: (e) => formatDateTime(e.started_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (e) =>
        canWrite && (e.status === "active" || e.status === "paused") ? (
          <RowActions
            label={e.candidate_name ?? "candidate"}
            actions={[
              e.status === "active"
                ? { label: "Pause", onClick: () => run.mutate({ id: e.id, action: "pause" }) }
                : { label: "Resume", onClick: () => run.mutate({ id: e.id, action: "resume" }) },
              { label: "Exit", onClick: () => run.mutate({ id: e.id, action: "exit" }) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <AdminGrid
      items={enrollments.data}
      columns={columns}
      getRowId={(e) => e.id}
      loading={enrollments.isPending}
      error={enrollments.error}
      emptyText="No one is enrolled yet. Enrol candidates from an audience or a talent pool."
      label="Enrolments"
    />
  );
}

function SequenceAnalytics({ sequence }: { sequence: SequenceOut }) {
  const styles = useStyles();
  const analytics = useQuery({
    queryKey: sequenceKeys.analytics(sequence.id),
    queryFn: ({ signal }) => sequencesApi.analytics(sequence.id, signal),
  });
  if (analytics.isPending) return <GridSkeleton rows={6} />;
  if (analytics.isError) return <ErrorBar title="Could not load analytics." message={errorMessage(analytics.error)} />;
  const f = analytics.data;
  const published = stepsFromServer(sequence.published_steps);
  return (
    <div className={styles.layout}>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Overall</Subtitle2>} />
        <FunnelChart counts={f.counts} rates={f.rates} label="Sequence funnel" />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">By step</Subtitle2>} />
        {f.steps.length === 0 ? (
          <Text className={styles.muted}>No step results yet.</Text>
        ) : (
          <div className={styles.stepStats}>
            {f.steps.map((st, i) => {
              const draft = published[Number(st.key) - 1];
              return (
                <section key={st.key} aria-label={st.label}>
                  <Text weight="semibold">
                    {st.label || `Step ${i + 1}`}
                    {draft ? ` · ${stepSummary(draft)}` : ""}
                  </Text>
                  <Text as="p" size={200} className={styles.muted}>
                    Sent {st.counts.sent.toLocaleString()} · open {formatRate(st.rates.open_rate)} · click {formatRate(st.rates.click_rate)} · reply{" "}
                    {formatRate(st.rates.reply_rate)}
                  </Text>
                  <FunnelChart counts={st.counts} rates={st.rates} label={`${st.label} funnel`} opensApproximate={false} />
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
