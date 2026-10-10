"use client";

import { Body1, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import { FeatureReadinessPanel } from "@/features/settings/integrations/feature-readiness";

/** Tab value of the read-only go-live step (after every import kind and the AI agents step). */
export const INTEGRATIONS_STEP = "__integrations__";
export const INTEGRATIONS_STEP_LABEL = "Integrations and AI (optional)";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/**
 * Go-live wizard last step (Epic 79 story 79.8, FR-414). Read-only readiness for external features: everything
 * external starts off and must pass its Fake/sandbox burn-in before using real credentials.
 */
export function IntegrationsGoLiveStep() {
  const styles = useStyles();
  return (
    <div className={styles.body}>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2 as="h2">{INTEGRATIONS_STEP_LABEL}</Subtitle2>} />
        <Body1>
          Apps, webhooks, connectors, the job network, calling, MCP and portal Copilots all start switched off. Turn
          each on only after your data is in and its readiness checks below are green. Connectors run against a Fake or
          sandbox before you give them real credentials.
        </Body1>
        <AppLink href="/settings/integrations">Set up integrations</AppLink>
      </Card>
      <FeatureReadinessPanel />
    </div>
  );
}
