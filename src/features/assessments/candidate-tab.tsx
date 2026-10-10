"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  Link,
  makeStyles,
  ProgressBar,
  SpinButton,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { Add16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { InviteToAssessmentButton } from "./invite-dialog";
import { canCancel, canDecide, canExtend, canRecordManual, endOfDayIso, formatDate, isDecimal, pctLabel, pctValue, signalLabel } from "./logic";
import { ScoreHiddenBadge } from "@/features/fairness/score-hidden";
import type { InvitationOut } from "./types";
import { DialogShell, InvitationStatusBadge, useAction, useAsmStyles } from "./ui";
import { assessmentKeys, useAssessmentPermissions, useCandidateResults, useSignals } from "./use-assessments";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, paddingBlock: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalS },
  facts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXXL },
  fact: { display: "flex", flexDirection: "column" },
  big: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  bars: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: tokens.spacingHorizontalXL },
  bar: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  barLabel: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  timeline: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  skillRow: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
});

/** Candidate 360 "Assessments" tab: invitations with results, signals, report and actions. */
export function CandidateAssessmentsTab({ candidateId, candidateName }: { candidateId: string; candidateName?: string | null }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const { canRead } = useAssessmentPermissions();
  const list = useCandidateResults(candidateId, canRead);
  if (!canRead) return <Body1>You do not have access to assessments.</Body1>;
  return (
    <div className={styles.root}>
      <div className={asm.rowCenter}>
        <InviteToAssessmentButton context={{ kind: "direct", candidateId, candidateName }} />
      </div>
      {list.isPending ? (
        <GridSkeleton rows={3} />
      ) : list.isError ? (
        <ErrorBar title="Could not load assessment results." message={errorMessage(list.error)} />
      ) : list.data.length === 0 ? (
        <Body1 className={asm.muted}>No assessments yet.</Body1>
      ) : (
        [...list.data].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((inv) => <InvitationCard key={inv.id} inv={inv} candidateId={candidateId} />)
      )}
    </div>
  );
}

