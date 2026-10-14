"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Text,
  Textarea,
  ToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { ErrorBar, GridSkeleton, IdSelect } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import { useUserNames } from "@/features/privacy/use-user-names";
import { errorMessage } from "@/lib/api/errors";
import { inboxApi, inboxKeys, type InboxProposal } from "./api";
import {
  AGE_BUCKETS,
  type AgeBucket,
  ageText,
  applyFilters,
  BULK_TOOLTIP,
  bulkBarText,
  bulkDialogItems,
  bulkEligible,
  bulkTitle,
  decisionError,
  EMPTY_INBOX_FILTERS,
  expiresText,
  groupProposals,
  type GroupBy,
  type InboxFilters,
  type InboxTab,
  inboxQuery,
  itemsForTab,
  nextAfterDecision,
  nextIndex,
  recordKey,
  recordLabel,
  rejectReasonError,
  visibleTabs,
} from "./logic";
import { PreviewRows, ProposalDetail } from "./proposal-detail";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";

const useStyles = makeStyles({
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    "@media (min-width: 768px)": { gridTemplateColumns: "minmax(280px, 2fr) minmax(0, 3fr)" },
  },
  filters: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM },
  filter: { minWidth: "150px", flex: "1 1 150px", maxWidth: "240px" },
  // "Group by" control: a stable unit that never compresses into the Record dropdown; it keeps its
  // content width and instead wraps to its own line as a whole when the row runs out of space.
  group: {
    display: "flex",
    gap: tokens.spacingHorizontalXS,
    alignItems: "center",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  groupLabel: { whiteSpace: "nowrap", color: tokens.colorNeutralForeground2 },
  list: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    outline: "none",
    minWidth: 0,
  },
  groupHead: { padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, color: tokens.colorNeutralForeground2 },
  row: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    columnGap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    cursor: "pointer",
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
  },
  rowActive: { backgroundColor: tokens.colorNeutralBackground1Selected },
  rowText: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  rowMeta: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  title: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  detail: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalL,
    minWidth: 0,
  },
  bulkBar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  empty: { padding: tokens.spacingHorizontalXXL, textAlign: "center", color: tokens.colorNeutralForeground3 },
  bulkItem: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  results: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

type BulkResult = { id: string; human_id: string; ok: boolean; text: string };

/**
 * Proposal inbox: tabs, filters, grouping, listbox rows with checkboxes, the detail pane and bulk decisions.
 * `scope="all"` is the AI governance console's view (opens on "All I can decide").
 */
