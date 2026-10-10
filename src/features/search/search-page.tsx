"use client";

import {
  Button,
  Caption1,
  CounterBadge,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Spinner,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, Filter20Regular } from "@fluentui/react-icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { usePeopleSearch } from "@/features/activity/people";
import { ErrorBar, NoAccess, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { CandidateSearchOut, InterpretationChip } from "@/lib/api/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { searchApi, searchKeys } from "./api";
import { FacetPanel } from "./facet-panel";
import { InterpretationBar } from "./interpretation-bar";
import { BooleanBox, NlBox } from "./query-box";
import { querySyntaxProblem } from "./query-error";
import { EmptyResults, ResultsList, ResultsSkeleton } from "./results-list";
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filtersFromApi,
  PAGE_SIZE,
  paramsToState,
  type SearchFilters,
  type SearchSort,
  type SearchState,
  stateToParams,
  stateToRequest,
} from "./url-state";

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  grow: { flex: 1 },
  box: { marginBottom: tokens.spacingVerticalM },
  layout: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    gap: tokens.spacingHorizontalXL,
    alignItems: "start",
    "@media (max-width: 1023px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  facets: {
    position: "sticky",
    top: tokens.spacingVerticalM,
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    paddingInlineEnd: tokens.spacingHorizontalXS,
  },
  results: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  count: { color: tokens.colorNeutralForeground2 },
});

const SORT_LABELS: Record<SearchSort, string> = {
  relevance: "Relevance",
  updated: "Recently updated",
  experience: "Most experience",
};

/** Labels from NL chips (`skills_all` / `skills_any` carry `{id, name}`). */
function chipLabels(chips: readonly InterpretationChip[] | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of chips ?? []) {
    if (!Array.isArray(c.value)) continue;
    for (const v of c.value as unknown[]) {
      if (v && typeof v === "object" && "id" in v && "name" in v) {
        const { id, name } = v as { id: unknown; name: unknown };
        if (typeof id === "string" && typeof name === "string") out[id] = name;
      }
    }
  }
  return out;
}

