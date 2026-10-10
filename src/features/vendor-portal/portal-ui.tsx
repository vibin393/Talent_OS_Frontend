"use client";

import {
  Badge,
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
  Title2,
  tokens,
} from "@fluentui/react-components";
import { LockClosed24Regular } from "@fluentui/react-icons";
import { useRef } from "react";
import { labelColor, portalErrorState } from "./labels";

/** Mobile-first page frame of the Vendor Portal content (the Epic 14 shell renders the header / nav). */
export const usePortalStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    paddingInline: tokens.spacingHorizontalL,
    paddingBlock: tokens.spacingVerticalL,
    maxWidth: "1100px",
    marginInline: "auto",
    width: "100%",
    boxSizing: "border-box",
  },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: tokens.spacingHorizontalM },
  card: { minHeight: "44px" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "640px" },
  target: { minHeight: "44px", minWidth: "44px" },
  kpi: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold },
  timeline: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  dl: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

export function PortalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = usePortalStyles();
  return (
    <main className={styles.page} aria-label={title}>
      <Title2 as="h1">{title}</Title2>
      {children}
    </main>
  );
}

export function LabelBadge({ label }: { label: string }) {
  return (
    <Badge appearance="tint" color={labelColor(label)}>
      {label}
    </Badge>
  );
}

export function Loading() {
  return (
    <Skeleton aria-label="Loading">
      <SkeletonItem size={24} />
      <SkeletonItem size={24} />
    </Skeleton>
  );
}

/** FR-82 "You don't have access" state (ask the account manager) for a 403; other errors as a message bar. */
export function PortalError({ error }: { error: unknown }) {
  const state = portalErrorState(error);
  if (state.kind === "forbidden") {
    return (
      <Card role="alert">
        <CardHeader
          image={<LockClosed24Regular aria-hidden />}
          header={<Subtitle2 as="h2">You don&apos;t have access</Subtitle2>}
          description={<Body1>{`You need permission for ${state.action}. Ask ${state.ask}.`}</Body1>}
        />
      </Card>
    );
  }
  return (
    <MessageBar intent={state.kind === "not_found" ? "warning" : "error"} role="alert">
      <MessageBarBody>{state.kind === "not_found" ? "Not found." : state.message}</MessageBarBody>
    </MessageBar>
  );
}

/** A 44 px button that opens a hidden file input (keyboard and screen-reader friendly). */
export function FilePickButton({
  label,
  accept,
  onFile,
  icon,
  className,
}: {
  label: string;
  accept: string;
  onFile: (file: File | null) => void;
  icon?: React.ReactElement;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button icon={icon} className={className} onClick={() => ref.current?.click()}>
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        aria-label={label}
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}
