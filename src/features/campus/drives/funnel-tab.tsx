"use client";

import {
  Caption1,
  makeStyles,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { FUNNEL_STAGE_COLORS, FUNNEL_STAGE_LABELS, funnelSegments, pct } from "../logic";
import { type DriveOut, FUNNEL_STAGES, type FunnelRow } from "../types";
import { useCampusStyles } from "../ui";
import { useFunnel } from "../use-campus";

const useStyles = makeStyles({
  legend: { display: "flex", flexWrap: "wrap", gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`, listStyleType: "none", margin: 0, padding: 0 },
  key: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  swatch: { width: "12px", height: "12px", borderRadius: "2px", flexShrink: 0 },
  rows: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, margin: 0, padding: 0, listStyleType: "none" },
  rowHead: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalS, fontSize: tokens.fontSizeBase200 },
  bar: { display: "flex", gap: "2px", height: "20px", borderRadius: "4px", overflow: "hidden", backgroundColor: tokens.colorNeutralBackground3 },
  seg: { height: "100%", minWidth: 0, ":hover": { opacity: 0.85 } },
  num: { fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2 },
});

/** One stacked bar: where each registered student stopped (exclusive stages), scaled to the largest Institution. */
function FunnelBar({ row, max }: { row: FunnelRow; max: number }) {
  const styles = useStyles();
  const segs = funnelSegments(row, FUNNEL_STAGES).filter((s) => s.count > 0);
  const width = max ? (row.registered / max) * 100 : 0;
  return (
    <li>
      <div className={styles.rowHead}>
        <Text weight="semibold" size={200}>
          {row.institution_name}
        </Text>
        <span className={styles.num}>
          {row.registered.toLocaleString()} registered · {row.joined.toLocaleString()} joined ({pct(row.joined, row.registered)})
        </span>
      </div>
      <div className={styles.bar} style={{ width: `${Math.max(width, row.registered ? 2 : 0)}%` }} aria-hidden>
        {segs.map((s) => (
          <div
            key={s.stage}
            className={styles.seg}
            style={{ flexGrow: s.count, flexBasis: 0, backgroundColor: FUNNEL_STAGE_COLORS[s.stage] }}
            title={`${row.institution_name}: ${s.count.toLocaleString()} stopped at ${FUNNEL_STAGE_LABELS[s.stage]}`}
          />
        ))}
      </div>
    </li>
  );
}

/** Funnel by Institution: registered -> eligible -> … -> joined (stacked bars + a table view). */
export function FunnelTab({ drive }: { drive: DriveOut }) {
  const styles = useStyles();
  const c = useCampusStyles();
  const funnel = useFunnel(drive.id);
  const [asTable, setAsTable] = useState(false);
  if (funnel.isPending) return <GridSkeleton />;
  if (funnel.isError) return <ErrorBar title="Could not load the funnel." message={errorMessage(funnel.error)} />;
  const { rows, totals } = funnel.data;
  const max = Math.max(0, ...rows.map((r) => r.registered));

  return (
    <section className={c.card} aria-labelledby="funnel-title">
      <div className={c.row}>
        <Text as="h3" weight="semibold" id="funnel-title" className={c.grow}>
          Where students are, by Institution
        </Text>
        <Switch label="Show as table" checked={asTable} onChange={(_, d) => setAsTable(d.checked)} />
      </div>
      {rows.length === 0 ? (
        <span className={c.muted}>No registrations yet.</span>
      ) : asTable ? (
        <div className={c.tableWrap}>
          <Table aria-label="Funnel by Institution" size="small" style={{ minWidth: 720 }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Institution</TableHeaderCell>
                {FUNNEL_STAGES.map((s) => (
                  <TableHeaderCell key={s}>{FUNNEL_STAGE_LABELS[s]}</TableHeaderCell>
                ))}
                <TableHeaderCell>Reneged</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows, { ...totals, institution_name: "Total" }].map((r) => (
                <TableRow key={`${r.institution_id}-${r.institution_name}`}>
                  <TableCell>{r.institution_name}</TableCell>
                  {FUNNEL_STAGES.map((s) => (
                    <TableCell key={s} className={c.num}>
                      {(r[s] ?? 0).toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className={c.num}>{(r.reneged ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <ul className={styles.legend} aria-label="Stages (where each student stopped)">
            {FUNNEL_STAGES.map((s) => (
              <li key={s} className={styles.key}>
                <span className={styles.swatch} style={{ backgroundColor: FUNNEL_STAGE_COLORS[s] }} aria-hidden />
                {FUNNEL_STAGE_LABELS[s]}
              </li>
            ))}
          </ul>
          <ul className={styles.rows}>
            {rows.map((r) => (
              <FunnelBar key={r.institution_id} row={r} max={max} />
            ))}
          </ul>
          <Caption1 className={c.muted}>
            Each bar shows where every registered student currently stopped. Totals: {totals.registered.toLocaleString()} registered,{" "}
            {totals.eligible.toLocaleString()} eligible, {totals.offered.toLocaleString()} offered, {totals.joined.toLocaleString()} joined. Use
            &ldquo;Show as table&rdquo; for exact numbers.
          </Caption1>
        </>
      )}
    </section>
  );
}
