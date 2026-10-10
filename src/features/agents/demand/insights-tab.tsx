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
  Subtitle2,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { DemandTabProps } from "@/features/demands/demand-tabs";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { duplicateBannerText, linkSuggestions, MILESTONE_LABELS, skillSuggestions, slaBasisText } from "./logic";
import { LinkSuggestions, SkillSuggestions } from "./suggestions-list";
import type { DemandFlag, SlaRisk } from "./types";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  section: { padding: tokens.spacingHorizontalM },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

function flagText(flag: DemandFlag): string {
  if (flag.kind === "possible_duplicate") return duplicateBannerText(flag);
  return flag.reasons.map((r) => r.detail).join("; ") || "SLA risk";
}

function SlaSection({ sla }: { sla: SlaRisk | null }) {
  const styles = useStyles();
  if (!sla) return <Caption1 className={styles.muted}>SLA risk is shown for open demands.</Caption1>;
  return (
    <div className={styles.list}>
      <div className={styles.row}>
        <Badge appearance="tint" color={sla.at_risk ? "danger" : "success"}>
          {sla.at_risk ? "At risk" : "On track"}
        </Badge>
        <Body1>{slaBasisText(sla)}</Body1>
      </div>
      {sla.clocks.map((c) => (
        <Caption1 key={c.milestone}>
          {MILESTONE_LABELS[c.milestone] ?? c.milestone}: {c.status} · {c.elapsed_pct}% elapsed · due {formatDateTime(c.due_at)}
        </Caption1>
      ))}
      {sla.reasons.map((r) => (
        <Body1 key={r}>{r}</Body1>
      ))}
      {sla.next_steps.length > 0 && (
        <div className={styles.row}>
          {sla.next_steps.map((s) => (
            <AppLink key={s.label} href={s.url}>
              {s.label}
            </AppLink>
          ))}
        </div>
      )}
    </div>
  );
}

/** Demand tab "AI assist" (`demand:read`): suggestions, flags, SLA risk and "Run Demand Agent". */
export function InsightsTab({ demandId }: DemandTabProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canUpdate = usePermission("demand:update");
  const query = useQuery({ queryKey: demandAgentKeys.insights(demandId), queryFn: ({ signal }) => demandAgentApi.insights(demandId, signal) });
  const run = useMutation({
    mutationFn: () => demandAgentApi.runAgent(demandId),
    onSuccess: (ref) => {
      if (ref.run_id) toast.success("Demand Agent is working on this demand.");
      else toast.error(`The Demand Agent did not start (${ref.reason ?? "unavailable"}).`);
      void qc.invalidateQueries({ queryKey: demandAgentKeys.insights(demandId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (query.isPending) return <GridSkeleton rows={6} />;
  if (query.isError) return <ErrorBar title="Could not load AI assist." message={errorMessage(query.error)} />;
  const data = query.data;
  const enabled = data.agent_enabled;
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Tooltip content={enabled ? "Run the Demand Agent on this demand" : "The Demand Agent is turned off"} relationship="description">
          <Button appearance="primary" disabled={!enabled || run.isPending} onClick={() => run.mutate()}>
            Run Demand Agent
          </Button>
        </Tooltip>
        {!enabled && <Caption1 className={styles.muted}>The Demand Agent is turned off</Caption1>}
        {data.last_run && (
          <span className={styles.row}>
            <AiBadge agentName="Demand Agent" />
            <Caption1>
              Last run {formatDateTime(data.last_run.created_at)} · {data.last_run.status} ·{" "}
              <AppLink href={`/ai/runs/${data.last_run.run_id}`}>View run</AppLink>
            </Caption1>
          </span>
        )}
      </div>
      {data.pending_jd_proposal_id && (
        <MessageBar intent="info">
          <MessageBarBody>
            A JD update from the Demand Agent is waiting for review.{" "}
            <AppLink href={`/proposals/${data.pending_jd_proposal_id}`}>Review</AppLink>
          </MessageBarBody>
        </MessageBar>
      )}
      <Card>
        <CardHeader header={<Subtitle2>Suggested skills</Subtitle2>} />
        <SkillSuggestions demandId={demandId} items={skillSuggestions(data.suggestions)} canUpdate={canUpdate} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2>Suggested contract and rate card</Subtitle2>} />
        <LinkSuggestions demandId={demandId} items={linkSuggestions(data.suggestions)} canUpdate={canUpdate} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2>Flags</Subtitle2>} />
        {data.flags.length === 0 ? (
          <Caption1 className={styles.muted}>No flags.</Caption1>
        ) : (
          <div className={styles.list}>
            {data.flags.map((f) => (
              <div key={f.id} className={styles.row}>
                <Badge appearance="outline" color={f.status === "open" ? "warning" : "subtle"}>
                  {f.kind === "possible_duplicate" ? "Possible duplicate" : "SLA risk"}
                </Badge>
                <Body1>{flagText(f)}</Body1>
                <Caption1 className={styles.muted}>{f.status}</Caption1>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader header={<Subtitle2>SLA risk</Subtitle2>} />
        <SlaSection sla={data.sla} />
      </Card>
    </div>
  );
}
