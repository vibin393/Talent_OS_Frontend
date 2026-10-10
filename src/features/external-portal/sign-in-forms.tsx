"use client";

import { Body1, Button, Field, Input, Link, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/features/auth/auth-frame";
import { FormAlert } from "@/features/auth/form-alert";
import { useFormStyles } from "@/features/auth/form-styles";
import { clientPortalSsoApi } from "@/features/client-sso/api";
import {
  discoveryKey,
  portalMfaParam,
  portalSignInMode,
  portalSsoErrorMessage,
  portalSsoStartUrl,
  safeSignInUrl,
  shouldDiscoverPortal,
  SSO_REQUIRED_MESSAGE,
} from "@/features/client-sso/sign-in";
import type { ClientSsoDiscoverOut } from "@/features/client-sso/types";
import { clientPortalApi } from "@/lib/api/client-portal-client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { takeFragmentToken } from "@/lib/api/external-portal-request";
import type { PortalAuthOut, PortalInviteOut } from "@/lib/api/types";
import { vendorPortalAuthApi } from "@/lib/api/vendor-portal-client";
import { safeNextPath } from "@/lib/navigation";
import { getLastWorkspace, setLastWorkspace } from "@/lib/workspace";
import { PortalMfaStep } from "./portal-mfa-step";

/** `next` inside the portal only (`/client...` / `/vendor...`). */
function portalNext(next: string | undefined, home: string): string {
  const safe = safeNextPath(next);
  return safe.startsWith(home) ? safe : home;
}

function useWorkspace(): [string, (v: string) => void] {
  const [slug, setSlug] = useState("");
  useEffect(() => {
    // Read after mount (localStorage); deferred so the effect never sets state synchronously.
    void Promise.resolve(getLastWorkspace()).then((last) => {
      if (last) setSlug((s) => s || last);
    });
  }, []);
  return [slug, setSlug];
}

function linkError(e: unknown): string {
  if (isApiError(e) && (e.code === "link_invalid" || e.status === 410)) return "This sign-in link or code is invalid or has expired.";
  if (isApiError(e) && e.status === 429) return "Too many attempts. Please wait a moment and try again.";
  return errorMessage(e);
}

// ================================================================ Client Portal
const SSO_MFA_CHALLENGE: PortalAuthOut = { status: "mfa_required", me: null, enrollment: null, recovery_codes: [] };

/** Epic 50: a 403 `sso_required` from verify-code / verify-link -> the same-origin sign-in URL, else null. */
function ssoRequiredUrl(e: unknown): string | null {
  if (!isApiError(e) || e.code !== "sso_required") return null;
  return safeSignInUrl(e.details.sign_in_url, typeof window === "undefined" ? undefined : window.location.origin);
}

function SsoRequiredNotice({ onBack }: { onBack: () => void }) {
  return (
    <>
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>{SSO_REQUIRED_MESSAGE}</MessageBarBody>
      </MessageBar>
      <Button appearance="primary" onClick={onBack}>
        Back to sign-in
      </Button>
    </>
  );
}

/**
 * `/client/sign-in`: email-first. A domain with a Client IdP (Epic 50) offers "Sign in with your company
 * account"; otherwise (or as the fallback) email -> magic link + 6-digit code; optional / enforced TOTP.
 * `?sso_error=<code>` explains a failed company sign-in; `?mfa=1|enroll` continues an SSO sign-in that
 * still needs the portal authenticator (the `tos_mfa` cookie was set by the redirect).
 */
export function ClientSignIn({ next, ssoError, mfa: mfaParam }: { next?: string; ssoError?: string; mfa?: string }) {
  const styles = useFormStyles();
  const router = useRouter();
  const [slug, setSlug] = useWorkspace();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => portalSsoErrorMessage(ssoError));
  const mfaMode = portalMfaParam(mfaParam);
  const [mfa, setMfa] = useState<PortalAuthOut | null>(mfaMode === "challenge" ? SSO_MFA_CHALLENGE : null);
  const [discovery, setDiscovery] = useState<{ key: string; result: ClientSsoDiscoverOut } | null>(null);
  const [fallback, setFallback] = useState(false);
  const [ssoBlocked, setSsoBlocked] = useState<string | null>(null);
  const enrollStarted = useRef(false);
  const done = () => router.replace(portalNext(next, "/client"));
  const tenant = slug.trim().toLowerCase();
  const active = discovery && discovery.key === discoveryKey(slug, email) ? discovery.result : null;
  const mode = portalSignInMode(active, fallback);

  useEffect(() => {
    if (mfaMode !== "enroll" || enrollStarted.current) return;
    enrollStarted.current = true;
    void clientPortalSsoApi
      .mfaEnrollment()
      .then(setMfa)
      .catch((e: unknown) =>
        setError(isApiError(e) && e.code === "mfa_challenge_expired" ? "Your sign-in expired. Sign in again." : errorMessage(e)),
      );
  }, [mfaMode]);

  async function discover() {
    if (!shouldDiscoverPortal(slug, email)) return;
    const key = discoveryKey(slug, email);
    try {
      const result = await clientPortalSsoApi.discover(tenant, email.trim());
      setDiscovery({ key, result });
    } catch {
      setDiscovery(null);
    }
  }

  function companySignIn(idpId: string) {
    setLastWorkspace(tenant);
    window.location.assign(portalSsoStartUrl(idpId, tenant, portalNext(next, "/client")));
  }

  async function request() {
    setBusy(true);
    setError(null);
    try {
      await clientPortalApi.requestLink(tenant, email.trim());
      setLastWorkspace(tenant);
      setSent(true);
    } catch (e) {
      setError(linkError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result = await clientPortalApi.verifyCode(tenant, email.trim(), code.trim());
      if (result.status === "signed_in") done();
      else setMfa(result);
    } catch (e) {
      const url = ssoRequiredUrl(e);
      if (url) setSsoBlocked(url);
      else setError(linkError(e));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setMfa(null);
    setSent(false);
    setCode("");
    setFallback(false);
    setSsoBlocked(null);
    router.replace("/client/sign-in");
  }

  if (mfa) {
    return (
      <AuthCard title={mfa.status === "mfa_enrollment_required" ? "Set up your authenticator" : "Verify it's you"} description="Client portal">
        <PortalMfaStep auth={mfa} verify={clientPortalApi.mfaVerify} onSignedIn={done} onRestart={restart} />
      </AuthCard>
    );
  }
  if (ssoBlocked) {
    return (
      <AuthCard title="Use your company account" description="Client portal">
        <div className={styles.form}>
          <SsoRequiredNotice
            onBack={() => {
              if (ssoBlocked.split("?")[0] === "/client/sign-in") restart();
              else window.location.assign(ssoBlocked);
            }}
          />
        </div>
      </AuthCard>
    );
  }
  if (mfaMode === "enroll" && !error) {
    return (
      <AuthCard title="Set up your authenticator" description="Client portal">
        <Body1>One moment…</Body1>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Client portal sign-in" description="Sign in with your company account or an emailed link.">
      <div className={styles.form}>
        <FormAlert message={error} />
        {!sent ? (
          <>
            <Field label="Workspace" required>
              <Input
                value={slug}
                onChange={(_, d) => setSlug(d.value)}
                onBlur={() => void discover()}
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <Field label="Work email" required>
              <Input
                type="email"
                value={email}
                onChange={(_, d) => setEmail(d.value)}
                onBlur={() => void discover()}
                autoComplete="username"
              />
            </Field>
            {mode.showSso && active?.idp_id && (
              <>
                {mode.note && <Body1>{mode.note}</Body1>}
                <Button appearance="primary" onClick={() => companySignIn(active.idp_id ?? "")}>
                  Sign in with your company account
                </Button>
              </>
            )}
            {mode.showMagicLink && (
              <Button
                appearance={mode.showSso ? "secondary" : "primary"}
                disabled={busy || !slug.trim() || !email.includes("@")}
                onClick={request}
              >
                Email me a sign-in link
              </Button>
            )}
            {mode.showFallbackLink && (
              <div className={styles.links}>
                <Link as="button" type="button" onClick={() => setFallback(true)}>
                  Can&apos;t use company sign-in?
                </Link>
              </div>
            )}
          </>
        ) : (
          <>
            <MessageBar intent="info">
              <MessageBarBody>If {email} has portal access, a sign-in email is on its way. Open the link, or type the code below.</MessageBarBody>
            </MessageBar>
            <Field label="6-digit code">
              <Input
                value={code}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                onChange={(_, d) => setCode(d.value.replace(/\D/g, ""))}
              />
            </Field>
            <Button appearance="primary" disabled={busy || code.length !== 6} onClick={verify}>
              Sign in
            </Button>
            <div className={styles.links}>
              <Link as="button" type="button" onClick={() => setSent(false)}>
                Use a different email
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthCard>
  );
}

/** `/client/sign-in/verify#t=<token>`: the emailed magic link (POSTed, so mail scanners never consume it). */
export function ClientVerify({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ssoBlocked, setSsoBlocked] = useState<string | null>(null);
  const [mfa, setMfa] = useState<PortalAuthOut | null>(null);
  const started = useRef(false);
  const done = () => router.replace(portalNext(next, "/client"));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void Promise.resolve(takeFragmentToken())
      .then((token) => {
        if (!token) throw new Error("incomplete");
        return clientPortalApi.verifyLink(token);
      })
      .then((result) => (result.status === "signed_in" ? done() : setMfa(result)))
      .catch((e: unknown) => {
        const url = ssoRequiredUrl(e);
        if (url) setSsoBlocked(url);
        else setError(isApiError(e) ? linkError(e) : "This sign-in link is incomplete. Request a new one.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  if (mfa) {
    return (
      <AuthCard title="Verify it's you" description="Client portal">
        <PortalMfaStep
          auth={mfa}
          verify={clientPortalApi.mfaVerify}
          onSignedIn={done}
          onRestart={() => router.replace("/client/sign-in")}
        />
      </AuthCard>
    );
  }
  if (ssoBlocked) {
    return (
      <AuthCard title="Use your company account" description="Client portal">
        <SsoRequiredNotice onBack={() => router.replace(ssoBlocked)} />
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Signing you in" description="Client portal">
      {error ? (
        <>
          <FormAlert message={error} />
          <Button onClick={() => router.replace("/client/sign-in")}>Back to sign-in</Button>
        </>
      ) : (
        <Body1>One moment…</Body1>
      )}
    </AuthCard>
  );
}

// ================================================================ Vendor Portal
/** `/vendor/sign-in`: workspace + email + password, then the mandatory authenticator code. */
export function VendorSignIn({ next }: { next?: string }) {
  const styles = useFormStyles();
  const router = useRouter();
  const [slug, setSlug] = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<PortalAuthOut | null>(null);
  const [forgot, setForgot] = useState<"form" | "sent" | null>(null);
  const done = () => router.replace(portalNext(next, "/vendor"));

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const result = await vendorPortalAuthApi.login(slug.trim().toLowerCase(), email.trim(), password);
      setLastWorkspace(slug.trim().toLowerCase());
      if (result.status === "signed_in") done();
      else setMfa(result);
    } catch (e) {
      setPassword("");
      if (isApiError(e) && e.status === 401) {
        setError(e.code === "account_locked" ? "Too many failed attempts. Try again later." : "Incorrect workspace, email or password");
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await vendorPortalAuthApi.requestReset(slug.trim().toLowerCase(), email.trim());
      setForgot("sent");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (mfa) {
    return (
      <AuthCard title={mfa.status === "mfa_enrollment_required" ? "Set up your authenticator" : "Verify it's you"} description="Vendor portal">
        <PortalMfaStep auth={mfa} verify={vendorPortalAuthApi.mfaVerify} onSignedIn={done} onRestart={() => setMfa(null)} />
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Vendor portal sign-in" description="Password and authenticator app">
      <div className={styles.form}>
        <FormAlert message={error} />
        <Field label="Workspace" required>
          <Input value={slug} onChange={(_, d) => setSlug(d.value)} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} autoComplete="username" />
        </Field>
        {forgot === null && (
          <>
            <Field label="Password" required>
              <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} autoComplete="current-password" />
            </Field>
            <Button appearance="primary" disabled={busy || !slug || !email || !password} onClick={login}>
              Sign in
            </Button>
            <div className={styles.links}>
              <Link as="button" type="button" onClick={() => setForgot("form")}>
                Forgot password?
              </Link>
            </div>
          </>
        )}
        {forgot === "form" && (
          <Button appearance="primary" disabled={busy || !slug || !email} onClick={reset}>
            Email me a reset link
          </Button>
        )}
        {forgot === "sent" && (
          <MessageBar intent="info">
            <MessageBarBody>If the account exists, a reset link is on its way.</MessageBarBody>
          </MessageBar>
        )}
      </div>
    </AuthCard>
  );
}

/** `/vendor/accept-invite#t=<token>`: set a password, then enrol the authenticator (mandatory). */
export function VendorAcceptInvite() {
  const styles = useFormStyles();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<PortalInviteOut | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState<PortalAuthOut | null>(null);

  useEffect(() => {
    void Promise.resolve(takeFragmentToken())
      .then((t) => {
        setToken(t);
        if (!t) throw new Error("incomplete");
        return vendorPortalAuthApi.lookupInvite(t);
      })
      .then((found) => {
        setInvite(found);
        setName(found.display_name);
      })
      .catch((e: unknown) => setError(isApiError(e) ? linkError(e) : "This invitation link is incomplete."));
  }, []);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setMfa(await vendorPortalAuthApi.acceptInvite(token, password, name.trim()));
    } catch (e) {
      setError(isApiError(e) && e.code === "weak_password" ? e.message : linkError(e));
    } finally {
      setBusy(false);
    }
  }

  if (mfa) {
    return (
      <AuthCard title="Set up your authenticator" description="Vendor portal">
        <PortalMfaStep
          auth={mfa}
          verify={vendorPortalAuthApi.mfaVerify}
          onSignedIn={() => router.replace("/vendor")}
          onRestart={() => router.replace("/vendor/sign-in")}
        />
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Join the vendor portal"
      description={invite ? `${invite.tenant_name} invited ${invite.email} (${invite.organization_name}).` : undefined}
    >
      <div className={styles.form}>
        <FormAlert message={error} />
        {invite && (
          <>
            <Field label="Your name">
              <Input value={name} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Password" hint="At least 10 characters">
              <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} autoComplete="new-password" />
            </Field>
            <Button appearance="primary" disabled={busy || password.length < 10} onClick={accept}>
              Continue
            </Button>
          </>
        )}
      </div>
    </AuthCard>
  );
}

/** `/vendor/reset-password#t=<token>`. */
export function VendorResetPassword() {
  const styles = useFormStyles();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    void Promise.resolve(takeFragmentToken()).then(setToken);
  }, []);
  async function submit() {
    if (!token) return;
    setError(null);
    try {
      await vendorPortalAuthApi.confirmReset(token, password);
      setDone(true);
    } catch (e) {
      setError(isApiError(e) && e.code === "weak_password" ? e.message : linkError(e));
    }
  }
  return (
    <AuthCard title="Reset your password" description="Vendor portal">
      <div className={styles.form}>
        <FormAlert message={error} />
        {done ? (
          <>
            <Body1>Your password was changed and every session was signed out.</Body1>
            <Button appearance="primary" onClick={() => router.replace("/vendor/sign-in")}>
              Sign in
            </Button>
          </>
        ) : (
          <>
            <Field label="New password" hint="At least 10 characters">
              <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} autoComplete="new-password" />
            </Field>
            <Button appearance="primary" disabled={!token || password.length < 10} onClick={submit}>
              Save password
            </Button>
          </>
        )}
      </div>
    </AuthCard>
  );
}
