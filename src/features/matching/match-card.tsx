"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Link,
  makeStyles,
  ProgressBar,
  Skeleton,
  SkeletonItem,
  Tag,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowUndo20Regular, Dismiss20Regular, ErrorCircle16Regular, PeopleAdd20Regular } from "@fluentui/react-icons";
import { AppLink } from "@/components/app-link";
import { scoreHiddenReason } from "@/features/fairness/logic";
import { ScoreHiddenBadge } from "@/features/fairness/score-hidden";
import type { MatchOut } from "@/lib/api/types";
import { barColor, dismissReasonLabel, formatScore, scoreColor, subScoreRows } from "./score";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 1.4fr) auto",
    gridTemplateAreas: '"who scores overall" "why why actions"',
    columnGap: tokens.spacingHorizontalXL,
    rowGap: tokens.spacingVerticalM,
    alignItems: "start",
    "@media (max-width: 899px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"who overall" "scores scores" "why why" "actions actions"',
    },
  },
  dismissed: { opacity: 0.75 },
  who: { gridArea: "who", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  whoTop: { display: "flex", alignItems: "baseline", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  rank: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  name: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400 },
  muted: { color: tokens.colorNeutralForeground3 },
  meta: { color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  tags: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXS },
  scores: {
    gridArea: "scores",
    display: "grid",
    gridTemplateColumns: "max-content minmax(80px, 1fr) 3.5ch",
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXXS,
    alignItems: "center",
  },
  scoreValue: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
  noData: { gridColumn: "2 / span 2", color: tokens.colorNeutralForeground3 },
  overall: { gridArea: "overall", display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalXXS },
  overallBadge: { minWidth: "56px", height: "56px", borderRadius: tokens.borderRadiusCircular, fontSize: tokens.fontSizeBase500 },
  why: { gridArea: "why", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  evidence: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL, color: tokens.colorNeutralForeground2 },
  actions: {
    gridArea: "actions",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
});

function Explanation({ match }: { match: MatchOut }) {
  const styles = useStyles();
  if (match.explanation_status === "pending") {
    return (
      <Skeleton aria-label="Generating explanation">
        <SkeletonItem size={12} style={{ width: "90%", marginBottom: 6 }} />
        <SkeletonItem size={12} style={{ width: "70%" }} />
      </Skeleton>
    );
  }
  if (match.explanation_status === "ready" && match.explanation) {
    return (
      <>
        <Body1>{match.explanation}</Body1>
        <Caption1 className={styles.muted}>AI-generated explanation · scores are rule-based</Caption1>
      </>
    );
  }
  const items = match.evidence.filter((e) => e.text);
  if (items.length === 0) return <Caption1 className={styles.muted}>No supporting evidence recorded.</Caption1>;
  return (
    <>
      <Caption1 className={styles.muted}>Why this match</Caption1>
      <ul className={styles.evidence}>
        {items.map((e) => (
          <li key={e.id}>
            <Caption1>{e.text}</Caption1>
          </li>
        ))}
      </ul>
    </>
  );
}

/** One ranked match: who, 7 sub-score bars, overall score, explanation/evidence and actions. */
export function MatchCard({
  match,
  rank,
  canWrite,
  canAddToPipeline,
  busy,
  onAdd,
  onDismiss,
  onRestore,
  onOpenPipeline,
}: {
  match: MatchOut;
  rank: number;
  canWrite: boolean;
  canAddToPipeline: boolean;
  busy: boolean;
  onAdd: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onOpenPipeline?: () => void;
}) {
  const styles = useStyles();
  const c = match.candidate;
  const name = c.display_name || "Candidate";
  const meta = [c.current_title, c.current_employer, c.city].filter(Boolean).join(" · ");
  // Epic 49: `overall` is null and `score_hidden_reason` set when LL144 hides AEDT scores.
  const overall = match.overall as number | null;
  const hiddenReason = scoreHiddenReason(match);
  const color = overall === null ? "informative" : scoreColor(overall);
  const inPipeline = !!(match.application_id || match.added_to_pipeline_at);
  const dismissed = !!match.dismissed_at;

  const addButton = (
    <Button
      appearance="primary"
      icon={<PeopleAdd20Regular />}
      disabled={canAddToPipeline && (busy || dismissed)}
      disabledFocusable={!canAddToPipeline}
      onClick={onAdd}
    >
      Add to pipeline
    </Button>
  );

  return (
    <Card className={dismissed ? `${styles.card} ${styles.dismissed}` : styles.card} aria-label={`Match ${rank}: ${name}`}>
      <div className={styles.who}>
        <div className={styles.whoTop}>
          <Text className={styles.rank} aria-label={`Rank ${rank}`}>
            #{rank}
          </Text>
          <AppLink href={`/candidates/${c.id}`} className={styles.name}>
            {name}
          </AppLink>
          {c.human_id && <Caption1 className={styles.muted}>{c.human_id}</Caption1>}
        </div>
        {meta && <Body1 className={styles.meta}>{meta}</Body1>}
        <div className={styles.tags}>
          {match.missing_mandatory.map((s) => (
            <Tag key={s} size="extra-small" appearance="outline" icon={<ErrorCircle16Regular />}>
              Missing: {s}
            </Tag>
          ))}
          {dismissed && (
            <Badge appearance="tint" color="subtle">
              Dismissed · {dismissReasonLabel(match.dismiss_reason)}
            </Badge>
          )}
          {match.is_stale && (
            <Badge appearance="tint" color="warning">
              Outdated
            </Badge>
          )}
        </div>
      </div>

      <div className={styles.scores} role="list" aria-label="Score breakdown">
        {subScoreRows(match.sub_scores).map((row) => (
          <div key={row.key} role="listitem" style={{ display: "contents" }}>
            <Caption1>{row.label}</Caption1>
            {row.value === null ? (
              <Caption1 className={styles.noData}>No data</Caption1>
            ) : (
              <>
                <ProgressBar
                  value={row.value / 100}
                  thickness="large"
                  color={barColor(row.value)}
                  aria-label={`${row.label} ${row.value} of 100`}
                />
                <Caption1 className={styles.scoreValue}>{row.value}</Caption1>
              </>
            )}
          </div>
        ))}
      </div>

      <div className={styles.overall}>
        {overall === null ? (
          <ScoreHiddenBadge reason={hiddenReason} size="medium" />
        ) : (
          <Badge
            size="extra-large"
            shape="circular"
            appearance="filled"
            color={color}
            className={styles.overallBadge}
            aria-label={`Overall score ${formatScore(overall)} of 100`}
          >
            {formatScore(overall)}
          </Badge>
        )}
        <Caption1 className={styles.muted}>Overall</Caption1>
      </div>

      <div className={styles.why}>
        <Explanation match={match} />
      </div>

      {canWrite && (
        <div className={styles.actions}>
          {inPipeline ? (
            <Link
              href="?tab=pipeline"
              onClick={(e) => {
                if (!onOpenPipeline) return;
                e.preventDefault();
                onOpenPipeline();
              }}
            >
              In pipeline
            </Link>
          ) : canAddToPipeline ? (
            addButton
          ) : (
            <Tooltip content="Pipeline available soon" relationship="description">
              {addButton}
            </Tooltip>
          )}
          {dismissed ? (
            <Button icon={<ArrowUndo20Regular />} disabled={busy} onClick={onRestore}>
              Restore
            </Button>
          ) : (
            <Button icon={<Dismiss20Regular />} disabled={busy} onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
