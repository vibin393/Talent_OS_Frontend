"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Subtitle2,
  Text,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, Document20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import type { RunOut, ToolCallOut } from "@/lib/api/agentic-types";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { RunDetailOut, RunPayloadOut } from "@/lib/api/governance-types";
import { governanceApi, governanceKeys } from "./api";
import { ConsoleShell } from "./console-shell";
import {
  copilotPrivacy,
  formatMicrosUsd,
  formatTokens,
  humanize,
  label,
  MODE_LABELS,
  OUTCOME_COLORS,
  OUTCOME_LABELS,
  reasonError,
  RISK_COLORS,
  RISK_LABELS,
  RUN_POLL_MS,
  RUN_STATUS_COLORS,
  runStatusLabel,
  shouldPollRun,
  stepTitle,
  subjectHref,
  toolCallsOfStep,
} from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  links: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "center" },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalM,
    margin: 0,
    listStyle: "none",
  },
  facts: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, rowGap: tokens.spacingVerticalXS },
  call: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingTop: tokens.spacingVerticalS,
  },
  callHead: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: "420px",
    overflowY: "auto",
    margin: 0,
  },
  events: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

type ViewRun = RunDetailOut & { limited: boolean };

/** Foundation `RunOut` (owner view) as the console shape, without cost and timeline. */
function fromFoundation(run: RunOut): ViewRun {
  return {
    ...run,
    cost_usd: "",
    payload_available: run.origin !== "copilot",
    copilot_private: run.origin === "copilot",
    timeline: [],
    steps: run.steps.map((s) => ({ ...s, model_tier: null, cache_read_tokens: null, cost_micros: null })),
    limited: true,
  };
}

async function loadRun(id: string, signal: AbortSignal): Promise<ViewRun> {
  try {
    return { ...(await governanceApi.run(id, signal)), limited: false };
  } catch (e) {
    // A run owner without `ai:govern` can still view the run through the foundation read.
    if (isApiError(e) && e.status === 403) return fromFoundation(await governanceApi.foundationRun(id, signal));
    throw e;
  }
}

