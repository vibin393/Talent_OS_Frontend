"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Info16Regular, Warning16Filled } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { financeAgentApi, financeAgentKeys } from "./api";
import { FLAGS_FOOTER, flagDates, flagLabel, flagText, groupFlags, hasAiExplanation } from "./logic";
import type { FlagOut } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  group: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, paddingBlock: tokens.spacingVerticalXS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-start" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, flexGrow: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  warn: { color: tokens.colorPaletteMarigoldForeground1, flexShrink: 0, marginTop: "2px" },
  info: { color: tokens.colorNeutralForeground3, flexShrink: 0, marginTop: "2px" },
});

/** "Things to check" (Epic 63): deterministic anomaly flags of a timesheet, with the Timesheet Agent's explanations.
 * Internal approvers only; never blocks approval or changes hours. */
export function TimesheetFlagsPanel({ timesheetId }: { timesheetId: string }) {
  const styles = useStyles();
  const canRead = usePermission("timesheet:read");
  const canApprove = usePermission("timesheet:approve");
  const canMonitor = usePermission("timesheet:monitor");
  const canReview = canApprove || canMonitor;
  const qc = useQueryClient();
  const [dismissing, setDismissing] = useState<FlagOut | null>(null);
  const [note, setNote] = useState("");
  const q = useQuery({
    queryKey: financeAgentKeys.flags(timesheetId),
    queryFn: ({ signal }) => financeAgentApi.flags(timesheetId, signal),
    enabled: canRead && Boolean(timesheetId),
  });
  const review = useMutation({
    mutationFn: (v: { id: string; status: "reviewed" | "dismissed"; note?: string }) => financeAgentApi.reviewFlag(v.id, v.status, v.note),
    onSuccess: () => {
      setDismissing(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: financeAgentKeys.flags(timesheetId) });
    },
  });
  if (!canRead) return null;
  const flags = q.data ?? [];
  if (q.isSuccess && flags.length === 0) return null;
  const groups = groupFlags(flags);
  return (
    <Card className={styles.card} aria-label="Things to check">
      <Subtitle2 as="h2">
        Things to check {hasAiExplanation(flags) && <AiBadge agentName="Timesheet Agent" />}
      </Subtitle2>
      <ErrorBar message={q.isError ? errorMessage(q.error) : review.isError ? errorMessage(review.error) : null} />
      {groups.map((g) => (
        <div key={g.key} className={styles.group}>
          {g.flags.map((f) => (
            <div key={f.id} className={styles.row}>
              {f.severity === "warning" ? (
                <Warning16Filled className={styles.warn} aria-label="Warning" />
              ) : (
                <Info16Regular className={styles.info} aria-label="Information" />
              )}
              <div className={styles.body}>
                <Text weight="semibold">{flagLabel(f.rule)}</Text>
                <Body1>{flagText(f)}</Body1>
                {f.entry_dates.length > 0 && <Caption1 className={styles.muted}>{flagDates(f.entry_dates)}</Caption1>}
                {f.status !== "open" && (
                  <Caption1 className={styles.muted}>
                    {f.status === "reviewed" ? "Reviewed" : "Dismissed"}
                    {f.review_note ? ` · ${f.review_note}` : ""}
                  </Caption1>
                )}
              </div>
              {canReview && f.status === "open" && (
                <div className={styles.actions}>
                  <Button size="small" disabled={review.isPending} onClick={() => review.mutate({ id: f.id, status: "reviewed" })}>
                    Mark reviewed
                  </Button>
                  <Button size="small" appearance="subtle" onClick={() => setDismissing(f)}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <Caption1 className={styles.muted}>{FLAGS_FOOTER}</Caption1>
      <Dialog open={dismissing !== null} onOpenChange={(_, d) => !d.open && setDismissing(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Dismiss flag</DialogTitle>
            <DialogContent>
              <Field label="Note" required hint="Why this is not a problem (kept with the timesheet).">
                <Textarea value={note} onChange={(_, d) => setNote(d.value)} maxLength={500} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDismissing(null)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={!note.trim() || review.isPending}
                onClick={() => dismissing && review.mutate({ id: dismissing.id, status: "dismissed", note })}
              >
                Dismiss
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}