function InvitationCard({ inv, candidateId }: { inv: InvitationOut; candidateId: string }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const permissions = usePermissions();
  const { canInvite, canReview, canAuthor } = useAssessmentPermissions();
  const [dialog, setDialog] = useState<"extend" | "cancel" | "pass" | "fail" | "manual" | "signals" | null>(null);
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: assessmentKeys.candidateResults(candidateId) });
  const sections = Object.entries(inv.section_scores ?? {});
  const skills = Object.entries(inv.skill_scores ?? {});
  const signalTotal = Object.values(inv.signal_counts ?? {}).reduce((a, b) => a + b, 0);
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h3">{inv.assessment_name}</Subtitle2>}
        description={
          <span className={asm.rowCenter}>
            <InvitationStatusBadge status={inv.status} />
            {inv.gating && (
              <Badge appearance="outline" color="important">
                Gating
              </Badge>
            )}
            <Caption1 className={asm.muted}>
              Invited {formatDate(inv.created_at)}
              {inv.deadline_at ? ` · deadline ${formatDateTime(inv.deadline_at)}` : ""}
              {inv.extended_count ? ` · extended ${inv.extended_count}×` : ""}
              {Number(inv.accommodation_factor) > 1 ? ` · ×${inv.accommodation_factor} time` : ""}
            </Caption1>
          </span>
        }
      />
      <div className={styles.facts}>
        <div className={styles.fact}>
          <Caption1 className={asm.muted}>Score</Caption1>
          {inv.score_hidden_reason ? <ScoreHiddenBadge reason={inv.score_hidden_reason} /> : <Text className={styles.big}>{pctLabel(inv.score)}</Text>}
          {inv.points != null && inv.max_points != null && (
            <Caption1>
              {inv.points} / {inv.max_points} points
            </Caption1>
          )}
        </div>
        <div className={styles.fact}>
          <Caption1 className={asm.muted}>Percentile</Caption1>
          <Text className={styles.big}>{inv.percentile != null ? `P${Math.round(Number(inv.percentile))}` : "—"}</Text>
        </div>
        {inv.result && (
          <div className={styles.fact}>
            <Caption1 className={asm.muted}>Result</Caption1>
            <Text className={styles.big}>{inv.result === "pass" ? "Pass" : inv.result === "fail" ? "Fail" : inv.result}</Text>
            {inv.decided_at && <Caption1>{formatDateTime(inv.decided_at)}</Caption1>}
          </div>
        )}
        {inv.pending_reviews > 0 && (
          <div className={styles.fact}>
            <Caption1 className={asm.muted}>Waiting for review</Caption1>
            <AppLink href="/assessments/reviews">{inv.pending_reviews} answer{inv.pending_reviews === 1 ? "" : "s"}</AppLink>
          </div>
        )}
      </div>
      {sections.length > 0 && (
        <>
          <Text weight="semibold">Sections</Text>
          <div className={styles.bars}>
            {sections.map(([key, s]) => (
              <ScoreBar key={key} label={s.title || key} pct={s.pct} detail={`${s.points} / ${s.max_points}`} />
            ))}
          </div>
        </>
      )}
      {skills.length > 0 && (
        <>
          <Text weight="semibold">Skills</Text>
          <div className={styles.bars}>
            {skills.map(([key, s]) => (
              <ScoreBar key={key} label={key} pct={s.pct} detail={s.label ?? (s.proficiency != null ? `Proficiency ${s.proficiency}/5` : undefined)} />
            ))}
          </div>
        </>
      )}
      {inv.decision_note && <Body1>Decision note: {inv.decision_note}</Body1>}
      {inv.cancel_reason && <Body1>Cancelled: {inv.cancel_reason}</Body1>}
      <div className={styles.actions}>
        {inv.attempt_id && (
          <Button size="small" appearance={signalTotal ? "secondary" : "subtle"} onClick={() => setDialog("signals")}>
            Signals: {signalTotal ? Object.entries(inv.signal_counts).filter(([, n]) => n > 0).map(([k, n]) => `${signalLabel(k)} ${n}`).join(" · ") : "none"}
          </Button>
        )}
        {inv.report_url && (
          <Link href={inv.report_url} target="_blank" rel="noopener noreferrer">
            Open report
          </Link>
        )}
        {canInvite && canExtend(inv) && (
          <Button size="small" onClick={() => setDialog("extend")}>
            Extend deadline
          </Button>
        )}
        {canInvite && canCancel(inv) && (
          <Button size="small" appearance="subtle" onClick={() => setDialog("cancel")}>
            Cancel invitation
          </Button>
        )}
        {(canReview || canAuthor) && canRecordManual(inv) && (
          <Button size="small" onClick={() => setDialog("manual")}>
            Record result
          </Button>
        )}
        {canDecide(inv, permissions) && (
          <>
            <Button size="small" appearance="primary" onClick={() => setDialog("pass")}>
              ★ Pass
            </Button>
            <Button size="small" onClick={() => setDialog("fail")}>
              ★ Fail
            </Button>
          </>
        )}
      </div>
      {dialog === "extend" && <ExtendDialog inv={inv} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "cancel" && <CancelDialog inv={inv} onClose={() => setDialog(null)} onDone={refresh} />}
      {(dialog === "pass" || dialog === "fail") && <DecideDialog inv={inv} result={dialog} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "manual" && <ManualResultDialog inv={inv} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "signals" && inv.attempt_id && <SignalsDialog attemptId={inv.attempt_id} canAnnotate={canReview} onClose={() => setDialog(null)} />}
    </Card>
  );
}

function ScoreBar({ label, pct, detail }: { label: string; pct: string; detail?: string | null }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  return (
    <div className={styles.bar}>
      <div className={styles.barLabel}>
        <Text>{label}</Text>
        <Text weight="semibold">{pctLabel(pct)}</Text>
      </div>
      <ProgressBar value={pctValue(pct)} thickness="large" aria-label={`${label}: ${pctLabel(pct)}`} />
      {detail && <Caption1 className={asm.muted}>{detail}</Caption1>}
    </div>
  );
}

