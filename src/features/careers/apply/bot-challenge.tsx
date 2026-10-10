"use client";

import { Field, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useRef } from "react";

type Provider = "none" | "turnstile" | "hcaptcha" | string;

type WidgetApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | number;
  remove?: (id: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: WidgetApi;
    hcaptcha?: WidgetApi;
  }
}

const SCRIPTS: Record<string, { src: string; global: "turnstile" | "hcaptcha" }> = {
  turnstile: { src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", global: "turnstile" },
  hcaptcha: { src: "https://js.hcaptcha.com/1/api.js?render=explicit", global: "hcaptcha" },
};

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading.delete(src);
      reject(new Error("challenge script failed"));
    };
    document.head.appendChild(s);
  });
  loading.set(src, p);
  return p;
}

const useStyles = makeStyles({ widget: { minHeight: "65px", marginTop: tokens.spacingVerticalXS } });

/**
 * Bot challenge widget for the apply and sign-in forms. With provider `none` (dev/test) it renders nothing
 * and the backend's no-op verifier accepts a missing token. Otherwise it loads the Turnstile / hCaptcha
 * script on demand and reports the token through `onToken` (null when expired or failed). Remount it
 * (change `key`) to reset after a `challenge_failed` response.
 */
export function BotChallenge({
  provider,
  siteKey,
  onToken,
  error,
  id,
}: {
  provider: Provider;
  siteKey: string;
  onToken: (token: string | null) => void;
  error?: string;
  id?: string;
}) {
  const styles = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const cfg = SCRIPTS[provider];
    const el = ref.current;
    if (!cfg || !el || !siteKey) return;
    let widgetId: string | number | undefined;
    let cancelled = false;
    loadScript(cfg.src)
      .then(() => {
        const api = window[cfg.global];
        if (cancelled || !api) return;
        widgetId = api.render(el, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId !== undefined) window[cfg.global]?.remove?.(widgetId);
    };
  }, [provider, siteKey]);

  if (!SCRIPTS[provider]) return null;
  return (
    <Field
      label="Security check"
      hint="Confirms you are a person, not an automated program."
      validationState={error ? "error" : "none"}
      validationMessage={error}
    >
      <div id={id} ref={ref} className={styles.widget} role="group" aria-label="Security check" tabIndex={-1} />
    </Field>
  );
}
