"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, CheckmarkCircle48Regular, Clock48Regular, DismissCircle48Regular, Prohibited48Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/features/admin/ui";
import { useNowMs } from "@/lib/time/use-now";
import type { OtpSentOut } from "@/features/documents/types";
import { OTP_PATTERN, otpErrorMessage } from "@/features/esign/ceremony-logic";
import { OfferOtpField } from "@/features/esign/offer-otp-field";
import { canAccept, candidateOfferState, expiryCountdown, responseError, type ResponseError } from "./candidate-offer";
import { employmentLabel, formatDate, formatMoney, workModeLabel } from "./format";
import type { CandidateOfferView as OfferView } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, width: "100%", maxWidth: "880px", margin: "0 auto" },
  terms: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
    "@media (max-width: 480px)": { gridTemplateColumns: "1fr" },
  },
  frame: {
    width: "100%",
    height: "70vh",
    minHeight: "360px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  respond: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  status: { padding: tokens.spacingHorizontalL },
});

export type CandidateOfferViewProps = {
  offer: OfferView;
  /** URL the letter PDF can be embedded / downloaded from (secure link or portal endpoint). */
  letterUrl: string | null;
  /** POST "viewed" once after the page loads (never on GET, so mail scanners record nothing). */
  onViewed?: () => Promise<unknown>;
  onAccept: (input: { typed_name: string; version_no: number; agreed: boolean; otp?: string }) => Promise<OfferView | null | undefined | void>;
  onDecline: (input: { reason: string | null; version_no: number }) => Promise<OfferView | null | undefined | void>;
  /** Reload the offer (after "This offer was updated"). */
  onReload?: () => void;
  /** Epic 22: when set, accepting needs the emailed 6-digit code sent by `sendOtp`. */
  otp?: { sendOtp: () => Promise<OtpSentOut> } | null;
};

/**
 * Candidate-facing offer: terms summary (never bill rate or margin), the embedded letter with Download, an expiry
 * countdown, typed-name e-acceptance for the exact version and a Decline dialog. Shared by the secure-link page
 * (Epic 8) and the Candidate Portal (Epic 9), which only wire their own API calls into the callbacks.
 */