function ExtendDialog({ inv, onClose, onDone }: { inv: InvitationOut; onClose: () => void; onDone: () => void }) {
  const asm = useAsmStyles();
  const [date, setDate] = useState<Date | null>(null);
  const { error, busy, run } = useAction(onDone, onClose);
  return (
    <DialogShell
      title="Extend the deadline"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || !date} onClick={() => date && void run(() => assessmentsApi.extend(inv.id, endOfDayIso(date)))}>
            Extend
          </Button>
        </>
      }
    >
      <div className={asm.stack}>
        <Body1>Current deadline: {formatDateTime(inv.deadline_at)}</Body1>
        <Field label="New deadline" required hint="End of the chosen day.">
          <DatePicker value={date} minDate={new Date()} allowTextInput onSelectDate={(d) => setDate(d ?? null)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

function CancelDialog({ inv, onClose, onDone }: { inv: InvitationOut; onClose: () => void; onDone: () => void }) {
  const asm = useAsmStyles();
  const [reason, setReason] = useState("");
  const { error, busy, run } = useAction(onDone, onClose);
  return (
    <DialogShell
      title="Cancel this invitation?"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button appearance="primary" disabled={busy || !reason.trim()} onClick={() => void run(() => assessmentsApi.cancel(inv.id, reason.trim()))}>
            Cancel invitation
          </Button>
        </>
      }
    >
      <div className={asm.stack}>
        <Body1>The candidate&apos;s link stops working. An attempt in progress is closed without a score.</Body1>
        <Field label="Reason" required>
          <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

/** ★ Human Pass/Fail decision. */
function DecideDialog({ inv, result, onClose, onDone }: { inv: InvitationOut; result: "pass" | "fail"; onClose: () => void; onDone: () => void }) {
  const asm = useAsmStyles();
  const [note, setNote] = useState("");
  const { error, busy, run } = useAction(onDone, onClose);
  return (
    <DialogShell
      title={result === "pass" ? "★ Mark as passed" : "★ Mark as failed"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy} onClick={() => void run(() => assessmentsApi.decide(inv.id, result, note.trim() || null))}>
            {result === "pass" ? "Pass" : "Fail"}
          </Button>
        </>
      }
    >
      <div className={asm.stack}>
        <Body1>
          {inv.candidate_name ?? "The candidate"} scored {pctLabel(inv.score)} on {inv.assessment_name}. This decision is recorded under your name.
        </Body1>
        <Field label="Note (optional)">
          <Textarea value={note} maxLength={2000} onChange={(_, d) => setNote(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

function ManualResultDialog({ inv, onClose, onDone }: { inv: InvitationOut; onClose: () => void; onDone: () => void }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [skills, setSkills] = useState<{ skill_key: string; proficiency: number }[]>([]);
  const { error, busy, run } = useAction(onDone, onClose);
  const valid = isDecimal(score) && Number(score) >= 0 && Number(score) <= 100 && skills.every((s) => s.skill_key.trim());
  return (
    <DialogShell
      title="Record result"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy || !valid}
            onClick={() =>
              void run(() =>
                assessmentsApi.manualResult(inv.id, {
                  score_pct: score.trim(),
                  result_note: note.trim() || null,
                  report_file_id: null,
                  skill_scores: skills.map((s) => ({ skill_key: s.skill_key.trim(), proficiency: s.proficiency })),
                }),
              )
            }
          >
            Save result
          </Button>
        </>
      }
    >
      <div className={asm.stack}>
        <Body1>For provider or offline tests whose result is not imported automatically.</Body1>
        <Field label="Score (%)" required>
          <Input value={score} inputMode="decimal" onChange={(_, d) => setScore(d.value)} />
        </Field>
        <Field label="Skill proficiency (1–5)">
          <div className={asm.stack}>
            {skills.map((s, i) => (
              <div key={i} className={styles.skillRow}>
                <Input aria-label={`Skill ${i + 1}`} placeholder="skill key" value={s.skill_key} onChange={(_, d) => setSkills((l) => l.map((x, j) => (j === i ? { ...x, skill_key: d.value } : x)))} />
                <SpinButton
                  aria-label={`Skill ${i + 1} proficiency`}
                  className={asm.narrow}
                  value={s.proficiency}
                  min={1}
                  max={5}
                  onChange={(_, d) => {
                    const v = d.value ?? Number(d.displayValue);
                    if (Number.isFinite(v)) setSkills((l) => l.map((x, j) => (j === i ? { ...x, proficiency: Math.min(5, Math.max(1, Math.round(Number(v)))) } : x)));
                  }}
                />
                <Button appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove skill ${i + 1}`} onClick={() => setSkills((l) => l.filter((_, j) => j !== i))} />
              </div>
            ))}
            <div>
              <Button size="small" icon={<Add16Regular />} onClick={() => setSkills((l) => [...l, { skill_key: "", proficiency: 3 }])}>
                Add skill
              </Button>
            </div>
          </div>
        </Field>
        <Field label="Note">
          <Textarea value={note} maxLength={2000} onChange={(_, d) => setNote(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

/** Proctoring signals: counts, the timeline and annotations (advisory only; signals never change a score). */
export function SignalsDialog({ attemptId, canAnnotate, onClose }: { attemptId: string; canAnnotate: boolean; onClose: () => void }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useSignals(attemptId);
  const [note, setNote] = useState("");
  const [signalId, setSignalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const annotate = async () => {
    setBusy(true);
    try {
      await assessmentsApi.annotate(attemptId, note.trim(), signalId);
      setNote("");
      setSignalId(null);
      void qc.invalidateQueries({ queryKey: assessmentKeys.signals(attemptId) });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title="Proctoring signals"
      onClose={onClose}
      wide
      actions={
        <Button appearance="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {q.isPending ? (
        <GridSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : (
        <div className={asm.stack}>
          <Caption1 className={asm.muted}>Signals are advisory. They never block the candidate or change the score.</Caption1>
          <div className={asm.rowCenter}>
            {Object.entries(q.data.counts).map(([k, n]) => (
              <Badge key={k} appearance="tint" color={n ? "warning" : "subtle"}>
                {signalLabel(k)}: {n}
              </Badge>
            ))}
            {q.data.dropped > 0 && <Badge appearance="tint">{q.data.dropped} dropped (rate limit)</Badge>}
          </div>
          <ol className={styles.timeline} aria-label="Signal timeline">
            {q.data.timeline.map((s) => {
              const notes = q.data.annotations.filter((a) => a.signal_id === s.id);
              return (
                <li key={s.id}>
                  <Text weight="semibold">{signalLabel(s.kind)}</Text> <Caption1 className={asm.muted}>{formatDateTime(s.occurred_at)}</Caption1>
                  {canAnnotate && (
                    <Button size="small" appearance="transparent" onClick={() => setSignalId(s.id)} aria-pressed={signalId === s.id}>
                      {signalId === s.id ? "Annotating" : "Annotate"}
                    </Button>
                  )}
                  {notes.map((a) => (
                    <Body1 key={a.id} block>
                      “{a.note}” <Caption1 className={asm.muted}>{formatDateTime(a.created_at)}</Caption1>
                    </Body1>
                  ))}
                </li>
              );
            })}
            {q.data.timeline.length === 0 && <li>No signals were recorded.</li>}
          </ol>
          {q.data.annotations.filter((a) => !a.signal_id).map((a) => (
            <Body1 key={a.id}>
              Note: “{a.note}” <Caption1 className={asm.muted}>{formatDateTime(a.created_at)}</Caption1>
            </Body1>
          ))}
          {canAnnotate && (
            <Field label={signalId ? "Annotation for the selected signal" : "Annotation for the attempt"}>
              <div className={asm.stack}>
                <Textarea value={note} maxLength={2000} onChange={(_, d) => setNote(d.value)} />
                <div className={asm.rowCenter}>
                  <Button disabled={busy || !note.trim()} onClick={() => void annotate()}>
                    Add annotation
                  </Button>
                  {signalId && (
                    <Button appearance="subtle" onClick={() => setSignalId(null)}>
                      Annotate the whole attempt instead
                    </Button>
                  )}
                </div>
              </div>
            </Field>
          )}
        </div>
      )}
    </DialogShell>
  );
}
