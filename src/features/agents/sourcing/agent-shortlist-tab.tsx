"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Play20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { DemandTabProps } from "@/features/demands/demand-tabs";
import { errorMessage } from "@/lib/api/errors";
import { sourcingApi, sourcingKeys } from "./api";
import { addableIds, approvableProposalIds, bulkResultLines, DISMISS_REASONS, excludedLine, runDisabledReason, versionLabel, visibleEntries } from "./logic";
import { OutreachDraftDrawer } from "./outreach-draft-drawer";
import { entryColumns } from "./shortlist-entry-row";
import type { DismissReason, EntryOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  toolbar: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1 },
  muted: { color: tokens.colorNeutralForeground3 },
  grid: { overflowX: "auto" },
  results: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

/** The Demand's "Agent shortlist" tab (Epic 56, FR-286). Entries are shown in the server rank order (never re-sorted). */
export function AgentShortlistTab({ demandId }: DemandTabProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canAdd = usePermission("application:create");
  const canDismiss = usePermission("match:write");
  const canDecide = usePermission("proposal:decide");
  const [version, setVersion] = useState<number | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<EntryOut | null>(null);
  const [reason, setReason] = useState<DismissReason | null>(null);
  const [reviewing, setReviewing] = useState<EntryOut | null>(null);
  const [results, setResults] = useState<string[] | null>(null);

  const shortlist = useQuery({
    queryKey: sourcingKeys.shortlist(demandId, version),
    queryFn: ({ signal }) => sourcingApi.shortlist(demandId, version, signal),
  });
  const versions = useQuery({ queryKey: sourcingKeys.versions(demandId), queryFn: ({ signal }) => sourcingApi.versions(demandId, signal) });
  const refresh = () => qc.invalidateQueries({ queryKey: sourcingKeys.all });

  const run = useMutation({
    mutationFn: () => sourcingApi.run(demandId),
    onSuccess: (out) => {
      if (out.run_id) toast.success("The Sourcing Agent started. The shortlist updates when it finishes.");
      else toast.error(out.reason === "feature_off" ? "The Sourcing Agent is off" : `The agent did not start (${out.reason}).`);
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const decide = useMutation({
    mutationFn: ({ entry, decision, why }: { entry: EntryOut; decision: "add_to_pipeline" | "dismiss" | "restore"; why?: DismissReason | null }) =>
      sourcingApi.decide(entry.id, { decision, reason: why ?? null }),
    onSuccess: (_, v) => {
      toast.success(v.decision === "add_to_pipeline" ? "Added to the pipeline." : v.decision === "dismiss" ? "Dismissed from the agent shortlist." : "Restored.");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bulkAdd = useMutation({
    mutationFn: async (ids: string[]) => {
      const lines: string[] = [];
      for (const id of ids) {
        const entry = data?.entries.find((x) => x.id === id);
        try {
          await sourcingApi.decide(id, { decision: "add_to_pipeline" });
          lines.push(`${entry?.candidate_name ?? id}: added to the pipeline`);
        } catch (e) {
          lines.push(`${entry?.candidate_name ?? id}: ${errorMessage(e)}`);
        }
      }
      return lines;
    },
    onSuccess: (lines) => {
      setResults(lines);
      setSelected(new Set());
      void refresh();
    },
  });
  const approve = useMutation({
    mutationFn: (ids: string[]) => sourcingApi.bulkDecide(ids, "approve"),
    onSuccess: (out) => {
      setResults(bulkResultLines(out));
      setSelected(new Set());
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const data = shortlist.data?.shortlist ?? null;
  const agentEnabled = shortlist.data?.agent_enabled ?? false;
  const entries = useMemo(() => visibleEntries(data, showDismissed), [data, showDismissed]);
  const columns = useMemo(
    () =>
      entryColumns({
        canAdd,
        canDismiss,
        onAdd: (e) => decide.mutate({ entry: e, decision: "add_to_pipeline" }),
        onDismiss: (e) => {
          setReason(null);
          setDismissing(e);
        },
        onRestore: (e) => decide.mutate({ entry: e, decision: "restore" }),
        onReview: (e) => setReviewing(e),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canAdd, canDismiss],
  );
  const approvable = approvableProposalIds(entries, selected);
  const addable = addableIds(entries, selected);
  const disabledReason = runDisabledReason(agentEnabled);
  const current = data?.status === "current";

  if (shortlist.isPending) return <GridSkeleton rows={6} />;
  if (shortlist.isError) return <ErrorBar title="Could not load the agent shortlist." message={errorMessage(shortlist.error)} />;

  const runButton = (
    <Button
      appearance="primary"
      icon={run.isPending ? <Spinner size="tiny" /> : <Play20Regular />}
      disabled={!agentEnabled || run.isPending}
      onClick={() => run.mutate()}
    >
      Run sourcing
    </Button>
  );

  return (
    <div className={styles.root}>
      <Card>
        <CardHeader
          header={
            <span className={styles.head}>
              <Subtitle2 as="h3">Agent shortlist</Subtitle2>
              <AiBadge agentName="Sourcing Agent" ownerName={data?.owner_name} />
            </span>
          }
          description={<Caption1 className={styles.muted}>Ranked by match score. The agent does not change scores.</Caption1>}
          action={
            <span className={styles.toolbar}>
              {(versions.data?.length ?? 0) > 0 && (
                <Dropdown
                  aria-label="Shortlist version"
                  value={data ? versionLabel(data.version, data.created_at) : ""}
                  selectedOptions={[String(data?.version ?? "")]}
                  onOptionSelect={(_, d) => {
                    const v = Number(d.optionValue);
                    const latest = versions.data?.[0]?.version;
                    setVersion(Number.isFinite(v) && v !== latest ? v : null);
                    setSelected(new Set());
                  }}
                >
                  {(versions.data ?? []).map((v) => (
                    <Option key={v.id} value={String(v.version)} text={versionLabel(v.version, v.created_at)}>
                      {versionLabel(v.version, v.created_at)}
                    </Option>
                  ))}
                </Dropdown>
              )}
              {data?.run_id && <AppLink href={`/ai/runs/${data.run_id}`}>View run</AppLink>}
              {disabledReason ? (
                <Tooltip content={disabledReason} relationship="description">
                  {runButton}
                </Tooltip>
              ) : (
                runButton
              )}
            </span>
          }
        />
        {data?.summary && (
          <MessageBar intent="info">
            <MessageBarBody>
              <MessageBarTitle>AI-generated</MessageBarTitle>
              {data.summary}
            </MessageBarBody>
          </MessageBar>
        )}
        {data && <Caption1 className={styles.muted}>{excludedLine(data.excluded_counts)}</Caption1>}
      </Card>

      {!data ? (
        <Body1>{agentEnabled ? "No agent shortlist yet. The Sourcing Agent runs when the Demand opens." : "The Sourcing Agent is off for your organisation."}</Body1>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Switch label="Show dismissed" checked={showDismissed} onChange={(_, d) => setShowDismissed(d.checked)} />
            <span className={styles.grow} />
            <Button disabled={!current || !canAdd || addable.length === 0 || bulkAdd.isPending} onClick={() => bulkAdd.mutate(addable)}>
              Add to pipeline
            </Button>
            <Button
              appearance="primary"
              disabled={!current || !canDecide || approvable.length === 0 || approve.isPending}
              onClick={() => approve.mutate(approvable)}
            >
              {`Approve outreach (${approvable.length})`}
            </Button>
          </div>
          <div className={styles.grid}>
            <DataGrid
              items={entries}
              columns={columns}
              getRowId={(e: EntryOut) => e.id}
              selectionMode={current ? "multiselect" : undefined}
              selectedItems={selected}
              onSelectionChange={(_, d) => setSelected(new Set([...d.selectedItems].map(String)))}
              aria-label="Agent shortlist"
            >
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<EntryOut>>
                {({ item, rowId }) => (
                  <DataGridRow<EntryOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          </div>
        </>
      )}

      <Dialog open={dismissing !== null} onOpenChange={(_, d) => !d.open && setDismissing(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Dismiss from agent shortlist</DialogTitle>
            <DialogContent>
              <Field label="Reason" required>
                <Dropdown
                  placeholder="Choose a reason"
                  value={DISMISS_REASONS.find((r) => r.value === reason)?.label ?? ""}
                  selectedOptions={reason ? [reason] : []}
                  onOptionSelect={(_, d) => setReason((d.optionValue as DismissReason) ?? null)}
                >
                  {DISMISS_REASONS.map((r) => (
                    <Option key={r.value} value={r.value}>
                      {r.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDismissing(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={!reason || decide.isPending}
                onClick={() => {
                  if (dismissing && reason) decide.mutate({ entry: dismissing, decision: "dismiss", why: reason });
                  setDismissing(null);
                }}
              >
                Dismiss
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={results !== null} onOpenChange={(_, d) => !d.open && setResults(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Results</DialogTitle>
            <DialogContent>
              <ul className={styles.results}>
                {(results ?? []).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setResults(null)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <OutreachDraftDrawer entry={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}
