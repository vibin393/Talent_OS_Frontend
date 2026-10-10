"use client";

import { Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { browserTimeZone, formatInZone } from "@/lib/time/zones";
import { historyLabel } from "./logic";
import type { HistoryOut } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  item: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "baseline",
    borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: tokens.spacingHorizontalS,
  },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Scheduling history": every step of the request (ids and times only). */
export function HistoryTimeline({ events }: { events: HistoryOut[] }) {
  const styles = useStyles();
  const tz = browserTimeZone();
  if (events.length === 0) return <Caption1 className={styles.muted}>No history yet.</Caption1>;
  return (
    <ol className={styles.list} aria-label="Scheduling history">
      {events.map((e) => (
        <li key={e.id} className={styles.item}>
          <Text>{historyLabel(e)}</Text>
          <Caption1 className={styles.muted}>
            {formatInZone(e.at, tz)}
            {e.actor_kind === "agent" ? " · Scheduling Agent" : e.actor_kind === "candidate" ? " · Candidate" : ""}
          </Caption1>
        </li>
      ))}
    </ol>
  );
}
