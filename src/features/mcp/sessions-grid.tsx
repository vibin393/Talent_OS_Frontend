"use client";

import {
  Badge,
  Caption1,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { mcpApi, mcpKeys, type McpSession, type SessionStatus } from "./api";
import { HoldsList } from "./holds-list";
import { endReasonLabel, STATUS_LABELS } from "./logic";
import { SessionDrawer } from "./session-drawer";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  filters: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  table: { overflowX: "auto" },
  row: { cursor: "pointer" },
});

export function StatusBadge({ s }: { s: McpSession }) {
  const st = STATUS_LABELS[s.status];
  const badge = (
    <Badge appearance="tint" color={st.color}>
      {st.label}
    </Badge>
  );
  return s.status === "ended" && s.end_reason ? (
    <Tooltip content={endReasonLabel(s.end_reason)} relationship="description">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

/** Governance console → "MCP sessions" (spec B3). Polls every 30 s (AD-15). */
export function SessionsGrid() {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canEnd = usePermission("ai:agent_configure");
  const [status, setStatus] = useState<SessionStatus | undefined>(undefined);
  const [open, setOpen] = useState<McpSession | null>(null);
  const q = useQuery({ queryKey: mcpKeys.sessions({ status }), queryFn: ({ signal }) => mcpApi.sessions({ status }, signal), refetchInterval: 30_000 });
  const end = useMutation({
    mutationFn: (s: McpSession) => mcpApi.endSession(s.id),
    onSuccess: (s) => {
      setOpen(s);
      void qc.invalidateQueries({ queryKey: ["mcp"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = q.data?.items ?? [];
  return (
    <div className={styles.root}>
      <HoldsList canRelease={canEnd} />
      <div className={styles.filters}>
        <Field label="Status">
          <Dropdown
            value={status ? STATUS_LABELS[status].label : "All"}
            selectedOptions={[status ?? "all"]}
            onOptionSelect={(_, d) => setStatus(d.optionValue === "all" ? undefined : (d.optionValue as SessionStatus))}
          >
            <Option value="all">All</Option>
            <Option value="active">Active</Option>
            <Option value="paused">Paused</Option>
            <Option value="ended">Ended</Option>
          </Dropdown>
        </Field>
      </div>
      {q.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {rows.length === 0 && !q.isLoading ? (
        <Caption1>No AI assistant sessions yet.</Caption1>
      ) : (
        <div className={styles.table}>
          <Table aria-label="MCP sessions">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Assistant</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell>Last activity</TableHeaderCell>
                <TableHeaderCell>Tool calls</TableHeaderCell>
                <TableHeaderCell>Proposals</TableHeaderCell>
                <TableHeaderCell>Refusals</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  key={s.id}
                  className={styles.row}
                  tabIndex={0}
                  onClick={() => setOpen(s)}
                  onKeyDown={(e) => (e.key === "Enter" ? setOpen(s) : undefined)}
                >
                  <TableCell>{s.user_name ?? s.user_id}</TableCell>
                  <TableCell>{s.client_name}</TableCell>
                  <TableCell>{new Date(s.started_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(s.last_seen_at).toLocaleString()}</TableCell>
                  <TableCell>{s.call_count}</TableCell>
                  <TableCell>{s.proposal_count}</TableCell>
                  <TableCell>{s.refusal_count}</TableCell>
                  <TableCell>
                    <StatusBadge s={s} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <SessionDrawer session={open} canEnd={canEnd} busy={end.isPending} onClose={() => setOpen(null)} onEnd={(s) => end.mutate(s)} />
    </div>
  );
}
