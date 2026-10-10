"use client";

import { Body1, Button, Card, makeStyles, Skeleton, SkeletonItem, Title2, tokens } from "@fluentui/react-components";
import { useParams } from "next/navigation";
import { careersPath } from "./format";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  title: { width: "60%", height: "32px" },
  card: { height: "88px" },
  notFound: { padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, alignItems: "flex-start", maxWidth: "560px" },
  button: { minHeight: "44px" },
});

/** Branded loading state of the career site list (inside the tenant chrome). */
export function CareersLoading() {
  const styles = useStyles();
  return (
    <Skeleton className={styles.stack} aria-busy="true" aria-label="Loading jobs">
      <SkeletonItem className={styles.title} />
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonItem key={i} className={styles.card} />
      ))}
    </Skeleton>
  );
}

/** Branded 404 for an unknown or closed job inside a known career site. */
export function CareersNotFound() {
  const styles = useStyles();
  const params = useParams<{ tenant?: string }>();
  return (
    <Card className={styles.notFound}>
      <Title2 as="h1">This job is not available</Title2>
      <Body1>It may have been filled or closed. Have a look at our other open positions.</Body1>
      {params.tenant && (
        <Button as="a" href={careersPath(params.tenant)} appearance="primary" className={styles.button}>
          See all jobs
        </Button>
      )}
    </Card>
  );
}
