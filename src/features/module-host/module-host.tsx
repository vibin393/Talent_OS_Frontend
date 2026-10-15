"use client";

import { Body1, Button, Link, makeStyles, Spinner, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { ArrowClockwise20Regular, ErrorCircle24Regular, Open16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useMe } from "@/features/auth/use-me";

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
 * SSO is embedded-first for now: the iframe may show the external app's own login. We pass the tenant
 * slug as a `?tenant=` hint so the embedded app can pre-select the workspace; a seamless central-token
 * handshake over `postMessage` is a follow-up (Story 3.3).
 */
export function ModuleHost({ title, src }: { title: string; src: string }) {
  const styles = useStyles();
  const me = useMe();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // A key bump forces the iframe to remount (true reload) on "Try again".
  const [reloadKey, setReloadKey] = useState(0);

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
          <Text size={200}>Embedded in Talent OS. Sign in to {title} if prompted.</Text>
        </div>
        <Link href={frameSrc} target="_blank" rel="noopener noreferrer">
          Open in new tab <Open16Regular aria-hidden style={{ verticalAlign: "text-bottom" }} />
        </Link>
      </div>

      <div className={styles.host}>
        <iframe
          key={reloadKey}
          className={styles.frame}
          src={frameSrc}
          title={title}
          onLoad={() => setState((s) => (s === "error" ? s : "ready"))}
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
