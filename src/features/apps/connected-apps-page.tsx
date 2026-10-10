"use client";

import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  MessageBar,
  MessageBarBody,
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
import { PageHeader } from "@/components/app-shell/page-header";
import { errorMessage } from "@/lib/api/errors";
import { appsApi, appsKeys, type ConnectedApp } from "./api";

const useStyles = makeStyles({ root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1000px" } });

/** Profile → Connected apps (Epic 67, spec B3). */
export function ConnectedAppsPage() {
  const styles = useStyles();
  const qc = useQueryClient();
  const [removing, setRemoving] = useState<ConnectedApp | null>(null);
  const q = useQuery({ queryKey: appsKeys.connected, queryFn: ({ signal }) => appsApi.connected(signal) });
  const remove = useMutation({
    mutationFn: (id: string) => appsApi.removeConnected(id),
    onSuccess: () => {
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: appsKeys.connected });
    },
  });
  const rows = q.data ?? [];
  return (
    <div className={styles.root}>
      <PageHeader title="Connected apps" subtitle="Apps and AI assistants you've allowed to act for you." />
      {q.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {rows.length === 0 && !q.isLoading ? (
        <Caption1>You haven&apos;t connected any apps.</Caption1>
      ) : (
        <Table aria-label="Connected apps">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>App</TableHeaderCell>
              <TableHeaderCell>Publisher</TableHeaderCell>
              <TableHeaderCell>Access</TableHeaderCell>
              <TableHeaderCell>Permissions</TableHeaderCell>
              <TableHeaderCell>Allowed on</TableHeaderCell>
              <TableHeaderCell>Last used</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.app_name}</TableCell>
                <TableCell>{r.publisher_name}</TableCell>
                <TableCell>{r.resource === "mcp" ? "AI assistant (MCP)" : "API"}</TableCell>
                <TableCell>
                  <Tooltip content={r.scope_labels.join(", ")} relationship="description">
                    <span>{r.scopes.length}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>{new Date(r.granted_at).toLocaleDateString()}</TableCell>
                <TableCell>{r.last_used_at ? new Date(r.last_used_at).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => setRemoving(r)}>
                    Remove access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={removing !== null} onOpenChange={(_, d) => (!d.open ? setRemoving(null) : undefined)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Remove access for {removing?.app_name}?</DialogTitle>
            <DialogContent>
              The app can no longer act for you, and its sign-in stops working within a minute. Data it already received stays with the app.
              {remove.error ? (
                <MessageBar intent="error">
                  <MessageBarBody>{errorMessage(remove.error)}</MessageBarBody>
                </MessageBar>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
                Remove access
              </Button>
              <Button onClick={() => setRemoving(null)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
