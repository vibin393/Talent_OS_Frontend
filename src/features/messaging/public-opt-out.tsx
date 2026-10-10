"use client";

import { Body1, Button, Caption1, Card, makeStyles, MessageBar, MessageBarBody, Spinner, tokens, typographyStyles } from "@fluentui/react-components";
import { CheckmarkCircle48Regular, DismissCircle48Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { publicLinkApi } from "@/features/public-links/api";
import { linkErrorCopy } from "@/features/public-links/logic";
import { isApiError } from "@/lib/api/errors";
import type { PublicLinkView } from "@/lib/api/types";
import { optOutCopy, optOutScreen } from "./logic";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  heading: { ...typographyStyles.title2, margin: 0, overflowWrap: "anywhere", ":focus": { outlineStyle: "none" } },
  success: { color: tokens.colorPaletteGreenForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { "& button": { minHeight: "44px", minWidth: "160px" }, "@media (max-width: 480px)": { "& button": { width: "100%" } } },
});

type OptOutView = PublicLinkView & { channel?: string | null };

/** `/l/[token]` renderer for `channel_opt_out` links: one-click stop of SMS or WhatsApp messages. */
export function PublicChannelOptOut({ token, view }: { token: string; view: PublicLinkView }) {
  const styles = useStyles();
  const v = view as OptOutView;
  const copy = optOutCopy(v.channel, v.tenant_name);
  const [screen, setScreen] = useState(() => optOutScreen(v));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [screen]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await publicLinkApi.optOut(token);
      setScreen("done");
    } catch (e) {
      const c = isApiError(e) ? linkErrorCopy(e.status, e.code) : linkErrorCopy(500, undefined);
      setError(`${c.title}. ${c.body}`);
    } finally {
      setBusy(false);
    }
  };

  if (screen === "done") {
    return (
      <Card className={styles.card}>
        <div className={styles.state} role="status">
          <CheckmarkCircle48Regular aria-hidden className={styles.success} />
          <h1 ref={heading} tabIndex={-1} className={styles.heading}>
            {copy.doneTitle}
          </h1>
          <Body1>{copy.doneBody}</Body1>
          <Caption1 className={styles.muted}>You can close this page.</Caption1>
        </div>
      </Card>
    );
  }
  if (screen === "unsupported") {
    return (
      <Card className={styles.card}>
        <div className={styles.state}>
          <DismissCircle48Regular aria-hidden className={styles.muted} />
          <h1 ref={heading} tabIndex={-1} className={styles.heading}>
            This link is no longer active
          </h1>
          <Body1>Ask the sender for a new link, or reply STOP to the message you received.</Body1>
        </div>
      </Card>
    );
  }
  return (
    <Card className={styles.card}>
      <div className={styles.state}>
        <h1 ref={heading} tabIndex={-1} className={styles.heading}>
          {copy.title}
        </h1>
        <Body1>{copy.body}</Body1>
        <div aria-live="assertive" role="alert">
          {error && (
            <MessageBar intent="error" layout="multiline">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        <div className={styles.actions}>
          <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            {copy.action}
          </Button>
        </div>
      </div>
    </Card>
  );
}
