"use client";

import {
  Badge,
  Body1,
  Card,
  CardHeader,
  makeStyles,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { DataBarVertical24Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useBusinessUnitLookup } from "@/features/admin/use-admin-data";
import { ErrorBar } from "@/features/admin/ui";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { errorMessage, isApiError } from "@/lib/api/errors";
import {
  dashboardParamsToSearch,
  type DashboardParams,
  type DatePreset,
  type DateRange,
  parseDashboardParams,
  resolveRange,
} from "./date-range";
import { FilterBar } from "./filter-bar";
import { LegalEntityFilter, useLegalEntityOptions } from "./p2/legal-entity-filter";
import { P2TileCard } from "./p2/p2-tile";
import { p2TileQuery, parseP2Params, type P2Params, withP2Params } from "./p2/params";
import { isP2Dashboard, type P2TileDef } from "./p2/types";
import { P3TileCard } from "./p3/p3-tile";
import { SUPPORTING_SIGNAL, tabHasSupportingSignal } from "./p3/tile-model";
import { isP3Dashboard, type P3TileDef } from "./p3/types";
import { AgentFilter } from "./p4/agent-filter";
import { P4TileCard } from "./p4/p4-tile";
import { agentQuery, isP4Dashboard, isTabVisible } from "./p4/tile-model";
import { isTileVisible, TileCard, type TileState, tileSpan } from "./tile-card";
import { useDashboards, useDashboardTiles } from "./use-dashboard-tile";

const MIN_TILE_WIDTH = 320;

const useStyles = makeStyles({
  // Many tabs (up to ~17 role/P2–P5 dashboards) scroll within the strip instead of widening the page.
  tabs: { marginBottom: tokens.spacingVerticalM, maxWidth: "100%", overflowX: "auto", flexShrink: 0 },
  tabBadge: { marginLeft: tokens.spacingHorizontalXS },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${MIN_TILE_WIDTH}px, 100%), 1fr))`,
    alignItems: "stretch",
    // Small tiles fill gaps left by wide ones.
    gridAutoFlow: "row dense",
  },
});

/** Grid column count for a container width (mirrors `repeat(auto-fill, minmax(320px, 1fr))`). */
export function gridColumns(width: number, gap = 16): number {
  if (width < 768) return 1;
  return Math.max(1, Math.floor((width + gap) / (MIN_TILE_WIDTH + gap)));
}

function useElementWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return width;
}

const FILTER_ERROR_CODES = new Set(["invalid_range", "bu_out_of_scope", "unknown_legal_entity"]);

/** `/dashboard`: role dashboards (My work / Team performance / Clients) with URL-backed filters. */
export function DashboardView({ initialSearch }: { initialSearch: string }) {
  const styles = useStyles();
  const router = useRouter();
  const { data: me } = useMe();
  const permissions = me?.permissions;
  // Epic 65: AI Administrators (ai:govern without report:read) open the "AI agents" dashboard only (API gate).
  const canRead = hasPermission(permissions, "report:read") || hasPermission(permissions, "ai:govern");
  const timeZone = me?.tenant.timezone;
  const [params, setParamsState] = useState<DashboardParams>(() => parseDashboardParams(new URLSearchParams(initialSearch)));
  const [nonce, setNonce] = useState(0);
  const [p2, setP2State] = useState<P2Params>(() => parseP2Params(new URLSearchParams(initialSearch)));
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(gridEl);
  const columns = width ? gridColumns(width) : 3;

  const dashboards = useDashboards();
  // Epic 65: P4 tabs ("AI agents", "Agent outcomes") only when listed by the API and permitted.
  const items = useMemo(() => (dashboards.data?.items ?? []).filter((d) => isTabVisible(d.key, permissions)), [dashboards.data, permissions]);
  const active = items.find((d) => d.key === params.view) ?? items[0];

  // Business units: only for callers who see every BU for reports (tenant scope) and can list BUs.
  const buAllowed =
    !!active && active.key !== "recruiter" && hasPermission(permissions, "report:read", "tenant") && hasPermission(permissions, "business_unit:read");
  const buLookup = useBusinessUnitLookup(buAllowed);
  const businessUnits = buAllowed && buLookup.data ? buLookup.data.items.map((b) => ({ id: b.id, name: b.name })) : null;
  const selectedBus = businessUnits ? params.businessUnitIds : [];

  const range = useMemo(() => resolveRange(params, timeZone), [params, timeZone]);
  const tiles = useMemo(() => active?.tiles ?? [], [active]);
  // P2 dashboard keys are hand-typed (the generated DashboardOut key predates Epic 34).
  const activeKey: string = active?.key ?? "";
  const isP2 = isP2Dashboard(activeKey);
  const isP3 = isP3Dashboard(activeKey);
  const leOptions = useLegalEntityOptions(isP2);
  const isP4 = isP4Dashboard(activeKey);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const extraQuery = isP2 ? p2TileQuery("", { ...p2, asOf: activeKey === "finance" ? p2.asOf : null }) : isP4 ? agentQuery(agentKey) : "";
  const results = useDashboardTiles(active?.key, tiles, { range, businessUnitIds: selectedBus, nonce, extraQuery });

  const setP2 = (patch: Partial<P2Params>) => {
    const next = { ...p2, ...patch };
    setP2State(next);
    const qs = withP2Params(dashboardParamsToSearch(params), next);
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  const setParams = (patch: Partial<DashboardParams>) => {
    const next = { ...params, ...patch };
    setParamsState(next);
    const qs = withP2Params(dashboardParamsToSearch(next), p2);
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  const onRangeChange = (preset: DatePreset, custom?: DateRange) =>
    setParams(preset === "custom" && custom ? { preset, from: custom.from, to: custom.to } : { preset, from: null, to: null });

  const computedAt =
    results
      .map((r) => r.data?.computed_at)
      .filter((v): v is string => !!v)
      .sort()[0] ?? null;
  const filterError = results.map((r) => r.error).find((e) => isApiError(e) && FILTER_ERROR_CODES.has(e.code));
  const refreshing = results.some((r) => r.isFetching);

  if (me && !canRead) {
    return (
      <>
        <PageHeader title="Home" subtitle={`Welcome, ${me.user.name} · ${me.tenant.name}`} />
        <Card style={{ maxWidth: 560 }}>
          <CardHeader
            image={<DataBarVertical24Regular aria-hidden />}
            header={<Subtitle2 as="h2">Dashboards aren&apos;t available for your role</Subtitle2>}
            description={<Body1>Ask a tenant admin for the report permission to see recruiting dashboards.</Body1>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Home" subtitle={me ? `Welcome, ${me.user.name} · ${me.tenant.name}` : undefined} />
      {items.length > 1 && active && (
        <TabList
          className={styles.tabs}
          selectedValue={active.key}
          onTabSelect={(_, d) => setParams({ view: String(d.value) === items[0].key ? null : String(d.value) })}
          aria-label="Dashboards"
        >
          {items.map((d) => (
            <Tab key={d.key} value={d.key}>
              {d.title}
              {tabHasSupportingSignal(d.key) && (
                <Badge appearance="tint" color="brand" size="small" className={styles.tabBadge}>
                  {SUPPORTING_SIGNAL}
                </Badge>
              )}
            </Tab>
          ))}
        </TabList>
      )}
      <FilterBar
        preset={params.preset}
        range={range}
        onRangeChange={onRangeChange}
        businessUnits={businessUnits}
        selectedBusinessUnits={selectedBus}
        onBusinessUnitsChange={(ids) => setParams({ businessUnitIds: ids })}
        onRefresh={() => setNonce((n) => n + 1)}
        refreshing={refreshing}
        computedAt={computedAt}
      />
      {isP2 && (
        <LegalEntityFilter
          entities={leOptions.data ?? []}
          selected={p2.legalEntityIds}
          onChange={(ids) => setP2({ legalEntityIds: ids })}
          asOf={p2.asOf}
          onAsOfChange={activeKey === "finance" ? (v) => setP2({ asOf: v }) : undefined}
        />
      )}
      {isP4 && <AgentFilter value={agentKey} onChange={setAgentKey} />}
      {filterError && <ErrorBar title="These filters can't be used." message={errorMessage(filterError)} />}
      {dashboards.error ? (
        <ErrorBar title="Could not load dashboards." message={errorMessage(dashboards.error)} />
      ) : (
        <div className={styles.grid} ref={setGridEl}>
          {!active
            ? Array.from({ length: 6 }, (_, i) => (
                <Card key={i}>
                  <Skeleton aria-label="Loading">
                    <SkeletonItem size={16} style={{ width: "50%", marginBottom: 12 }} />
                    <SkeletonItem size={40} style={{ width: "30%" }} />
                  </Skeleton>
                </Card>
              ))
            : tiles.map((def, i) => {
                const r = results[i];
                const state: TileState = r?.data
                  ? { status: "ok", tile: r.data }
                  : r?.error
                    ? { status: "error", message: tileErrorMessage(r.error) }
                    : { status: "loading" };
                if (!isTileVisible(def, state)) return null;
                if (isP4) {
                  return (
                    <P4TileCard
                      key={`${active.key}:${def.key}`}
                      def={def as P2TileDef}
                      state={state}
                      onRetry={() => void r?.refetch()}
                      span={tileSpan(def.size, columns)}
                    />
                  );
                }
                if (isP3) {
                  return (
                    <P3TileCard
                      key={`${active.key}:${def.key}`}
                      dashboardKey={activeKey}
                      def={def as P3TileDef}
                      state={state}
                      onRetry={() => void r?.refetch()}
                      span={tileSpan(def.size, columns)}
                    />
                  );
                }
                if (isP2) {
                  return (
                    <P2TileCard
                      key={`${active.key}:${def.key}`}
                      def={def as P2TileDef}
                      state={state}
                      onRetry={() => void r?.refetch()}
                      span={tileSpan(def.size, columns)}
                    />
                  );
                }
                return (
                  <TileCard
                    key={`${active.key}:${def.key}`}
                    def={def}
                    state={state}
                    onRetry={() => void r?.refetch()}
                    span={tileSpan(def.size, columns)}
                    timeZone={timeZone}
                  />
                );
              })}
        </div>
      )}
    </>
  );
}

function tileErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 403) return "You don't have access to this tile's data.";
  return "Couldn't load this tile.";
}
