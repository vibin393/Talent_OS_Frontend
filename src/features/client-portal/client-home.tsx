"use client";

import { Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { cpApi, cpKeys } from "./api";
import { Failure, formatDate, Loading, PageTitle, useCpStyles } from "./ui";

function Tile({ href, label, value, hint }: { href: string; label: string; value: string | number; hint?: string }) {
  const s = useCpStyles();
  return (
    <Link href={href} className={s.tile}>
      <Text className={s.muted}>{label}</Text>
      <span className={s.big}>{value}</span>
      {hint ? <Text size={200} className={s.muted}>{hint}</Text> : null}
    </Link>
  );
}

/** Client Portal home (Epic 18): approvals, new submissions, interviews, team and invoices tiles. */
export function ClientPortalHome() {
  const s = useCpStyles();
  const q = useQuery({ queryKey: cpKeys.home, queryFn: ({ signal }) => cpApi.home(signal) });
  if (q.error) return <Failure error={q.error} />;
  if (!q.data) return <Loading />;
  const h = q.data;
  return (
    <div className={s.page}>
      <PageTitle>{`Welcome, ${h.display_name}`}</PageTitle>
      <div className={s.grid}>
        {h.approvals_pending !== null ? (
          <Tile href="/client/approvals" label="Awaiting your approval" value={h.approvals_pending} />
        ) : null}
        {h.new_submissions !== null ? (
          <Tile href="/client/demands" label="New candidates to review" value={h.new_submissions} hint="Sent in the last 7 days" />
        ) : null}
        {h.upcoming_interview_dates !== null ? (
          <Tile
            href="/client/demands"
            label="Upcoming interviews"
            value={h.upcoming_interview_dates.length}
            hint={h.upcoming_interview_dates.slice(0, 3).map(formatDate).join(" · ") || "None scheduled"}
          />
        ) : null}
        {h.team ? (
          <Tile href="/client/team" label="Your team" value={h.team.size} hint={`${h.team.ending_within_30_days} ending within 30 days`} />
        ) : null}
        {h.invoices_issued !== null ? <Tile href="/client/invoices" label="Invoices issued" value={h.invoices_issued} /> : null}
      </div>
    </div>
  );
}
