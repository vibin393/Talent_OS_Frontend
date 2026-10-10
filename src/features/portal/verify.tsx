"use client";

import { Body1, Button, Card, makeStyles, MessageBar, MessageBarBody, Spinner, Title2, tokens } from "@fluentui/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CareerThemeProvider } from "@/features/careers/career-theme-provider";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import { rememberedTenant, rememberTenant, signInUrl, tokenFromFragment } from "./format";

const STORAGE_KEY = "portal-verify-token";
const noopSubscribe = () => () => {};
let firstRead: string | null = null;

/** The `#t=` token, saved to sessionStorage so a reload of the (fragment-less) page still works. */
function readToken(): string {
  if (firstRead !== null) return firstRead;
  let value = tokenFromFragment(window.location.hash);
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else value = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // storage unavailable: the token still works for this page view
  }
  firstRead = value;
  return value;
}

function forgetToken() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Copy for a failed verification (410 expired / used / revoked, 404 invalid). */
export function verifyErrorCopy(e: unknown): { title: string; body: string; canResend: boolean } {
  if (isApiError(e)) {
    switch (e.code) {
      case "link_expired":
        return { title: "This link has expired", body: "Sign-in links work for 15 minutes. Send yourself a new one.", canResend: true };
      case "link_used":
        return { title: "This link was already used", body: "Each sign-in link works once. Send yourself a new one.", canResend: true };
      case "link_revoked":
        return { title: "This link is no longer valid", body: "A newer link was sent, or this one was cancelled. Use the latest email or send a new link.", canResend: true };
      case "link_invalid":
        return { title: "We don't recognise this link", body: "Check that you opened the full link from the email, or send yourself a new one.", canResend: true };
    }
    if (e.status === 429) return { title: "Too many attempts", body: "Too many attempts, try again later.", canResend: false };
  }
  return { title: "We couldn't sign you in", body: errorMessage(e), canResend: true };
}

const useStyles = makeStyles({
  wrap: { flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalL}` },
  card: { width: "100%", maxWidth: "440px", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  button: { minHeight: "44px" },
});

/**
 * Magic-link landing page (`/portal/verify#t=<token>`). The token stays in the fragment (never sent to a
 * server or referrer), is cleared from the address bar, and is only POSTed when the candidate presses
 * "Continue" — mail scanners that prefetch the link never consume it.
 */
export function VerifyView() {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const token = useSyncExternalStore(noopSubscribe, readToken, () => "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await portalApi.verify(token);
      forgetToken();
      rememberTenant(me.tenant.slug);
      queryClient.setQueryData(portalKeys.me, me);
      router.replace("/portal");
    } catch (e) {
      forgetToken();
      setError(e);
      setBusy(false);
    }
  };

  const copy = error ? verifyErrorCopy(error) : null;
  const resend = () => router.push(signInUrl(rememberedTenant()));

  return (
    <CareerThemeProvider brandColor={null}>
      <main id="main" className={styles.wrap}>
        <Card className={styles.card}>
          {!hydrated ? (
            <Spinner label="Loading" />
          ) : copy ? (
            <>
              <Title2 as="h1">{copy.title}</Title2>
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>{copy.body}</MessageBarBody>
              </MessageBar>
              {copy.canResend && (
                <Button appearance="primary" className={styles.button} onClick={resend}>
                  Send a new link
                </Button>
              )}
            </>
          ) : !token ? (
            <>
              <Title2 as="h1">Sign-in link missing</Title2>
              <Body1>Open the full link from your email, or send yourself a new one.</Body1>
              <Button appearance="primary" className={styles.button} onClick={resend}>
                Send a new link
              </Button>
            </>
          ) : (
            <>
              <Title2 as="h1">Welcome back</Title2>
              <Body1>Press continue to sign in to your candidate portal on this device.</Body1>
              <Button appearance="primary" className={styles.button} onClick={verify} disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                Continue to your portal
              </Button>
            </>
          )}
        </Card>
      </main>
    </CareerThemeProvider>
  );
}
