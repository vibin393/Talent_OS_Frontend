"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";
import { errorMessage } from "@/lib/api/errors";

export const usePortalStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "860px", width: "100%" },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground2 },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  rowMain: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0, flex: "1 1 220px" },
  rowTitle: {
    color: tokens.colorBrandForegroundLink,
    fontWeight: tokens.fontWeightSemibold,
    textDecorationLine: "none",
    overflowWrap: "anywhere",
    ":hover": { textDecorationLine: "underline" },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  button: { minHeight: "44px", minWidth: "44px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  input: { minHeight: "44px" },
  dl: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
    "@media (max-width: 480px)": { gridTemplateColumns: "minmax(0, 1fr)", "& dd": { marginBottom: tokens.spacingVerticalS } },
  },
  empty: { color: tokens.colorNeutralForeground2 },
  heading: { ":focus": { outlineStyle: "none" } },
});

export function PortalPageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  const styles = usePortalStyles();
  return (
    <div className={styles.header}>
      <Title2 as="h1">{title}</Title2>
      {subtitle && <Text className={styles.muted}>{subtitle}</Text>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <Skeleton aria-label={label} aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonItem key={i} size={32} />
      ))}
    </Skeleton>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card>
      <CardHeader
        image={<ErrorCircle24Regular aria-hidden />}
        header={<Subtitle2 as="h2">Something went wrong</Subtitle2>}
        description={<Body1 role="alert">{errorMessage(error)}</Body1>}
      />
      {onRetry && (
        <div>
          <Button onClick={onRetry} style={{ minHeight: 44 }}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <MessageBar intent="error" layout="multiline" role="alert">
      <MessageBarBody>{message}</MessageBarBody>
    </MessageBar>
  );
}
