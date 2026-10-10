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
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess } from "@/features/admin/ui";
import { useAgenticState, governanceKeys } from "@/features/ai-governance/api";
import { KillSwitchBanner } from "@/features/ai-governance/kill-switch-control";
import { usePermission } from "@/features/auth/use-permission";
import { useUserNames } from "@/features/privacy/use-user-names";
import { humanize } from "@/features/ai-governance/logic";
import type { AgentCatalogDetail } from "@/lib/api/governance-types";
import { agentsApi, useAgentsList, useChecklist } from "./api";
import { agentErrorText, agentStatus, budgetUsedText, ENABLEMENT_NOTICE, formatDate, readinessText } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, minWidth: 0 },
  notice: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, margin: 0, paddingLeft: tokens.spacingHorizontalL },
  cardBody: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
});

function Readiness({ agentKey }: { agentKey: string }) {
  const c = useChecklist(agentKey);
  if (c.isPending) return <Spinner size="extra-tiny" aria-label="Loading readiness" />;
  if (!c.data) return <>—</>;
  return <>{readinessText(c.data.items)}</>;
}

/** `/admin/ai/agents` (`ai:govern` or `ai:agent_configure`): master switch and the agent grid. */
export function AgentsList() {
  const styles = useStyles();
  const router = useRouter();
  const configure = usePermission("ai:agent_configure");
  const govern = usePermission("ai:govern");
  const allowed = configure || govern;
  const agents = useAgentsList(allowed);
  if (!allowed) return <NoAccess what="AI agent settings" />;

  const columns: TableColumnDefinition<AgentCatalogDetail>[] = [
    createTableColumn({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (a) => a.name }),
    createTableColumn({ columnId: "purpose", renderHeaderCell: () => "Purpose", renderCell: (a) => a.purpose }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (a) => {
        const s = agentStatus(a);
        return (
          <Badge appearance="tint" color={s.color}>
            {s.label}
          </Badge>
        );
      },
    }),
    createTableColumn({ columnId: "mode", renderHeaderCell: () => "Default mode", renderCell: (a) => humanize(a.default_mode) }),
    createTableColumn({ columnId: "budget", renderHeaderCell: () => "Budget used", renderCell: (a) => budgetUsedText(a) }),
    createTableColumn({ columnId: "ready", renderHeaderCell: () => "Readiness", renderCell: (a) => (a.placeholder ? "—" : <Readiness agentKey={a.key} />) }),
    createTableColumn({
      columnId: "configure",
      renderHeaderCell: () => "",
      renderCell: (a) =>
        a.placeholder ? null : (
          <Button size="small" onClick={() => router.push(`/admin/ai/agents/${a.key}`)}>
            Configure
          </Button>
        ),
    }),
  ];
  return (
    <div className={styles.root}>
      <PageHeader title="AI agents" subtitle="Turn agents on, choose what they may do on their own and see each agent's readiness." />
      <KillSwitchBanner />
      <MasterCard canEnable={configure} />
      <AdminGrid
        items={agents.data}
        columns={columns}
        getRowId={(a) => a.key}
        loading={agents.isPending}
        error={agents.error}
        emptyText="No agents are available yet."
        label="Agents"
      />
    </div>
  );
}

function MasterCard({ canEnable }: { canEnable: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const state = useAgenticState();
  const userName = useUserNames();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const enable = useMutation({
    mutationFn: () => agentsApi.enableAgentic(state.data?.current_notice_version ?? ""),
    onSuccess: (out) => {
      qc.setQueryData(governanceKeys.agentic, (prev: object | undefined) => ({ ...(prev ?? {}), ...out }));
      setOpen(false);
      setAccepted(false);
    },
  });
  const s = state.data;
  const by = s?.enabled_by_name ?? userName(s?.enabled_by ?? null) ?? "an administrator";
  return (
    <Card>
      <CardHeader header={<Subtitle2 as="h2">AI agents for this tenant</Subtitle2>} />
      <div className={styles.cardBody}>
        {!s ? (
          <Spinner size="tiny" />
        ) : s.enabled ? (
          <Text>
            On since {formatDate(s.enabled_at)}, accepted by {by} (notice {s.notice_version ?? s.current_notice_version})
          </Text>
        ) : (
          <>
            <Text>AI agents are off.</Text>
            {canEnable && (
              <Button appearance="primary" onClick={() => setOpen(true)}>
                Turn on AI agents
              </Button>
            )}
          </>
        )}
      </div>
      <Dialog open={open} onOpenChange={(_, d) => !d.open && !enable.isPending && setOpen(false)}>
        <DialogSurface style={{ maxWidth: 640 }}>
          <DialogBody>
            <DialogTitle>Turn on AI agents</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              <Body1>Enablement notice (version {s?.current_notice_version})</Body1>
              <ul className={styles.notice}>
                {ENABLEMENT_NOTICE.map((p) => (
                  <li key={p}>
                    <Body1>{p}</Body1>
                  </li>
                ))}
              </ul>
              <Checkbox label="I have read and accept this notice" checked={accepted} onChange={(_, d) => setAccepted(!!d.checked)} />
              {enable.error && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{agentErrorText(enable.error)}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)} disabled={enable.isPending}>
                Cancel
              </Button>
              <Button appearance="primary" disabled={!accepted || enable.isPending} onClick={() => enable.mutate()}>
                Turn on
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}
