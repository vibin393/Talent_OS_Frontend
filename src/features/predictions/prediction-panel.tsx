"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDown16Regular, ArrowUp16Regular, DataTrending20Regular, Sparkle16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import {
  canSeePredictions,
  contributionWidth,
  DEFAULT_DISCLAIMER,
  directionText,
  DISABLED_TEXT,
  EXPLANATION_UNAVAILABLE,
  formatDays,
  formatProbability,
  NO_MODEL_TEXT,
  progressText,
  progressValue,
  SUPPORTING_SIGNAL,
  TOP_CONTRIBUTIONS,
  topContributions,
  visibleEntries,
} from "./logic";
import { PredictionBadge } from "./prediction-badge";
import type { ExplanationOut, PredictionEntry, PredictionSubjectKind } from "./types";
import { useExplainPrediction, useSubjectPredictions } from "./use-predictions";

const useStyles = makeStyles({
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL },
  entry: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  first: { borderTop: "none", paddingTop: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  value: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3 },
  tableWrap: { overflowX: "auto" },
  barCell: { minWidth: "160px" },
  barTrack: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  bar: { height: "10px", borderRadius: tokens.borderRadiusSmall, flexShrink: 0 },
  barBox: { flex: 1, minWidth: "80px", maxWidth: "200px" },
  up: { backgroundColor: tokens.colorPaletteRedBackground3 },
  down: { backgroundColor: tokens.colorPaletteGreenBackground3 },
  upText: { color: tokens.colorPaletteRedForeground1 },
  downText: { color: tokens.colorPaletteGreenForeground1 },
  dirLabel: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXXS, whiteSpace: "nowrap" },
  explain: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
});

const SUBJECT_TITLES: Record<PredictionSubjectKind, string> = {
  demand: "Predictions",
  offer: "Offer drop risk",
  placement: "Predictions",
};

/**
 * Predictions for one Demand / Offer / Placement (Epic 48). Hidden entirely without `prediction:read`,
 * when the API answers 403 / 404, or when there is nothing the user may see. Attrition renders only with
 * `prediction:read_attrition` and only when the backend sent it.
 */
export function PredictionPanel({ subjectKind, subjectId, title }: { subjectKind: PredictionSubjectKind; subjectId: string; title?: string }) {
  const styles = useStyles();
  const permissions = usePermissions();
  const canRead = canSeePredictions(permissions);
  const q = useSubjectPredictions(subjectKind, subjectId, canRead);
  if (!canRead) return null;
  if (q.isPending) return <Spinner size="tiny" label="Loading predictions" />;
  if (q.isError) {
    if (isApiError(q.error) && (q.error.status === 403 || q.error.status === 404)) return null;
    return <ErrorBar title="Could not load predictions." message={errorMessage(q.error)} />;
  }
  const entries = visibleEntries(q.data.predictions, permissions);
  if (entries.length === 0) return null;
  return (
    <Card className={styles.card} aria-label={title ?? SUBJECT_TITLES[subjectKind]}>
      <CardHeader
        image={<DataTrending20Regular aria-hidden />}
        header={<Subtitle2 as="h2">{title ?? SUBJECT_TITLES[subjectKind]}</Subtitle2>}
        description={<Caption1 className={styles.muted}>{SUPPORTING_SIGNAL} – a statistical estimate from your own history, not a decision.</Caption1>}
      />
      {entries.map((e, i) => (
        <PredictionEntryView key={e.kind} entry={e} first={i === 0} />
      ))}
    </Card>
  );
}

export function PredictionEntryView({ entry, first }: { entry: PredictionEntry; first?: boolean }) {
  const styles = useStyles();
  const ttf = entry.kind === "time_to_fill";
  return (
    <section className={mergeClasses(styles.entry, first && styles.first)} aria-label={entry.kind_label}>
      <div className={styles.head}>
        <Text weight="semibold">{entry.kind_label}</Text>
        {entry.status === "ok" && !ttf && <PredictionBadge prediction={entry} suffix="risk" />}
      </div>
      {entry.status === "disabled" && <Body1 className={styles.muted}>{DISABLED_TEXT}</Body1>}
      {entry.status === "no_model" && <Body1 className={styles.muted}>{NO_MODEL_TEXT}</Body1>}
      {entry.status === "insufficient_data" && (
        <div>
          <Body1>{progressText(entry.progress)}</Body1>
          <ProgressBar value={progressValue(entry.progress)} thickness="large" aria-label={progressText(entry.progress)} />
        </div>
      )}
      {entry.status === "ok" && <OkEntry entry={entry} />}
    </section>
  );
}

