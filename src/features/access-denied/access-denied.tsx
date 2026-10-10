"use client";

import { Body1, Button, makeStyles, Subtitle1, tokens } from "@fluentui/react-components";
import { LockClosedRegular } from "@fluentui/react-icons";
import { type AskWhom, askLabel } from "./access";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalXXL}`,
    maxWidth: "520px",
    marginInline: "auto",
  },
  icon: { fontSize: "48px", color: tokens.colorNeutralForeground3 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * FR-82 "You don't have access" empty state (Fluent, M365 look). Shared by the internal app, the Candidate
 * Portal and the Client / Vendor Portal shells.
 */
export function AccessDenied({
  action,
  ask = "tenant_admin",
  onBack,
}: {
  action?: string | null;
  ask?: AskWhom;
  onBack?: () => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.root} role="alert" data-testid="access-denied">
      <LockClosedRegular className={styles.icon} aria-hidden />
      <Subtitle1 as="h2">You don&apos;t have access</Subtitle1>
      {action ? <Body1>You need permission to: {action}</Body1> : <Body1>You need additional permissions to see this.</Body1>}
      <Body1 className={styles.muted}>{askLabel(ask)} to give you access.</Body1>
      {onBack && (
        <Button appearance="secondary" onClick={onBack}>
          Go back
        </Button>
      )}
    </div>
  );
}
