"use client";

import { Body1, Button, Link, makeStyles, Spinner, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { ArrowClockwise20Regular, ErrorCircle24Regular, Open16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/features/auth/use-me";
import { api } from "@/lib/api/client";

/** The short-lived central JWT envelope returned by `GET /api/v1/auth/token`. */
type CentralTokenResponse = { access_token: string; token_type: string; expires_in: number };

/**
 * Unified SSO handshake (shell side).
 *
 * Contract: the embedded app posts `{type:"unified-sso-ready"}` to its parent when it is ready; the
 * shell replies with `{type:"unified-sso-token", token}` posted to the app's own origin. The shell
 * also posts proactively on iframe load (belt and suspenders) and re-posts a fresh token shortly
 * before the current one expires so the embedded session never lapses.
 */
const SSO_READY = "unified-sso-ready";
const SSO_TOKEN = "unified-sso-token";
/** Re-mint this many seconds before the central token expires. */
const REFRESH_LEAD_SECONDS = 30;
/** Never schedule a refresh tighter than this (guards against tiny/zero `expires_in`). */
const MIN_REFRESH_SECONDS = 30;

const useStyles = makeStyles({
  root: {
    // Fill the shell content area (the parent <main> already scrolls); the iframe owns its own scroll.
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    gap: tokens.spacingVerticalM,
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    flexShrink: 0,
  },
  titleText: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  host: {
    position: "relative",
    flex: 1,
    minHeight: "480px",
    borderRadius: tokens.borderRadiusLarge,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  frame: {
    display: "block",
    width: "100%",
    height: "100%",
    border: "none",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXL,
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  errorIcon: { color: tokens.colorPaletteRedForeground1 },
});

/**
 * Renders an external platform app inside the authenticated shell via an `<iframe>` that fills the
 * content area, with a title bar, a loading spinner and an error state.
 *
 * SSO is seamless: the shell mints a short-lived central JWT (`GET /api/v1/auth/token`, cookies
 * auto-included) and hands it to the embedded app over `postMessage`, scoped strictly to the app's
 * own origin. The tenant slug is still passed as a `?tenant=` hint so the app can pre-select the
 * workspace, and the embedded app's own login remains a fallback if minting ever fails.
 */
export function ModuleHost({ title, src }: { title: string; src: string }) {
  const styles = useStyles();
  const me = useMe();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // A key bump forces the iframe to remount (true reload) on "Try again".
  const [reloadKey, setReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The app's origin (e.g. http://croar.localhost) — the ONLY postMessage targetOrigin we ever use.
  const appOrigin = useMemo(() => {
    try {
      return new URL(src).origin;
    } catch {
      return null;
    }
  }, [src]);

  // Mint a fresh central token and post it to the embedded app, then schedule the next refresh.
  const mintAndPost = useCallback(async () => {
    const target = iframeRef.current?.contentWindow;
    if (!target || !appOrigin) return;
    try {
      const res = await api.get<CentralTokenResponse>("/api/v1/auth/token");
      // Re-read the contentWindow after the await (the iframe may have remounted meanwhile).
      const live = iframeRef.current?.contentWindow;
      if (!live) return;
      live.postMessage({ type: SSO_TOKEN, token: res.access_token }, appOrigin);

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      const refreshSeconds = Math.max(res.expires_in - REFRESH_LEAD_SECONDS, MIN_REFRESH_SECONDS);
      refreshTimer.current = setTimeout(() => {
        void mintAndPost();
      }, refreshSeconds * 1000);
    } catch (err) {
      // Minting failed: leave the embedded app to fall back to its own login. Just log.
      console.warn("[module-host] central token mint failed; embedded app will use its own login", err);
    }
  }, [appOrigin]);

  // Listen for the app's "ready" handshake and reply with a token scoped to its origin.
  useEffect(() => {
    if (!appOrigin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== appOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown } | null;
      if (data && typeof data === "object" && data.type === SSO_READY) {
        void mintAndPost();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appOrigin, mintAndPost]);

  // Clear any pending refresh timer on unmount.
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const tenant = me.data?.tenant.slug;
  let frameSrc = src;
  if (tenant) {
    try {
      const url = new URL(src);
      url.searchParams.set("tenant", tenant);
      frameSrc = url.toString();
    } catch {
      // `src` is always an absolute env URL; if it somehow is not, fall back to it unchanged.
      frameSrc = src;
    }
  }

  const retry = () => {
    setState("loading");
    setReloadKey((k) => k + 1);
  };

  return (
    <div className={styles.root}>
      <div className={styles.titleBar}>
        <div className={styles.titleText}>
          <Subtitle2 as="h1">{title}</Subtitle2>
          <Text size={200}>Embedded in Talent OS with single sign-on.</Text>
        </div>
        <Link href={frameSrc} target="_blank" rel="noopener noreferrer">
          Open in new tab <Open16Regular aria-hidden style={{ verticalAlign: "text-bottom" }} />
        </Link>
      </div>

      <div className={styles.host}>
        <iframe
          key={reloadKey}
          ref={iframeRef}
          className={styles.frame}
          src={frameSrc}
          title={title}
          onLoad={() => {
            setState((s) => (s === "error" ? s : "ready"));
            // Proactively hand over a token in case the app loaded before it could post "ready".
            void mintAndPost();
          }}
          onError={() => setState("error")}
          // The embedded app manages its own session/cookies; allow the usual interactive features.
          allow="clipboard-read; clipboard-write; fullscreen"
        />

        {state === "loading" && (
          <div className={styles.overlay} role="status" aria-live="polite">
            <Spinner label={`Loading ${title}…`} />
          </div>
        )}

        {state === "error" && (
          <div className={styles.overlay} role="alert">
            <ErrorCircle24Regular className={styles.errorIcon} aria-hidden />
            <Subtitle2 as="h2">Could not load {title}</Subtitle2>
            <Body1>The app did not respond. It may be offline, or your browser may be blocking the embed.</Body1>
            <Button appearance="primary" icon={<ArrowClockwise20Regular />} onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
