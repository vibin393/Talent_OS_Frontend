"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  mergeClasses,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  Title3,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import {
  CheckmarkCircle48Regular,
  Clock48Regular,
  DismissCircle48Regular,
  DocumentPdf20Regular,
  ErrorCircle48Regular,
  Mail20Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/features/admin/ui";
import type { CeremonyOut, OtpSentOut } from "@/features/documents/types";
import { SIGNER_STATUS_LABELS } from "@/features/documents/logic";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  type CeremonyApi,
  type CeremonyChannel,
  type CeremonyError,
  ceremonyError,
  ceremonyStep,
  type CeremonyStep,
  documentUrl,
  needsOtp,
  normalizeOtp,
  otpSentMessage,
  signerProgress,
  validateSign,
} from "./ceremony-logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, width: "100%", maxWidth: "880px", marginInline: "auto", minWidth: 0 },
  card: {
    padding: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM },
  },
  heading: { margin: 0, overflowWrap: "anywhere", ":focus": { outlineStyle: "none" }, ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` } },
  subtitle: { ...typographyStyles.subtitle1 },
  muted: { color: tokens.colorNeutralForeground3 },
  frame: {
    width: "100%",
    height: "70vh",
    minHeight: "360px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  docHeader: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  signers: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  signerRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS, minHeight: "32px" },
  signerName: { flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere" },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "@media (max-width: 480px)": { flexDirection: "column", alignItems: "stretch" },
  },
  touch: { minHeight: "44px", minWidth: "44px" },
  checkbox: { minHeight: "44px", alignItems: "center" },
  otpRow: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  otpInput: { minHeight: "44px", maxWidth: "200px", letterSpacing: "0.3em", fontVariantNumeric: "tabular-nums" },
  input: { minHeight: "44px", width: "100%" },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalS },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

/** Heading that takes focus when `focusKey` changes so screen readers announce the new state. */
function FocusHeading({ children, focusKey, as = "h2" }: { children: React.ReactNode; focusKey: string; as?: "h1" | "h2" }) {
  const styles = useStyles();
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus();
  }, [focusKey]);
  const Tag = as;
  return (
    <Tag ref={ref} tabIndex={-1} className={mergeClasses(styles.heading, styles.subtitle)}>
      {children}
    </Tag>
  );
}

function ErrorLive({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive" role="alert">
      {message && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

export type SignCeremonyProps = {
  channel: CeremonyChannel;
  api: CeremonyApi;
  /** Called after this signer signs or declines (e.g. to refresh a list). */
  onFinished?: (outcome: "signed" | "declined") => void;
};

/**
 * Signing ceremony shared by the internal app, the worker portal and secure links: the PDF, consent to sign
 * electronically, the emailed code (when required), a typed-name signature and Decline. Works from 360px wide.
 */
export function SignCeremony({ channel, api, onFinished }: SignCeremonyProps) {
  const styles = useStyles();
  const queryKey = ["esign-ceremony", api.key];
  const q = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.load(signal),
    retry: (count, e) => count < 1 && ceremonyError(e).message.startsWith("Cannot reach"),
    refetchOnWindowFocus: channel !== "public",
  });

  if (q.isPending) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading the document…" />
      </Card>
    );
  }
  if (q.isError) {
    const err = ceremonyError(q.error);
    return (
      <Card className={styles.card}>
        <div className={styles.state}>
          <ErrorCircle48Regular aria-hidden className={styles.danger} />
          <Title3 as="h1">This document can&apos;t be opened</Title3>
          <Body1 role="alert">{err.message}</Body1>
          {!err.fatal && (
            <Button className={styles.touch} onClick={() => q.refetch()}>
              Try again
            </Button>
          )}
        </div>
      </Card>
    );
  }
  return <CeremonyBody key={q.data.signer_id} api={api} queryKey={queryKey} c={q.data} onFinished={onFinished} reload={() => q.refetch()} />;
}

function CeremonyBody({
  api,
  c,
  queryKey,
  reload,
  onFinished,
}: {
  api: CeremonyApi;
  c: CeremonyOut;
  queryKey: readonly unknown[];
  reload: () => unknown;
  onFinished?: (outcome: "signed" | "declined") => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const wide = useMediaQuery("(min-width: 640px)");
  const [agreed, setAgreed] = useState(c.consented);
  const [typedName, setTypedName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState<OtpSentOut | null>(null);
  const [busy, setBusy] = useState<"consent" | "otp" | "sign" | "decline" | null>(null);
  const [error, setError] = useState<CeremonyError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"agreed" | "typedName" | "otp", string>>>({});
  const [fatal, setFatal] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);

  const step: CeremonyStep = ceremonyStep(c);
  const otpRequired = needsOtp(c);
  const pdf = documentUrl(c, api.viewUrl);

  const focusField = (field: "agreed" | "typedName" | "otp" | null) => {
    const el = field === "otp" ? otpRef.current : field === "typedName" ? nameRef.current : field === "agreed" ? agreeRef.current : null;
    requestAnimationFrame(() => el?.focus());
  };

  const fail = (e: unknown) => {
    const err = ceremonyError(e);
    if (err.fatal) {
      setFatal(err.message);
      if (err.reload) void reload();
      return;
    }
    setError(err);
    if (err.field) {
      setFieldErrors({ [err.field]: err.message });
      if (err.field === "agreed") setAgreed(false);
      focusField(err.field);
    }
    if (err.reload) void reload();
  };

  const onAgree = async (checked: boolean) => {
    setAgreed(checked);
    setFieldErrors((f) => ({ ...f, agreed: undefined }));
    if (!checked || c.consented) return;
    setBusy("consent");
    setError(null);
    try {
      await api.consent();
      queryClient.setQueryData<CeremonyOut>(queryKey, (old) => (old ? { ...old, consented: true } : old));
    } catch (e) {
      setAgreed(false);
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    setBusy("otp");
    setError(null);
    setFieldErrors((f) => ({ ...f, otp: undefined }));
    try {
      const sent = await api.sendOtp();
      setOtpSent(sent);
      setOtp("");
      focusField("otp");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const sign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const found = validateSign({ agreed, typedName, otp }, otpRequired);
    setFieldErrors(found);
    const first = (["agreed", "otp", "typedName"] as const).find((k) => found[k]);
    if (first) {
      focusField(first);
      return;
    }
    setBusy("sign");
    try {
      await api.sign({ typed_name: typedName.trim(), agreed: true, ...(otpRequired ? { otp } : {}) });
      await reload();
      onFinished?.("signed");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    setBusy("decline");
    setError(null);
    try {
      await api.decline(reason.trim() || null);
      setDeclining(false);
      await reload();
      onFinished?.("declined");
    } catch (err) {
      setDeclining(false);
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.root}>
      <div>
        <Caption1 className={styles.muted}>{[c.tenant_name, c.human_id].filter(Boolean).join(" · ")}</Caption1>
        <Title3 as="h1" style={{ display: "block", overflowWrap: "anywhere" }}>
          {c.title}
        </Title3>
        <Body1>
          {signerProgress(c)} · Sign by {formatDateTime(c.expires_at)}
        </Body1>
      </div>

      {fatal ? (
        <Card className={styles.card}>
          <div className={styles.state}>
            <ErrorCircle48Regular aria-hidden className={styles.danger} />
            <FocusHeading focusKey={`fatal-${fatal}`}>This document can&apos;t be signed</FocusHeading>
            <Body1 role="alert">{fatal}</Body1>
          </div>
        </Card>
      ) : (
        <StatusCard step={step} c={c} />
      )}

      <Card className={styles.card} role="region" aria-labelledby="esign-doc-title">
        <div className={styles.docHeader}>
          <Subtitle1 as="h2" id="esign-doc-title">
            Document
          </Subtitle1>
          <Button as="a" href={pdf} target="_blank" rel="noopener noreferrer" icon={<DocumentPdf20Regular />} className={styles.touch}>
            Open the document (PDF)
          </Button>
        </div>
        {wide && <iframe src={pdf} title={`Document to sign: ${c.title}`} className={styles.frame} />}
        {!wide && <Caption1 className={styles.muted}>Open the document to read it before you sign.</Caption1>}
      </Card>

      <Card className={styles.card} role="region" aria-labelledby="esign-signers-title">
        <Subtitle1 as="h2" id="esign-signers-title">
          Signers
        </Subtitle1>
        <ol className={styles.signers}>
          {[...c.signers]
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <li key={`${s.order}-${s.name}`} className={styles.signerRow}>
                <Text className={styles.signerName}>
                  {s.order}. {s.name}
                </Text>
                <Badge appearance="tint" color={s.status === "signed" ? "success" : s.status === "declined" ? "danger" : "informative"}>
                  {SIGNER_STATUS_LABELS[s.status] ?? s.status}
                </Badge>
                {s.signed_at && <Caption1 className={styles.muted}>{formatDateTime(s.signed_at)}</Caption1>}
              </li>
            ))}
        </ol>
      </Card>

      {!fatal && (step === "consent" || step === "sign") && (
        <Card className={styles.card} role="region" aria-labelledby="esign-sign-title">
          <form className={styles.card} style={{ padding: 0 }} onSubmit={sign} noValidate>
            <Subtitle1 as="h2" id="esign-sign-title">
              Sign as {c.signer_name}
            </Subtitle1>
            <Field validationState={fieldErrors.agreed ? "error" : "none"} validationMessage={fieldErrors.agreed}>
              <Checkbox
                ref={agreeRef}
                className={styles.checkbox}
                checked={agreed || c.consented}
                disabled={c.consented || busy === "consent"}
                onChange={(_, d) => onAgree(!!d.checked)}
                label="I agree to sign electronically. My typed name is my signature on this document."
              />
            </Field>
            {busy === "consent" && <Spinner size="tiny" label="Saving your agreement…" labelPosition="after" />}

            {otpRequired && (
              <div className={styles.card} style={{ padding: 0 }}>
                <Body1>For your security we email you a 6-digit code to confirm it&apos;s you.</Body1>
                <div className={styles.otpRow}>
                  <Button
                    className={styles.touch}
                    icon={busy === "otp" ? <Spinner size="tiny" /> : <Mail20Regular />}
                    disabled={!!busy || !(agreed || c.consented)}
                    onClick={sendCode}
                  >
                    {otpSent ? "Send a new code" : "Send code"}
                  </Button>
                </div>
                <div aria-live="polite">
                  {otpSent && (
                    <Caption1>
                      {otpSentMessage(otpSent)} It expires at {formatDateTime(otpSent.expires_at)}.
                    </Caption1>
                  )}
                </div>
                <Field
                  label="6-digit code"
                  required
                  validationState={fieldErrors.otp ? "error" : "none"}
                  validationMessage={fieldErrors.otp}
                >
                  <Input
                    ref={otpRef}
                    className={styles.otpInput}
                    value={otp}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    disabled={!!busy}
                    onChange={(_, d) => {
                      setOtp(normalizeOtp(d.value));
                      if (fieldErrors.otp) setFieldErrors((f) => ({ ...f, otp: undefined }));
                    }}
                  />
                </Field>
              </div>
            )}

            <Field
              label="Type your full name"
              required
              hint={`Exactly as shown: ${c.signer_name}`}
              validationState={fieldErrors.typedName ? "error" : "none"}
              validationMessage={fieldErrors.typedName}
            >
              <Input
                ref={nameRef}
                className={styles.input}
                value={typedName}
                autoComplete="name"
                maxLength={300}
                disabled={!!busy}
                onChange={(_, d) => {
                  setTypedName(d.value);
                  if (fieldErrors.typedName) setFieldErrors((f) => ({ ...f, typedName: undefined }));
                }}
              />
            </Field>

            <ErrorLive message={error && !error.field ? error.message : null} />

            <div className={styles.actions}>
              <Button type="submit" appearance="primary" size="large" className={styles.touch} disabled={!!busy} icon={busy === "sign" ? <Spinner size="tiny" /> : undefined}>
                Sign
              </Button>
              <Button size="large" className={styles.touch} disabled={!!busy} onClick={() => setDeclining(true)}>
                Decline
              </Button>
            </div>
            <Caption1 className={styles.muted}>
              We record your typed name, the time, your IP address and a fingerprint of the document as evidence of your signature.
            </Caption1>
          </form>
        </Card>
      )}

      <Dialog open={declining} modalType="alert" onOpenChange={(_, d) => !d.open && busy !== "decline" && setDeclining(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Decline to sign?</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              <Body1>The sender is told you declined, and the request ends for everyone. You can&apos;t undo this.</Body1>
              <Field label="Reason (optional)">
                <Textarea value={reason} maxLength={2000} resize="vertical" onChange={(_, d) => setReason(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                className={styles.touch}
                disabled={busy === "decline"}
                icon={busy === "decline" ? <Spinner size="tiny" /> : undefined}
                onClick={decline}
              >
                Decline
              </Button>
              <Button className={styles.touch} disabled={busy === "decline"} onClick={() => setDeclining(false)}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function StatusCard({ step, c }: { step: CeremonyStep; c: CeremonyOut }) {
  const styles = useStyles();
  if (step === "consent" || step === "sign") return null;
  const content: Record<Exclude<CeremonyStep, "consent" | "sign">, { icon: React.ReactNode; title: string; body: string }> = {
    signed: {
      icon: <CheckmarkCircle48Regular aria-hidden className={styles.success} />,
      title: "You signed this document",
      body: "Thank you. We'll email everyone a copy of the signed document once all signers have signed.",
    },
    completed: {
      icon: <CheckmarkCircle48Regular aria-hidden className={styles.success} />,
      title: "This document is fully signed",
      body: "Everyone has signed. The signed copy is shown below and was emailed to all signers.",
    },
    declined: {
      icon: <DismissCircle48Regular aria-hidden />,
      title: "You declined to sign",
      body: "The sender has been told. Nothing more is needed from you.",
    },
    closed: {
      icon: <Clock48Regular aria-hidden />,
      title: c.status === "expired" ? "This request has expired" : c.status === "cancelled" ? "This request was cancelled" : "This request is closed",
      body: "It can no longer be signed. Contact the sender if you have questions.",
    },
    waiting: {
      icon: <Clock48Regular aria-hidden />,
      title: "Waiting for another signer",
      body: "Someone needs to sign before you. We'll email you when it's your turn.",
    },
  };
  const x = content[step];
  return (
    <Card className={styles.card}>
      <div className={styles.state} role="status">
        {x.icon}
        <FocusHeading focusKey={step}>{x.title}</FocusHeading>
        <Body1>{x.body}</Body1>
      </div>
    </Card>
  );
}
