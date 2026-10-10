"use client";

import { Body1, Card, CardHeader, makeStyles, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { usePermission } from "@/features/auth/use-permission";
import { crmApi, crmKeys } from "../api";
import { formatDate, formatMoney } from "../format";
import { StageBadge } from "../ui";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, marginTop: tokens.spacingVerticalL, maxWidth: "720px" },
  stats: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL },
  list: { listStyle: "none", margin: 0, padding: 0 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    padding: `${tokens.spacingVerticalXS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Client 360 "Opportunities" card: open count, weighted pipeline per currency and the list. */
export function ClientOpportunitiesCard({ clientId }: { clientId: string }) {
  const styles = useStyles();
  const canRead = usePermission("opportunity:read");
  const q = useQuery({
    queryKey: crmKeys.clientOpportunities(clientId),
    queryFn: ({ signal }) => crmApi.clientOpportunities(clientId, signal),
    enabled: canRead,
  });
  if (!canRead || !q.data) return null;
  const { open_count, weighted_pipeline, items } = q.data;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Opportunities</Subtitle2>}
        action={<AppLink href={`/opportunities?client_id=${clientId}`}>View all</AppLink>}
      />
      <div className={styles.stats}>
        <Text>
          <span className={styles.muted}>Open </span>
          {open_count}
        </Text>
        {weighted_pipeline.map((t) => (
          <Text key={t.currency}>
            <span className={styles.muted}>Weighted </span>
            {formatMoney(t.weighted, t.currency)}
          </Text>
        ))}
      </div>
      {items.length === 0 ? (
        <Body1 className={styles.muted}>No opportunities yet.</Body1>
      ) : (
        <ul className={styles.list}>
          {items.slice(0, 8).map((o) => (
            <li key={o.id} className={styles.item}>
              <AppLink href={`/opportunities/${o.id}`}>{o.name}</AppLink>
              <StageBadge stage={o.stage} />
              <Text size={200} className={styles.muted}>
                {formatMoney(o.estimated_revenue, o.currency)} · close {formatDate(o.expected_close_date)}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
