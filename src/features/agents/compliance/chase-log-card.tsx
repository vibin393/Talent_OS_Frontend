"use client";

import { Badge, Body1, Button, Caption1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { complianceAgentApi, complianceAgentKeys } from "./api";
import { chaseLine, runStartedMessage, suppressedText } from "./logic";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  row: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, paddingBlock: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Compliance chasing" card on the Placement page (registered panel) and the Worker 360 view. */
export function ChaseLogCard({ placementId, candidateId }: { placementId?: string; candidateId?: string }) {
  const styles = useStyles();
  const canRead = usePermission("compliance:read");
  const [notice, setNotice] = useState<{ intent: "success" | "warning"; text: string } | null>(null);
  const id = placementId ?? candidateId ?? "";
  const q = useQuery({
    queryKey: placementId ? complianceAgentKeys.placement(id) : complianceAgentKeys.candidate(id),
    queryFn: ({ signal }) =>
      placementId ? complianceAgentApi.placementChases(id, signal) : complianceAgentApi.candidateChases(id, signal),
    enabled: canRead && Boolean(id),
  });
  const target = candidateId ?? q.data?.[0]?.candidate_id;
  const chase = useMutation({
    mutationFn: () => complianceAgentApi.chaseNow(String(target)),
    onSuccess: (ref) => setNotice(runStartedMessage(ref, "Compliance Agent")),
  });
  if (!canRead) return null;
  const rows = q.data ?? [];
  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Text weight="semibold">
            Compliance chasing <AiBadge agentName="Compliance Agent" />
          </Text>
        }
        action={
          target ? (
            <Button size="small" disabled={chase.isPending} onClick={() => chase.mutate()}>
              Chase now
            </Button>
          ) : undefined
        }
      />
      {notice && (
        <MessageBar intent={notice.intent}>
          <MessageBarBody>{notice.text}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={q.isError ? errorMessage(q.error) : chase.isError ? errorMessage(chase.error) : null} />
      {q.isSuccess && rows.length === 0 && <Caption1 className={styles.muted}>No reminders sent by the Compliance Agent yet.</Caption1>}
      {rows.map((c) => (
        <div key={c.id} className={styles.row}>
          <Body1>{chaseLine(c)}</Body1>
          {c.suppressed.map((s) => (
            <Caption1 key={s.channel} className={styles.muted}>
              {suppressedText(s)}
            </Caption1>
          ))}
          {c.escalated && (
            <Badge appearance="tint" color="danger">
              {`Escalated to ${c.escalated_to_name ?? "the coordinator"}`}
            </Badge>
          )}
        </div>
      ))}
    </Card>
  );
}

export function PlacementChaseLog({ placementId }: { placementId: string; placementStatus: string }) {
  return <ChaseLogCard placementId={placementId} />;
}
