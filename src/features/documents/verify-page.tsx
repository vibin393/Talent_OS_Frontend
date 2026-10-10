"use client";

import { Body1, Caption1, Card, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, Spinner, tokens } from "@fluentui/react-components";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { FileDrop } from "@/features/candidates/file-drop";
import { errorMessage } from "@/lib/api/errors";
import { documentsApi } from "./api";
import { formatBytes, requestStatus, verifyResultCopy } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "720px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  signers: { margin: 0, paddingInlineStart: tokens.spacingHorizontalXL },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/documents/verify`: drop a PDF to check whether it is a document signed through Talent OS. */
export function VerifyPage() {
  const styles = useStyles();
  const allowed = usePermission("document:verify");
  const [file, setFile] = useState<File | null>(null);
  const verify = useMutation({ mutationFn: (f: File) => documentsApi.verify(f) });
  if (!allowed) return <NoAccess what="document verification" />;
  const result = verify.data;
  const copy = result ? verifyResultCopy(result) : null;
  return (
    <>
      <PageHeader title="Verify a document" subtitle="Check whether a file is exactly a document signed through Talent OS. The file is compared by fingerprint and not stored." />
      <div className={styles.root}>
        <FileDrop
          accept="application/pdf,.pdf"
          title="Drop a signed PDF here"
          hint="PDF up to 25 MB"
          buttonLabel="Choose a file"
          disabled={verify.isPending}
          onFiles={([f]) => {
            if (!f) return;
            setFile(f);
            verify.mutate(f);
          }}
        />
        <div aria-live="polite">
          {verify.isPending && <Spinner size="small" label={`Checking ${file?.name ?? "the file"}…`} />}
          {verify.isError && <ErrorBar title="Could not check the file." message={errorMessage(verify.error)} />}
          {result && copy && (
            <MessageBar intent={copy.intent} layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>{copy.title}</MessageBarTitle>
                {copy.body}
              </MessageBarBody>
            </MessageBar>
          )}
        </div>
        {result && result.match !== "none" && (
          <Card className={styles.card}>
            <Body1>
              <strong>{result.human_id ?? "Signature request"}</strong>
              {result.status ? ` · ${requestStatus(result.status).label}` : ""}
              {result.completed_at ? ` · completed ${formatDateTime(result.completed_at)}` : ""}
            </Body1>
            {result.signers.length > 0 && (
              <ol className={styles.signers}>
                {result.signers.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    {s.name} — {s.signed_at ? `signed ${formatDateTime(s.signed_at)}` : "not signed"}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
        {file && !verify.isPending && (
          <Caption1 className={styles.muted}>
            Checked: {file.name} ({formatBytes(file.size)})
          </Caption1>
        )}
      </div>
    </>
  );
}
