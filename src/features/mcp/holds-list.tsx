"use client";

import {
  Button,
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
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { mcpApi, mcpKeys, type McpHold } from "./api";

const useStyles = makeStyles({ root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS } });

/** "Paused accounts" (spec B3), shown above the sessions grid when non-empty. */
export function HoldsList({ canRelease }: { canRelease: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [target, setTarget] = useState<McpHold | null>(null);
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: mcpKeys.holds, queryFn: ({ signal }) => mcpApi.holds(signal), enabled: canRelease, refetchInterval: 30_000 });
  const release = useMutation({
    mutationFn: (h: McpHold) => mcpApi.releaseHold(h.id, note.trim()),
    onSuccess: () => {
      setTarget(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["mcp"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <div className={styles.root}>
      <MessageBar intent="warning">
        <MessageBarBody>{rows.length} people have AI assistant access paused.</MessageBarBody>
      </MessageBar>
      <Table aria-label="Paused accounts">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Reason</TableHeaderCell>
            <TableHeaderCell>Paused at</TableHeaderCell>
            <TableHeaderCell>Auto-release</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h) => (
            <TableRow key={h.id}>
              <TableCell>{h.user_name ?? h.user_id}</TableCell>
              <TableCell>{h.reason === "bulk_read" ? "Read an unusual number of candidate records" : "Paused by an administrator"}</TableCell>
              <TableCell>{new Date(h.held_at).toLocaleString()}</TableCell>
              <TableCell>{h.auto_release_at ? new Date(h.auto_release_at).toLocaleString() : "Never"}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => setTarget(h)}>
                  Allow again
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={target !== null} onOpenChange={(_, d) => (!d.open ? setTarget(null) : undefined)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Allow AI assistant access again for {target?.user_name ?? "this user"}?</DialogTitle>
            <DialogContent>
              <Field label="Note" required>
                <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={!note.trim() || release.isPending} onClick={() => target && release.mutate(target)}>
                Allow again
              </Button>
              <Button onClick={() => setTarget(null)}>Cancel</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
