"use client";

import { Body1, Caption1, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import { formatDateTime } from "@/features/admin/ui";
import { FeedbackBadge } from "@/features/pipeline/badges";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  item: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    flexWrap: "wrap",
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    ":last-child": { borderBottom: "none" },
  },
  text: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  muted: { color: tokens.colorNeutralForeground3 },
});

type RecentSubmission = {
  id?: string;
  human_id?: string;
  demand_id?: string;
  demand_title?: string | null;
  candidate_id?: string;
  sent_at?: string | null;
  feedback_status?: string;
};

/** Client 360 "Submissions" card: the latest candidates sent to this client and their feedback. */
export function ClientSubmissionsCard({ submissions }: { submissions: Record<string, unknown>[] }) {
  const styles = useStyles();
  const rows = submissions as RecentSubmission[];
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Recent submissions</Subtitle2>} />
      {rows.length === 0 ? (
        <Body1 className={styles.muted}>No candidates have been submitted to this client yet.</Body1>
      ) : (
        <ul className={styles.list}>
          {rows.map((r, i) => (
            <li key={r.id ?? i} className={styles.item}>
              <span className={styles.text}>
                {r.demand_id ? (
                  <AppLink href={`/demands/${r.demand_id}?tab=pipeline`}>{r.demand_title ?? r.human_id ?? "Demand"}</AppLink>
                ) : (
                  <span>{r.demand_title ?? r.human_id}</span>
                )}
                <Caption1 className={styles.muted}>
                  {r.human_id} · sent {formatDateTime(r.sent_at)}
                  {r.candidate_id && (
                    <>
                      {" · "}
                      <AppLink href={`/candidates/${r.candidate_id}`}>Candidate</AppLink>
                    </>
                  )}
                </Caption1>
              </span>
              {r.feedback_status && r.feedback_status !== "none" ? (
                <FeedbackBadge status={r.feedback_status} />
              ) : (
                <Caption1 className={styles.muted}>Awaiting feedback</Caption1>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
