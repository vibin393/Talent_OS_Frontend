"use client";

import { Body1, Button, Caption1, Card, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { Play16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { AnswerReview } from "@/features/agents/screening/answer-review";
import { screeningAgentApi, screeningAgentKeys } from "@/features/agents/screening/api";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";
import { formatTimestamp, playbackAt } from "./logic";
import type { VoiceSession } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  pane: { maxHeight: "320px", overflowY: "auto", padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  line: { overflowWrap: "anywhere" },
  candidate: { fontWeight: tokens.fontWeightSemibold },
  plays: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  audio: { width: "100%" },
});

/** Voice review: Epic 57's answer grid, a "Play" button per answer (recording from that moment), the transcript with
 * timestamps, then "Complete review"; the outcome is set with the P1 screening outcome control. */
export function VoiceReview({ session }: { session: VoiceSession }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const target = { voiceSessionId: session.id } as const;
  const review = useQuery({ queryKey: screeningAgentKeys.review(target), queryFn: ({ signal }) => screeningAgentApi.review(target, signal), retry: false });
  const transcript = useQuery({ queryKey: voiceKeys.transcript(session.id), queryFn: ({ signal }) => voiceApi.transcript(session.id, signal), enabled: session.has_transcript });
  const [src, setSrc] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const play = useMutation({
    mutationFn: async (startMs: number | null) => {
      const p = await voiceApi.playback(session.id);
      return playbackAt(p.url, startMs);
    },
    onSuccess: (url) => {
      setSrc(url);
      setTimeout(() => void audio.current?.play().catch(() => undefined), 0);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const complete = useMutation({
    mutationFn: () => voiceApi.completeReview(session.id),
    onSuccess: () => {
      toast.success("Voice screen reviewed. Set the outcome on the screening below.");
      void qc.invalidateQueries({ queryKey: voiceKeys.all });
      void qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
  const answers = review.data?.answers ?? [];
  return (
    <div className={styles.root}>
      {session.summary && (
        <Card>
          <Subtitle2>
            Summary <AiBadge agentName="Voice Screening Agent" />
          </Subtitle2>
          <Body1>{session.summary}</Body1>
          {session.gaps.length > 0 && <Caption1 className={styles.muted}>Gaps: {session.gaps.map(String).join("; ")}</Caption1>}
        </Card>
      )}
      <AnswerReview
        voiceSessionId={session.id}
        completeFn={async () => {
          await voiceApi.completeReview(session.id);
          return screeningAgentApi.review(target);
        }}
        onCompleted={() => void qc.invalidateQueries({ queryKey: voiceKeys.all })}
      />
      {session.has_recording && answers.length > 0 && (
        <div className={styles.plays}>
          {answers.map((a) => (
            <Button key={a.id} size="small" icon={<Play16Regular />} onClick={() => play.mutate(a.start_ms)} aria-label={`Play ${a.question_label}`}>
              Play · {a.question_label} ({formatTimestamp(a.start_ms)})
            </Button>
          ))}
        </div>
      )}
      {src && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- call recordings have the transcript below as their text alternative
        <audio ref={audio} className={styles.audio} controls src={src} />
      )}
      {transcript.data && (
        <Card className={styles.pane} aria-label="Transcript">
          {transcript.data.segments.map((s) => (
            <Body1 key={s.seq} className={`${styles.line} ${s.speaker_role === "candidate" ? styles.candidate : ""}`}>
              [{formatTimestamp(s.start_ms)}] {s.speaker_role === "candidate" ? "Candidate" : s.speaker_role === "unknown" ? "Speaker" : "Recruiter"}: {s.text}
            </Body1>
          ))}
        </Card>
      )}
      <ErrorBar message={complete.error ? errorMessage(complete.error) : null} />
      {session.status === "ready_for_review" && answers.length === 0 && !review.isPending && (
        <div>
          <Button appearance="primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
            Complete review
          </Button>
        </div>
      )}
    </div>
  );
}
