"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, errorMessage, toApiError } from "@/lib/api/errors";
import { CHECK_TYPE_LABELS } from "./logic";
import type { CheckResult, ProviderCheckView } from "./types";

const useStyles = makeStyles({
  card: { maxWidth: "640px", width: "100%", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, boxSizing: "border-box" },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM, textAlign: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  files: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
  pre: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: tokens.fontSizeBase200, margin: 0 },
  button: { minHeight: "44px" },
});

const enc = encodeURIComponent;

async function getView(token: string): Promise<ProviderCheckView> {
  const res = await fetch(`/api/v1/public/links/${enc(token)}/bgv-check`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as ProviderCheckView;
}

async function submit(token: string, form: FormData): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/public/links/${enc(token)}/bgv-check`, { method: "POST", body: form, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
}

/** Purpose `bgv_provider_check`: the minimal check view (own files only) and the result form (a proposal). */
export function PublicProviderCheck({ token }: { token: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: ["public", "bgv-check", token], queryFn: () => getView(token), retry: false });
  const [result, setResult] = useState<CheckResult>("verified");
  const [note, setNote] = useState("");
  const [verifier, setVerifier] = useState("");
  const [source, setSource] = useState("");
  const [verifiedOn, setVerifiedOn] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (q.isPending) return <Spinner label="Loading the verification request" />;
  if (q.isError) {
    return (
      <Card className={styles.card}>
        <Body1 role="alert">{errorMessage(q.error, "This link is not valid.")}</Body1>
      </Card>
    );
  }
  const view = q.data;
  if (done || view.submitted) {
    return (
      <Card className={styles.card}>
        <div className={styles.state}>
          <CheckmarkCircle48Regular aria-hidden className={styles.ok} />
          <Body1 role="status">Thank you — your result was sent to {view.tenant_name ?? "the hiring team"} for review.</Body1>
        </div>
      </Card>
    );
  }
  const send = async () => {
    const form = new FormData();
    form.append("result", result);
    if (note) form.append("note", note);
    if (verifier) form.append("verifier_name", verifier);
    if (source) form.append("source_contacted", source);
    if (verifiedOn) form.append("verified_on", verifiedOn);
    for (const f of files) form.append("files", f);
    setBusy(true);
    setError(null);
    try {
      await submit(token, form);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className={styles.card}>
      <Text as="h1" size={500} weight="semibold">
        {CHECK_TYPE_LABELS[view.check_type]} verification
      </Text>
      <Body1>
        {view.subject_label} · {view.candidate_name ?? "Candidate"}
      </Body1>
      <Caption1>Requested by {view.tenant_name ?? "the hiring team"}. Only the documents needed for this check are shared.</Caption1>
      {view.files.length > 0 && (
        <ul className={styles.files}>
          {view.files.map((f) => (
            <li key={f.file_id}>
              <Link href={`/api/v1/public/links/${enc(token)}/bgv-check/files/${enc(f.file_id)}`}>{f.original_name}</Link>
            </li>
          ))}
        </ul>
      )}
      {Object.keys(view.declarations).length > 0 && <pre className={styles.pre}>{JSON.stringify(view.declarations, null, 2)}</pre>}
      <Field label="Result" required>
        <RadioGroup value={result} onChange={(_, d) => setResult(d.value as CheckResult)}>
          <Radio value="verified" label="Verified" />
          <Radio value="discrepancy" label="Discrepancy found" />
          <Radio value="unable_to_verify" label="Unable to verify" />
        </RadioGroup>
      </Field>
      <Field label="Note">
        <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
      </Field>
      <Field label="Verifier name">
        <Input value={verifier} onChange={(_, d) => setVerifier(d.value)} />
      </Field>
      <Field label="Source contacted">
        <Input value={source} onChange={(_, d) => setSource(d.value)} />
      </Field>
      <Field label="Verified on">
        <Input type="date" value={verifiedOn} onChange={(_, d) => setVerifiedOn(d.value)} />
      </Field>
      <Field label="Evidence (PDF, JPG, PNG)">
        <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </Field>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Button appearance="primary" className={styles.button} disabled={busy} onClick={() => void send()}>
        Submit result (one use)
      </Button>
    </Card>
  );
}
