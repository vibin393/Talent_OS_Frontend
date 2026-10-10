"use client";

import { Button, CounterBadge, makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { CalendarLtr20Regular, ClipboardTextEdit20Regular, TextBulletListLtr20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useMe } from "@/features/auth/use-me";
import { useNowMs } from "@/lib/time/use-now";
import { browserTimeZone, todayInZone } from "@/lib/time/zones";
import { weekRange } from "./demand-interviews";
import { needsMyScorecard } from "./format";
import { InterviewDrawer } from "./interview-drawer";
import { InterviewsGrid } from "./interviews-grid";
import type { InterviewOut } from "./types";
import { useMyInterviews } from "./use-interviews";
import { WeekCalendar } from "./week-calendar";
import { weekStart } from "./week-layout";

type MyTab = "upcoming" | "scorecards" | "past";

const useStyles = makeStyles({
  bar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
});

// Stable "now" per page view: the lists are refetched on focus anyway.
const NOW_ISO = () => new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

/** `/interviews`: interviews where I am a participant or the organiser — Upcoming, Needs scorecard, Past; list or week view. */
export function MyInterviews() {
  const styles = useStyles();
  const router = useRouter();
  const { data: me } = useMe();
  const tz = browserTimeZone();
  const [tab, setTab] = useState<MyTab>("upcoming");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [week, setWeek] = useState(() => weekStart(todayInZone(tz)));
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(NOW_ISO);

  const upcoming = useMyInterviews({ from: now, status: "scheduled", pageSize: 100 });
  const past = useMyInterviews({ to: now, pageSize: 100 });
  const calendar = useMyInterviews({ ...weekRange(week, tz), pageSize: 100 });

  const userId = me?.user.id;
  const pastItems = useMemo(() => [...(past.data?.items ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at)), [past.data]);
  const nowMs = useNowMs();
  const owed = useMemo(() => pastItems.filter((i) => needsMyScorecard(i, userId, nowMs)), [pastItems, userId, nowMs]);

  const current = tab === "upcoming" ? upcoming : past;
  const items = tab === "upcoming" ? upcoming.data?.items : tab === "scorecards" ? (past.data ? owed : undefined) : past.data ? pastItems : undefined;
  const all = [...(upcoming.data?.items ?? []), ...pastItems, ...(calendar.data?.items ?? [])];
  const open: InterviewOut | undefined = all.find((i) => i.id === openId);

  const scorecardAction = (i: InterviewOut) =>
    needsMyScorecard(i, userId, nowMs) ? (
      <Button size="small" appearance="primary" icon={<ClipboardTextEdit20Regular />} onClick={() => router.push(`/interviews/${i.id}/scorecard`)}>
        Submit scorecard
      </Button>
    ) : null;

  return (
    <>
      <PageHeader title="My interviews" subtitle={`Interviews you organise or take part in. Times are shown in ${tz.replace(/_/g, " ")}.`} />
      <div className={styles.bar}>
        <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as MyTab)} aria-label="Interview lists" className={styles.grow}>
          <Tab value="upcoming">Upcoming</Tab>
          <Tab value="scorecards">
            Needs scorecard{" "}
            {owed.length > 0 && <CounterBadge count={owed.length} size="small" color="brand" aria-label={`${owed.length} scorecards due`} />}
          </Tab>
          <Tab value="past">Past</Tab>
        </TabList>
        <TabList size="small" selectedValue={view} onTabSelect={(_, d) => setView(d.value as "list" | "calendar")} aria-label="View">
          <Tab value="list" icon={<TextBulletListLtr20Regular />}>
            List
          </Tab>
          <Tab value="calendar" icon={<CalendarLtr20Regular />}>
            Week
          </Tab>
        </TabList>
      </div>
      {view === "list" ? (
        <InterviewsGrid
          items={items}
          loading={current.isPending}
          error={current.error}
          timeZone={tz}
          onOpen={(i) => setOpenId(i.id)}
          renderAction={scorecardAction}
          hideDemand={false}
          label="My interviews"
          emptyText={
            tab === "upcoming" ? "No upcoming interviews." : tab === "scorecards" ? "You are all caught up — no scorecards due." : "No past interviews."
          }
        />
      ) : (
        <WeekCalendar
          interviews={calendar.data?.items ?? []}
          timeZone={tz}
          week={week}
          onWeekChange={setWeek}
          onOpen={(i) => setOpenId(i.id)}
          loading={calendar.isFetching}
        />
      )}
      {open && <InterviewDrawer interview={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