export function CandidateOfferView({ offer: initial, letterUrl, onViewed, onAccept, onDecline, onReload, otp }: CandidateOfferViewProps) {
  const styles = useStyles();
  const now = useNowMs(30_000);
  const [offer, setOffer] = useState<OfferView>(initial);
  const [typed, setTyped] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<ResponseError | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const viewedOnce = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const state = candidateOfferState(offer, now);

  useEffect(() => {
    if (viewedOnce.current || !onViewed) return;
    viewedOnce.current = true;
    onViewed().catch(() => undefined);
  }, [onViewed]);

  const settle = (next: OfferView | null | undefined | void, fallback: Partial<OfferView>) => {
    setOffer((o) => (next ? next : { ...o, ...fallback }));
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  const accept = async () => {
    setError(null);
    setBusy("accept");
    try {
      const next = await onAccept({ typed_name: typed.trim(), version_no: offer.version_no, agreed, ...(otp ? { otp: otpCode } : {}) });
      settle(next, {
        status: "accepted",
        can_respond: false,
        response: { decision: "accepted", version_no: offer.version_no, typed_name: typed.trim(), decided_at: new Date().toISOString() },
      });
    } catch (e) {
      const otpMsg = otpErrorMessage(e);
      if (otpMsg) setOtpError(otpMsg);
      else setError(responseError(e));
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    setError(null);
    setBusy("decline");
    try {
      const next = await onDecline({ reason: reason.trim() || null, version_no: offer.version_no });
      setDeclining(false);
      settle(next, {
        status: "declined",
        can_respond: false,
        response: { decision: "declined", version_no: offer.version_no, typed_name: null, decided_at: new Date().toISOString() },
      });
    } catch (e) {
      setDeclining(false);
      setError(responseError(e));
    } finally {
      setBusy(null);
    }
  };

  const countdown = expiryCountdown(offer.expires_at, now);

  return (
    <div className={styles.root}>
      <div>
        <Caption1 className={styles.muted}>{offer.tenant_name ?? "Your offer"}</Caption1>
        <Title3 as="h1" style={{ display: "block" }}>
          {offer.title}
        </Title3>
        <Body1>
          Offer {offer.reference} · version {offer.version_no}
          {countdown && state === "open" ? ` · ${countdown} (${formatDateTime(offer.expires_at)})` : ""}
        </Body1>
      </div>

      <div aria-live="polite" ref={resultRef} tabIndex={-1}>
        {state === "accepted" && (
          <Card className={styles.status}>
            <CardHeader
              image={<CheckmarkCircle48Regular aria-hidden color={tokens.colorPaletteGreenForeground1} />}
              header={<Subtitle1 as="h2">You accepted this offer</Subtitle1>}
              description={
                <Body1>
                  Signed as “{offer.response?.typed_name ?? typed}” on {formatDateTime(offer.response?.decided_at)} for version {offer.response?.version_no ?? offer.version_no}. A
                  signed copy of the letter is being emailed to you.
                </Body1>
              }
            />
          </Card>
        )}
        {state === "declined" && (
          <Card className={styles.status}>
            <CardHeader
              image={<DismissCircle48Regular aria-hidden />}
              header={<Subtitle1 as="h2">You declined this offer</Subtitle1>}
              description={<Body1>We have let the hiring team know. Thank you for your time.</Body1>}
            />
          </Card>
        )}
        {state === "expired" && (
          <Card className={styles.status}>
            <CardHeader
              image={<Clock48Regular aria-hidden />}
              header={<Subtitle1 as="h2">This offer has expired</Subtitle1>}
              description={<Body1>Contact your recruiter if you are still interested.</Body1>}
            />
          </Card>
        )}
        {state === "withdrawn" && (
          <Card className={styles.status}>
            <CardHeader
              image={<Prohibited48Regular aria-hidden />}
              header={<Subtitle1 as="h2">This offer was withdrawn</Subtitle1>}
              description={<Body1>Your recruiter will be in touch.</Body1>}
            />
          </Card>
        )}
        {state === "closed" && (
          <MessageBar intent="info">
            <MessageBarBody>This offer is not open for a response.</MessageBarBody>
          </MessageBar>
        )}
        {error && error.kind === "version_changed" && (
          <MessageBar intent="warning" layout="multiline" role="alert">
            <MessageBarBody>{error.message}</MessageBarBody>
            {onReload && (
              <MessageBarActions>
                <Button onClick={onReload}>Reload</Button>
              </MessageBarActions>
            )}
          </MessageBar>
        )}
        {error && error.kind !== "version_changed" && error.kind !== "name_mismatch" && (
          <MessageBar intent="error" layout="multiline" role="alert">
            <MessageBarBody>{error.message}</MessageBarBody>
          </MessageBar>
        )}
      </div>

      <Card>
        <CardHeader header={<Subtitle1 as="h2">Key terms</Subtitle1>} />
        <dl className={styles.terms}>
          <dt>Role</dt>
          <dd>
            {offer.title} · {employmentLabel(offer.employment_type)}
          </dd>
          <dt>Pay</dt>
          <dd>{formatMoney(offer.pay_rate, offer.pay_rate_unit)}</dd>
          {offer.bonus && (
            <>
              <dt>Bonus</dt>
              <dd>{formatMoney(offer.bonus)}</dd>
            </>
          )}
          <dt>Start date</dt>
          <dd>{formatDate(offer.start_date)}</dd>
          {offer.end_date && (
            <>
              <dt>End date</dt>
              <dd>{formatDate(offer.end_date)}</dd>
            </>
          )}
          {(offer.location || offer.work_mode) && (
            <>
              <dt>Location</dt>
              <dd>{[offer.location, offer.work_mode ? workModeLabel(offer.work_mode) : null].filter(Boolean).join(" · ")}</dd>
            </>
          )}
          {offer.benefits_summary && (
            <>
              <dt>Benefits</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{offer.benefits_summary}</dd>
            </>
          )}
          <dt>Respond by</dt>
          <dd>{offer.expires_at ? formatDateTime(offer.expires_at) : formatDate(offer.expiry_date)}</dd>
        </dl>
      </Card>

      {offer.letter_available && letterUrl && (
        <section aria-label="Offer letter">
          <div className={styles.actions} style={{ marginBottom: tokens.spacingVerticalS, alignItems: "center" }}>
            <Subtitle1 as="h2" style={{ flex: 1 }}>
              Offer letter
            </Subtitle1>
            <Link href={letterUrl} download={`${offer.reference}.pdf`} target="_blank" rel="noopener noreferrer">
              <ArrowDownload20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Download PDF
            </Link>
          </div>
          <iframe className={styles.frame} src={letterUrl} title={`Offer letter ${offer.reference}`} />
        </section>
      )}

      {state === "open" && (
        <Card className={styles.respond}>
          <Subtitle1 as="h2">Accept this offer</Subtitle1>
          <Field
            label="Type your full name to sign"
            required
            validationState={error?.kind === "name_mismatch" ? "error" : "none"}
            validationMessage={error?.kind === "name_mismatch" ? error.message : undefined}
            hint={offer.candidate_name ? `As it appears on the offer: ${offer.candidate_name}` : undefined}
          >
            <Input
              value={typed}
              autoComplete="name"
              maxLength={300}
              onChange={(_, d) => {
                setTyped(d.value);
                if (error?.kind === "name_mismatch") setError(null);
              }}
            />
          </Field>
          <Checkbox
            checked={agreed}
            onChange={(_, d) => setAgreed(!!d.checked)}
            label={`I agree that typing my name is my electronic signature for version ${offer.version_no} of this offer.`}
          />
          {otp && (
            <OfferOtpField
              value={otpCode}
              onChange={(v) => {
                setOtpCode(v);
                setOtpError(null);
              }}
              send={otp.sendOtp}
              error={otpError}
              disabled={!!busy}
            />
          )}
          <div className={styles.actions}>
            <Button appearance="primary" disabled={!canAccept(typed, agreed) || (!!otp && !OTP_PATTERN.test(otpCode)) || !!busy} icon={busy === "accept" ? <Spinner size="tiny" /> : undefined} onClick={accept}>
              Accept offer
            </Button>
            <Button disabled={!!busy} onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
          <Text size={200} className={styles.muted}>
            We record your typed name, the time, your IP address and the offer version as evidence of your signature.
          </Text>
        </Card>
      )}

      <Dialog open={declining} modalType="alert" onOpenChange={(_, d) => !d.open && !busy && setDeclining(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Decline this offer?</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              <Body1>You can&apos;t undo this. The hiring team is told you declined.</Body1>
              <Field label="Reason (optional)">
                <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={!!busy} icon={busy === "decline" ? <Spinner size="tiny" /> : undefined} onClick={decline}>
                Decline offer
              </Button>
              <Button disabled={!!busy} onClick={() => setDeclining(false)}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
