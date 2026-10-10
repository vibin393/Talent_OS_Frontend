"use client";

import { Button, Caption1, Field, makeStyles, MessageBar, MessageBarBody, Spinner, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";
import { AttestationFields } from "./attestation-fields";
import { AUDIO_ACCEPT, recordingDisabledReason, TRANSCRIPT_ACCEPT, uploadError } from "./logic";
import type { VoiceSession } from "./types";

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Upload call transcript or recording" (Manual path): files, the two attestation statements, "Upload". */
export function UploadDrawer({ session, open, onClose }: { session: VoiceSession; open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [transcript, setTranscript] = useState<File | null>(null);
  const [recording, setRecording] = useState<File | null>(null);
  const [att, setAtt] = useState({ consentObtained: false, policyFollowed: false });
  const [touched, setTouched] = useState(false);
  const [recordingOnly, setRecordingOnly] = useState(false);
  const blocked = recordingDisabledReason(session);
  const validation = uploadError(transcript, recording, att.consentObtained, att.policyFollowed);

  const upload = useMutation({
    mutationFn: async () => {
      let last: VoiceSession | null = null;
      if (recording) last = await voiceApi.uploadRecording(session.id, recording, att.consentObtained, att.policyFollowed);
      if (transcript) last = await voiceApi.uploadTranscript(session.id, transcript, att.consentObtained, att.policyFollowed);
      return last;
    },
    onSuccess: (out) => {
      void qc.invalidateQueries({ queryKey: voiceKeys.all });
      setTranscript(null);
      setRecording(null);
      setAtt({ consentObtained: false, policyFollowed: false });
      setTouched(false);
      if (out && !out.has_transcript) {
        setRecordingOnly(true);
        return;
      }
      toast.success(out?.needs_speaker_label ? "Uploaded. Mark the candidate's lines." : "Uploaded. The assistant is extracting the answers.");
      onClose();
    },
  });

  return (
    <DetailsDrawer
      open={open}
      onClose={onClose}
      title="Upload call transcript or recording"
      footer={
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
      }
    >
      <div className={styles.body}>
        <ErrorBar message={upload.error ? errorMessage(upload.error) : null} />
        {recordingOnly && (
          <MessageBar intent="info">
            <MessageBarBody>Add a transcript so the assistant can extract answers. Talent OS does not transcribe audio.</MessageBarBody>
          </MessageBar>
        )}
        {touched && validation && (
          <MessageBar intent="warning" role="alert">
            <MessageBarBody>{validation}</MessageBarBody>
          </MessageBar>
        )}
        <Field label="Transcript (TXT, VTT, SRT, DOCX, up to 5 MB)">
          <input type="file" accept={TRANSCRIPT_ACCEPT} aria-label="Transcript" onChange={(e) => setTranscript(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Recording (MP3, M4A, WAV, OGG, up to 200 MB)" hint={blocked ?? undefined}>
          <input
            type="file"
            accept={AUDIO_ACCEPT}
            aria-label="Recording"
            disabled={!!blocked}
            onChange={(e) => setRecording(e.target.files?.[0] ?? null)}
          />
        </Field>
        <AttestationFields
          consentObtained={att.consentObtained}
          policyFollowed={att.policyFollowed}
          showErrors={touched}
          onChange={setAtt}
        />
        <Caption1 className={styles.muted}>Only the words are used. No voice or audio features are analysed.</Caption1>
      </div>
    </DetailsDrawer>
  );
}
