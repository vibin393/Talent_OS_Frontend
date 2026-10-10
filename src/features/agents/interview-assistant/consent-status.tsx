"use client";

import { Badge, Caption1, makeStyles, Text, tokens } from "@fluentui/react-components";
import { CONSENT_LABELS } from "./logic";
import type { ParticipantConsent } from "./types";

const useStyles = makeStyles({
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const COLORS = { agreed: "success", waiting: "warning", refused: "danger" } as const;
const KIND = { candidate: "Candidate", internal: "Interviewer", external: "Client interviewer" } as const;

/** Participant consent list: "Candidate: Agreed / Waiting / Refused", "{interviewer}: Agreed / Waiting". */
export function ConsentStatus({ participants }: { participants: ParticipantConsent[] }) {
  const styles = useStyles();
  return (
    <ul className={styles.list} aria-label="Recording consent">
      {participants.map((p) => (
        <li key={`${p.kind}-${p.participant_id ?? "candidate"}`} className={styles.row}>
          <Text weight="semibold">{p.kind === "candidate" ? "Candidate" : p.name}:</Text>
          <Badge appearance="tint" color={COLORS[p.state]}>
            {CONSENT_LABELS[p.state]}
          </Badge>
          {p.kind !== "candidate" && <Caption1 className={styles.muted}>{KIND[p.kind]}</Caption1>}
          {p.kind === "candidate" && <Caption1 className={styles.muted}>{p.name}</Caption1>}
        </li>
      ))}
    </ul>
  );
}
