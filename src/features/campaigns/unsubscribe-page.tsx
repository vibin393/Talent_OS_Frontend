"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, ErrorCircle48Regular, MailOff20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { unsubscribeCopy, unsubscribeErrorCopy } from "./unsubscribe-logic";
import { marketingPublicApi } from "./public-api";
import type { UnsubscribeView } from "./types";

const useStyles = makeStyles({
  page: { minHeight: "100svh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground3 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "48px",
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  brand: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, overflowWrap: "anywhere" },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "560px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    "@media (max-width: 480px)": { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}` },
  },
  card: { padding: tokens.spacingHorizontalXL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  heading: { ...typographyStyles.title2, margin: 0, overflowWrap: "anywhere", ":focus": { outlineStyle: "none" } },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
  check: { minHeight: "44px", alignItems: "center" },
  actions: {
    width: "100%",
    "& button": { minHeight: "44px", minWidth: "160px" },
    "@media (max-width: 480px)": { "& button": { width: "100%" } },
  },
  footer: { textAlign: "center", padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
});

export type UnsubscribeState = "form" | "done";

/** Presentational unsubscribe card (rendered by the page; exported for tests). */
export function UnsubscribeCard({
  view,
  state,
  all,
  onAllChange,
  onConfirm,
  busy,
  error,
  doneAll,
}: {
  view: UnsubscribeView;
  state: UnsubscribeState;
  all: boolean;
  onAllChange: (all: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
  doneAll?: boolean;
}) {
  const styles = useStyles();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [state]);
  const copy = unsubscribeCopy(view, doneAll ?? all);

  if (state === "done" || view.already_unsubscribed) {
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
  return (
    <Card className={styles.card}>
      <div className={styles.state}>
        <h1 ref={heading} tabIndex={-1} className={styles.heading}>
          {copy.title}
        </h1>
        <Body1>{copy.body}</Body1>
        <Checkbox
          className={styles.check}
          checked={all}
          onChange={(_, d) => onAllChange(!!d.checked)}
          label="Unsubscribe from all marketing"
        />
        <div aria-live="assertive" role="alert">
          {error && (
            <MessageBar intent="error" layout="multiline">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
        <div className={styles.actions}>
          <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={onConfirm}>
            Unsubscribe
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** `/m/[token]/u`: public one-page unsubscribe (no sign-in). */
export function UnsubscribePage({ token }: { token: string }) {
  const styles = useStyles();
  const view = useQuery({
    queryKey: ["marketing-unsubscribe", token],
    queryFn: ({ signal }) => marketingPublicApi.view(token, signal),
    retry: (count, e) => count < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const [all, setAll] = useState(false);
  const [state, setState] = useState<UnsubscribeState>("form");
  const [doneAll, setDoneAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await marketingPublicApi.unsubscribe(token, all);
      setDoneAll(r.all);
      setState("done");
    } catch (e) {
      const c = unsubscribeErrorCopy(isApiError(e) ? e.status : 500);
      setError(`${c.title}. ${c.body}`);
    } finally {
      setBusy(false);
    }
  };

  const err = view.isError ? unsubscribeErrorCopy(isApiError(view.error) ? view.error.status : 500) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <MailOff20Regular aria-hidden />
        <span className={styles.brand}>{view.data?.tenant_name || "Email preferences"}</span>
      </header>
      <main className={styles.main}>
        {view.isPending ? (
          <Card className={styles.card}>
            <Spinner label="Loading..." />
          </Card>
        ) : err ? (
          <Card className={styles.card}>
            <div className={styles.state}>
              <ErrorCircle48Regular aria-hidden className={styles.danger} />
              <h1 className={styles.heading}>{err.title}</h1>
              <Body1>{err.body}</Body1>
            </div>
          </Card>
        ) : (
          view.data && (
            <UnsubscribeCard
              view={view.data}
              state={state}
              all={all}
              onAllChange={setAll}
              onConfirm={confirm}
              busy={busy}
              error={error}
              doneAll={state === "done" ? doneAll : undefined}
            />
          )
        )}
      </main>
      <footer className={styles.footer}>
        <Caption1>Your choice is saved right away.</Caption1>
      </footer>
    </div>
  );
}
