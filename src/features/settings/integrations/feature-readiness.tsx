"use client";

import {
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle20Filled, ErrorCircle20Filled, Warning20Filled } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { consoleApi, consoleKeys, type FeatureReadiness } from "@/features/ecosystem-console/api";
import { readinessColor, readinessLabel } from "@/features/ecosystem-console/logic";
import { errorMessage } from "@/lib/api/errors";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  feature: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, paddingBlock: tokens.spacingVerticalS, borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  checks: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
  check: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
});

export const FEATURE_LABELS: Record<string, string> = {
  job_network: "Job network",
  telephony: "Calling and transcription",
  stt: "Speech-to-text",
  ledger_sync: "Ledger sync",
  hrms_sync: "HRMS sync",
  job_boards: "Job boards",
  calendar_sync: "Calendar sync",
  mcp: "MCP access for AI assistants",
  portal_copilot: "Portal Copilot",
  campaign_copy: "AI campaign copy",
};

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ok") return <CheckmarkCircle20Filled primaryFill={tokens.colorPaletteGreenForeground1} aria-hidden />;
  if (status === "blocking") return <ErrorCircle20Filled primaryFill={tokens.colorPaletteRedForeground1} aria-hidden />;
  return <Warning20Filled primaryFill={tokens.colorPaletteYellowForeground1} aria-hidden />;
}

/**
 * "Feature readiness" checklist (Epic 79 story 79.8, spec A9/B5). Each feature's burn-in / go-live checks with a
 * status icon and the failing checks called out. Read-only; the backend enablement registry is the source.
 */
export function FeatureReadinessPanel({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: consoleKeys.featureReadiness, queryFn: ({ signal }) => consoleApi.featureReadiness(signal) });

  return (
    <Card>
      <CardHeader
        header={<Subtitle2>Feature readiness</Subtitle2>}
        description={<Caption1>Each integration must pass its burn-in and go-live checks before it can use real credentials.</Caption1>}
      />
      <div className={styles.card}>
        {q.isPending ? (
          <Spinner size="tiny" label="Loading readiness" />
        ) : q.error ? (
          <MessageBar intent="error">
            <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
          </MessageBar>
        ) : (q.data ?? []).length === 0 ? (
          <Body1>No features need setup checks.</Body1>
        ) : (
          (q.data ?? []).map((f) => <FeatureRow key={f.feature} feature={f} compact={compact} />)
        )}
      </div>
    </Card>
  );
}

function FeatureRow({ feature, compact }: { feature: FeatureReadiness; compact: boolean }) {
  const styles = useStyles();
  const failing = feature.checks.filter((c) => c.status !== "ok");
  return (
    <div className={styles.feature}>
      <div className={styles.head}>
        <StatusIcon status={feature.status} />
        <Text weight="semibold">{featureLabel(feature.feature)}</Text>
        <Badge appearance="tint" color={readinessColor(feature.status)}>
          {readinessLabel(feature.status)}
        </Badge>
      </div>
      {!compact && failing.length > 0 ? (
        <ul className={styles.checks}>
          {failing.map((c) => (
            <li key={c.key} className={styles.check}>
              <StatusIcon status={c.status} />
              <Text size={200}>
                {c.label}
                {c.detail ? ` — ${c.detail}` : ""}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
