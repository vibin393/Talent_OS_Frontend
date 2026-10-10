"use client";

import { Body1, Button, Caption1, Card, Field, Input, makeStyles, MessageBar, MessageBarBody, Spinner, Subtitle1, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/errors";
import { publicRecordingApi } from "./api";
import type { CaptureAckView, RecordingConsentView } from "./types";

const useStyles = makeStyles({
  card: { maxWidth: "640px", margin: "0 auto", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  notice: { whiteSpace: "pre-wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Shared consent form of the public link and the Candidate Portal: "Where are you right now?", "I agree" / "No thanks". */
export function RecordingConsentForm({
  view,
  onDecide,
}: {
  view: RecordingConsentView;
  onDecide: (body: { decision: "agree" | "refuse"; country?: string | null; region?: string | null }) => Promise<RecordingConsentView>;
}) {
  const styles = useStyles();
  const [country, setCountry] = useState(view.country === "IN" ? "India" : (view.country ?? ""));
  const [region, setRegion] = useState(view.region ?? "");
  const [busy, setBusy] = useState<"agree" | "refuse" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState(view.status);
  const decide = async (decision: "agree" | "refuse") => {
    if (decision === "agree" && !country.trim()) {
      setError("Tell us which country you are in.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const out = await onDecide({ decision, country: country.trim() || null, region: region.trim() || null });
      setState(out.status);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className={styles.card}>
      <Subtitle1 as="h1">Recording your interview with {view.tenant_name ?? "the hiring team"}</Subtitle1>
      {view.stage_name && <Caption1 className={styles.muted}>{view.stage_name} interview</Caption1>}
      <Body1 as="p" className={styles.notice}>
        <strong>{view.notice_title}</strong>
        {"\n"}
        {view.notice_body}
      </Body1>
      {state === "agreed" && (
        <MessageBar intent="success">
          <MessageBarBody>Thank you. You agreed to the interview being recorded or transcribed. You can change your mind at any time.</MessageBarBody>
        </MessageBar>
      )}
      {state === "refused" && (
        <MessageBar intent="info">
          <MessageBarBody>The interview will not be recorded or transcribed. It goes ahead as usual.</MessageBarBody>
        </MessageBar>
      )}
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Where are you right now?" hint="Country (and state, if you like). Recording is only allowed where the law permits it.">
        <Input value={country} placeholder="Country" onChange={(_, d) => setCountry(d.value)} />
      </Field>
      <Field label="State or region">
        <Input value={region} onChange={(_, d) => setRegion(d.value)} />
      </Field>
      <div className={styles.actions}>
        <Button appearance="primary" disabled={!!busy} icon={busy === "agree" ? <Spinner size="tiny" /> : undefined} onClick={() => decide("agree")}>
          I agree
        </Button>
        <Button disabled={!!busy} onClick={() => decide("refuse")}>
          No thanks
        </Button>
      </div>
    </Card>
  );
}

/** Public secure-link page (purpose `interview_recording_consent`). */
export function PublicRecordingConsent({ token }: { token: string }) {
  const q = useQuery({ queryKey: ["public-recording-consent", token], queryFn: () => publicRecordingApi.consentView(token), retry: false });
  const qc = useQueryClient();
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.isError)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  return (
    <RecordingConsentForm
      view={q.data}
      onDecide={async (body) => {
        const out = await publicRecordingApi.consentDecide(token, body);
        qc.setQueryData(["public-recording-consent", token], out);
        return out;
      }}
    />
  );
}

/** Public secure-link page for an external (Client) interviewer (purpose `interview_capture_ack`). */
export function PublicCaptureAck({ token }: { token: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: ["public-capture-ack", token], queryFn: () => publicRecordingApi.ackView(token), retry: false });
  const [view, setView] = useState<CaptureAckView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.isError)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  const v = view ?? q.data;
  return (
    <Card className={styles.card}>
      <Subtitle1 as="h1">Agree to recording for this interview</Subtitle1>
      {v.stage_name && (
        <Caption1 className={styles.muted}>
          {v.stage_name} interview · {v.tenant_name}
        </Caption1>
      )}
      <Body1 as="p">{v.statement}</Body1>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {v.status === "agreed" ? (
        <MessageBar intent="success">
          <MessageBarBody>Thank you. You agreed to recording for this interview.</MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                setView(await publicRecordingApi.ack(token));
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            I agree
          </Button>
        </div>
      )}
    </Card>
  );
}
