"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Copy16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { mcpApi, mcpKeys, type McpSession } from "./api";
import { MY_ASSISTANTS_TEXT, myAssistantsState } from "./logic";
import { StatusBadge } from "./sessions-grid";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1000px" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM },
  url: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  table: { overflowX: "auto" },
});

/** Profile → AI assistants (Epic 73, spec B4). */
export function MyAssistants() {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const me = useQuery({ queryKey: mcpKeys.me, queryFn: ({ signal }) => mcpApi.me(signal) });
  const state = myAssistantsState(me.data);
  const sessions = useQuery({
    queryKey: mcpKeys.sessions({ mine: true }),
    queryFn: ({ signal }) => mcpApi.sessions({ mine: true }, signal),
    enabled: state !== null && state !== "disabled",
    refetchInterval: 30_000,
  });
  const end = useMutation({
    mutationFn: (s: McpSession) => mcpApi.endSession(s.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mcp"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = sessions.data?.items ?? [];
  const copy = () => {
    if (me.data) void navigator.clipboard?.writeText(me.data.server_url).then(() => toast.success("Copied"));
  };
  return (
    <div className={styles.root}>
      <PageHeader
        title="AI assistants"
        subtitle="Assistants connected to Talent OS as you. They can only see and do what you can, and anything that changes or sends something waits for your approval in Proposals."
      />
      {state && state !== "ready" ? (
        <MessageBar intent={state === "on_hold" ? "error" : "info"}>
          <MessageBarBody>{MY_ASSISTANTS_TEXT[state]}</MessageBarBody>
        </MessageBar>
      ) : null}
      {state === "ready" || state === "on_hold" ? (
        <Card>
          <CardHeader header={<Subtitle2 as="h2">How to connect</Subtitle2>} />
          <div className={styles.body}>
            <div className={styles.url}>
              <Input readOnly value={me.data?.server_url ?? ""} aria-label="Server URL" />
              <Button icon={<Copy16Regular />} onClick={copy}>
                Copy
              </Button>
            </div>
            <Body1>1. In your assistant, add a custom connector with this URL.</Body1>
            <Body1>2. Sign in to Talent OS when asked and review the access.</Body1>
            <Body1>3. Ask the assistant to search your requirements.</Body1>
            <AppLink href="/developers/docs/mcp">Developer guide</AppLink>
          </div>
        </Card>
      ) : null}
      {state !== "disabled" ? (
        <Card>
          <CardHeader header={<Subtitle2 as="h2">Sessions</Subtitle2>} />
          {rows.length === 0 ? (
            <Caption1>No sessions yet.</Caption1>
          ) : (
            <div className={styles.table}>
              <Table aria-label="Sessions">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Assistant</TableHeaderCell>
                    <TableHeaderCell>Started</TableHeaderCell>
                    <TableHeaderCell>Last activity</TableHeaderCell>
                    <TableHeaderCell>Tool calls</TableHeaderCell>
                    <TableHeaderCell>Proposals</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.client_name}</TableCell>
                      <TableCell>{new Date(s.started_at).toLocaleString()}</TableCell>
                      <TableCell>{new Date(s.last_seen_at).toLocaleString()}</TableCell>
                      <TableCell>{s.call_count}</TableCell>
                      <TableCell>{s.proposal_count}</TableCell>
                      <TableCell>
                        <StatusBadge s={s} />
                      </TableCell>
                      <TableCell>
                        {s.status !== "ended" ? (
                          <Button size="small" disabled={end.isPending} onClick={() => end.mutate(s)}>
                            End session
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : null}
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Remove an assistant&apos;s access</Subtitle2>} />
        <div className={styles.body}>
          <AppLink href="/me/connected-apps">Open Connected apps</AppLink>
        </div>
      </Card>
    </div>
  );
}
