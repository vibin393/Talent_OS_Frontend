"use client";

import { Body1, Button, Caption1, Card, Field, makeStyles, Radio, RadioGroup, Spinner, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Speaker labels from an uploaded transcript ("Speaker 1", "Speaker 2", ... by position when unnamed). */
export function speakerGroups(segments: { seq: number; text: string; speaker_role: string }[]): { label: string; seqs: number[]; sample: string }[] {
  // unlabelled lines alternate between the two people on the call
  const groups = [
    { label: "Speaker 1", seqs: [] as number[], sample: "" },
    { label: "Speaker 2", seqs: [] as number[], sample: "" },
  ];
  segments.forEach((s, i) => {
    const g = groups[i % 2];
    g.seqs.push(s.seq);
    if (!g.sample) g.sample = s.text.slice(0, 120);
  });
  return groups.filter((g) => g.seqs.length > 0);
}

/** "This is the candidate": shown when the transcript has no candidate speaker. */
export function SpeakerLabeller({ sessionId }: { sessionId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: voiceKeys.transcript(sessionId), queryFn: ({ signal }) => voiceApi.transcript(sessionId, signal) });
  const groups = useMemo(() => speakerGroups(q.data?.segments ?? []), [q.data]);
  const [choice, setChoice] = useState("");
  const save = useMutation({
    mutationFn: () => voiceApi.speakers(sessionId, groups.find((g) => g.label === choice)?.seqs ?? []),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voiceKeys.all });
      toast.success("Thanks. The assistant is extracting the answers.");
    },
  });
  if (q.isPending) return <GridSkeleton rows={2} />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  return (
    <Card className={styles.root}>
      <Body1>The transcript doesn&apos;t say who the candidate is.</Body1>
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <Field label="Which speaker is the candidate?" required>
        <RadioGroup value={choice} onChange={(_, d) => setChoice(d.value)}>
          {groups.map((g) => (
            <Radio key={g.label} value={g.label} label={`This is the candidate — ${g.label}: “${g.sample}”`} />
          ))}
        </RadioGroup>
      </Field>
      <Caption1 className={styles.muted}>Answers are taken only from the candidate&apos;s lines.</Caption1>
      <div>
        <Button appearance="primary" disabled={!choice || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate()}>
          Continue
        </Button>
      </div>
    </Card>
  );
}
