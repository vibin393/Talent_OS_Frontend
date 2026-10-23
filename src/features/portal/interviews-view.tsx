"use client";

import { Badge, Body1, Button, Card, Link as FluentLink, Subtitle1, Tab, TabList, Text } from "@fluentui/react-components";
import { CalendarAdd20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import type { PortalInterview, PortalMe } from "@/lib/api/types";
import { buildIcs, formatDateTime, icsFileName } from "./format";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";
import { NeedDifferentTime, PickTimeCards } from "@/features/agents/scheduling/portal-scheduling";
import { PortalRecordingConsent } from "@/features/agents/interview-assistant/portal-recording";

function downloadIcs(interview: PortalInterview, orgName: string) {
  const blob = new Blob([buildIcs(interview, orgName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFileName(interview);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "Missed",
};

/** The candidate's interviews with an "Add to calendar" (.ics generated in the browser). */
export function InterviewsView() {
  const styles = usePortalStyles();
  const [upcoming, setUpcoming] = useState(true);
  const [now] = useState(() => Date.now()); // mount-time clock; interview rows don't need a ticking "now"
  const me = useQuery<PortalMe>({ queryKey: portalKeys.me, enabled: false });
  const q = useQuery({ queryKey: portalKeys.interviews(upcoming), queryFn: ({ signal }) => portalApi.interviews(upcoming, signal) });
  const org = me.data?.tenant.display_name ?? "the hiring team";

  return (
    <div className={styles.page}>
      <PortalPageHeader title="Interviews" subtitle="Your scheduled interviews. Add them to your calendar so you don't miss one." />
      <PickTimeCards />
      <TabList selectedValue={upcoming ? "upcoming" : "all"} onTabSelect={(_, d) => setUpcoming(d.value === "upcoming")} aria-label="Which interviews">
        <Tab value="upcoming">Upcoming</Tab>
        <Tab value="all">All</Tab>
      </TabList>
      {q.isPending ? (
        <LoadingBlock label="Loading interviews" />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Card className={styles.card}>
          <Body1 className={styles.empty}>{upcoming ? "You have no upcoming interviews." : "You have no interviews yet."}</Body1>
        </Card>
      ) : (
        <ul className={styles.list}>
          {q.data.map((i) => (
            <li key={i.id}>
              <Card className={styles.card}>
                <div className={styles.actions} style={{ justifyContent: "space-between" }}>
                  <Subtitle1 as="h2">{[i.title, i.round_name].filter(Boolean).join(" – ")}</Subtitle1>
                  <Badge appearance="outline">{STATUS_LABELS[i.status] ?? i.status}</Badge>
                </div>
                <dl className={styles.dl}>
                  <dt>When</dt>
                  <dd>
                    {formatDateTime(i.starts_at, i.timezone)}
                    {i.ends_at ? ` – ${formatDateTime(i.ends_at, i.timezone)}` : ""}
                  </dd>
                  {i.mode && (
                    <>
                      <dt>How</dt>
                      <dd>{i.mode}</dd>
                    </>
                  )}
                  {i.location && (
                    <>
                      <dt>Where</dt>
                      <dd>{i.location}</dd>
                    </>
                  )}
                  {i.join_url && /^https?:\/\//i.test(i.join_url) && (
                    <>
                      <dt>Join</dt>
                      <dd>
                        <FluentLink href={i.join_url} target="_blank" rel="noopener noreferrer">
                          Join the meeting<Text className={styles.muted}> (opens in a new tab)</Text>
                        </FluentLink>
                      </dd>
                    </>
                  )}
                </dl>
                {i.status !== "cancelled" && (
                  <div>
                    <Button icon={<CalendarAdd20Regular />} className={styles.button} onClick={() => downloadIcs(i, org)}>
                      Add to calendar
                    </Button>
                    {i.status === "scheduled" && Date.parse(i.starts_at) > now && <NeedDifferentTime interviewId={i.id} />}
                  </div>
                )}
                {i.status !== "cancelled" && <PortalRecordingConsent interviewId={i.id} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
