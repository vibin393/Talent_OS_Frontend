"use client";

import {
  Body1,
  Button,
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
  Link as FluentLink,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Subtitle1,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, DocumentPdf20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { OTP_PATTERN, otpErrorMessage } from "@/features/esign/ceremony-logic";
import { OfferOtpField } from "@/features/esign/offer-otp-field";
import { portalOfferOtpApi } from "@/features/esign/portal-api";
import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS } from "@/features/careers/format";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { CandidateOfferView } from "@/lib/api/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatDate, formatMoney, OFFER_STATUS_LABELS } from "./format";
import { type AcceptDraft, validateAccept, validateDecline } from "./forms";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";

const useStyles = makeStyles({
  letter: { width: "100%", height: "70vh", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium },
});

function offerError(e: unknown): string {
  if (isApiError(e)) {
    switch (e.code) {
      case "offer_version_changed":
        return "This offer was updated while you were reviewing it. We've loaded the latest version; please review it again.";
      case "offer_expired":
        return "This offer has expired and can no longer be accepted. Contact the hiring team if you have questions.";
      case "offer_not_open":
        return "This offer can no longer be answered.";
      case "name_mismatch":
        return "The name you typed does not match the name on the offer.";
      case "agreement_required":
        return "Confirm that typing your name is your electronic signature.";
    }
  }
  return errorMessage(e);
}

