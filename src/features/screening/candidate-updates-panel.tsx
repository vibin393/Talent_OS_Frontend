"use client";

import { Button, Card, CardHeader, Checkbox, makeStyles, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { candidateKeys } from "@/features/candidates/api";
import { pipelineApi } from "@/features/pipeline/api";
import { pipelineError } from "@/features/pipeline/use-actions";
import type { ProposedCandidateUpdate } from "@/lib/api/types";
import { formatAnswer } from "./validation";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS, backgroundColor: tokens.colorBrandBackground2 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

export const MAPPED_FIELD_LABELS: Record<string, string> = {
  expected_ctc: "Expected compensation",
  notice_period_days: "Notice period (days)",
  current_location: "Current location",
  work_authorization: "Work authorization",
  willing_to_relocate: "Willing to relocate",
};

/** "Update candidate profile?" — lists mapped answers that differ from the profile; nothing is written without Apply. */
export function CandidateUpdatesPanel({
  screeningId,
  candidateId,
  updates,
  onDone,
}: {
  screeningId: string;
  candidateId: string;
  updates: ProposedCandidateUpdate[];
  onDone: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(updates.map((u) => u.field)));
  const apply = useMutation({
    mutationFn: () => pipelineApi.applyCandidateUpdates(screeningId, [...chosen]),
    onSuccess: (r) => {
      toast.success(`Updated ${r.applied.length} profile field${r.applied.length === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) });
      onDone();
    },
    onError: (e) => toast.error(pipelineError(e)),
  });
  if (updates.length === 0) return null;
  return (
    <Card className={styles.card} role="region" aria-label="Update candidate profile">
      <CardHeader header={<Subtitle2 as="h3">Update candidate profile?</Subtitle2>} description="These answers differ from the candidate's profile. Choose what to copy." />
      <ul className={styles.list}>
        {updates.map((u) => (
          <li key={u.field}>
            <Checkbox
              checked={chosen.has(u.field)}
              onChange={(_, d) =>
                setChosen((prev) => {
                  const next = new Set(prev);
                  if (d.checked) next.add(u.field);
                  else next.delete(u.field);
                  return next;
                })
              }
              label={
                <span>
                  <Text weight="semibold">{MAPPED_FIELD_LABELS[u.field] ?? u.field}: </Text>
                  <span className={styles.muted}>{formatAnswer(undefined, u.current)}</span> → {formatAnswer(undefined, u.proposed)}
                </span>
              }
            />
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button appearance="primary" disabled={chosen.size === 0 || apply.isPending} onClick={() => apply.mutate()}>
          Apply
        </Button>
        <Button disabled={apply.isPending} onClick={onDone}>
          Not now
        </Button>
      </div>
    </Card>
  );
}
