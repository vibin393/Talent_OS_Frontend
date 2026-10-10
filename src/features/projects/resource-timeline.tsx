"use client";

import { Badge, Button, makeStyles, mergeClasses, Text, tokens, Tooltip } from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBar, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { addDays, buildTimelineGrid, splitText, type TimelineCell, weeksBetween, weekStart } from "./logic";
import type { ResourceTimeline as Timeline } from "./types";
import { useProjectTimeline } from "./use-projects";

const WEEKS = 12;

const useStyles = makeStyles({
  surface: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    overflowX: "auto",
  },
  table: { borderCollapse: "collapse", minWidth: "100%", fontSize: tokens.fontSizeBase200 },
  th: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    textAlign: "left",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  rowHead: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    whiteSpace: "nowrap",
    position: "sticky",
    left: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    minWidth: "180px",
  },
  section: { padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`, color: tokens.colorNeutralForeground3 },
  cell: {
    minWidth: "56px",
    height: "28px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralBackground1}`,
  },
  ok: { backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground2 },
  gap: { backgroundColor: tokens.colorStatusWarningBackground2, color: tokens.colorStatusWarningForeground2 },
  over: { backgroundColor: tokens.colorStatusDangerBackground2, color: tokens.colorStatusDangerForeground2, fontWeight: tokens.fontWeightSemibold },
  legend: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

function defaultFrom(): string {
  return weekStart(addDays(new Date().toISOString().slice(0, 10), -14));
}

/** Roles & Workers × weeks grid of a project (gaps in warning colour, over-allocation in danger colour). */
export function ResourceTimelineCard({ projectId }: { projectId: string }) {
  const admin = useAdminStyles();
  const [from, setFrom] = useState(defaultFrom);
  const to = addDays(from, WEEKS * 7 - 1);
  const q = useProjectTimeline(projectId, from, to);
  return (
    <>
      <div className={admin.toolbar}>
        <Button appearance="subtle" icon={<ChevronLeft20Regular />} aria-label="Earlier weeks" onClick={() => setFrom((f) => addDays(f, -28))} />
        <Text>
          {from} – {to}
        </Text>
        <Button appearance="subtle" icon={<ChevronRight20Regular />} aria-label="Later weeks" onClick={() => setFrom((f) => addDays(f, 28))} />
        <span className={admin.grow} />
        {q.data && (
          <>
            <Badge appearance="tint" color={q.data.gap_count ? "warning" : "success"}>
              {q.data.gap_count} gaps
            </Badge>
            <Badge appearance="tint" color={q.data.over_allocation_count ? "danger" : "success"}>
              {q.data.over_allocation_count} over-allocated
            </Badge>
          </>
        )}
      </div>
      {q.isPending ? <GridSkeleton rows={4} /> : q.isError ? <ErrorBar message={errorMessage(q.error)} /> : <TimelineGrid timeline={q.data} />}
    </>
  );
}

function Cell({ cell }: { cell: TimelineCell }) {
  const s = useStyles();
  const cls = mergeClasses(s.cell, cell.state === "ok" && s.ok, cell.state === "gap" && s.gap, cell.state === "over" && s.over);
  const label = cell.state === "gap" ? `Gap ${cell.text}` : cell.state === "over" ? `Over-allocated ${cell.text}` : cell.text;
  if (cell.state === "over" && cell.split.length) {
    return (
      <Tooltip content={splitText(cell.split)} relationship="description" withArrow>
        <td className={cls} tabIndex={0} aria-label={label} data-state={cell.state}>
          {cell.text}
        </td>
      </Tooltip>
    );
  }
  return (
    <td className={cls} aria-label={label || undefined} data-state={cell.state}>
      {cell.text}
    </td>
  );
}

/** The grid itself (exported for reuse; the transform lives in `logic.ts`). */
export function TimelineGrid({ timeline }: { timeline: Timeline }) {
  const s = useStyles();
  const admin = useAdminStyles();
  const weeks = weeksBetween(timeline.from_date, timeline.to_date);
  const rows = buildTimelineGrid(timeline, weeks);
  const roles = rows.filter((r) => r.kind === "role");
  const workers = rows.filter((r) => r.kind === "worker");
  if (!rows.length) return <div className={admin.empty}>No roles or assignments in this period.</div>;
  const section = (title: string) => (
    <tr>
      <th scope="rowgroup" colSpan={weeks.length + 1} className={s.section}>
        {title}
      </th>
    </tr>
  );
  return (
    <div className={s.surface}>
      <table className={s.table} aria-label="Resource timeline">
        <thead>
          <tr>
            <th className={s.th} scope="col">
              Week of
            </th>
            {weeks.map((w) => (
              <th key={w} className={s.th} scope="col">
                {w.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.length > 0 && section("Roles (assigned FTE / headcount)")}
          {roles.map((r) => (
            <tr key={`r-${r.id}`}>
              <th scope="row" className={s.rowHead}>
                {r.label}
              </th>
              {r.cells.map((c) => (
                <Cell key={c.week} cell={c} />
              ))}
            </tr>
          ))}
          {workers.length > 0 && section("Workers (allocation across projects)")}
          {workers.map((r) => (
            <tr key={`w-${r.id}`}>
              <th scope="row" className={s.rowHead}>
                {r.label}
              </th>
              {r.cells.map((c) => (
                <Cell key={c.week} cell={c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
