"use client";

import { Badge, Body1, Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import {
  ArrowReset20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  Hourglass20Regular,
  Next20Regular,
} from "@fluentui/react-icons";
import { formatDateTime } from "@/features/admin/ui";
import type { ApprovalDecisionOut, ApprovalRequestOut } from "@/lib/api/types";
import { useUserNames } from "./use-user-names";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  request: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  steps: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    marginLeft: tokens.spacingHorizontalS,
  },
  step: {
    display: "grid",
    gridTemplateColumns: "24px 1fr",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  comment: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
});

export const REQUEST_STATUS: Record<ApprovalRequestOut["status"], { label: string; color: "warning" | "success" | "danger" | "severe" | "subtle" }> = {
  pending: { label: "Pending", color: "warning" },
  approved: { label: "Approved", color: "success" },
  rejected: { label: "Rejected", color: "danger" },
  changes_requested: { label: "Changes requested", color: "severe" },
  cancelled: { label: "Cancelled", color: "subtle" },
};

const OUTCOME: Record<ApprovalDecisionOut["outcome"], { label: string; icon: React.ReactElement }> = {
  approved: { label: "Approved", icon: <Checkmark20Regular /> },
  rejected: { label: "Rejected", icon: <Dismiss20Regular /> },
  changes_requested: { label: "Changes requested", icon: <ArrowReset20Regular /> },
  skipped: { label: "Skipped (condition not met)", icon: <Next20Regular /> },
};

/** Approval requests for a subject (newest first), each with its step decisions as a timeline. */
export function ApprovalHistory({ requests }: { requests: readonly ApprovalRequestOut[] }) {
  const styles = useStyles();
  const nameOf = useUserNames();
  if (requests.length === 0) return <Body1 className={styles.muted}>Not submitted for approval yet.</Body1>;
  return (
    <ol className={styles.list}>
      {requests.map((r) => {
        const decisions = [...(r.decisions ?? [])].sort((a, b) => a.position - b.position || a.decided_at.localeCompare(b.decided_at));
        const status = REQUEST_STATUS[r.status];
        return (
          <li key={r.id} className={styles.request}>
            <div className={styles.head}>
              <Badge appearance="tint" color={status.color}>
                {status.label}
              </Badge>
              <Caption1 className={styles.muted}>
                Submitted {formatDateTime(r.submitted_at)}
                {nameOf(r.submitted_by) ? ` by ${nameOf(r.submitted_by)}` : ""}
              </Caption1>
            </div>
            <ol className={styles.steps}>
              {decisions.map((d) => (
                <li key={d.id} className={styles.step}>
                  <span aria-hidden>{OUTCOME[d.outcome].icon}</span>
                  <span>
                    <Text weight="semibold">{d.step_name}</Text> · {OUTCOME[d.outcome].label}
                    {d.actor_id && ` by ${nameOf(d.actor_id) ?? "an approver"}`}
                    <Caption1 className={styles.muted}> {formatDateTime(d.decided_at)}</Caption1>
                    {d.comment && (
                      <Body1 as="p" className={styles.comment} style={{ margin: 0 }}>
                        “{d.comment}”
                      </Body1>
                    )}
                  </span>
                </li>
              ))}
              {r.status === "pending" && (
                <li className={styles.step}>
                  <span aria-hidden>
                    <Hourglass20Regular />
                  </span>
                  <span>
                    <Text weight="semibold">{r.current_step_name ?? `Step ${r.current_position ?? ""}`}</Text> · Waiting for
                    {r.current_approver_user_id ? ` ${nameOf(r.current_approver_user_id) ?? "the approver"}` : " an approver with the step role"}
                  </span>
                </li>
              )}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
