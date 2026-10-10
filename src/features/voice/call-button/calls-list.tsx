"use client";

import { Caption1, makeStyles, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { telephonyApi, telephonyKeys } from "@/features/telephony/api";
import { mmss } from "@/features/telephony/logic";
import type { CallStatus } from "@/features/telephony/types";

const useStyles = makeStyles({ muted: { color: tokens.colorNeutralForeground3 } });

const OUTCOME: Record<CallStatus, string> = {
  requested: "Ringing",
  dialing_recruiter: "Ringing",
  dialing_candidate: "Connecting",
  in_progress: "In call",
  completed: "Completed",
  no_answer: "No answer",
  busy: "Busy",
  failed: "Failed",
  refused: "Refused",
  cancelled: "Cancelled",
};

/** "Calls" on the Voice Session (spec B4): time, outcome, duration, recorded. */
export function CallsList({ sessionId }: { sessionId: string }) {
  const styles = useStyles();
  const canCall = usePermission("voice:call");
  const canUpload = usePermission("voice:upload");
  const can = canCall || canUpload;
  const q = useQuery({ queryKey: telephonyKeys.calls(sessionId), queryFn: ({ signal }) => telephonyApi.list(sessionId, signal), enabled: can, retry: false });
  if (!can || !q.data || q.data.items.length === 0) return null;
  return (
    <>
      <Caption1 className={styles.muted}>Calls</Caption1>
      <Table size="extra-small" aria-label="Calls">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Time</TableHeaderCell>
            <TableHeaderCell>Outcome</TableHeaderCell>
            <TableHeaderCell>Duration</TableHeaderCell>
            <TableHeaderCell>Recorded</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.items.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{new Date(c.requested_at).toLocaleString()}</TableCell>
              <TableCell>{OUTCOME[c.status]}</TableCell>
              <TableCell>{mmss(c.duration_s)}</TableCell>
              <TableCell>{c.recorded ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