function pretty(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/** `/admin/ai/runs/[id]`: run header, step timeline with tool calls, and the reason-gated payload view. */
export function RunDetail({ runId }: { runId: string }) {
  return (
    <ConsoleShell permission="ai:govern" anyOf={["proposal:decide", "copilot:use", "ai:agent_configure"]}>
      <RunDetailBody runId={runId} />
    </ConsoleShell>
  );
}

function RunDetailBody({ runId }: { runId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const { data: me } = useMe();
  const govern = usePermission("ai:govern");
  const payloadRead = usePermission("ai:payload_read");
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const run = useQuery({
    queryKey: governanceKeys.run(runId),
    queryFn: ({ signal }) => loadRun(runId, signal),
    refetchInterval: (q) => (shouldPollRun(q.state.data?.status) ? RUN_POLL_MS : false),
    retry: (count, error) => count < 1 && !(isApiError(error) && (error.status === 403 || error.status === 404)),
  });

  if (run.isPending) return <GridSkeleton rows={4} />;
  if (run.isError) {
    const notFound = isApiError(run.error) && (run.error.status === 404 || run.error.status === 403);
    return <ErrorBar title="Could not load this run." message={notFound ? "This run does not exist or you cannot view it." : errorMessage(run.error)} />;
  }
  const r = run.data;
  const privacy = copilotPrivacy(r);
  const subject = subjectHref(r.subject_type, r.subject_id);
  const canCancel = shouldPollRun(r.status) && (govern || (!!me && me.user.id === r.owner_user_id));

  return (
    <div className={styles.root}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => router.push("/admin/ai/runs")}>
          Runs
        </Button>
      </div>
      <div className={styles.header}>
        <Subtitle1 as="h2">{r.agent_name}</Subtitle1>
        <AiBadge agentName={r.agent_name} ownerName={r.actor_label} />
        <Badge appearance="tint" color={RUN_STATUS_COLORS[r.status] ?? "subtle"}>
          {runStatusLabel(r.status)}
        </Badge>
        {r.reason_code && <Text className={styles.muted}>{humanize(r.reason_code)}</Text>}
        {shouldPollRun(r.status) && <Spinner size="extra-tiny" aria-label="Updating" />}
      </div>
      <div className={styles.links}>
        {subject && <AppLink href={subject}>Open subject</AppLink>}
        {r.fallback_task_id && <AppLink href={`/tasks?id=${r.fallback_task_id}`}>Fallback task</AppLink>}
        <Text className={styles.muted}>
          Started {formatDateTime(r.started_at ?? r.created_at)} · {formatTokens(r.input_tokens + r.output_tokens)} tokens
          {r.cost_usd ? ` · ${formatMicrosUsd(r.cost_micros)}` : ""}
        </Text>
        {privacy.payloadDisabled ? (
          <Tooltip content={privacy.note ?? "No stored payload for this run."} relationship="description">
            <Button icon={<Document20Regular />} disabledFocusable>
              View full payload
            </Button>
          </Tooltip>
        ) : (
          payloadRead && (
            <Button icon={<Document20Regular />} onClick={() => setPayloadOpen(true)}>
              View full payload
            </Button>
          )
        )}
        {canCancel && <Button onClick={() => setCancelOpen(true)}>Cancel run</Button>}
      </div>
      {privacy.note && (
        <MessageBar intent="info">
          <MessageBarBody>{privacy.note}</MessageBarBody>
        </MessageBar>
      )}
      {r.limited && (
        <MessageBar intent="info">
          <MessageBarBody>You are viewing this run as its owner. Costs and the event timeline are shown to AI governance only.</MessageBarBody>
        </MessageBar>
      )}
      {r.timeline.length > 0 && (
        <div>
          <Subtitle2 as="h3">Events</Subtitle2>
          <ul className={styles.events}>
            {r.timeline
              .filter((t) => t.kind === "status" || t.kind === "proposal" || t.kind === "decision")
              .map((t, i) => (
                <li key={`${t.at}-${i}`}>
                  <Caption1>
                    {formatDateTime(t.at)} · {t.label}
                  </Caption1>
                </li>
              ))}
          </ul>
        </div>
      )}
      <Subtitle2 as="h3">Steps</Subtitle2>
      {r.steps.length === 0 ? (
        <Body1 className={styles.muted}>No steps yet.</Body1>
      ) : (
        <ol className={styles.timeline} aria-label="Run steps">
          {r.steps.map((s) => (
            <li key={s.step_no}>
              <Card>
                <CardHeader header={<Subtitle2 as="h4">{stepTitle(s.step_no)}</Subtitle2>} />
                <div className={styles.facts}>
                  <Text>Model tier: {s.model_tier ? humanize(s.model_tier) : "—"}</Text>
                  <Text>Stop reason: {s.stop_reason ? humanize(s.stop_reason) : "—"}</Text>
                  <Text>
                    Tokens in / out / cached: {formatTokens(s.input_tokens)} / {formatTokens(s.output_tokens)} / {formatTokens(s.cache_read_tokens)}
                  </Text>
                  <Text>Cost: {formatMicrosUsd(s.cost_micros)}</Text>
                  <Text>Latency: {s.latency_ms !== null ? `${s.latency_ms.toLocaleString()} ms` : "—"}</Text>
                  {s.ai_action_id && <AppLink href={`/admin/ai/log?id=${s.ai_action_id}`}>AI action</AppLink>}
                </div>
                {toolCallsOfStep(r.tool_calls, s.step_no).map((c) => (
                  <ToolCallRowView key={c.id} call={c} hideArgs={privacy.hideArgs} note={privacy.note} proposals={r.proposals} />
                ))}
              </Card>
            </li>
          ))}
        </ol>
      )}
      {payloadOpen && <PayloadDialog runId={r.id} onClose={() => setPayloadOpen(false)} />}
      {cancelOpen && <CancelDialog runId={r.id} onClose={() => setCancelOpen(false)} />}
    </div>
  );
}

function ToolCallRowView({
  call,
  hideArgs,
  note,
  proposals,
}: {
  call: ToolCallOut;
  hideArgs: boolean;
  note: string | null;
  proposals: RunOut["proposals"];
}) {
  const styles = useStyles();
  const target = subjectHref(call.target_type, call.target_id);
  const proposal = proposals.find((p) => p.id === call.proposal_id);
  return (
    <div className={styles.call}>
      <div className={styles.callHead}>
        <Text weight="semibold">{call.tool_key}</Text>
        <Badge appearance="tint" color={RISK_COLORS[call.risk] ?? "subtle"}>
          {label(RISK_LABELS, call.risk)}
        </Badge>
        <Tooltip content={call.mode_reason || "—"} relationship="description">
          <Text tabIndex={0}>Mode: {label(MODE_LABELS, call.mode)}</Text>
        </Tooltip>
        <Badge appearance="filled" color={OUTCOME_COLORS[call.outcome] ?? "subtle"}>
          {label(OUTCOME_LABELS, call.outcome)}
        </Badge>
        {call.error_code && <Caption1 className={styles.muted}>{call.error_code}</Caption1>}
        {target && <AppLink href={target}>{humanize(call.target_type ?? "")}</AppLink>}
        {call.proposal_id && <AppLink href={`/proposals?id=${call.proposal_id}`}>{proposal?.human_id ?? "Proposal"}</AppLink>}
      </div>
      {hideArgs ? (
        <Caption1 className={styles.muted}>{note}</Caption1>
      ) : (
        <Accordion collapsible multiple>
          <AccordionItem value="args">
            <AccordionHeader size="small">Arguments (redacted)</AccordionHeader>
            <AccordionPanel>
              <pre className={styles.pre}>{pretty(call.args_redacted)}</pre>
            </AccordionPanel>
          </AccordionItem>
          <AccordionItem value="summary">
            <AccordionHeader size="small">Result summary</AccordionHeader>
            <AccordionPanel>
              <pre className={styles.pre}>{pretty(call.result_summary)}</pre>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

function PayloadDialog({ runId, onClose }: { runId: string; onClose: () => void }) {
  const styles = useStyles();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [data, setData] = useState<RunPayloadOut | null>(null);
  const read = useMutation({ mutationFn: () => governanceApi.payload(runId, reason.trim()), onSuccess: setData });
  const err = touched ? reasonError(reason) : null;
  const failure = read.error
    ? isApiError(read.error) && read.error.code === "copilot_private"
      ? "Copilot conversations are private to their user."
      : errorMessage(read.error)
    : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !read.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 880 }}>
        <DialogBody>
          <DialogTitle>View full prompt and output</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            {!data ? (
              <Field
                label="Reason for access"
                required
                hint="Access is recorded in the audit log."
                validationState={err ? "error" : "none"}
                validationMessage={err ?? undefined}
              >
                <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={500} />
              </Field>
            ) : data.items.length === 0 ? (
              <Body1>No stored payload for this run.</Body1>
            ) : (
              data.items.map((item, i) => (
                <div key={`${item.kind}-${item.step_no}-${i}`}>
                  <Caption1>
                    Step {item.step_no} · {humanize(item.kind)} · {formatDateTime(item.created_at)}
                  </Caption1>
                  <pre className={styles.pre} aria-readonly="true" tabIndex={0}>
                    {pretty(item.content)}
                  </pre>
                </div>
              ))
            )}
            {failure && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{failure}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={read.isPending}>
              Close
            </Button>
            {!data && (
              <Button
                appearance="primary"
                disabled={read.isPending}
                icon={read.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={() => {
                  setTouched(true);
                  if (!reasonError(reason)) read.mutate();
                }}
              >
                View payload
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function CancelDialog({ runId, onClose }: { runId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const cancel = useMutation({
    mutationFn: () => governanceApi.cancelRun(runId, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: governanceKeys.run(runId) });
      onClose();
    },
  });
  const err = touched && !reason.trim() ? "Enter a reason." : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !cancel.isPending && onClose()} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Cancel run?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Field label="Reason" required validationState={err ? "error" : "none"} validationMessage={err ?? undefined}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={500} />
            </Field>
            {cancel.error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{errorMessage(cancel.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={cancel.isPending}>
              Keep running
            </Button>
            <Button
              appearance="primary"
              disabled={cancel.isPending}
              onClick={() => {
                setTouched(true);
                if (reason.trim()) cancel.mutate();
              }}
            >
              Cancel run
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