function OkEntry({ entry }: { entry: PredictionEntry }) {
  const styles = useStyles();
  const ttf = entry.kind === "time_to_fill";
  const [showAll, setShowAll] = useState(false);
  const shown = topContributions(entry.contributions, showAll);
  const value = ttf ? formatDays(entry.predicted_days ?? entry.score, entry.interval) : formatProbability(entry.score);
  return (
    <>
      <div className={styles.row}>
        <Tooltip content={SUPPORTING_SIGNAL} relationship="description">
          <span/* NOSONAR */ className={styles.value} tabIndex={0}>
            {ttf ? value : `Probability ${value ?? "—"}`}
          </span>
        </Tooltip>
        {ttf && entry.interval && <Caption1 className={styles.muted}>likely range, 20th–80th percentile</Caption1>}
      </div>
      <Caption1 className={styles.muted}>
        {entry.model_version !== null ? `Model v${entry.model_version}` : "Model"} · computed {formatDateTime(entry.computed_at)}
      </Caption1>

      {entry.contributions.length > 0 && (
        <div className={styles.tableWrap}>
          <Table size="small" aria-label={`What drives the ${entry.kind_label.toLowerCase()} estimate`}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Factor</TableHeaderCell>
                <TableHeaderCell>Value</TableHeaderCell>
                <TableHeaderCell className={styles.barCell}>Effect</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => {
                const up = c.direction === "up";
                return (
                  <TableRow key={c.key}>
                    <TableCell>{c.label}</TableCell>
                    <TableCell>{c.value_display}</TableCell>
                    <TableCell className={styles.barCell}>
                      <div className={styles.barTrack}>
                        <div className={styles.barBox} aria-hidden>
                          <div className={mergeClasses(styles.bar, up ? styles.up : styles.down)} style={{ width: `${contributionWidth(c, shown)}%` }} />
                        </div>
                        <span className={mergeClasses(styles.dirLabel, up ? styles.upText : styles.downText)}>
                          {up ? <ArrowUp16Regular aria-hidden /> : <ArrowDown16Regular aria-hidden />}
                          {c.display} · {directionText(entry.kind, c.direction)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {entry.contributions.length > TOP_CONTRIBUTIONS && (
            <Button appearance="transparent" size="small" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show top 5" : `Show all (${entry.contributions.length})`}
            </Button>
          )}
        </div>
      )}

      <Explanation entry={entry} />
    </>
  );
}

function Explanation({ entry }: { entry: PredictionEntry }) {
  const styles = useStyles();
  const explain = useExplainPrediction();
  const initial: ExplanationOut | null =
    entry.explanation_status === "ok" && entry.explanation_text
      ? { status: "ok", text: entry.explanation_text, disclaimer: DEFAULT_DISCLAIMER }
      : entry.explanation_status === "unavailable"
        ? { status: "unavailable", text: null, disclaimer: DEFAULT_DISCLAIMER }
        : null;
  const result = explain.data ?? initial;
  if (!entry.prediction_id) return null;
  return (
    <div className={styles.row}>
      {!result && (
        <Button
          icon={explain.isPending ? <Spinner size="tiny" /> : <Sparkle16Regular />}
          disabled={explain.isPending}
          onClick={() => explain.mutate(entry.prediction_id!)}
        >
          Explain
        </Button>
      )}
      {explain.isError && (
        <MessageBar intent="warning">
          <MessageBarBody>{EXPLANATION_UNAVAILABLE}</MessageBarBody>
        </MessageBar>
      )}
      {result && result.status === "ok" && result.text && (
        <div className={styles.explain} role="note" aria-live="polite">
          <div className={styles.row}>
            <Badge size="small" appearance="tint" color="brand" icon={<Sparkle16Regular />}>
              AI
            </Badge>
            <Caption1 className={styles.muted}>{result.disclaimer || DEFAULT_DISCLAIMER}</Caption1>
          </div>
          <Body1>{result.text}</Body1>
        </div>
      )}
      {result && !(result.status === "ok" && result.text) && <Caption1 className={styles.muted}>{EXPLANATION_UNAVAILABLE}</Caption1>}
    </div>
  );
}
