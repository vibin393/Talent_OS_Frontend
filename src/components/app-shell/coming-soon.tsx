"use client";

import { Body1, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { WrenchScrewdriver24Regular } from "@fluentui/react-icons";
import { PageHeader } from "./page-header";

const useStyles = makeStyles({
  card: {
    maxWidth: "560px",
  },
  icon: {
    color: tokens.colorBrandForeground1,
  },
  description: {
    color: tokens.colorNeutralForeground2,
  },
});

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  const styles = useStyles();
  return (
    <>
      <PageHeader title={title} />
      <Card className={styles.card}>
        <CardHeader
          image={<WrenchScrewdriver24Regular className={styles.icon} aria-hidden />}
          header={<Subtitle2 as="h2">Coming soon</Subtitle2>}
          description={<Body1 className={styles.description}>{description ?? `${title} is not available yet.`}</Body1>}
        />
      </Card>
    </>
  );
}
