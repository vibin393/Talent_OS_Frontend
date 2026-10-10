"use client";

import { Body1, Button, Card, Field, Input, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, Spinner, Title2, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRef, useState } from "react";
import { CareerThemeProvider } from "@/features/careers/career-theme-provider";
import { ErrorSummary, type SummaryError } from "@/features/careers/error-summary";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { portalApi } from "@/lib/api/portal-client";
import type { PublicBranding } from "@/lib/api/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/;

export const SENT_MESSAGE = "If an account exists, we've sent a link (valid 15 minutes).";

const useStyles = makeStyles({
  wrap: { flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalL}` },
  card: { width: "100%", maxWidth: "440px", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  logo: { height: "40px", width: "auto", maxWidth: "180px", objectFit: "contain", alignSelf: "flex-start" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  input: { minHeight: "44px" },
  button: { minHeight: "44px" },
});

/** Candidate Portal sign-in: request a magic link. The answer never reveals whether the email exists. */
export function SignInView({ tenant }: { tenant: string | null }) {
  const validTenant = tenant && SLUG.test(tenant) ? tenant : null;
  const branding = useQuery({
    queryKey: ["careers", "branding", validTenant],
    queryFn: ({ signal }) => apiRequest<PublicBranding>(`/api/v1/public/careers/${encodeURIComponent(validTenant as string)}`, { signal, skipAuthHandler: true }),
    enabled: !!validTenant,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return (
    <CareerThemeProvider brandColor={branding.data?.brand_color}>
      <SignInCard tenant={validTenant} branding={branding.data ?? null} />
    </CareerThemeProvider>
  );
}

function SignInCard({ tenant, branding }: { tenant: string | null; branding: PublicBranding | null }) {
  const styles = useStyles();
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const sentRef = useRef<HTMLDivElement>(null);

  const fieldError = (id: string) => errors.find((e) => e.id === id)?.message;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    const slug = tenant ?? org.trim().toLowerCase();
    const list: SummaryError[] = [];
    if (!tenant && !SLUG.test(slug)) list.push({ id: "signin-org", message: "Enter your organisation's careers site name" });
    if (!EMAIL.test(email.trim())) list.push({ id: "signin-email", message: "Enter an email address like name@example.com" });
    setErrors(list);
    if (list.length) {
      setFocusKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      await portalApi.requestLink({ tenant_slug: slug, email: email.trim() });
      setSent(true);
      setTimeout(() => sentRef.current?.focus(), 0);
    } catch (e) {
      if (isApiError(e) && e.status === 429) setServerError("Too many attempts, try again later.");
      else if (isApiError(e) && e.status === 422) {
        setErrors([{ id: "signin-email", message: "Enter an email address like name@example.com" }]);
        setFocusKey((k) => k + 1);
      } else setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const name = branding?.display_name;
  return (
    <main id="main" className={styles.wrap}>
      <Card className={styles.card}>
        {branding?.logo_url && <Image src={branding.logo_url} alt={branding.display_name} width={180} height={40} className={styles.logo} unoptimized />}
        <Title2 as="h1">Sign in to your candidate portal</Title2>
        <Body1>
          Follow your applications{name ? ` at ${name}` : ""}, manage your profile and your privacy choices. We&apos;ll email you a one-time sign-in link — no password
          needed.
        </Body1>
        {sent ? (
          <div ref={sentRef} tabIndex={-1} role="status">
            <MessageBar intent="success" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>Check your email</MessageBarTitle>
                {SENT_MESSAGE}
              </MessageBarBody>
            </MessageBar>
            <Button appearance="subtle" className={styles.button} onClick={() => setSent(false)} style={{ marginTop: 8 }}>
              Use a different email
            </Button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit} noValidate>
            <ErrorSummary errors={errors} focusKey={focusKey} />
            {serverError && (
              <MessageBar intent="error" layout="multiline" role="alert">
                <MessageBarBody>{serverError}</MessageBarBody>
              </MessageBar>
            )}
            {!tenant && (
              <Field
                label="Organisation"
                required
                hint="The name in the careers site address, e.g. “acme” in /careers/acme"
                validationState={fieldError("signin-org") ? "error" : "none"}
                validationMessage={fieldError("signin-org")}
              >
                <Input id="signin-org" className={styles.input} value={org} onChange={(_, d) => setOrg(d.value)} autoCapitalize="none" />
              </Field>
            )}
            <Field label="Email" required validationState={fieldError("signin-email") ? "error" : "none"} validationMessage={fieldError("signin-email")}>
              <Input
                id="signin-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(_, d) => setEmail(d.value)}
              />
            </Field>
            <Button type="submit" appearance="primary" className={styles.button} disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
              Email me a sign-in link
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
