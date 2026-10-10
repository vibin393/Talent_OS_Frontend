"use client";

import { Caption1, makeStyles, mergeClasses, Spinner, Text, tokens } from "@fluentui/react-components";
import { Warning16Regular } from "@fluentui/react-icons";
import { useMemo } from "react";
import { busySlotIndexes, daySlots, hasConflict, proposedSlotIndexes, rowSummary, type Busy } from "./free-busy";

export type FreeBusyRow = { id: string; name: string; status: "available" | "unknown" | "loading"; busy: readonly Busy[] };

const NAME_COL = "150px";
const SLOT_WIDTH = "28px";

const useStyles = makeStyles({
  wrap: {
    overflowX: "auto",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  grid: { display: "grid", position: "relative", minWidth: "max-content" },
  headName: {
    position: "sticky",
    left: 0,
    zIndex: 2,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  timeButton: {
    appearance: "none",
    border: "none",
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
    padding: 0,
    height: "28px",
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground2Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
  },
  name: {
    position: "sticky",
    left: 0,
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: `0 ${tokens.spacingHorizontalS}`,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    height: "32px",
  },
  cell: {
    height: "32px",
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
    cursor: "pointer",
  },
  hourStart: { borderLeftColor: tokens.colorNeutralStroke1 },
  busy: { backgroundColor: tokens.colorPaletteRedBackground2 },
  unknown: {
    backgroundImage: `repeating-linear-gradient(135deg, ${tokens.colorNeutralBackground3} 0 4px, ${tokens.colorNeutralBackground1} 4px 8px)`,
    cursor: "default",
  },
  unknownLabel: {
    gridColumnEnd: "-1",
    display: "flex",
    alignItems: "center",
    paddingInlineStart: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    pointerEvents: "none",
    height: "32px",
  },
  proposed: {
    pointerEvents: "none",
    border: `${tokens.strokeWidthThicker} solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: "transparent",
    zIndex: 3,
  },
  legend: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "center", marginTop: tokens.spacingVerticalXS },
  swatch: { display: "inline-block", width: "12px", height: "12px", marginInlineEnd: tokens.spacingHorizontalXS, verticalAlign: "middle" },
  conflict: { color: tokens.colorPaletteRedForeground1, display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
});

/**
 * Outlook scheduling-assistant style strip: one row per person, 30-minute columns from 08:00 to 20:00 of `date`
 * in `timeZone`, busy time in red, unconnected calendars hatched, the proposed slot outlined in the brand color.
 * Clicking a column (or its time button) proposes that start time.
 */
export function FreeBusyStrip({
  date,
  timeZone,
  rows,
  startMinutes,
  durationMinutes,
  onPickSlot,
  loading,
}: {
  date: string;
  timeZone: string;
  rows: readonly FreeBusyRow[];
  startMinutes: number;
  durationMinutes: number;
  onPickSlot: (minutes: number) => void;
  loading?: boolean;
}) {
  const styles = useStyles();
  const slots = useMemo(() => daySlots(date, timeZone), [date, timeZone]);
  const busyByRow = useMemo(() => rows.map((r) => busySlotIndexes(r.busy, slots)), [rows, slots]);
  const proposed = proposedSlotIndexes(startMinutes, durationMinutes, slots);
  const proposedList = [...proposed].sort((a, b) => a - b);
  const conflict = hasConflict(
    proposed,
    busyByRow.filter((_, i) => rows[i].status === "available"),
  );
  const columns = `${NAME_COL} repeat(${slots.length}, ${SLOT_WIDTH})`;

  return (
    <div>
      <div className={styles.wrap} role="group" aria-label={`Scheduling assistant for ${date} (${timeZone})`}>
        <div className={styles.grid} style={{ gridTemplateColumns: columns }}>
          <div className={styles.headName}>
            <Caption1>{loading ? <Spinner size="extra-tiny" label="Loading free/busy" /> : "Attendees"}</Caption1>
          </div>
          {slots.map((s) => (
            <button
              key={s.index}
              type="button"
              className={mergeClasses(styles.timeButton, s.startMinutes % 60 === 0 && styles.hourStart)}
              title={`Start at ${s.label}`}
              aria-label={`Start at ${s.label}`}
              aria-pressed={proposed.has(s.index) && proposedList[0] === s.index}
              onClick={() => onPickSlot(s.startMinutes)}
            >
              {s.startMinutes % 60 === 0 ? s.label.slice(0, 2) : ""}
            </button>
          ))}

          {rows.map((row, r) => {
            const gridRow = r + 2;
            const summary =
              row.status === "loading" ? `${row.name}: loading` : rowSummary(row.name, row.status, busyByRow[r], slots);
            return (
              <div key={row.id} role="group" aria-label={summary} style={{ display: "contents" }}>
                <div className={styles.name} style={{ gridRow }} title={row.name}>
                  <Text size={200} truncate wrap={false}>
                    {row.name}
                  </Text>
                </div>
                {slots.map((s) => (
                  <div
                    key={s.index}
                    aria-hidden
                    style={{ gridRow, gridColumn: s.index + 2 }}
                    className={mergeClasses(
                      styles.cell,
                      s.startMinutes % 60 === 0 && styles.hourStart,
                      row.status === "unknown" && styles.unknown,
                      row.status === "available" && busyByRow[r].has(s.index) && styles.busy,
                    )}
                    onClick={row.status === "unknown" ? undefined : () => onPickSlot(s.startMinutes)}
                  />
                ))}
                {row.status === "unknown" && (
                  <div className={styles.unknownLabel} style={{ gridRow, gridColumnStart: 2 }} aria-hidden>
                    <Caption1>Not connected</Caption1>
                  </div>
                )}
              </div>
            );
          })}

          {proposedList.length > 0 && rows.length > 0 && (
            <div
              aria-hidden
              className={styles.proposed}
              style={{ gridRow: `1 / ${rows.length + 2}`, gridColumn: `${proposedList[0] + 2} / ${proposedList[proposedList.length - 1] + 3}` }}
            />
          )}
        </div>
      </div>
      <div className={styles.legend}>
        <Caption1>
          <span className={styles.swatch} style={{ backgroundColor: tokens.colorPaletteRedBackground2 }} aria-hidden />
          Busy
        </Caption1>
        <Caption1>
          <span className={mergeClasses(styles.swatch, styles.unknown)} aria-hidden />
          Calendar not connected
        </Caption1>
        <Caption1>
          <span className={styles.swatch} style={{ border: `2px solid ${tokens.colorBrandStroke1}` }} aria-hidden />
          Proposed time
        </Caption1>
        {conflict && (
          <Caption1 className={styles.conflict} role="status">
            <Warning16Regular aria-hidden /> Someone is busy at the proposed time
          </Caption1>
        )}
      </div>
    </div>
  );
}
