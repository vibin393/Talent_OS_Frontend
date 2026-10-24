"use client";

import {
  Badge,
  Caption1,
  Caption1Strong,
  Link,
  makeStyles,
  mergeClasses,
  Popover,
  PopoverSurface,
  SearchBox,
  Skeleton,
  SkeletonItem,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  Briefcase20Regular,
  Building20Regular,
  BuildingPeople20Regular,
  CalendarStar20Regular,
  ClipboardTask20Regular,
  ContactCard20Regular,
  DocumentData20Regular,
  DocumentText20Regular,
  Folder20Regular,
  GlobePerson20Regular,
  HatGraduation20Regular,
  Megaphone20Regular,
  PeopleTeam20Regular,
  Person20Regular,
  PersonClock20Regular,
  PersonSupport20Regular,
  // Epic 65: Phase 4 search groups.
  BookOpen20Regular,
  Sparkle20Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { searchApi, searchKeys } from "@/features/search/api";
import {
  flatHits,
  hitSubtitle,
  INITIAL_NAV,
  MIN_QUERY,
  navReducer,
  optionId,
  type QuickHit,
  type QuickHitType,
  resultSections,
  seeAllHref,
} from "@/features/search/global-search-state";
import { usePermission } from "@/features/auth/use-permission";
import { useDebounced } from "@/lib/use-debounced";


const useStyles = makeStyles({
  box: { width: "100%", maxWidth: "100%" },
  surface: {
    width: "560px",
    maxWidth: "calc(100vw - 32px)",
    padding: 0,
    maxHeight: "min(70vh, 560px)",
    overflowY: "auto",
  },
  section: { paddingBlock: tokens.spacingVerticalXS },
  sectionHead: {
    display: "block",
    paddingInline: tokens.spacingHorizontalL,
    paddingBlock: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground2,
  },
  list: { listStyleType: "none", margin: 0, padding: 0 },
  row: {
    display: "grid",
    gridTemplateColumns: "20px minmax(0, 1fr)",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    paddingInline: tokens.spacingHorizontalL,
    paddingBlock: tokens.spacingVerticalS,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  active: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Selected },
  },
  icon: { color: tokens.colorBrandForeground1 },
  exact: { marginInlineStart: tokens.spacingHorizontalS },
  text: { display: "flex", flexDirection: "column", minWidth: 0 },
  title: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subtitle: {
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  footer: {
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    paddingInline: tokens.spacingHorizontalL,
    paddingBlock: tokens.spacingVerticalS,
  },
  empty: { display: "block", padding: tokens.spacingHorizontalL, color: tokens.colorNeutralForeground3 },
});

const ICONS: Record<QuickHitType, React.ReactElement> = {
  candidate: <Person20Regular />,
  demand: <Briefcase20Regular />,
  client: <Building20Regular />,
  contact: <ContactCard20Regular />,
  vendor: <BuildingPeople20Regular />,
  placement: <PersonClock20Regular />,
  worker: <PersonSupport20Regular />,
  invoice: <DocumentText20Regular />,
  talent_pool: <PeopleTeam20Regular />,
  campaign: <Megaphone20Regular />,
  assessment: <ClipboardTask20Regular />,
  campus_drive: <HatGraduation20Regular />,
  recruitment_event: <CalendarStar20Regular />,
  project: <Folder20Regular />,
  immigration_case: <GlobePerson20Regular />,
  report_definition: <DocumentData20Regular />,
  agent_proposal: <Sparkle20Regular />,
  knowledge_source: <BookOpen20Regular />,
};

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/**
 * Suite-header global search (M365 style): SearchBox + grouped results popover. ARIA combobox /
 * listbox; ↑/↓ move, Enter opens, Esc closes and restores focus; Alt+Q focuses the box.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const styles = useStyles();
  const router = useRouter();
  const canSearchCandidates = usePermission("candidate:read");
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [nav, dispatch] = useReducer(navReducer, INITIAL_NAV);
  const debounced = useDebounced(q.trim(), 200);
  const enabled = debounced.length >= MIN_QUERY;

  const results = useQuery({
    queryKey: searchKeys.global(debounced),
    queryFn: ({ signal }) => searchApi.global(debounced, 5, signal),
    enabled,
    staleTime: 15_000,
    retry: false,
  });

  // Alt+Q focuses the search box, like Microsoft 365.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "q" || e.key === "Q" || e.code === "KeyQ")) {
        e.preventDefault();
        if (document.activeElement !== inputRef.current && !isEditable(document.activeElement)) {
          returnFocus.current = document.activeElement as HTMLElement | null;
        }
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pending = q.trim().length >= MIN_QUERY && (debounced !== q.trim() || results.isPending);
  const sections = pending ? [] : resultSections(results.data);
  const hits = flatHits(sections);
  const open = nav.open && focused && q.trim().length >= MIN_QUERY;
  const activeHit = nav.active >= 0 ? hits[nav.active] : undefined;

  const close = (restore: boolean) => {
    dispatch({ type: "close" });
    if (restore) {
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target && target !== inputRef.current && document.contains(target)) target.focus();
      else inputRef.current?.blur();
    }
  };

  const go = (hit: QuickHit) => {
    dispatch({ type: "close" });
    setQ("");
    inputRef.current?.blur();
    router.push(hit.url);
  };

  const seeAll = () => {
    const href = seeAllHref(q);
    dispatch({ type: "close" });
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      dispatch({ type: "move", delta: e.key === "ArrowDown" ? 1 : -1, count: hits.length });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeHit) go(activeHit);
      else if (q.trim().length >= MIN_QUERY && canSearchCandidates) seeAll();
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (q) {
        setQ("");
      }
    }
  };

  let seq = -1;
  const renderRow = (hit: QuickHit) => {
    seq += 1;
    const index = seq;
    const id = optionId(hit);
    const subtitle = hitSubtitle(hit);
    return (
      <li/* NOSONAR */
        key={`${hit.type}-${hit.id}`}
        id={id}
        role="option"
        aria-selected={nav.active === index}
        className={mergeClasses(styles.row, nav.active === index && styles.active)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(hit)}
      >
        <span className={styles.icon} aria-hidden>
          {ICONS[hit.type]}
        </span>
        <span className={styles.text}>
          <Text className={styles.title}>
            {hit.title}
            {hit.exact && (
              <Badge appearance="tint" color="brand" size="small" className={styles.exact}>
                Exact match
              </Badge>
            )}
          </Text>
          {subtitle && <Caption1 className={styles.subtitle}>{subtitle}</Caption1>}
        </span>
      </li>
    );
  };

  return (
    <div ref={setAnchor} className={mergeClasses(styles.box, className)}>
      <SearchBox
        ref={inputRef}
        className={styles.box}
        appearance="filled-lighter"
        placeholder="Search candidates, demands, clients, placements, invoices"
        aria-label="Search candidates, demands, clients, contacts, vendors, placements, workers, invoices"
        value={q}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={open && activeHit ? optionId(activeHit) : undefined}
        aria-keyshortcuts="Alt+Q"
        onChange={(_, d) => {
          setQ(d.value);
          if (d.value.trim().length >= MIN_QUERY) dispatch({ type: "open" });
          else dispatch({ type: "close" });
        }}
        onFocus={() => {
          setFocused(true);
          if (q.trim().length >= MIN_QUERY) dispatch({ type: "open" });
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      <Popover
        open={open}
        positioning={{ target: anchor, position: "below", align: "start" }}
        trapFocus={false}
        onOpenChange={(e, d) => {
          // Clicks inside the search box itself are not "outside" clicks.
          if (!d.open && !(e?.target instanceof Node && anchor?.contains(e.target))) dispatch({ type: "close" });
        }}
      >
        <PopoverSurface className={styles.surface} onMouseDown={(e) => e.preventDefault()}>
          <div id={listboxId} role="listbox" aria-label="Search results">
            {pending ? (
              <Skeleton aria-label="Loading results" className={styles.section}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={styles.row} role="presentation">
                    <SkeletonItem shape="square" size={20} />
                    <SkeletonItem size={16} style={{ width: `${70 - i * 10}%` }} />
                  </div>
                ))}
              </Skeleton>
            ) : results.isError ? (
              <Caption1 className={styles.empty}>Search is unavailable right now.</Caption1>
            ) : sections.length === 0 ? (
              <Caption1 className={styles.empty}>No results for “{debounced}”.</Caption1>
            ) : (
              sections.map((s) => (
                <div key={s.key} className={styles.section} role="group" aria-labelledby={`${listboxId}-${s.key}`}>
                  <Caption1Strong id={`${listboxId}-${s.key}`} className={styles.sectionHead}>
                    {s.title}
                    {s.timedOut ? " (timed out)" : ""}
                  </Caption1Strong>
                  <ul className={styles.list} role="presentation">
                    {s.hits.map(renderRow)}
                  </ul>
                </div>
              ))
            )}
          </div>
          {canSearchCandidates && (
            <div className={styles.footer}>
              <Link
                href={seeAllHref(q)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  seeAll();
                }}
              >
                See all candidate results
              </Link>
            </div>
          )}
        </PopoverSurface>
      </Popover>
    </div>
  );
}
