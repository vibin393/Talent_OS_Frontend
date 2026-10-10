"use client";

import { Badge, Button, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { portalRecordingApi } from "./api";
import { RecordingConsentForm } from "./public-consent";

const useStyles = makeStyles({
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Candidate Portal interview card line "Recording: Agreed / Not agreed" + "Change" (only when the interviewers asked). */
export function PortalRecordingConsent({ interviewId }: { interviewId: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const key = ["portal-recording-consent", interviewId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await portalRecordingApi.view(interviewId);
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null;
        throw e;
      }
    },
  });
  if (!q.data) return null;
  const agreed = q.data.status === "agreed";
  return (
    <div>
      <div className={styles.row}>
        <Caption1>Recording:</Caption1>
        <Badge appearance="tint" color={agreed ? "success" : "subtle"}>
          {agreed ? "Agreed" : "Not agreed"}
        </Badge>
        <Button size="small" appearance="subtle" onClick={() => setEditing((v) => !v)}>
          Change
        </Button>
      </div>
      {editing && (
        <RecordingConsentForm
          view={q.data}
          onDecide={async (body) => {
            const out = await portalRecordingApi.decide(interviewId, body);
            qc.setQueryData(key, out);
            return out;
          }}
        />
      )}
    </div>
  );
}
