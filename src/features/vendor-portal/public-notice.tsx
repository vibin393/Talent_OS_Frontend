"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, DismissCircle48Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { publicLinkApi } from "@/features/public-links/api";
import { linkErrorCopy } from "@/features/public-links/logic";
import { isApiError } from "@/lib/api/errors";
import type { PublicLinkView } from "@/lib/api/types";
import { type NoticeScreen, noticeIntro, noticeScreen } from "./public-notice-logic";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  heading: { ...typographyStyles.title2, margin: 0, overflowWrap: "anywhere", ":focus": { outlineStyle: "none" } },
  success: { color: tokens.colorPaletteGreenForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "160px" },
    "@media (max-width: 480px)": { "& button": { width: "100%" } },
  },
});

/** `/l/[token]` renderer for `vendor_data_notice` links (Epic 17, FR-95 DPDP notice): notice text, Agree / Withdraw. */
export function PublicVendorNotice({ token, view }: { token: string; view: PublicLinkView }) {
  const styles = useStyles();
  const [screen, setScreen] = useState<NoticeScreen>(() => noticeScreen(view.status));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [screen]);

  const respond = async (granted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await publicLinkApi.consent(token, granted, view.notice?.id ?? null);
      setScreen(granted ? "granted" : "withdrawn");
    } catch (e) {
      const c = isApiError(e) ? linkErrorCopy(e.status, e.code) : linkErrorCopy(500, undefined);
      setError(`${c.title}. ${c.body}`);
    } finally {
      setBusy(false);
    }
  };

  if (screen !== "notice") {
    const granted = screen === "granted";
    return (
      <Card className={styles.card}>
        <div className={styles.state} role="status">
          {granted ? <CheckmarkCircle48Regular aria-hidden className={styles.success} /> : <DismissCircle48Regular aria-hidden />}
          <h1 ref={heading} tabIndex={-1} className={styles.heading}>
            {granted ? "Thank you — your consent was recorded" : "Your consent was withdrawn"}
          </h1>
          <Body1>
            {granted
              ? "You can withdraw your consent at any time from this link."
              : "We will no longer process your profile for this role."}
          </Body1>
          {granted && (
            <div className={styles.actions}>
              <Button disabled={busy} onClick={() => respond(false)}>
                Withdraw consent
              </Button>
            </div>
          )}
          <Caption1 className={styles.muted}>You can close this page.</Caption1>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <h1 ref={heading} tabIndex={-1} className={styles.heading}>
        How your data is used
      </h1>
      <Body1>{noticeIntro(view)}</Body1>
      {view.notice?.body_md && <MarkdownView source={view.notice.body_md} />}
      <div aria-live="assertive">
        {error && (
          <MessageBar intent="error" role="alert">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <div className={styles.actions}>
        <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => respond(true)}>
          I agree
        </Button>
        <Button disabled={busy} onClick={() => respond(false)}>
          Withdraw consent
        </Button>
      </div>
    </Card>
  );
}
