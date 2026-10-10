"use client";

import { Body1, Button, Caption1, Card, Checkbox, Dropdown, Field, Input, makeStyles, MessageBar, MessageBarBody, Option, Spinner, Subtitle1, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { publicVoiceApi } from "./api";
import { consentError } from "./logic";
import type { VoiceConsentView } from "./types";

const useStyles = makeStyles({
  card: { maxWidth: "640px", margin: "0 auto", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  notice: { whiteSpace: "pre-wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

export const COUNTRIES: { code: string; label: string }[] = [
  { code: "IN", label: "India" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Germany" },
  { code: "GB", label: "United Kingdom" },
  { code: "SG", label: "Singapore" },
  { code: "US", label: "United States" },
];

/** Public Secure-Link page (purpose `voice_consent`): location, then the call and recording agreements separately. */
export function PublicVoiceConsent({ token }: { token: string }) {
  const q = useQuery({ queryKey: ["public-voice-consent", token], queryFn: () => publicVoiceApi.view(token), retry: false });
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.isError)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  return <VoiceConsentForm token={token} view={q.data} />;
}

export function VoiceConsentForm({ token, view }: { token: string; view: VoiceConsentView }) {
  const styles = useStyles();
  const [country, setCountry] = useState(view.country ?? "");
  const [region, setRegion] = useState(view.region ?? "");
  const [call, setCall] = useState(view.voice_screening === "granted");
  const [recording, setRecording] = useState(view.call_recording === "granted");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<VoiceConsentView | null>(null);
  const tenant = view.tenant_name ?? "the hiring team";
  if (saved)
    return (
      <Card className={styles.card}>
        <Subtitle1 as="h1">Screening call with {tenant}</Subtitle1>
        <MessageBar intent="success">
          <MessageBarBody>Thanks — {view.recruiter_name ?? "the recruiter"} will be in touch.</MessageBarBody>
        </MessageBar>
      </Card>
    );
  const save = async () => {
    const invalid = consentError(country);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setSaved(await publicVoiceApi.decide(token, { country, region: region.trim() || null, voice_screening: call, call_recording: call && recording }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className={styles.card}>
      <Subtitle1 as="h1">Screening call with {tenant}</Subtitle1>
      {view.demand_title && <Caption1 className={styles.muted}>{view.demand_title}</Caption1>}
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Where are you right now?" required>
        <Dropdown
          aria-label="Country"
          placeholder="Country"
          value={COUNTRIES.find((c) => c.code === country)?.label ?? country}
          selectedOptions={country ? [country] : []}
          onOptionSelect={(_, d) => setCountry(d.optionValue ?? "")}
        >
          {COUNTRIES.map((c) => (
            <Option key={c.code} value={c.code}>
              {c.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="State">
        <Input value={region} onChange={(_, d) => setRegion(d.value)} />
      </Field>
      {view.notices.map((n) => (
        <Body1 as="p" key={n.purpose} className={styles.notice}>
          <strong>{n.title}</strong>
          {"\n"}
          {n.body}
        </Body1>
      ))}
      <Checkbox checked={call} label="I agree to a screening call" onChange={(_, d) => setCall(!!d.checked)} />
      <Checkbox
        checked={call && recording}
        disabled={!call}
        label="I agree to the call being recorded (optional)"
        onChange={(_, d) => setRecording(!!d.checked)}
      />
      <div>
        <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={save}>
          Save my choices
        </Button>
      </div>
    </Card>
  );
}
