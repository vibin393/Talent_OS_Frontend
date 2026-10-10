"use client";

import { Body1, Card, CardHeader, makeStyles, Spinner, Subtitle1, tokens } from "@fluentui/react-components";
import { Clock48Regular, ErrorCircle48Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { publicEsignApi } from "@/features/esign/public-api";
import { publicOfferApi, type PublicLinkView } from "./candidate-api";
import { responseError } from "./candidate-offer";
import { CandidateOfferView } from "./candidate-offer-view";

const useStyles = makeStyles({
  root: { width: "100%" },
  status: { maxWidth: "560px", margin: "0 auto", padding: tokens.spacingHorizontalL },
});

/**
 * Secure-link offer page (purpose `offer_response`), rendered by the Epic 6 `/l/[token]` page. It POSTs
 * `viewed` once from the browser; accept / decline consume the link. Errors: 404, 410 (used / expired), 429.
 */
export function PublicOfferResponse({ token, initialView }: { token: string; initialView?: PublicLinkView | null }) {
  const styles = useStyles();
  const [link, setLink] = useState<PublicLinkView | null>(initialView ?? null);
  const [error, setError] = useState<unknown>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (initialView && reloads === 0) return;
    let alive = true;
    publicOfferApi
      .view(token)
      .then((v) => alive && setLink(v))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [token, initialView, reloads]);

  const onViewed = useCallback(() => publicOfferApi.viewed(token), [token]);
  // Epic 22: tenants can require an emailed code to accept (checked once; failures mean "not required").
  const [otpRequired, setOtpRequired] = useState(false);
  useEffect(() => {
    let alive = true;
    publicEsignApi
      .offerOtpStatus(token)
      .then((r) => alive && setOtpRequired(!!r.required))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token]);

  const offer = link?.offer ?? null;
  if (error || (link && !offer)) {
    const e = responseError(error ?? new ApiError(404, "not_found", ""));
    const expired = e.kind === "expired" || e.kind === "not_open";
    return (
      <section className={styles.root} aria-label="Your offer">
        <Card className={styles.status}>
          <CardHeader
            image={expired ? <Clock48Regular aria-hidden /> : <ErrorCircle48Regular aria-hidden />}
            header={
              <Subtitle1 as="h1">
                {e.kind === "not_found" ? "Link not found" : e.kind === "rate_limited" ? "Too many attempts" : expired ? "This link is no longer active" : "Something went wrong"}
              </Subtitle1>
            }
            description={<Body1>{e.message}</Body1>}
          />
        </Card>
      </section>
    );
  }
  if (!offer) {
    return (
      <section className={styles.root} aria-label="Your offer">
        <Spinner label="Loading your offer…" />
      </section>
    );
  }
  return (
    <section className={styles.root} aria-label="Your offer">
      <CandidateOfferView
        key={`${offer.version_no}-${reloads}`}
        offer={offer}
        letterUrl={offer.letter_available ? publicOfferApi.letterUrl(token) : null}
        onViewed={onViewed}
        onAccept={async (body) => (await publicOfferApi.accept(token, body)).offer}
        onDecline={async (body) => (await publicOfferApi.decline(token, body)).offer}
        otp={otpRequired ? { sendOtp: () => publicEsignApi.sendOfferOtp(token) } : null}
        onReload={() => {
          setLink(null);
          setReloads((n) => n + 1);
        }}
      />
    </section>
  );
}