function AcceptDialog({ offer, open, onClose, onDone }: { offer: CandidateOfferView; open: boolean; onClose: () => void; onDone: (e?: unknown) => void }) {
  const styles = usePortalStyles();
  const [draft, setDraft] = useState<AcceptDraft>({ typedName: "", agreed: false });
  const [stage, setStage] = useState<"sign" | "confirm">("sign");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // Epic 22: an emailed code is required when the tenant turned on offer OTP.
  const otpStatus = useQuery({ queryKey: [...portalKeys.offer(offer.id), "otp"], queryFn: ({ signal }) => portalOfferOtpApi.status(offer.id, signal), retry: false });
  const otpRequired = !!otpStatus.data?.required;
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: () =>
      portalOfferOtpApi.accept(offer.id, {
        typed_name: draft.typedName.trim(),
        version_no: offer.version_no,
        agreed: draft.agreed,
        ...(otpRequired ? { otp } : {}),
      }),
  });

  const next = () => {
    const e = validateAccept(draft, offer.candidate_name);
    if (otpRequired && !OTP_PATTERN.test(otp)) e.otp = "Enter the 6-digit code from the email.";
    setOtpError(e.otp ?? null);
    setErrors(e);
    if (!Object.keys(e).length) setStage("confirm");
  };
  const confirm = async () => {
    setServerError(null);
    try {
      await accept.mutateAsync();
      onDone();
    } catch (e) {
      if (isApiError(e) && (e.code === "offer_version_changed" || e.code === "offer_expired" || e.code === "offer_not_open")) {
        onDone(e);
        return;
      }
      const otpMsg = otpErrorMessage(e);
      if (otpMsg) setOtpError(otpMsg);
      else setServerError(offerError(e));
      setStage("sign");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !accept.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{stage === "sign" ? "Accept this offer" : "Confirm your acceptance"}</DialogTitle>
          <DialogContent className={styles.form}>
            <InlineError message={serverError} />
            {stage === "sign" ? (
              <>
                <Body1>Typing your full name below is your electronic signature on version {offer.version_no} of this offer.</Body1>
                <Field
                  label="Your full name"
                  required
                  hint={offer.candidate_name ? `Exactly as on the offer: ${offer.candidate_name}` : undefined}
                  validationState={errors.typedName ? "error" : "none"}
                  validationMessage={errors.typedName}
                >
                  <Input
                    className={styles.input}
                    autoComplete="name"
                    value={draft.typedName}
                    maxLength={300}
                    onChange={(_, d) => setDraft((x) => ({ ...x, typedName: d.value }))}
                  />
                </Field>
                <Field validationState={errors.agreed ? "error" : "none"} validationMessage={errors.agreed}>
                  <Checkbox
                    checked={draft.agreed}
                    onChange={(_, d) => setDraft((x) => ({ ...x, agreed: !!d.checked }))}
                    label="I have read the offer and agree that typing my name is my electronic signature"
                  />
                </Field>
                {otpRequired && (
                  <OfferOtpField
                    value={otp}
                    onChange={(v) => {
                      setOtp(v);
                      setOtpError(null);
                    }}
                    send={() => portalOfferOtpApi.send(offer.id)}
                    error={otpError}
                  />
                )}
              </>
            ) : (
              <Body1>
                You are accepting the offer for <strong>{offer.title}</strong>, signed as <strong>{draft.typedName.trim()}</strong>. This can&apos;t be undone.
              </Body1>
            )}
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} disabled={accept.isPending} onClick={stage === "sign" ? onClose : () => setStage("sign")}>
              {stage === "sign" ? "Cancel" : "Back"}
            </Button>
            {stage === "sign" ? (
              <Button appearance="primary" className={styles.button} onClick={next}>
                Continue
              </Button>
            ) : (
              <Button appearance="primary" className={styles.button} onClick={confirm} disabled={accept.isPending} icon={accept.isPending ? <Spinner size="tiny" /> : undefined}>
                Accept offer
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function DeclineDialog({ offer, open, onClose, onDone }: { offer: CandidateOfferView; open: boolean; onClose: () => void; onDone: (e?: unknown) => void }) {
  const styles = usePortalStyles();
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const decline = useMutation({ mutationFn: () => portalApi.declineOffer(offer.id, { reason: reason.trim() || null, version_no: offer.version_no }) });
  const submit = async () => {
    setServerError(null);
    const e = validateDecline(reason);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await decline.mutateAsync();
      onDone();
    } catch (err) {
      if (isApiError(err) && (err.code === "offer_version_changed" || err.code === "offer_expired" || err.code === "offer_not_open")) {
        onDone(err);
        return;
      }
      setServerError(offerError(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !decline.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Decline this offer?</DialogTitle>
          <DialogContent className={styles.form}>
            <InlineError message={serverError} />
            <Body1>
              You are declining the offer for <strong>{offer.title}</strong>. This can&apos;t be undone.
            </Body1>
            <Field label="Reason (optional)" validationState={errors.reason ? "error" : "none"} validationMessage={errors.reason}>
              <Textarea value={reason} maxLength={2000} resize="vertical" onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button className={styles.button} onClick={onClose} disabled={decline.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" className={styles.button} onClick={submit} disabled={decline.isPending} icon={decline.isPending ? <Spinner size="tiny" /> : undefined}>
              Decline offer
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** An offer: letter preview, terms, and Accept (typed-name signature, then confirm) or Decline. */
export function OfferView({ id }: { id: string }) {
  const styles = usePortalStyles();
  const local = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const wide = useMediaQuery("(min-width: 640px)");
  const [dialog, setDialog] = useState<"accept" | "decline" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const q = useQuery({ queryKey: portalKeys.offer(id), queryFn: ({ signal }) => portalApi.offer(id, signal), retry: false });
  const viewed = useRef(false);
  const offerId = q.data?.id;

  // Record the view once from JavaScript (GETs record nothing, so mail scanners never mark it viewed).
  useEffect(() => {
    if (!offerId || viewed.current) return;
    viewed.current = true;
    portalApi
      .offerViewed(offerId)
      .then((view) => queryClient.setQueryData(portalKeys.offer(offerId), view))
      .catch(() => undefined);
  }, [offerId, queryClient]);

  const done = (kind: "accept" | "decline") => async (e?: unknown) => {
    setDialog(null);
    await queryClient.invalidateQueries({ queryKey: portalKeys.offer(id) });
    void queryClient.invalidateQueries({ queryKey: portalKeys.offers });
    void queryClient.invalidateQueries({ queryKey: portalKeys.applications });
    if (e) setNotice(offerError(e));
    else toast.success(kind === "accept" ? "You accepted the offer. Congratulations!" : "You declined the offer");
  };

  if (q.isPending) return <LoadingBlock label="Loading offer" />;
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404) {
      return (
        <Card className={styles.card}>
          <Subtitle1 as="h1">Offer not found</Subtitle1>
          <Body1>It may have been withdrawn. Go back to your applications.</Body1>
        </Card>
      );
    }
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  }
  const o = q.data;
  const letter = o.letter_available && o.letter_url && o.letter_url.startsWith("/api/") ? o.letter_url : null;

  return (
    <div className={styles.page}>
      <FluentLink href="/portal" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> My applications
      </FluentLink>
      <PortalPageHeader title={`Offer: ${o.title}`} subtitle={`${o.tenant_name ?? ""} · ${OFFER_STATUS_LABELS[o.status] ?? o.status}`} />
      {notice && (
        <MessageBar intent="warning" layout="multiline" role="alert">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      )}
      {o.response && (
        <MessageBar intent={o.response.decision === "accepted" ? "success" : "info"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{o.response.decision === "accepted" ? "You accepted this offer" : "You declined this offer"}</MessageBarTitle>
            {formatDate(o.response.decided_at)}
            {o.response.typed_name ? ` · signed as ${o.response.typed_name}` : ""}
          </MessageBarBody>
        </MessageBar>
      )}
      <Card className={styles.card}>
        <Subtitle1 as="h2">Offer details</Subtitle1>
        <dl className={styles.dl}>
          <dt>Role</dt>
          <dd>{o.title}</dd>
          <dt>Employment</dt>
          <dd>{EMPLOYMENT_TYPE_LABELS[o.employment_type] ?? o.employment_type}</dd>
          <dt>Pay</dt>
          <dd>{formatMoney(o.pay_rate, o.pay_rate_unit)}</dd>
          {o.bonus && (
            <>
              <dt>Bonus</dt>
              <dd>{formatMoney(o.bonus)}</dd>
            </>
          )}
          {o.benefits_summary && (
            <>
              <dt>Benefits</dt>
              <dd style={{ whiteSpace: "pre-line" }}>{o.benefits_summary}</dd>
            </>
          )}
          <dt>Start date</dt>
          <dd>{formatDate(o.start_date)}</dd>
          {o.end_date && (
            <>
              <dt>End date</dt>
              <dd>{formatDate(o.end_date)}</dd>
            </>
          )}
          {o.location && (
            <>
              <dt>Location</dt>
              <dd>{o.location}</dd>
            </>
          )}
          {o.work_mode && (
            <>
              <dt>Work mode</dt>
              <dd>{WORK_MODE_LABELS[o.work_mode] ?? o.work_mode}</dd>
            </>
          )}
          <dt>Respond by</dt>
          <dd>{formatDate(o.expiry_date)}</dd>
          <dt>Version</dt>
          <dd>{o.version_no}</dd>
        </dl>
        {o.can_respond && (
          <div className={styles.actions}>
            <Button appearance="primary" className={styles.button} onClick={() => setDialog("accept")}>
              Accept offer
            </Button>
            <Button className={styles.button} onClick={() => setDialog("decline")}>
              Decline
            </Button>
          </div>
        )}
      </Card>
      {letter && (
        <Card className={styles.card} role="region" aria-labelledby="letter-title">
          <div className={styles.actions} style={{ justifyContent: "space-between" }}>
            <Subtitle1 as="h2" id="letter-title">
              Offer letter
            </Subtitle1>
            <Button as="a" href={letter} target="_blank" rel="noopener" icon={<DocumentPdf20Regular />} className={styles.button}>
              Open the letter (PDF)
            </Button>
          </div>
          {wide && <iframe src={letter} title={`Offer letter for ${o.title}`} className={local.letter}/>}
        </Card>
      )}
      {dialog === "accept" && <AcceptDialog offer={o} open onClose={() => setDialog(null)} onDone={done("accept")} />}
      {dialog === "decline" && <DeclineDialog offer={o} open onClose={() => setDialog(null)} onDone={done("decline")} />}
    </div>
  );
}
