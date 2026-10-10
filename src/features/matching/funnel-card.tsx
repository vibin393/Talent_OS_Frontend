"use client";

import { Badge, Button, Caption1, Card, makeStyles, Spinner, Subtitle2, Title3, tokens, Tooltip } from "@fluentui/react-components";
import { ArrowClockwise20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import type { MatchFunnelOut, MatchRunOut } from "@/lib/api/types";
import { relativeTime, STRONG_DEFAULT } from "./score";

const useStyles = makeStyles({
  card: { marginBottom: tokens.spacingVerticalM },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1 },
  steps: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    marginBlock: tokens.spacingVerticalS,
  },
  step: { display: "flex", flexDirection: "column", minWidth: "96px" },
  label: { color: tokens.colorNeutralForeground2 },
  chevron: { color: tokens.colorNeutralForeground3 },
  foot: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const STATUS_BADGE: Record<MatchRunOut["status"], { color: "success" | "danger" | "informative" | "warning"; label: string }> = {
  running: { color: "informative", label: "Computing…" },
  completed: { color: "success", label: "Up to date" },
  failed: { color: "danger", label: "Last run failed" },
  skipped: { color: "informative", label: "No changes" },
};

/** Rediscovery funnel: Total → Relevant → Strong → Available, with run status and Recompute. */
export function FunnelCard({
  funnel,
  lastRun,
  canRecompute,
  recomputing,
  onRecompute,
  footExtra,
}: {
  funnel: MatchFunnelOut | null | undefined;
  lastRun: MatchRunOut | null | undefined;
  canRecompute: boolean;
  recomputing: boolean;
  onRecompute: () => void;
  /** Extra summary shown in the footer (e.g. Epic 38 "N matching Pools"). */
  footExtra?: React.ReactNode;
}) {
  const styles = useStyles();
  const strong = funnel?.strong_threshold ?? STRONG_DEFAULT;
  const steps = [
    { label: "Total in pool", value: funnel?.total },
    { label: "Relevant", value: funnel?.relevant },
    { label: `Strong ≥${strong}`, value: funnel?.strong },
    { label: "Available", value: funnel?.available },
  ];
  const running = lastRun?.status === "running";
  const status = lastRun ? STATUS_BADGE[lastRun.status] : null;

  return (
    <Card className={styles.card} aria-label="Rediscovery funnel">
      <div className={styles.head}>
        <Subtitle2 as="h2">Rediscovery</Subtitle2>
        {status && (
          <Badge
            appearance="tint"
            color={status.color}
            icon={running ? <Spinner size="tiny" aria-hidden /> : undefined}
            aria-live="polite"
          >
            {status.label}
          </Badge>
        )}
        <div className={styles.grow} />
        {canRecompute && (
          <Tooltip content="Re-rank the talent pool against this demand" relationship="description">
            <Button
              icon={recomputing ? <Spinner size="tiny" /> : <ArrowClockwise20Regular />}
              disabled={recomputing || running}
              onClick={onRecompute}
            >
              Recompute
            </Button>
          </Tooltip>
        )}
      </div>
      <ol className={styles.steps} style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        {steps.map((s, i) => (
          <li key={s.label} style={{ display: "contents" }}>
            {i > 0 && <ChevronRight20Regular className={styles.chevron} aria-hidden />}
            <div className={styles.step}>
              <Title3>{s.value === undefined ? "—" : s.value.toLocaleString()}</Title3>
              <Caption1 className={styles.label}>{s.label}</Caption1>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.foot}>
        <Caption1 className={styles.muted}>
          {lastRun
            ? running
              ? `Started ${relativeTime(lastRun.started_at)}`
              : `Updated ${relativeTime(lastRun.finished_at ?? lastRun.started_at)}`
            : "Not computed yet — matches are computed when the demand is Open."}
        </Caption1>
        {footExtra}
      </div>
    </Card>
  );
}
