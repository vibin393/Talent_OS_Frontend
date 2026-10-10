"use client";

import {
  Body1,
  Caption1,
  Card,
  Link as FluentLink,
  makeStyles,
  Spinner,
  Subtitle1,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { careersPath } from "@/features/careers/format";
import { AEDT_FEATURE_LABELS, cellText, DIMENSION_LABELS, formatDate, formatRatio, isSuppressedCell, SELECTION_POINT_LABELS, tableTitle, UNKNOWN_LABEL } from "./logic";
import type { AedtFeature, PublicPublicationOut, PublicSummaryRow, SelectionPoint } from "./types";
import { usePublicSummary } from "./use-fairness";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  back: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minHeight: "44px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground2 },
  tableWrap: { overflowX: "auto" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  unknownRow: { backgroundColor: tokens.colorNeutralBackground2 },
});

/** Unknown row always present and last (public summaries carry no selected counts). */
function publicRows(rows: readonly PublicSummaryRow[]): PublicSummaryRow[] {
  const known = rows.filter((r) => !r.unknown);
  const unknown = rows.filter((r) => r.unknown);
  return [...known, ...(unknown.length ? unknown : [{ category: "unknown", label: UNKNOWN_LABEL, unknown: true, applicants: 0, impact_ratio: null }])];
}

/** Career Portal `/careers/[tenant]/fairness`: published bias-audit summaries (NYC LL144). */
export function PublicSummaryView({ slug }: { slug: string }) {
  const styles = useStyles();
  const q = usePublicSummary(slug);
  return (
    <div className={styles.root}>
      <FluentLink href={careersPath(slug)} className={styles.back}>
        <ArrowLeft20Regular aria-hidden /> All jobs
      </FluentLink>
      <Title1 as="h1">Bias audit summaries</Title1>
      <Body1 className={styles.muted}>
        Independent bias audits of the automated employment decision tools used in hiring, as required by New York City Local Law 144.
        Small groups are not shown to protect privacy.
      </Body1>
      {q.isPending ? (
        <Spinner label="Loading summaries" />
      ) : q.isError || q.data.length === 0 ? (
        <Body1>No bias audit summaries are published.</Body1>
      ) : (
        q.data.map((p) => <Publication key={p.id} pub={p} />)
      )}
    </div>
  );
}

function Publication({ pub }: { pub: PublicPublicationOut }) {
  const styles = useStyles();
  const s = pub.summary;
  const unknown = Object.entries(s.unknown_counts ?? {});
  return (
    <Card className={styles.card} role="region" aria-label={pub.aedt_name}>
      <Subtitle1 as="h2">{pub.aedt_name}</Subtitle1>
      <Text className={styles.muted}>
        {AEDT_FEATURE_LABELS[pub.feature as AedtFeature] ?? pub.feature} · audit date {formatDate(pub.audit_date)} · distribution date{" "}
        {formatDate(pub.distribution_date)}
      </Text>
      <Text>
        {SELECTION_POINT_LABELS[s.selection_point as SelectionPoint] ?? s.selection_point}, {formatDate(s.date_from)} – {formatDate(s.date_to)}.
        Total applicants: {s.total_applicants}.
        {unknown.length > 0 &&
          ` Unknown category: ${unknown.map(([k, v]) => `${DIMENSION_LABELS[k as keyof typeof DIMENSION_LABELS] ?? k} ${v}`).join(", ")}.`}
      </Text>
      {s.tables.map((t) => {
        const title = tableTitle([], t.key);
        const scoring = t.rows.some((r) => r.scoring_impact_ratio !== undefined);
        return (
          <div key={t.key} className={styles.tableWrap}>
            <Subtitle2 as="h3">{title}</Subtitle2>
            <Table aria-label={`${pub.aedt_name}: ${title}`} size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell className={styles.num}>Applicants</TableHeaderCell>
                  <TableHeaderCell className={styles.num}>Impact ratio</TableHeaderCell>
                  {scoring && <TableHeaderCell className={styles.num}>Scoring impact ratio</TableHeaderCell>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {publicRows(t.rows).map((r) => (
                  <TableRow key={r.category} className={r.unknown ? styles.unknownRow : undefined}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className={styles.num}>{isSuppressedCell(r.applicants) ? <span aria-label="suppressed">{cellText(r.applicants)}</span> : cellText(r.applicants)}</TableCell>
                    <TableCell className={styles.num}>{r.unknown ? "—" : formatRatio(r.impact_ratio)}</TableCell>
                    {scoring && <TableCell className={styles.num}>{r.unknown ? "—" : formatRatio(r.scoring_impact_ratio)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
      <Caption1 className={styles.muted}>Impact ratio = the category&apos;s rate divided by the highest category&apos;s rate.</Caption1>
    </Card>
  );
}
