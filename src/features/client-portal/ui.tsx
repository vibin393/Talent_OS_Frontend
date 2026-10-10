"use client";

import { Body1, makeStyles, MessageBar, MessageBarBody, Spinner, Text, tokens } from "@fluentui/react-components";
import { useEffect, useRef } from "react";
import { errorMessage } from "@/lib/api/errors";

/** Shared M365-style layout of the Client Portal content pages (mobile-first from 360 px). */
export const useCpStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px", minWidth: 0 },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    minWidth: 0,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, minWidth: 0 },
  grow: { flex: "1 1 200px", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  link: { color: tokens.colorBrandForegroundLink, textDecorationLine: "none", ":hover": { textDecorationLine: "underline" } },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    "& button, & a": { minHeight: "44px" },
  },
  num: { fontVariantNumeric: "tabular-nums" },
  tile: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    textDecorationLine: "none",
    color: tokens.colorNeutralForeground1,
    minHeight: "96px",
    ":hover": { boxShadow: tokens.shadow8 },
  },
  big: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold, lineHeight: tokens.lineHeightHero700 },
  dl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

/** Page heading that takes focus on mount (WCAG: focus on heading change). */
export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const s = useCpStyles();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={s.header}>
      <Text as="h1" size={600} weight="semibold" ref={ref} tabIndex={-1}>
        {children}
      </Text>
      {actions}
    </div>
  );
}

export function Loading() {
  return <Spinner label="Loading" />;
}

export function Failure({ error }: { error: unknown }) {
  return (
    <MessageBar intent="error" aria-live="assertive">
      <MessageBarBody>{errorMessage(error)}</MessageBarBody>
    </MessageBar>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  const s = useCpStyles();
  return <Body1 className={s.muted}>{children}</Body1>;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