export function ProposalInbox({ scope = "mine", initialId = null }: { scope?: "mine" | "all"; initialId?: string | null }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const userName = useUserNames();
  const govern = usePermission("ai:govern");
  const tabs = visibleTabs(govern);
  const [tab, setTab] = useState<InboxTab>(scope === "all" ? "all" : "assigned");
  const activeTab = tabs.some((t) => t.value === tab) ? tab : tabs[0].value;
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_INBOX_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [checked, setChecked] = useState<InboxProposal[]>([]);
  const [bulk, setBulk] = useState<"approve" | "reject" | null>(null);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [announce, setAnnounce] = useState("");
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const query = inboxQuery(activeTab);
  const list = useQuery({
    queryKey: inboxKeys.list(query),
    queryFn: ({ signal }) => inboxApi.list(query, signal),
    refetchInterval: 60_000,
  });
  const meId = me?.user.id;
  // Plain derivations: the React Compiler memoizes them.
  const tabItems = itemsForTab(list.data?.items ?? [], activeTab, meId);
  const shown = applyFilters(tabItems, filters, now);
  const groups = groupBy ? groupProposals(shown, groupBy) : [{ key: "all", label: "", items: shown }];
  const ordered = groups.flatMap((g) => g.items);
  const ids = ordered.map((p) => p.id);

  const selectedInList = ordered.find((p) => p.id === selectedId) ?? null;
  // `/proposals?id=<uuid>` (notifications, search) opens a Proposal even outside the current tab.
  const direct = useQuery({
    queryKey: inboxKeys.one(selectedId ?? ""),
    queryFn: ({ signal }) => inboxApi.get(selectedId ?? "", signal),
    enabled: !!selectedId && !selectedInList && !list.isPending,
    retry: false,
  });
  const selected = selectedInList ?? (direct.data && direct.data.origin !== "copilot" ? direct.data : null);

  const options = (() => {
    const agents = new Map<string, string>();
    const actions = new Map<string, string>();
    const records = new Map<string, string>();
    for (const p of tabItems) {
      agents.set(p.agent_key, p.agent_name);
      actions.set(p.tool_key, p.tool_title);
      const rk = recordKey(p);
      if (rk) records.set(rk, recordLabel(p));
    }
    const toOpts = (m: Map<string, string>) => [...m].map(([id, label]) => ({ id, label }));
    return { agents: toOpts(agents), actions: toOpts(actions), records: toOpts(records) };
  })();

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    if (focus) rowRefs.current.get(id)?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = nextIndex(e.key, Math.max(0, ids.indexOf(selectedId ?? "")), ids.length);
    if (i >= 0) select(ids[i], true);
  };
  const onDecided = (id: string) => {
    const next = nextAfterDecision(ids, id);
    setChecked((c) => c.filter((p) => p.id !== id));
    setAnnounce("Decision recorded.");
    void qc.invalidateQueries({ queryKey: inboxKeys.all });
    setSelectedId(next);
    if (next) setTimeout(() => rowRefs.current.get(next)?.focus(), 0);
  };
  const toggle = (p: InboxProposal, on: boolean) => setChecked((c) => (on ? [...c, p] : c.filter((x) => x.id !== p.id)));
  const updateFilter = (patch: Partial<InboxFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, d) => {
          setTab(d.value as InboxTab);
          setChecked([]);
        }}
        aria-label="Proposal views"
      >
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <div className={styles.filters}>
        <IdSelect label="Agent" className={styles.filter} options={options.agents} value={filters.agent} noneLabel="All agents" onChange={(v) => updateFilter({ agent: v })} />
        <IdSelect label="Action" className={styles.filter} options={options.actions} value={filters.action} noneLabel="All actions" onChange={(v) => updateFilter({ action: v })} />
        <IdSelect
          label="Age"
          className={styles.filter}
          options={AGE_BUCKETS.map((b) => ({ id: b.value, label: b.label }))}
          value={filters.age}
          noneLabel="Any age"
          onChange={(v) => updateFilter({ age: v as AgeBucket | null })}
        />
        <IdSelect label="Record" className={styles.filter} options={options.records} value={filters.record} noneLabel="All records" onChange={(v) => updateFilter({ record: v })} />
        <div className={styles.group} role="group" aria-label="Group by">
          <Text className={styles.groupLabel}>Group by:</Text>
          <ToggleButton size="small" checked={groupBy === "agent"} onClick={() => setGroupBy((g) => (g === "agent" ? null : "agent"))}>
            Agent
          </ToggleButton>
          <ToggleButton size="small" checked={groupBy === "record"} onClick={() => setGroupBy((g) => (g === "record" ? null : "record"))}>
            Record
          </ToggleButton>
        </div>
      </div>
      {checked.length > 0 && (
        <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
          <Text weight="semibold">{bulkBarText(checked.length)}</Text>
          <Text aria-hidden>·</Text>
          <Button size="small" appearance="primary" onClick={() => setBulk("approve")}>
            Approve all
          </Button>
          <Text aria-hidden>·</Text>
          <Button size="small" onClick={() => setBulk("reject")}>
            Reject all
          </Button>
          <Button size="small" appearance="subtle" onClick={() => setChecked([])}>
            Clear
          </Button>
        </div>
      )}
      {results.length > 0 && (
        <div className={styles.results} aria-live="polite">
          {results.map((r) => (
            <MessageBar key={r.id} intent={r.ok ? "success" : "warning"}>
              <MessageBarBody>
                {r.human_id}: {r.text}
              </MessageBarBody>
            </MessageBar>
          ))}
          <div>
            <Button size="small" appearance="subtle" onClick={() => setResults([])}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <div className={styles.layout}>
        <div>
          {list.isPending ? (
            <GridSkeleton rows={5} />
          ) : list.isError ? (
            <ErrorBar title="Could not load proposals." message={errorMessage(list.error)} />
          ) : ordered.length === 0 ? (
            <div className={styles.list}>
              <Body1 className={styles.empty}>No proposals waiting for you.</Body1>
            </div>
          ) : (
            <div
              className={styles.list}
              role="listbox"
              aria-label="Proposals"
              aria-activedescendant={selectedId ? `prp-${selectedId}` : undefined}
              onKeyDown={onKeyDown}
            >
              {groups.map((g) => (
                <div key={g.key} role="group" aria-label={g.label || undefined}>
                  {groupBy && (
                    <Subtitle2 as="h3" className={styles.groupHead}>
                      {g.label} ({g.items.length})
                    </Subtitle2>
                  )}
                  {g.items.map((p) => {
                    const isChecked = checked.some((c) => c.id === p.id);
                    const eligible = isChecked || bulkEligible(p, checked);
                    const box = (
                      <Checkbox
                        aria-label={`Select ${p.human_id}`}
                        checked={isChecked}
                        disabled={!eligible}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(_, d) => toggle(p, !!d.checked)}
                      />
                    );
                    return (
                      <div
                        key={p.id}
                        id={`prp-${p.id}`}
                        ref={(el) => {
                          if (el) rowRefs.current.set(p.id, el);
                          else rowRefs.current.delete(p.id);
                        }}
                        role="option"
                        aria-selected={p.id === selectedId}
                        tabIndex={p.id === selectedId || (!selectedId && p.id === ids[0]) ? 0 : -1}
                        className={mergeClasses(styles.row, p.id === selectedId && styles.rowActive)}
                        onClick={() => select(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            select(p.id);
                          }
                        }}
                      >
                        {eligible ? (
                          box
                        ) : (
                          <Tooltip content={BULK_TOOLTIP} relationship="description">
                            <span>{box}</span>
                          </Tooltip>
                        )}
                        <div className={styles.rowText}>
                          <div className={styles.rowMeta}>
                            <Caption1>{p.human_id}</Caption1>
                            <AiBadge agentName={p.agent_name} ownerName={userName(p.owner_user_id)} />
                            <Badge appearance="tint" size="small" color={p.risk === "high" ? "danger" : "informative"}>
                              {p.risk === "high" ? "High" : "Low"}
                            </Badge>
                          </div>
                          <Text weight="semibold" className={styles.title}>
                            {renderProposal(p).title || p.title}
                          </Text>
                          <div className={styles.rowMeta}>
                            {p.target_type && <Caption1 className={styles.muted}>{recordLabel(p)}</Caption1>}
                            <Caption1 className={styles.muted}>Age: {ageText(p, now)}</Caption1>
                            <Caption1 className={styles.muted}>Expires in: {expiresText(p.expires_at, now)}</Caption1>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.detail} aria-live="polite" aria-label="Proposal details">
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{announce}</span>
          {selected ? (
            <ProposalDetail key={selected.id} proposal={selected} canSeeRun={govern || selected.owner_user_id === me?.user.id} onDecided={onDecided} />
          ) : direct.isFetching ? (
            <Spinner size="small" label="Loading proposal" />
          ) : (
            <Body1 className={styles.muted}>Select a proposal to see what will happen.</Body1>
          )}
        </div>
      </div>
      {bulk && (
        <BulkDialog
          decision={bulk}
          items={checked}
          onClose={() => setBulk(null)}
          onDone={(r) => {
            setResults(r);
            setBulk(null);
            setChecked([]);
            setAnnounce(`${r.filter((x) => x.ok).length} of ${r.length} decided.`);
            void qc.invalidateQueries({ queryKey: inboxKeys.all });
          }}
        />
      )}
    </div>
  );
}

function BulkDialog({
  decision,
  items,
  onClose,
  onDone,
}: {
  decision: "approve" | "reject";
  items: InboxProposal[];
  onClose: () => void;
  onDone: (results: BulkResult[]) => void;
}) {
  const styles = useStyles();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const dialogItems = bulkDialogItems(items);
  const run = useMutation({
    mutationFn: () => inboxApi.bulkDecide(items.map((p) => p.id), decision, note.trim() || null),
    onSuccess: (out) => {
      onDone(
        items.map((p) => {
          const r = out.find((o) => o.id === p.id);
          const ok = !!r && !r.error_code && r.status !== "pending" && r.status !== "stale";
          return {
            id: p.id,
            human_id: p.human_id,
            ok,
            text: ok ? (decision === "approve" ? "Approved." : "Rejected.") : r?.status === "stale" ? "This record changed after the agent proposed this." : r?.error_code ?? "Not decided.",
          };
        }),
      );
    },
    onError: (e) => setFailure(decisionError(e).text),
  });
  const err = decision === "reject" && touched ? rejectReasonError(note) : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>{bulkTitle(decision, items.length)}</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <ol style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
              {dialogItems.map((it) => (
                <li key={it.id} className={styles.bulkItem}>
                  <Text weight="semibold">
                    {it.human_id} · {it.rendered.title}
                  </Text>
                  <PreviewRows rendered={it.rendered} />
                  <Divider />
                </li>
              ))}
            </ol>
            <Field
              label={decision === "reject" ? "Reason (required)" : "Note"}
              required={decision === "reject"}
              validationState={err ? "error" : "none"}
              validationMessage={err ?? undefined}
            >
              <Textarea value={note} onChange={(_, d) => setNote(d.value)} onBlur={() => setTouched(true)} maxLength={1000} />
            </Field>
            {failure && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{failure}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={run.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={run.isPending}
              icon={run.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                setTouched(true);
                if (decision === "reject" && rejectReasonError(note)) return;
                run.mutate();
              }}
            >
              {decision === "approve" ? "Approve all" : "Reject all"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
