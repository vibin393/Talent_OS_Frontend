"use client";

import { makeStyles, Text, Title2, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXL,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
  },
});

/** Page title (`Title2` rendered as the page's `<h1>`) with an optional subtitle. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Title2 as="h1">{title}</Title2>
      {subtitle && (
        <Text size={300} className={styles.subtitle}>
          {subtitle}
        </Text>
      )}
    </div>
  );
}
