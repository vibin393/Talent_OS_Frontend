"use client";

import { Body1, Button, Caption1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceAgentApi, complianceAgentKeys } from "./api";
import { followUpLine, limitReached, runStartedMessage } from "./logic";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Provider follow-ups" card on the BGV case page (Epic 62 B3). */
export function BgvFollowUpsCard({ caseId }: { caseId: string }) {
  const styles = useStyles();
  const canRead = usePermission("bgv:read");
  const [notice, setNotice] = useState<{ intent: "success" | "warning"; text: string } | null>(null);
  const q = useQuery({
    queryKey: complianceAgentKeys.bgv(caseId),
    queryFn: ({ signal }) => complianceAgentApi.caseFollowUps(caseId, signal),
    enabled: canRead,
  });
  const run = useMutation({
    mutationFn: () => complianceAgentApi.followUpNow(caseId),
    onSuccess: (ref) => setNotice(runStartedMessage(ref, "BGV Agent")),
  });
  if (!canRead) return null;
  const d = q.data;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Text weight="semibold">
            Provider follow-ups <AiBadge agentName="BGV Agent" />
          </Text>
        }
        action={
          <Button size="small" disabled={run.isPending} onClick={() => run.mutate()}>
            Follow up now
          </Button>
        }
      />
      {notice && (
        <MessageBar intent={notice.intent}>
          <MessageBarBody>{notice.text}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={q.isError ? errorMessage(q.error) : run.isError ? errorMessage(run.error) : null} />
      {d && d.follow_ups.length === 0 && <Caption1 className={styles.muted}>No provider follow-ups yet.</Caption1>}
      {d?.follow_ups.map((f) => <Body1 key={f.id}>{followUpLine(f, d.max_follow_ups)}</Body1>)}
      {d && limitReached(d.overdue) && (
        <MessageBar intent="warning">
          <MessageBarBody>{`Follow-up limit reached — task created for ${d.limit_task_owner_name ?? "the case owner"}`}</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}
