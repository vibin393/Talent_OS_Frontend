"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  SearchBox,
  Spinner,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Location20Regular, Search20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PagingBar } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { ErrorBlock, LoadingBlock } from "@/features/portal/ui";
import { EMPLOYMENT_TYPE_LABELS, labelOf, WORK_MODE_LABELS } from "@/features/referrals/logic";
import { emptyFilters, formatDay } from "../logic";
import type { OpeningFilters, OpeningOut } from "../types";
import { useOpenings } from "../use-mobility";
import { APP_SURFACE, EligibilityBar, FitBadge, MobilityStatusBadge, type Surface, SurfaceHeader, useMobilityStyles, usePageClass, WORK_SURFACE } from "./shared";

const useStyles = makeStyles({
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalM,
    alignItems: "end",
  },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: tokens.spacingHorizontalM },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  title: { fontWeight: tokens.fontWeightSemibold, overflowWrap: "anywhere" },
  meta: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3 },
});

/** `/internal-jobs`: the internal job board for Users. */
export function InternalJobsBoard() {
  const me = useMe();
  const tenant = me.data?.tenant?.name;
  return <BoardView surface={APP_SURFACE} title={tenant ? `Careers at ${tenant}` : "Internal jobs"} />;
}

/** `/portal/work/opportunities`: the internal job board for Workers (360 px friendly). */
export function WorkOpportunitiesBoard() {
  return <BoardView surface={WORK_SURFACE} title="Opportunities" />;
}

function BoardView({ surface, title }: { surface: Surface; title: string }) {
  const styles = useStyles();
  const m = useMobilityStyles();
  const pageClass = usePageClass(surface);
  const [filters, setFilters] = useState<OpeningFilters>(emptyFilters);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const openings = useOpenings(surface.client, filters);

  const search = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters((f) => ({ ...f, q, location, page: 1 }));
  };

  return (
    <div className={pageClass}>
      <div className={m.headerRow}>
        <SurfaceHeader surface={surface} title={title} subtitle="Open roles you can apply for without leaving the company." />
        <AppLink href={surface.applicationsHref}>My applications</AppLink>
      </div>

      <form className={styles.filters} role="search" aria-label="Search openings" onSubmit={search}>
        <Field label="Search">
          <SearchBox
            className={m.tall}
            value={q}
            placeholder="Job title or skill"
            onChange={(_, d) => setQ(d.value)}
            contentBefore={<Search20Regular aria-hidden />}
          />
        </Field>
        <Field label="Location">
          <Input className={m.tall} value={location} contentBefore={<Location20Regular aria-hidden />} onChange={(_, d) => setLocation(d.value)} />
        </Field>
        <Button type="submit" appearance="primary" className={m.tall}>
          Search
        </Button>
      </form>
      <Switch
        label="Show openings I'm not eligible for"
        checked={filters.includeIneligible}
        onChange={(_, d) => setFilters((f) => ({ ...f, includeIneligible: d.checked, page: 1 }))}
      />

      {openings.isPending ? (
        <LoadingBlock label="Loading openings" />
      ) : openings.isError ? (
        <ErrorBlock error={openings.error} onRetry={() => openings.refetch()} />
      ) : !openings.data.board_enabled ? (
        <Card className={styles.card}>
          <Body1>The internal job board is not available right now.</Body1>
        </Card>
      ) : openings.data.items.length === 0 ? (
        <Card className={styles.card}>
          <Body1>No openings match your search.</Body1>
        </Card>
      ) : (
        <>
          {openings.isFetching && <Spinner size="extra-tiny" aria-label="Refreshing" />}
          <ul className={styles.cards} aria-label="Openings" style={{ listStyleType: "none", margin: 0, padding: 0 }}>
            {openings.data.items.map((o) => (
              <li key={o.demand_id}>
                <OpeningCard opening={o} href={`${surface.base}/${o.demand_id}`} />
              </li>
            ))}
          </ul>
          <PagingBar
            page={openings.data.page}
            pageSize={openings.data.page_size}
            total={openings.data.total}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            busy={openings.isFetching}
          />
        </>
      )}
    </div>
  );
}

function OpeningCard({ opening: o, href }: { opening: OpeningOut; href: string }) {
  const styles = useStyles();
  const m = useMobilityStyles();
  return (
    <Card className={styles.card}>
      <AppLink href={href} className={styles.title}>
        {o.title}
      </AppLink>
      <div className={styles.meta}>
        <Text size={200}>{o.location_text || "Location not set"}</Text>
        <Text size={200}>{labelOf(WORK_MODE_LABELS, o.work_mode)}</Text>
        {o.employment_type && <Text size={200}>{labelOf(EMPLOYMENT_TYPE_LABELS, o.employment_type)}</Text>}
      </div>
      <div className={m.badges}>
        <FitBadge fitPct={o.fit_pct} reasons={o.fit_reasons} />
        {o.application_status && <MobilityStatusBadge status={o.application_status} prefix="Applied" />}
      </div>
      <EligibilityBar eligible={o.eligible} reasons={o.reasons} />
      {o.closes_at && <Caption1 className={m.muted}>Closes {formatDay(o.closes_at)}</Caption1>}
    </Card>
  );
}
