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
  ProgressBar,
  Skeleton,
  SkeletonItem,
  Subtitle1,
  Subtitle2,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { useCroarOverview, type CroarQueue } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  kpi: { padding: tokens.spacingHorizontalL },
  kpiValue: { lineHeight: 1 },
  columns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
  },
  queue: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  queueText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  stage: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, paddingBlock: tokens.spacingVerticalXS },
  stageTop: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  card: { padding: tokens.spacingHorizontalL },
});

const toneToColor: Record<string, "informative" | "warning" | "danger" | "success"> = {
  info: "informative",
  warning: "warning",
  danger: "danger",
  success: "success",
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const styles = useStyles();
  return (
    <Card className={styles.kpi}>
      <Caption1>{label}</Caption1>
      <Title2 as="span" block className={styles.kpiValue}>
        {value}
      </Title2>
      {hint && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{hint}</Caption1>}
    </Card>
  );
}

function QueueRow({ q }: { q: CroarQueue }) {
  const styles = useStyles();
  return (
    <div className={styles.queue}>
      <div className={styles.queueText}>
        <Body1>{q.label}</Body1>
        {q.hint && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{q.hint}</Caption1>}
      </div>
      <Badge appearance="tint" color={toneToColor[q.tone ?? "info"] ?? "informative"} size="large">
        {q.count}
      </Badge>
    </div>
  );
}

function LoadingState() {
  const styles = useStyles();
  return (
    <Skeleton aria-label="Loading Croar dashboard">
      <div className={styles.kpiGrid}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonItem key={i} size={72} />
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * Native Croar dashboard rendered inside the Talent OS shell (Fluent UI). Data is fetched through the
 * module gateway (`/api/v1/modules/croar/...`) — no iframe, no second chrome.
 */
export function CroarDashboard() {
  const styles = useStyles();
  const { data, isPending, isError, refetch } = useCroarOverview();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title2 as="h1">Croar</Title2>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          Recruiting &amp; workforce — live, inside Talent OS.
        </Caption1>
      </div>

      {isError && (
        <MessageBar intent="error">
          <MessageBarBody>
            Could not load the Croar dashboard.{" "}
            <Text as="span" role="button" tabIndex={0} style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => refetch()}>
              Try again
            </Text>
          </MessageBarBody>
        </MessageBar>
      )}

      {isPending && <LoadingState />}

      {data && (
        <>
          <div className={styles.kpiGrid}>
            <Kpi label="Active jobs" value={data.hiring?.active_jobs ?? 0} hint={`${data.hiring?.total_jobs ?? 0} total`} />
            <Kpi label="Candidates" value={data.hiring?.candidates ?? 0} />
            <Kpi label="Applications (30d)" value={data.hiring?.applications_30d ?? 0} />
            <Kpi label="Headcount" value={data.workforce?.headcount ?? 0} hint={`${data.workforce?.on_probation ?? 0} on probation`} />
          </div>

          <div className={styles.columns}>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle1>Needs your attention</Subtitle1>} />
              {data.queues.length === 0 ? (
                <Body1 style={{ color: tokens.colorNeutralForeground3 }}>All clear — nothing waiting.</Body1>
              ) : (
                data.queues.map((q) => <QueueRow key={q.key} q={q} />)
              )}
            </Card>

            <Card className={styles.card}>
              <CardHeader header={<Subtitle1>Hiring pipeline</Subtitle1>} />
              {data.pipeline.stages.length === 0 ? (
                <Body1 style={{ color: tokens.colorNeutralForeground3 }}>No candidates in the pipeline yet.</Body1>
              ) : (
                data.pipeline.stages.map((s) => (
                  <div key={s.stage} className={styles.stage}>
                    <div className={styles.stageTop}>
                      <Subtitle2>{s.stage}</Subtitle2>
                      <Text>{s.count}</Text>
                    </div>
                    <ProgressBar value={Math.max(0, Math.min(1, s.share))} thickness="large" />
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
