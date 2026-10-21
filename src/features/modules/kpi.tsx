"use client";

import {
  Caption1,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  kpi: { padding: tokens.spacingHorizontalL },
  value: { lineHeight: 1 },
});

export type Kpi = { label: string; value: string | number; hint?: string };

/** A module landing dashboard: title + a responsive grid of KPI tiles, with loading/error states. */
export function ModuleKpiDashboard({
  title,
  subtitle,
  kpis,
  isPending,
  isError,
  onRetry,
}: {
  title: string;
  subtitle?: string;
  kpis: Kpi[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title2 as="h1">{title}</Title2>
        {subtitle && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{subtitle}</Caption1>}
      </div>

      {isError && (
        <MessageBar intent="error">
          <MessageBarBody>
            Could not load this dashboard.{" "}
            <Text as="span" role="button" tabIndex={0} style={{ textDecoration: "underline", cursor: "pointer" }} onClick={onRetry}>
              Try again
            </Text>
          </MessageBarBody>
        </MessageBar>
      )}

      {isPending ? (
        <Skeleton aria-label="Loading">
          <div className={styles.grid}>
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonItem key={i} size={72} />
            ))}
          </div>
        </Skeleton>
      ) : (
        <div className={styles.grid}>
          {kpis.map((k) => (
            <Card key={k.label} className={styles.kpi}>
              <Caption1>{k.label}</Caption1>
              <Title2 as="span" block className={styles.value}>
                {k.value}
              </Title2>
              {k.hint && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{k.hint}</Caption1>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
