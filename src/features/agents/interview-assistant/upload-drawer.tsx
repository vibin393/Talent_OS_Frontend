"use client";

import { Button, Caption1, Checkbox, Field, makeStyles, MessageBar, MessageBarBody, Radio, RadioGroup, Spinner, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { interviewAssistantApi, interviewAssistantKeys } from "./api";
import { AUDIO_ACCEPT, needsSpeakerStep, TRANSCRIPT_ACCEPT, uploadError } from "./logic";
import type { CaptureStatusOut } from "./types";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Upload interview transcript or recording": transcript and / or audio, attestation, then "Who is the candidate?"
 * when the transcript names speakers we could not match. */
export function UploadDrawer({
  interviewId,
  open,
  status,
  allowRecording,
  allowTranscript,
  onClose,
}: {
  interviewId: string;
  open: boolean;
  status: CaptureStatusOut | undefined;
  allowRecording: boolean;
  allowTranscript: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState<File | null>(null);
  const [recording, setRecording] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [touched, setTouched] = useState(false);
  const [speaker, setSpeaker] = useState("");
  const validation = uploadError(transcript, recording, attested);
  const speakerStep = needsSpeakerStep(status);

  const upload = useMutation({
    mutationFn: async () => {
      let last = null;
      if (recording) last = await interviewAssistantApi.uploadRecording(interviewId, recording, attested);
      if (transcript) last = await interviewAssistantApi.uploadTranscript(interviewId, transcript, attested);
      return last;
    },
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: interviewAssistantKeys.status(interviewId) });
      if (out?.needs_transcript) toast.success("Recording saved. Upload the meeting transcript so the assistant can work from it.");
      else if (out && needsSpeakerStep(out.status)) toast.success("Uploaded. Tell us who the candidate is.");
      else toast.success("Uploaded. The assistant is preparing your draft.");
      setTranscript(null);
      setRecording(null);
      setAttested(false);
      setTouched(false);
      if (!out || !needsSpeakerStep(out.status)) onClose();
    },
  });
  const relabel = useMutation({
    mutationFn: () => interviewAssistantApi.speakers(interviewId, speaker),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interviewAssistantKeys.status(interviewId) });
      toast.success("Thanks. The assistant is preparing your draft.");
      onClose();
    },
  });

  return (
    <DetailsDrawer
      open={open}
      onClose={onClose}
      title={speakerStep ? "Who is the candidate?" : "Upload interview transcript or recording"}
      footer={
        speakerStep ? (
          <Button appearance="primary" disabled={!speaker || relabel.isPending} onClick={() => relabel.mutate()}>
            Continue
          </Button>
        ) : (
          <Button
            appearance="primary"
            disabled={upload.isPending}
            icon={upload.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => {
              setTouched(true);
              if (!validation) upload.mutate();
            }}
          >
            Upload
          </Button>
        )
      }
    >
      <div className={styles.body}>
        {speakerStep ? (
          <>
            <ErrorBar message={relabel.error ? errorMessage(relabel.error) : null} />
            <Field label="Who is the candidate?" required>
              <RadioGroup value={speaker} onChange={(_, d) => setSpeaker(d.value)}>
                {status?.unknown_speakers.map((s) => (
                  <Radio key={s} value={s} label={s} />
                ))}
              </RadioGroup>
            </Field>
          </>
        ) : (
          <>
            <ErrorBar message={upload.error ? errorMessage(upload.error) : null} />
            {touched && validation && (
              <MessageBar intent="warning" role="alert">
                <MessageBarBody>{validation}</MessageBarBody>
              </MessageBar>
            )}
            {allowTranscript && (
              <Field label="Meeting transcript (VTT, TXT, SRT, DOCX — Teams, Zoom or Meet export)">
                <input type="file" accept={TRANSCRIPT_ACCEPT} aria-label="Meeting transcript" onChange={(e) => setTranscript(e.target.files?.[0] ?? null)} />
              </Field>
            )}
            {allowRecording && (
              <Field label="Recording (MP3, M4A, WAV, OGG — audio only)">
                <input type="file" accept={AUDIO_ACCEPT} aria-label="Recording" onChange={(e) => setRecording(e.target.files?.[0] ?? null)} />
              </Field>
            )}
            <Checkbox checked={attested} onChange={(_, d) => setAttested(!!d.checked)} label="This is the interview everyone agreed to record" />
            <Caption1 className={styles.muted}>Video files aren&apos;t accepted. Only the words are used.</Caption1>
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}
