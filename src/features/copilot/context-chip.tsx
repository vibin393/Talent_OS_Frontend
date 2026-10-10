"use client";

/** "Using: {label}" chip (Epic 54 B2). Dismissed, it reads "Not using this page" with a "Use this page" link. */
import { Caption1, Link, makeStyles, Tag, tokens } from "@fluentui/react-components";
import { COPY } from "./copy";
import { chipLabel } from "./page-context";
import type { PageContext } from "./types";

const useStyles = makeStyles({
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

export function ContextChip({
  context,
  dismissed,
  onDismiss,
  onRestore,
}: {
  context: PageContext | null;
  dismissed: boolean;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const styles = useStyles();
  const label = chipLabel(context);
  if (!label) return null;
  if (dismissed) {
    return (
      <div className={styles.row}>
        <Caption1 className={styles.muted}>{COPY.notUsingPage}</Caption1>
        <Link as="button" onClick={onRestore}>
          {COPY.usePage}
        </Link>
      </div>
    );
  }
  return (
    <div className={styles.row}>
      <Tag
        size="small"
        appearance="brand"
        dismissible
        dismissIcon={{ "aria-label": "Stop using this page" }}
        value="page"
        onClick={onDismiss}
        onKeyDown={(e) => {
          if (e.key === "Delete" || e.key === "Backspace") onDismiss();
        }}
      >
        {label}
      </Tag>
    </div>
  );
}
