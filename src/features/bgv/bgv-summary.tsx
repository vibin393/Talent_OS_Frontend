"use client";

import { Badge, Body1, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { bgvApi, bgvKeys } from "./api";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS, formatDate } from "./logic";
import { NewBgvCaseButton } from "./new-case-dialog";

const useStyles = makeStyles({
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

/** Placement tab / Worker 360 section: the BGV cases of a placement (status, package, decision date). */
export function PlacementBgvSummary({ placementId, candidateId }: { placementId: string; candidateId?: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: bgvKeys.placement(placementId), queryFn: ({ signal }) => bgvApi.placementCases(placementId, signal) });
  // The "New BGV case" action shows only where the candidate is known (placement tab) and with bgv:manage.
  const action = candidateId ? (
    <div className={styles.row}>
      <NewBgvCaseButton candidateId={candidateId} placementId={placementId} />
    </div>
  ) : null;
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError || q.data.length === 0)
    return (
      <div className={styles.list}>
        {action}
        <Body1>No background verification for this placement.</Body1>
      </div>
    );
  return (
    <div className={styles.list}>
    {action}
    <ul className={styles.list}>
      {q.data.map((c) => (
        <li key={c.id} className={styles.row}>
          <NextLink href={`/bgv/${c.id}`}>{c.human_id}</NextLink>
          <Badge appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
            {CASE_STATUS_LABELS[c.status]}
          </Badge>
          <Caption1>
            {c.package_name ?? ""} · {c.required ? "required" : "ad hoc"}
            {c.adjudicated_at ? ` · decided ${formatDate(c.adjudicated_at)}` : ""}
          </Caption1>
        </li>
      ))}
    </ul>
    </div>
  );
}