/** `/candidates/search`: Boolean / natural-language candidate search with facets; state lives in the URL. */
export function CandidateSearchPage() {
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const canRead = usePermission("candidate:read");
  const canViewComp = usePermission("compensation:view");
  const narrow = useMediaQuery("(max-width: 1023px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: me } = useMe();
  const myId = me?.user.id;

  const urlState = useMemo(() => paramsToState(params), [params]);
  // Labels for id filters that are not in the URL (owners, tags) are resolved below.
  const tags = useQuery({ queryKey: searchKeys.tags, queryFn: ({ signal }) => searchApi.tags(signal), enabled: canRead, staleTime: 5 * 60_000 });
  const people = usePeopleSearch("", canRead);
  const state: SearchState = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const t of tags.data?.items ?? []) labels[t.id] = t.name;
    for (const p of people.people) labels[p.id] = p.name;
    if (myId) labels[myId] = "You";
    return { ...urlState, labels: { ...labels, ...urlState.labels } };
  }, [urlState, tags.data, people.people, myId]);

  const request = useMemo(() => stateToRequest(state), [state]);
  const search = useQuery({
    queryKey: searchKeys.candidates(request),
    queryFn: ({ signal }) => searchApi.candidates(request, signal),
    enabled: canRead,
    placeholderData: keepPreviousData,
    retry: (n, e) => !(isApiError(e) && e.status > 0 && e.status < 500) && n < 2,
    staleTime: 30_000,
  });

  const replaceState = (next: SearchState) => {
    const qs = stateToParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // An NL search that the AI interpreted: move to the structured state (chips) so paging, edits and
  // shared links never call the AI again. The response is seeded under the structured request's key.
  const data = search.data;
  useEffect(() => {
    if (search.isPlaceholderData || !data || request.mode !== "nl" || !data.interpretation || data.notice) return;
    const next: SearchState = {
      ...state,
      interpreted: true,
      q: data.applied_q ?? "",
      sem: data.semantic_text ?? "",
      filters: data.applied_filters ? filtersFromApi(data.applied_filters) : state.filters,
      labels: { ...state.labels, ...chipLabels(data.interpretation) },
    };
    queryClient.setQueryData<CandidateSearchOut>(searchKeys.candidates(stateToRequest(next)), data);
    replaceState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, request.mode, search.isPlaceholderData]);

  if (!canRead) return <NoAccess what="candidate search" />;

  const update = (patch: Partial<SearchState>) => replaceState({ ...state, page: 1, ...patch });
  const setFilters = (filters: SearchFilters, labels?: Record<string, string>) =>
    update({ filters, labels: labels ? { ...state.labels, ...labels } : state.labels });

  const problem = state.mode === "boolean" ? querySyntaxProblem(search.error, state.q) : null;
  const otherError = search.isError && !problem ? search.error : null;
  const facets = data?.facets ?? [];
  const filterCount = activeFilterCount(state.filters);
  const loading = search.isPending || (search.isFetching && search.isPlaceholderData);

  const panel = (
    <FacetPanel filters={state.filters} facets={facets} labels={state.labels} canViewComp={canViewComp} onChange={setFilters} />
  );

  return (
    <>
      <PageHeader title="Search candidates" subtitle="Find people in your talent pool with Boolean or natural-language search." />
      <div className={styles.toolbar}>
        <TabList
          size="small"
          selectedValue={state.mode}
          onTabSelect={(_, d) => {
            if (d.value === state.mode) return;
            update({ mode: d.value as SearchState["mode"], q: "", nlq: "", sem: "", interpreted: false, filters: state.filters });
          }}
          aria-label="Search mode"
        >
          <Tab value="boolean">Boolean</Tab>
          <Tab value="nl">Natural language</Tab>
        </TabList>
        <div className={styles.grow} />
        {narrow && (
          <Button icon={<Filter20Regular />} onClick={() => setDrawerOpen(true)}>
            Filters
            {filterCount > 0 && <CounterBadge count={filterCount} size="small" style={{ marginInlineStart: 6 }} />}
          </Button>
        )}
        <Dropdown
          aria-label="Sort by"
          value={`Sort: ${SORT_LABELS[state.sort]}`}
          selectedOptions={[state.sort]}
          onOptionSelect={(_, d) => d.optionValue && update({ sort: d.optionValue as SearchSort })}
          style={{ minWidth: 200 }}
        >
          {(Object.keys(SORT_LABELS) as SearchSort[]).map((s) => (
            <Option key={s} value={s}>
              {SORT_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <Caption1 className={styles.count} aria-live="polite">
          {data ? `${data.total.toLocaleString()} ${data.total === 1 ? "result" : "results"}` : ""}
        </Caption1>
      </div>

      <div className={styles.box}>
        {state.mode === "boolean" ? (
          <BooleanBox
            key={`b:${state.q}`}
            initial={state.q}
            problem={problem}
            busy={false}
            onSubmit={(q) => {
              if (q.trim() === state.q.trim()) void search.refetch();
              else update({ q: q.trim() });
            }}
          />
        ) : (
          <NlBox
            key={`n:${state.nlq}`}
            initial={state.nlq}
            busy={search.isFetching && request.mode === "nl"}
            onSubmit={(text) =>
              update({ mode: "nl", nlq: text, q: "", sem: "", interpreted: false, filters: EMPTY_FILTERS, labels: {} })
            }
          />
        )}
      </div>

      {state.mode === "nl" && data?.notice === "ai_unavailable" && !search.isPlaceholderData && (
        <MessageBar intent="warning" style={{ marginBottom: 12 }}>
          <MessageBarBody>AI search is unavailable — showing keyword results.</MessageBarBody>
        </MessageBar>
      )}
      {state.mode === "nl" && state.interpreted && (
        <InterpretationBar state={state} canViewComp={canViewComp} onChange={(s) => replaceState({ ...s, interpreted: true })} />
      )}
      {state.mode === "nl" && !state.interpreted && request.mode === "nl" && search.isFetching && state.nlq && (
        <div style={{ marginBottom: 12 }}>
          <Spinner size="tiny" label="Interpreting your search…" labelPosition="after" />
        </div>
      )}

      <div className={styles.layout}>
        {!narrow && (
          <aside className={styles.facets} aria-label="Filters">
            {panel}
          </aside>
        )}
        <section className={styles.results} aria-label="Results" aria-busy={loading}>
          {otherError && (
            <ErrorBar
              title="Search failed."
              message={
                isApiError(otherError) && otherError.code === "forbidden_filter"
                  ? "You do not have permission to filter by compensation."
                  : errorMessage(otherError)
              }
            />
          )}
          {problem ? (
            <EmptyResults title="Fix the query to search" description="The Boolean query has a syntax error; see the message above." />
          ) : loading && !data ? (
            <ResultsSkeleton />
          ) : data && data.items.length === 0 ? (
            <EmptyResults
              title="No candidates found"
              description={
                filterCount
                  ? "Try removing a filter or broadening the query."
                  : "Try different keywords, or check the spelling of names and skills."
              }
            />
          ) : data ? (
            <>
              <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 120ms" }}>
                <ResultsList items={data.items} />
              </div>
              <PagingBar
                page={state.page}
                pageSize={PAGE_SIZE}
                total={Math.min(data.total, 1000 * PAGE_SIZE)}
                busy={search.isFetching}
                onPageChange={(page) => replaceState({ ...state, page })}
              />
            </>
          ) : null}
        </section>
      </div>

      {narrow && (
        <OverlayDrawer position="start" open={drawerOpen} onOpenChange={(_, d) => setDrawerOpen(d.open)}>
          <DrawerHeader>
            <DrawerHeaderTitle
              action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => setDrawerOpen(false)} />}
            >
              Filters
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>{panel}</DrawerBody>
        </OverlayDrawer>
      )}
    </>
  );
}
