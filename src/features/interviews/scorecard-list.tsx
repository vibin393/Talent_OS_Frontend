"use client";

import { Badge, Body1, Caption1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Text, tokens } from "@fluentui/react-components";
import { EyeOff20Regular } from "@fluentui/react-icons";
import { formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { recommendationLabel } from "./format";
import { averageRating, blindedText, kitFromSnapshot } from "./scorecard";
import type { Recommendation } from "./types";
import { useScorecards } from "./use-scorecards";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  ratings: { display: "grid", gridTemplateColumns: "1fr auto", columnGap: tokens.spacingHorizontalL, rowGap: tokens.spacingVerticalXXS, margin: 0 },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingInline: tokens.spacingHorizontalM, paddingBottom: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  pre: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
});

const REC_COLOR: Record<Recommendation, "success" | "brand" | "warning" | "danger"> = {
  strong_yes: "success",
  yes: "brand",
  no: "warning",
  strong_no: "danger",
};

/** Submitted scorecards for an interview, or the blinded state ("2 of 3 submitted — submit yours to view"). */
export function ScorecardList({ interviewId }: { interviewId: string }) {
  const styles = useStyles();
  const q = useScorecards(interviewId);
  if (q.isPending) return <GridSkeleton rows={2} />;
  if (q.isError) return <Body1 className={styles.muted}>{errorMessage(q.error)}</Body1>;
  const blinded = blindedText(q.data);
  if (blinded) {
    return (
      <MessageBar intent="info" icon={<EyeOff20Regular />}>
        <MessageBarBody>{blinded}</MessageBarBody>
      </MessageBar>
    );
  }
  const submitted = q.data.items.filter((c) => c.status === "submitted");
  if (!submitted.length) return <Body1 className={styles.muted}>No scorecards submitted yet ({q.data.submitted_count} of {q.data.required_count}).</Body1>;
  return (
    <div className={styles.list}>
      {submitted.map((c) => {
        const kit = kitFromSnapshot(c.kit);
        const avg = averageRating(c);
        return (
          <Card key={c.participant_id} appearance="outline">
            <CardHeader
              header={<Text weight="semibold">{c.participant_name ?? "Interviewer"}</Text>}
              description={
                <Caption1 className={styles.muted}>
                  {c.participant_kind === "interviewer_external" ? "External · " : ""}
                  {formatDateTime(c.submitted_at)}
                  {avg !== null ? ` · average ${avg}/${kit.ratingScale}` : ""}
                </Caption1>
              }
              action={
                c.recommendation ? (
                  <Badge appearance="tint" color={REC_COLOR[c.recommendation]}>
                    {recommendationLabel(c.recommendation)}
                  </Badge>
                ) : undefined
              }
            />
            <div className={styles.body}>
              <dl className={styles.ratings}>
                {c.ratings.map((r) => (
                  <div key={r.competency_key} style={{ display: "contents" }}>
                    <dt>
                      {kit.competencies.find((k) => k.key === r.competency_key)?.label ?? r.competency_key}
                      {r.note && (
                        <Caption1 as="span" className={styles.muted}>
                          {" "}
                          — {r.note}
                        </Caption1>
                      )}
                    </dt>
                    <dd style={{ margin: 0 }}>
                      {r.rating}/{kit.ratingScale}
                    </dd>
                  </div>
                ))}
              </dl>
              {c.summary && (
                <Body1 as="p" className={styles.pre} style={{ margin: 0 }}>
                  {c.summary}
                </Body1>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
