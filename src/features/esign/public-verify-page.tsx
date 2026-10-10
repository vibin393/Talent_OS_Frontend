"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { ShieldCheckmark20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/features/admin/ui";
import { isApiError } from "@/lib/api/errors";
import { publicEsignApi } from "./public-api";

const useStyles = makeStyles({
  page: { minHeight: "100svh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground3 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "48px",
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
  },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "640px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    "@media (max-width: 480px)": { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}` },
  },
  card: { padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  form: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  grow: { flex: "1 1 240px" },
  touch: { minHeight: "44px" },
  footer: { textAlign: "center", padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/verify?c=<certificate id>`: anyone can check a signing certificate printed on a signed document. */
export function PublicVerifyPage({ certificateId }: { certificateId: string | null }) {
  const styles = useStyles();
  const router = useRouter();
  const [input, setInput] = useState(certificateId ?? "");
  const [inputError, setInputError] = useState<string | null>(null);
  const id = certificateId && UUID.test(certificateId) ? certificateId : null;
  const q = useQuery({
    queryKey: ["public-verify", id],
    queryFn: ({ signal }) => publicEsignApi.verifyCertificate(id as string, signal),
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!UUID.test(v)) {
      setInputError("Enter the certificate ID exactly as printed on the document.");
      return;
    }
    setInputError(null);
    router.replace(`/verify?c=${encodeURIComponent(v)}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <ShieldCheckmark20Regular aria-hidden /> Talent OS · Signature verification
      </header>
      <main className={styles.main}>
        <Card className={styles.card}>
          <Title3 as="h1">Check a signed document</Title3>
          <Body1>Enter the certificate ID printed on the signed document&apos;s certificate page to confirm it was signed through Talent OS.</Body1>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field className={styles.grow} label="Certificate ID" validationState={inputError ? "error" : "none"} validationMessage={inputError}>
              <Input className={styles.touch} value={input} onChange={(_, d) => setInput(d.value)} autoComplete="off" spellCheck={false} />
            </Field>
            <Button type="submit" appearance="primary" className={styles.touch}>
              Check
            </Button>
          </form>
          <div aria-live="polite">
            {certificateId && !id && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>This certificate ID is not valid.</MessageBarBody>
              </MessageBar>
            )}
            {id && q.isPending && <Spinner size="small" label="Checking…" />}
            {id && q.isError && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>Not found</MessageBarTitle>
                  {isApiError(q.error) && q.error.status === 404
                    ? "No signed document has this certificate ID."
                    : "We could not check this certificate right now. Try again later."}
                </MessageBarBody>
              </MessageBar>
            )}
            {id && q.data && (
              <MessageBar intent={q.data.valid ? "success" : "error"} layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>{q.data.valid ? "Valid certificate" : "Not valid"}</MessageBarTitle>
                  {q.data.valid
                    ? `“${q.data.title ?? "Document"}” was signed by ${q.data.signer_count} signer${q.data.signer_count === 1 ? "" : "s"}${
                        q.data.completed_at ? ` and completed on ${formatDateTime(q.data.completed_at)}` : ""
                      }.`
                    : "This certificate does not belong to a completed signature."}
                </MessageBarBody>
              </MessageBar>
            )}
          </div>
          <Caption1>To check the file itself, ask the sender to verify it in Talent OS.</Caption1>
        </Card>
      </main>
      <footer className={styles.footer}>
        <Caption1>Talent OS electronic signatures</Caption1>
      </footer>
    </div>
  );
}
