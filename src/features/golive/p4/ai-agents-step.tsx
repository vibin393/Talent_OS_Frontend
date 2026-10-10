"use client";

import { Badge, Body1, Card, CardHeader, makeStyles, Spinner, Subtitle2, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, tokens } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import { useAgentsList, useChecklist } from "@/features/agents-settings/api";
import { formatDate } from "@/features/agents-settings/logic";
import { useAgenticState } from "@/features/ai-governance/api";

/** Tab value of the read-only go-live step (after every import kind). */
export const AI_AGENTS_STEP = "__ai_agents__";
export const AI_AGENTS_STEP_LABEL = "AI agents (optional)";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  wrap: { overflowX: "auto" },
});

function Ready({ agentKey }: { agentKey: string }) {
  const c = useChecklist(agentKey);
  if (c.isPending) return <Spinner size="extra-tiny" aria-label="Loading" />;
  if (!c.data) return <>—</>;
  return (
    <Badge appearance="tint" color={c.data.ready ? "success" : "warning"}>
      {c.data.ready ? "Ready" : "Not ready"}
    </Badge>
  );
}

/** Go-live wizard last step (FR-330): agentic status and per-agent readiness, read-only, for `ai:agent_configure`. */
export function AiAgentsGoLiveStep() {
  const styles = useStyles();
  const state = useAgenticState();
  const agents = useAgentsList();
  const list = (agents.data ?? []).filter((a) => !a.placeholder);
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">{AI_AGENTS_STEP_LABEL}</Subtitle2>} />
      <Body1>
        AI agents are optional. Turn them on after your data is in: master switch, then each agent, then a 14-day suggest-only period
        before any action can run on its own.
      </Body1>
      {state.data && (
        <Text>
          {state.data.enabled ? `AI agents are on since ${formatDate(state.data.enabled_at)}.` : "AI agents are off."}
        </Text>
      )}
      {agents.isPending ? (
        <Spinner size="tiny" />
      ) : list.length > 0 ? (
        <div className={styles.wrap}>
          <Table size="small" aria-label="Agent readiness">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Agent</TableHeaderCell>
                <TableHeaderCell>Enabled</TableHeaderCell>
                <TableHeaderCell>Readiness</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.key}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.enabled ? "On" : "Off"}</TableCell>
                  <TableCell>
                    <Ready agentKey={a.key} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <AppLink href="/admin/ai/agents">Set up AI agents</AppLink>
    </Card>
  );
}
