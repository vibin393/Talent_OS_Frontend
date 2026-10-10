"use client";

import { makeStyles, Subtitle2, Tab, TabList, tokens } from "@fluentui/react-components";
import { CalendarLtr20Regular, TextBulletListLtr20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { addDays, browserTimeZone, todayInZone, toUtcPreview } from "@/lib/time/zones";
import { InterviewDrawer } from "./interview-drawer";
import { InterviewsGrid } from "./interviews-grid";
import { PlanEditor } from "./plan-editor";
import type { InterviewOut } from "./types";
import { useDemandInterviews } from "./use-interviews";
import { WeekCalendar } from "./week-calendar";
import { weekStart } from "./week-layout";

const useStyles = makeStyles({
  head: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  grow: { flex: 1 },
  section: { marginTop: tokens.spacingVerticalXXL },
});

/** UTC bounds of the week starting `monday` in `tz` (for the calendar query). */
export function weekRange(monday: string, tz: string): { from: string; to: string } {
  return {
    from: toUtcPreview(monday, "00:00", tz) ?? `${monday}T00:00:00Z`,
    to: toUtcPreview(addDays(monday, 7), "00:00", tz) ?? `${addDays(monday, 7)}T00:00:00Z`,
  };
}

/** The demand "Interviews" tab: the interview plan editor, then every interview as a list or a week calendar. */
export function DemandInterviews({ demandId }: { demandId: string }) {
  const styles = useStyles();
  const canRead = usePermission("interview:read");
  const canSchedule = usePermission("interview:schedule");
  const tz = browserTimeZone();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [week, setWeek] = useState(() => weekStart(todayInZone(tz)));
  const [openId, setOpenId] = useState<string | null>(null);
  const range = view === "calendar" ? weekRange(week, tz) : {};
  const q = useDemandInterviews(demandId, { ...range, pageSize: 100 });
  const items = q.data?.items;
  const open: InterviewOut | undefined = items?.find((i) => i.id === openId);

  return (
    <>
      {canSchedule && <PlanEditor demandId={demandId} interviews={items} />}
      {canRead ? (
        <section className={canSchedule ? styles.section : undefined} aria-labelledby="demand-interviews-title">
          <div className={styles.head}>
            <Subtitle2 as="h2" id="demand-interviews-title" className={styles.grow}>
              Interviews
            </Subtitle2>
            <TabList size="small" selectedValue={view} onTabSelect={(_, d) => setView(d.value as "list" | "calendar")} aria-label="Interview view">
              <Tab value="list" icon={<TextBulletListLtr20Regular />}>
                List
              </Tab>
              <Tab value="calendar" icon={<CalendarLtr20Regular />}>
                Calendar
              </Tab>
            </TabList>
          </div>
          {view === "list" ? (
            <InterviewsGrid
              items={items}
              loading={q.isPending}
              error={q.error}
              timeZone={tz}
              onOpen={(i) => setOpenId(i.id)}
              emptyText="No interviews scheduled for this demand yet. Schedule them from an application in the pipeline."
            />
          ) : (
            <WeekCalendar interviews={items ?? []} timeZone={tz} week={week} onWeekChange={setWeek} onOpen={(i) => setOpenId(i.id)} loading={q.isFetching} />
          )}
        </section>
      ) : (
        !canSchedule && <NoAccess what="interviews" />
      )}
      {open && <InterviewDrawer interview={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
