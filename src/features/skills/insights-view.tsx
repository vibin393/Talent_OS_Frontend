"use client";

import {
  Caption1,
  Input,
  makeStyles,
  mergeClasses,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { skillGraphApi, skillGraphKeys } from "./graph-api";
import { insightLinks, PROFICIENCY_LABELS, sparkPoints, supplySegments } from "./logic";
import type { ProficiencyBucket, SkillInsightRow } from "./types";

const SEGMENT_COLORS: Record<ProficiencyBucket, string> = {
  "5": tokens.colorBrandBackground,
  "4": tokens.colorBrandBackground2Hover,
  "3": tokens.colorPaletteBlueBorderActive,
  "2": tokens.colorPaletteBlueBackground2,
  "1": tokens.colorNeutralBackground5,
  unknown: tokens.colorNeutralStroke2,
};

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  filters: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  scroll: { overflowX: "auto" },
  table: { minWidth: "720px" },
  bar: {
    display: "flex",
    height: "10px",
    width: "140px",
    borderRadius: tokens.borderRadiusSmall,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  spark: { display: "block" },
  demand: { stroke: tokens.colorPaletteRedForeground1 },
  supply: { stroke: tokens.colorBrandForeground1 },
});

function SupplyBar({ row }: { row: SkillInsightRow }) {
  const styles = useStyles();
  const segs = supplySegments(row);
  const label = segs.map((s) => `${s.key === "unknown" ? "Not recorded" : PROFICIENCY_LABELS[Number(s.key)]}: ${s.count}`).join(", ");
  return (
    <Tooltip content={label || "No supply"} relationship="description">
      <div className={styles.bar} role="img" aria-label={`Supply by proficiency: ${label || "none"}`}>
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${s.pct}%`, backgroundColor: SEGMENT_COLORS[s.key] }} />
        ))}
      </div>
    </Tooltip>
  );
}

function Sparkline({ row }: { row: SkillInsightRow }) {
  const styles = useStyles();
  return (
    <svg className={styles.spark} width={80} height={22} role="img" aria-label="90-day trend: demand and supply">
      <polyline className={styles.demand} fill="none" strokeWidth={1.5} points={sparkPoints(row.trend_90d.demand, 80, 20)} />
      <polyline className={styles.supply} fill="none" strokeWidth={1.5} points={sparkPoints(row.trend_90d.supply, 80, 20)} />
    </svg>
  );
}

/** `/reports/skills`: skills supply and demand (Epic 37, FR-191). Every number opens the filtered list. */
export function SkillInsightsView() {
  const styles = useStyles();
  const allowed = usePermission("skills_insight:read");
  const [category, setCategory] = useState("");
  const deferred = useDeferredValue(category.trim());
  const q = useQuery({
    queryKey: skillGraphKeys.insights(deferred),
    queryFn: ({ signal }) => skillGraphApi.insights({ category: deferred || undefined }, signal),
    enabled: allowed,
  });
  if (!allowed) return <NoAccess what="the skills insight" />;
  return (
    <div className={styles.root}>
      <PageHeader title="Skills supply and demand" subtitle="Open demand, candidate supply by proficiency, verified supply and bench per skill." />
      <div className={styles.filters}>
        <Input placeholder="Category (e.g. Framework)" value={category} onChange={(_, d) => setCategory(d.value)} aria-label="Category" />
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {q.isLoading && <GridSkeleton rows={8} />}
      {q.data && q.data.items.length === 0 && <Text className={styles.muted}>No skills match these filters.</Text>}
      {q.data && q.data.items.length > 0 && (
        <div className={styles.scroll}>
          <Table size="small" aria-label="Skills supply and demand" className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Skill</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Open demand</TableHeaderCell>
                <TableHeaderCell>Supply by proficiency</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Candidates</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Verified</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Bench</TableHeaderCell>
                <TableHeaderCell>90 days</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.items.map((r) => {
                const links = insightLinks(r);
                return (
                  <TableRow key={r.skill_key}>
                    <TableCell>
                      <Text weight="semibold">{r.name}</Text>
                      {r.category && (
                        <Caption1 className={styles.muted} block>
                          {r.category}
                        </Caption1>
                      )}
                    </TableCell>
                    <TableCell className={styles.num}>
                      <AppLink href={links.demands}>{r.open_demand}</AppLink>
                    </TableCell>
                    <TableCell>
                      <SupplyBar row={r} />
                    </TableCell>
                    <TableCell className={styles.num}>
                      <AppLink href={links.candidates}>{r.supply_total}</AppLink>
                    </TableCell>
                    <TableCell className={styles.num}>
                      <AppLink href={links.verified}>{r.verified_supply}</AppLink>
                    </TableCell>
                    <TableCell className={mergeClasses(styles.num, r.bench === null ? styles.muted : undefined)}>
                      {r.bench === null ? "—" : <AppLink href={links.bench}>{r.bench}</AppLink>}
                    </TableCell>
                    <TableCell>
                      <Sparkline row={r} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Caption1 className={styles.muted}>Trend: red = new demand, blue = new candidate skills (weekly, last 13 weeks).</Caption1>
        </div>
      )}
    </div>
  );
}
