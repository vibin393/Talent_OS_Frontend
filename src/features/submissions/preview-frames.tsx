"use client";

import { Caption1, makeStyles, MessageBar, MessageBarBody, Spinner, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { pipelineApi } from "@/features/pipeline/api";
import { pipelineErrorMessage } from "@/features/pipeline/transitions";
import { pipelineError } from "@/features/pipeline/use-actions";
import type { ResumeKind, SubmissionPreviewIn } from "@/lib/api/types";

const useStyles = makeStyles({
  frame: {
    width: "100%",
    height: "480px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "#ffffff",
  },
  muted: { color: tokens.colorNeutralForeground3 },
});

function usePreview(body: SubmissionPreviewIn, enabled = true) {
  return useQuery({
    queryKey: ["pipeline", "submission-preview", body],
    queryFn: ({ signal }) => pipelineApi.preview(body, signal),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

function base64ToBlobUrl(b64: string, type: string): string | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type }));
  } catch {
    return null;
  }
}

/** PDF preview of the resume the client will receive (client-formatted PDFs have contact details removed). */
export function ResumePreview({ applicationId, resumeKind, name }: { applicationId: string; resumeKind: ResumeKind; name: string }) {
  const styles = useStyles();
  const preview = usePreview({ application_id: applicationId, resume_kind: resumeKind });
  const b64 = preview.data?.resume_pdf_base64 ?? null;
  const url = useMemo(() => (b64 ? base64ToBlobUrl(b64, "application/pdf") : null), [b64]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (preview.isPending) return <Spinner size="small" label="Preparing the resume preview…" />;
  if (preview.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{pipelineError(preview.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const data = preview.data;
  if (!data.resume_available) {
    return (
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>{data.resume_error ? pipelineErrorMessage(data.resume_error, data.resume_error) : "No resume is available for this option."}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!url) {
    return (
      <Text className={styles.muted}>
        The original resume file will be attached as uploaded (preview is only available for PDFs).
      </Text>
    );
  }
  return (
    <>
      <iframe className={styles.frame} src={url} title={`Resume preview for ${name}`} />
      {resumeKind === "client_formatted" && (
        <Caption1 className={styles.muted}>Email, phone, address and links are removed from the client-formatted resume.</Caption1>
      )}
    </>
  );
}

/** The rendered submission email in a sandboxed iframe (no scripts, no same-origin access). */
export function EmailPreview({ body, name }: { body: SubmissionPreviewIn; name: string }) {
  const styles = useStyles();
  const preview = usePreview(body);
  if (preview.isPending) return <Spinner size="small" label="Rendering the email…" />;
  if (preview.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{pipelineError(preview.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  return (
    <>
      <Text weight="semibold" block>
        Subject: {preview.data.subject}
      </Text>
      <iframe className={styles.frame} sandbox="" srcDoc={preview.data.html} title={`Email preview for ${name}`} />
    </>
  );
}
