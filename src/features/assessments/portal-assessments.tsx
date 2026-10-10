"use client";

import { Badge, Body1, Card, Link, makeStyles, Spinner, Text, tokens, typographyStyles } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/errors";
import { portalAssessmentsApi } from "./api";
import { INVITATION_STATUS_COLORS, INVITATION_STATUS_LABELS } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "720px", marginInline: "auto" },
  heading: { ...typographyStyles.title2, margin: 0 },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalXS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/portal/assessments`: the candidate's assessment invitations. */
export function PortalAssessmentsList() {
  const styles = useStyles();
  const q = useQuery({ queryKey: ["portal", "assessments"], queryFn: ({ signal }) => portalAssessmentsApi.list(signal), retry: false });
  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>My assessments</h1>
      {q.isPending ? (
        <Spinner label="Loading…" />
      ) : q.isError ? (
        <Body1 role="alert">{errorMessage(q.error)}</Body1>
      ) : q.data.length === 0 ? (
        <Body1 className={styles.muted}>You have no assessments.</Body1>
      ) : (
        q.data.map((a) => (
          <Card key={a.invitation_id} className={styles.card}>
            <div className={styles.row}>
              <Link href={`/portal/assessments/${encodeURIComponent(a.invitation_id)}`}>
                {a.assessment_name}
              </Link>
              <Badge appearance="tint" color={INVITATION_STATUS_COLORS[a.status] ?? "informative"}>
                {INVITATION_STATUS_LABELS[a.status] ?? a.status}
              </Badge>
            </div>
            {a.deadline_at && <Text size={200} className={styles.muted}>Deadline {new Date(a.deadline_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</Text>}
          </Card>
        ))
      )}
    </div>
  );
}
