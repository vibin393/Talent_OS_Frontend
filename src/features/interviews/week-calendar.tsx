"use client";

import { Caption1, makeStyles, mergeClasses, Text, tokens, Toolbar, ToolbarButton } from "@fluentui/react-components";
import { CalendarToday20Regular, ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef } from "react";
import { useNowMs } from "@/lib/time/use-now";
import { addDays, formatTimeInZone, todayInZone, zoneAbbreviation } from "@/lib/time/zones";
import { STATUS_LABELS } from "./format";
import type { InterviewOut } from "./types";
import { layoutWeek, nextEventIndex, weekDays, weekStart } from "./week-layout";

const HOUR_PX = 48;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const useStyles = makeStyles({
  root: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: tokens.spacingHorizontalS, padding: tokens.spacingHorizontalS },
  title: { flex: 1, minWidth: "160px" },
  scrollX: { overflowX: "auto" },
  head: {
    display: "grid",
    gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))",
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    minWidth: "740px",
  },
  dayHead: { padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, display: "flex", flexDirection: "column" },
  today: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  body: { height: "560px", overflowY: "auto", minWidth: "740px" },
  grid: { display: "grid", gridTemplateColumns: "56px repeat(7, minmax(96px, 1fr))", position: "relative", height: `${24 * HOUR_PX}px` },
  hours: { position: "relative" },
  hourLabel: { position: "absolute", right: tokens.spacingHorizontalXS, transform: "translateY(-50%)", color: tokens.colorNeutralForeground3 },
  dayCol: {
    position: "relative",
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    backgroundImage: `repeating-linear-gradient(to bottom, ${tokens.colorNeutralStroke3} 0 1px, transparent 1px ${HOUR_PX}px)`,
  },
  chip: {
    position: "absolute",
    boxSizing: "border-box",
    padding: `2px ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
    borderLeft: `${tokens.strokeWidthThickest} solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textAlign: "start",
    cursor: "pointer",
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    border: "none",
    ":hover": { backgroundColor: tokens.colorBrandBackground2Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`, outlineOffset: "1px", zIndex: 5 },
  },
  cancelled: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderLeftColor: tokens.colorNeutralStroke1,
    color: tokens.colorNeutralForeground3,
    textDecorationLine: "line-through",
  },
  completed: { backgroundColor: tokens.colorPaletteGreenBackground1, borderLeftColor: tokens.colorPaletteGreenBorder2 },
  nowLine: { position: "absolute", left: 0, right: 0, height: "2px", backgroundColor: tokens.colorPaletteRedBorder2, zIndex: 4, pointerEvents: "none" },
  empty: { padding: tokens.spacingHorizontalM, color: tokens.colorNeutralForeground3 },
});

function dayLabel(date: string, index: number): { name: string; date: string } {
  const [, m, d] = date.split("-");
  return { name: DAY_NAMES[index], date: `${Number(d)} ${MONTHS[Number(m) - 1]}` };
}

/**
 * Outlook-like week view: 7 day columns, hour rows, events positioned by start/end in `timeZone`,
 * previous / next / today navigation. Keyboard: arrow keys move between events, Enter opens one.
 */
export function WeekCalendar({
  interviews,
  timeZone,
  week,
  onWeekChange,
  onOpen,
  loading,
}: {
  interviews: readonly InterviewOut[];
  timeZone: string;
  /** Monday of the displayed week (`YYYY-MM-DD`). */
  week: string;
  onWeekChange: (week: string) => void;
  onOpen: (interview: InterviewOut) => void;
  loading?: boolean;
}) {
  const styles = useStyles();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const now = useNowMs();
  const days = weekDays(week);
  const today = todayInZone(timeZone, now);
  const placed = useMemo(
    () => layoutWeek(interviews.map((i) => ({ ...i, id: i.id, startsAt: i.starts_at, endsAt: i.ends_at })), week, timeZone),
    [interviews, week, timeZone],
  );
  const ordered = useMemo(() => [...placed].sort((a, b) => a.day - b.day || a.top - b.top), [placed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX - 8;
  }, []);

  const range = `${dayLabel(days[0], 0).date} – ${dayLabel(days[6], 6).date} ${days[6].slice(0, 4)}`;
  const todayIndex = days.indexOf(today);
  const nowMinutes = (() => {
    const t = formatTimeInZone(now, timeZone).split(":");
    return Number(t[0]) * 60 + Number(t[1]);
  })();

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Toolbar aria-label="Week navigation" size="small">
          <ToolbarButton icon={<CalendarToday20Regular />} onClick={() => onWeekChange(weekStart(today))}>
            Today
          </ToolbarButton>
          <ToolbarButton aria-label="Previous week" icon={<ChevronLeft20Regular />} onClick={() => onWeekChange(addDays(week, -7))} />
          <ToolbarButton aria-label="Next week" icon={<ChevronRight20Regular />} onClick={() => onWeekChange(addDays(week, 7))} />
        </Toolbar>
        <Text weight="semibold" className={styles.title} aria-live="polite">
          {range}
        </Text>
        <Caption1>
          Times in {timeZone.replace(/_/g, " ")} ({zoneAbbreviation(timeZone)}){loading ? " · Loading…" : ""}
        </Caption1>
      </div>
      <div className={styles.scrollX}>
        <div className={styles.head} role="presentation">
          <div />
          {days.map((d, i) => {
            const l = dayLabel(d, i);
            return (
              <div key={d} className={mergeClasses(styles.dayHead, d === today && styles.today)}>
                <Caption1>{l.name}</Caption1>
                <Text size={400} className={d === today ? styles.today : undefined}>
                  {l.date.split(" ")[0]}
                </Text>
              </div>
            );
          })}
        </div>
        <div className={styles.body} ref={scrollRef}>
          <div className={styles.grid}>
            <div className={styles.hours} aria-hidden>
              {Array.from({ length: 23 }, (_, h) => (
                <Caption1 key={h} className={styles.hourLabel} style={{ top: (h + 1) * HOUR_PX }}>
                  {String(h + 1).padStart(2, "0")}:00
                </Caption1>
              ))}
            </div>
            {days.map((d, dayIndex) => (
              <div key={d} className={styles.dayCol} role="list" aria-label={`${dayLabel(d, dayIndex).name} ${dayLabel(d, dayIndex).date}`}>
                {dayIndex === todayIndex && <div className={styles.nowLine} style={{ top: (nowMinutes / 60) * HOUR_PX }} aria-hidden />}
                {ordered
                  .filter((p) => p.day === dayIndex)
                  .map((p) => {
                    const i = p.event as unknown as InterviewOut;
                    const order = ordered.indexOf(p);
                    const width = 100 / p.lanes;
                    const time = `${formatTimeInZone(i.starts_at, timeZone)}–${formatTimeInZone(i.ends_at, timeZone)}`;
                    return (
                      <div key={i.id} role="listitem">
                        <button
                          type="button"
                          ref={(el) => {
                            chipRefs.current[order] = el;
                          }}
                          tabIndex={order === 0 ? 0 : -1}
                          className={mergeClasses(styles.chip, i.status === "cancelled" && styles.cancelled, i.status === "completed" && styles.completed)}
                          style={{
                            top: (p.top / 60) * HOUR_PX,
                            height: Math.max(18, (p.height / 60) * HOUR_PX - 2),
                            left: `calc(${p.lane * width}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                          }}
                          aria-label={`${i.candidate_name ?? "Candidate"}, ${i.stage_name}, ${time}, ${STATUS_LABELS[i.status].label}`}
                          onClick={() => onOpen(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onOpen(i);
                              return;
                            }
                            const next = nextEventIndex(ordered.length, order, e.key);
                            if (next !== order && next >= 0) {
                              e.preventDefault();
                              chipRefs.current[next]?.focus();
                            }
                          }}
                        >
                          <strong>{i.candidate_name ?? "Candidate"}</strong>
                          <br />
                          {time} · {i.stage_name}
                        </button>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {!loading && placed.length === 0 && <Caption1 className={styles.empty}>No interviews this week.</Caption1>}
    </div>
  );
}

