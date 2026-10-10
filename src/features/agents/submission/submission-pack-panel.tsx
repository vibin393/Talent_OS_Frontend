"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useDemand } from "@/features/demands/use-demand";
import type { ApplicationPanelProps } from "@/features/pipeline/application-panels";
import { useApplication } from "@/features/pipeline/use-pipeline";
import { SubmitWizard } from "@/features/submissions/submit-wizard";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { ApplicationOut } from "@/lib/api/types";
import { submissionPackKeys, submissionPacksApi } from "./api";
import {
  AGENT_NAME,
  checkLabel,
  countWords,
  LEVEL_LABELS,
  marginText,
  money,
  orderedChecks,
  packBadge,
  prepareMode,
  resumeLine,
  usedLine,
  wordCounter,
} from "./logic";
import type { PackDetailOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  writeUp: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  rates: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: tokens.spacingHorizontalM },
  checks: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  check: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: tokens.spacingHorizontalS },
  checkText: { display: "flex", flexDirection: "column", flex: "1 1 200px", minWidth: 0 },
  footer: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  grow: { flex: 1 },
});

/** Application drawer panel "Submission pack" (Epic 61, registered as `agent_submission`, Submissions tab). */
export function SubmissionPackPanel({ applicationId, demandId }: ApplicationPanelProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canDraft = usePermission("submission:draft");
  const pack = useQuery({
    queryKey: submissionPackKeys.forApplication(applicationId),
    queryFn: async ({ signal }) => {
      try {
        return await submissionPacksApi.forApplication(applicationId, signal);
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null;
        throw e;
      }
    },
  });
  const status = useQuery({ queryKey: submissionPackKeys.status, queryFn: ({ signal }) => submissionPacksApi.agentStatus(signal), staleTime: 60_000 });
  const mode = prepareMode(status.data);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: submissionPackKeys.forApplication(applicationId) });

  const startAgent = useMutation({
    mutationFn: () => submissionPacksApi.startAgent(applicationId),
    onSuccess: async (ref) => {
      if (ref.run_id) toast.success("The Submission Agent is preparing the pack.");
      else toast.error(`The Submission Agent did not start (${(ref.reason ?? "unavailable").replace(/_/g, " ")}).`);
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const manual = useMutation({
    mutationFn: () => submissionPacksApi.prepareWithoutAi(applicationId),
    onSuccess: async () => {
      toast.success("Submission pack prepared.");
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const prepareButton = (label = "Prepare submission") =>
    mode === "paused" ? (
      <Tooltip content="Agents paused by your administrator" relationship="description">
        <Button appearance="primary" disabled>
          {label}
        </Button>
      </Tooltip>
    ) : mode === "agent" ? (
      <Button appearance="primary" disabled={!canDraft || startAgent.isPending} onClick={() => startAgent.mutate()}>
        {label}
      </Button>
    ) : (
      <>
        <Tooltip content="Submission Agent is off. Ask your AI administrator." relationship="description">
          <Button appearance="primary" disabled>
            {label}
          </Button>
        </Tooltip>
        <Button disabled={!canDraft || manual.isPending} onClick={() => manual.mutate()}>
          Prepare without AI
        </Button>
      </>
    );

  return (
    <Card className={styles.root} aria-labelledby="submission-pack-title">
      <div className={styles.head}>
        <Subtitle2 as="h3" id="submission-pack-title">
          Submission pack
        </Subtitle2>
        <AiBadge agentName={AGENT_NAME} mode={pack.data?.prepared_by_kind === "agent" ? "auto" : null} />
        {pack.data && <Badge appearance="tint" color={packBadge(pack.data).color}>{packBadge(pack.data).label}</Badge>}
        {(startAgent.isPending || manual.isPending) && <Spinner size="tiny" aria-label="Preparing" />}
      </div>
      {pack.isPending ? (
        <GridSkeleton rows={4} />
      ) : pack.isError ? (
        <ErrorBar title="Could not load the submission pack." message={errorMessage(pack.error)} />
      ) : !pack.data ? (
        <>
          <Body1 className={styles.muted}>No submission pack yet.</Body1>
          <div className={styles.footer}>{prepareButton()}</div>
        </>
      ) : (
        <PackBody key={`${pack.data.id}:${pack.data.lock_version}`} pack={pack.data} demandId={demandId} onChanged={invalidate} prepareButton={prepareButton} />
      )}
    </Card>
  );
}

function PackBody({
  pack,
  demandId,
  onChanged,
  prepareButton,
}: {
  pack: PackDetailOut;
  demandId: string;
  onChanged: () => Promise<unknown>;
  prepareButton: (label?: string) => React.ReactNode;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const canSubmit = usePermission("submission:create");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(pack.summary_text ?? "");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const open = pack.lifecycle === "open";

  const save = useMutation({
    mutationFn: () => submissionPacksApi.patch(pack.id, { summary_text: text, lock_version: pack.lock_version }),
    onSuccess: async () => {
      toast.success("Write-up saved.");
      setEditing(false);
      await onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const refresh = useMutation({
    mutationFn: () => submissionPacksApi.refreshChecks(pack.application_id),
    onSuccess: async () => {
      toast.success("Checks refreshed.");
      await onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const discard = useMutation({
    mutationFn: () => submissionPacksApi.discard(pack.id),
    onSuccess: async () => {
      toast.success("Submission pack discarded.");
      await onChanged();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      {pack.lifecycle === "used" && (
        <MessageBar intent="success" layout="multiline">
          <MessageBarBody>{usedLine(pack)}</MessageBarBody>
        </MessageBar>
      )}
      {pack.write_up_status === "failed" && open && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>The agent could not write the summary. The checks below are complete; add the write-up yourself.</MessageBarBody>
        </MessageBar>
      )}
      <section className={styles.section} aria-label="Resume">
        <Subtitle2 as="h4">Resume</Subtitle2>
        <div className={styles.row}>
          <Text>{resumeLine(pack)}</Text>
          {pack.resume_id && <AppLink href={`/candidates/${pack.candidate_id}?tab=resume`}>Preview</AppLink>}
        </div>
      </section>
      <section className={styles.section} aria-label="Write-up">
        <div className={styles.row}>
          <Subtitle2 as="h4">Write-up</Subtitle2>
          <span className={styles.grow} />
          <Caption1 className={styles.muted}>{wordCounter(editing ? countWords(text) : pack.word_count, pack.max_words)}</Caption1>
          {open && canSubmit && !editing && (
            <Button appearance="subtle" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
        {editing ? (
          <>
            <Field label="Write-up" validationMessage={countWords(text) > pack.max_words ? `At most ${pack.max_words} words.` : undefined}>
              <Textarea value={text} onChange={(_, d) => setText(d.value)} resize="vertical" rows={6} maxLength={3000} />
            </Field>
            <div className={styles.row}>
              <Button appearance="primary" disabled={save.isPending || !text.trim() || countWords(text) > pack.max_words} onClick={() => save.mutate()}>
                Save
              </Button>
              <Button onClick={() => { setEditing(false); setText(pack.summary_text ?? ""); }}>Cancel</Button>
            </div>
          </>
        ) : (
          <Body1 className={pack.summary_text ? styles.writeUp : styles.muted}>{pack.summary_text || "No write-up yet."}</Body1>
        )}
      </section>
      <section className={styles.section} aria-label="Rates">
        <Subtitle2 as="h4">Rates</Subtitle2>
        <div className={styles.rates}>
          <Field label="Pay rate">
            <Text>{money(pack.pay_rate, pack.currency, pack.pay_rate_unit, pack.rates_hidden)}</Text>
          </Field>
          <Field label="Bill rate">
            <Text>{money(pack.bill_rate, pack.currency, pack.bill_rate_unit, pack.rates_hidden)}</Text>
          </Field>
          <Field label="Margin">
            <Text>{marginText(pack)}</Text>
          </Field>
        </div>
      </section>
      <section className={styles.section} aria-label="Checks">
        <Subtitle2 as="h4">Checks</Subtitle2>
        <ul className={styles.checks}>
          {orderedChecks(pack.checks).map((c) => (
            <li key={c.key} className={styles.check}>
              <Badge appearance="tint" color={LEVEL_LABELS[c.level].color}>
                {LEVEL_LABELS[c.level].label}
              </Badge>
              <span className={styles.checkText}>
                <Text weight="semibold">{checkLabel(c.key, pack.client_name)}</Text>
                <Caption1>{c.message}</Caption1>
              </span>
              {c.link?.path && <AppLink href={c.link.path}>Open</AppLink>}
            </li>
          ))}
        </ul>
      </section>
      {open && (
        <div className={styles.footer}>
          <Tooltip content={canSubmit ? "Open the Submission dialog pre-filled from this pack" : "You can view this pack. A recruiter sends it."} relationship="description">
            <Button appearance="primary" disabled={!canSubmit} onClick={() => setWizardOpen(true)}>
              Review and send
            </Button>
          </Tooltip>
          <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            Refresh checks
          </Button>
          {canSubmit && (
            <Button appearance="subtle" onClick={() => setConfirmDiscard(true)}>
              Discard pack
            </Button>
          )}
          <span className={styles.grow} />
          {pack.agent_run_id && <AppLink href={`/ai/runs/${pack.agent_run_id}`}>View agent run</AppLink>}
        </div>
      )}
      {!open && pack.lifecycle !== "used" && <div className={styles.footer}>{prepareButton()}</div>}
      {!canSubmit && open && <Caption1 className={styles.muted}>You can view this pack. A recruiter sends it.</Caption1>}
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard pack"
        confirmLabel="Discard pack"
        onConfirm={() => discard.mutateAsync()}
        onClose={() => setConfirmDiscard(false)}
      >
        Discard this pack? The agent will not prepare a new one unless you ask.
      </ConfirmDialog>
      {wizardOpen && <PackWizard pack={pack} demandId={demandId} onClose={() => { setWizardOpen(false); void onChanged(); }} />}
    </>
  );
}

/** Loads the demand and application, then opens the P1 Submission dialog pre-filled from the pack (B2). */
function PackWizard({ pack, demandId, onClose }: { pack: PackDetailOut; demandId: string; onClose: () => void }) {
  const demand = useDemand(demandId);
  const app = useApplication(pack.application_id);
  if (demand.isError || app.isError) return <ErrorBar title="Could not open the Submission dialog." message={errorMessage(demand.error ?? app.error)} />;
  if (!demand.data || !app.data) return <Spinner size="tiny" aria-label="Opening the Submission dialog" />;
  return <SubmitWizard demand={demand.data} apps={[app.data as unknown as ApplicationOut]} initialPack={pack} onClose={onClose} />;
}
