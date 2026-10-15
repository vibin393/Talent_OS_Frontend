"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Body1, Button, Link } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ssoApi, ssoStartUrl } from "@/features/sso/api";
import { loginMode, shouldDiscover, ssoErrorMessage } from "@/features/sso/discover";
import type { SsoDiscoverOut } from "@/features/sso/types";
import { useDebounced } from "@/lib/use-debounced";
import { AppLink } from "@/components/app-link";
import { isApiError } from "@/lib/api/errors";
import { safeNextPath } from "@/lib/navigation";
import { getLastWorkspace } from "@/lib/workspace";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { loginErrorMessage } from "./login-errors";
import { isMfaChallenge } from "./mfa";
import { MfaCodeStep } from "./mfa-code-step";
import { type LoginValues, loginSchema } from "./schemas";
import { applyServerFieldErrors } from "./server-errors";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useLogin } from "./use-login";

export function LoginForm({ next, mfa, ssoError }: { next?: string; mfa?: boolean; ssoError?: string }) {
  const styles = useFormStyles();
  const router = useRouter();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(() => ssoErrorMessage(ssoError));
  // Set after a correct password for an MFA account (or an SSO sign-in that still needs the Talent OS code):
  // the form switches to the code step.
  const [challengeFor, setChallengeFor] = useState<string | null>(mfa ? "" : null);
  // Epic 14 (FR-77): email-first SSO discovery.
  const [discovery, setDiscovery] = useState<SsoDiscoverOut | null>(null);
  const [passwordRequested, setPasswordRequested] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenant_slug: "", email: "", password: "" },
  });
  const [slug, email] = useWatch({ control: form.control, name: ["tenant_slug", "email"] });
  const debouncedSlug = useDebounced(slug, 400);
  const debouncedEmail = useDebounced(email, 400);
  useEffect(() => {
    if (!shouldDiscover(debouncedSlug, debouncedEmail)) return;
    let cancelled = false;
    ssoApi
      .discover(debouncedSlug.trim().toLowerCase(), debouncedEmail.trim())
      .then((found) => !cancelled && setDiscovery(found))
      .catch(() => !cancelled && setDiscovery(null));
    return () => {
      cancelled = true;
    };
  }, [debouncedSlug, debouncedEmail]);
  // A stale match never applies once the email no longer qualifies for discovery.
  const activeDiscovery = shouldDiscover(debouncedSlug, debouncedEmail) ? discovery : null;
  const mode = loginMode(activeDiscovery, passwordRequested);

  // Prefill the last used workspace (localStorage is only available after mount).
  useEffect(() => {
    const last = getLastWorkspace();
    if (last && !form.getValues("tenant_slug")) form.setValue("tenant_slug", last);
  }, [form]);

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const result = await login.mutateAsync(values);
      if (isMfaChallenge(result)) {
        setChallengeFor(values.email);
        return;
      }
      router.replace(safeNextPath(next));
    } catch (error) {
      if (isApiError(error) && error.status === 422 && applyServerFieldErrors(error, form.setError, ["tenant_slug", "email", "password"])) {
        return;
      }
      form.resetField("password");
      setFormError(loginErrorMessage(error));
    }
  }

  const pending = form.formState.isSubmitting || (login.isSuccess && !isMfaChallenge(login.data));

  if (challengeFor) {
    return (
      <MfaCodeStep
        email={challengeFor}
        onVerified={() => router.replace(safeNextPath(next))}
        onRestart={(message) => {
          setChallengeFor(null);
          login.reset();
          form.resetField("password");
          setFormError(message ?? null);
        }}
      />
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className={styles.form}>
      <FormAlert message={formError} />
      <TextField
        control={form.control}
        name="tenant_slug"
        label="Workspace"
        autoComplete="organization"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="acme"
      />
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      {mode.showSso && activeDiscovery?.idp_id && (
        <>
          {mode.note && <Body1>{mode.note}</Body1>}
          <Button
            appearance={mode.showPassword ? "secondary" : "primary"}
            onClick={() => window.location.assign(ssoStartUrl(activeDiscovery.idp_id ?? "", slug.trim().toLowerCase(), safeNextPath(next)))}
          >
            Continue with SSO
          </Button>
        </>
      )}
      {mode.showPassword && (
        <>
          <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
          <div className={styles.links}>
            <AppLink href="/forgot-password">Forgot password?</AppLink>
          </div>
          <SubmitButton pending={pending}>Sign in</SubmitButton>
        </>
      )}
      {mode.showPasswordLink && (
        <div className={styles.links}>
          <Link as="button" type="button" onClick={() => setPasswordRequested(true)}>
            Sign in with password
          </Link>
        </div>
      )}
      <AppLink href="/find-workspace" className={styles.center}>
        Find my workspace
      </AppLink>
    </form>
  );
}
