"use client";

import { Body1, Caption1, makeStyles, Subtitle1, tokens } from "@fluentui/react-components";
import { Wrench24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalS,
    minHeight: "320px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
});

/**
 * Placeholder for a module section whose native Talent OS page is not built yet. The contextual
 * sidebar is complete, but we're honest about which pages are wired vs. still coming.
 */
export function ModuleComingSoon({ title }: { title: string }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Wrench24Regular />
      <Subtitle1>{title}</Subtitle1>
      <Body1>This section is being rebuilt as a native page inside Talent OS.</Body1>
      <Caption1>Until then, the data is still available in the full app.</Caption1>
    </div>
  );
}
