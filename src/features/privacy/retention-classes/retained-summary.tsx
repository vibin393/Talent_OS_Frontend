"use client";

import {
  Body1,
  Caption1,
  makeStyles,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { retainedSentence } from "./format";
import type { RetainedSummaryRow } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, overflowX: "auto" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const withPeriod = (s: string) => (s.endsWith(".") ? s : `${s}.`);

/** Epic 35 B2 (AD-34): "Retained and why" on the DSR detail page, from the erasure run's `retained_summary`. */
export function RetainedSummary({ rows }: { rows: readonly RetainedSummaryRow[] }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <Subtitle2 as="h3">Retained and why</Subtitle2>
      <Caption1 className={styles.muted}>{withPeriod(retainedSentence(rows, formatDay))} This list is included in the response letter.</Caption1>
      {rows.length === 0 ? (
        <Body1>Every record was erased or anonymized.</Body1>
      ) : (
        <Table size="small" aria-label="Retained and why">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Class</TableHeaderCell>
              <TableHeaderCell>Records</TableHeaderCell>
              <TableHeaderCell>Count</TableHeaderCell>
              <TableHeaderCell>Kept until</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.class}-${r.table}-${i}`}>
                <TableCell>{r.class}</TableCell>
                <TableCell>{r.table}</TableCell>
                <TableCell>{r.count.toLocaleString()}</TableCell>
                <TableCell>{r.retained_until ? formatDay(r.retained_until) : "Until released"}</TableCell>
                <TableCell>{r.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
