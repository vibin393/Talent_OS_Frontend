"use client";

import { Badge, Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { browserTimeZone } from "@/lib/time/zones";
import { slotLabel } from "./logic";
import type { OfferOut } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  item: { display: "flex", flexDirection: "column", gap: "2px" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** The offered slots of one offer: each in the recruiter's zone with the candidate's zone below. */
export function SlotList({ offer, candidateTimezone }: { offer: OfferOut; candidateTimezone: string }) {
  const styles = useStyles();
  const tz = browserTimeZone();
  if (offer.slots.length === 0) return <Caption1 className={styles.muted}>No slots.</Caption1>;
  return (
    <ul className={styles.list} aria-label={`Offered times, round ${offer.round}`}>
      {offer.slots.map((s) => (
        <li key={s.index} className={styles.item}>
          <div className={styles.row}>
            <Text>{slotLabel(s.start, s.end, tz)}</Text>
            {offer.picked_index === s.index && (
              <Badge size="small" appearance="tint" color="success">
                Picked
              </Badge>
            )}
            {!s.all_known_free && (
              <Badge size="small" appearance="tint" color="warning">
                Conflict
              </Badge>
            )}
          </div>
          {candidateTimezone !== tz && (
            <Caption1 className={styles.muted}>
              Candidate: {slotLabel(s.start, s.end, candidateTimezone)} ({candidateTimezone})
            </Caption1>
          )}
        </li>
      ))}
    </ul>
  );
}
