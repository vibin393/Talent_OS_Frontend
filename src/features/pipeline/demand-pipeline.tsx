"use client";

import {
  Button,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  SearchBox,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { Board20Regular, Dismiss20Regular, List20Regular, PersonAdd20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ExportMenu } from "@/features/exports/export-menu";
import { SubmitWizard } from "@/features/submissions/submit-wizard";
import { errorMessage } from "@/lib/api/errors";
import { useDebounced } from "@/lib/use-debounced";
import type { ApplicationOut, BulkTransitionOut, DemandOut, PipelineBoardOut, PipelineReasonKind, PipelineStageOut } from "@/lib/api/types";
import { AddCandidatesDialog } from "./add-candidates-dialog";
import { pipelineApi, pipelineKeys } from "./api";
import { ApplicationDrawer, type DrawerAction } from "./application-drawer";
import { PipelineBoard } from "./board";
import { type BulkRequest, PipelineList } from "./list-view";
import { ReasonDialog, type ReasonValues } from "./reason-dialog";
import { dropAction, liveStages, pipelineErrorMessage } from "./transitions";
import { pipelineError, useTransitionApplication } from "./use-actions";
import { useBoard, useInvalidatePipeline, useStages } from "./use-pipeline";

const useStyles = makeStyles({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  grow: { flex: 1 },
  bar: { marginBottom: tokens.spacingVerticalM },
  list: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
});

type View = "board" | "list";
type ReasonRequest = { kind: PipelineReasonKind; apps: ApplicationOut[]; to: PipelineStageOut };
type BulkReport = { title: string; out: BulkTransitionOut; names: Map<string, string> };

/** Demand Pipeline tab: Board (Kanban) / List views, add candidates, bulk actions, drawer and wizard. */
export function DemandPipeline({ demand }: { demand: DemandOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePipeline();
  const canRead = usePermission("application:read");
  const canAdd = usePermission("application:create");
  const canMove = usePermission("application:move");
  const canReject = usePermission("application:reject");
  const canSubmit = usePermission("submission:create");
  const canConfirmRejection = usePermission("submission:update");

  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReasonRequest | null>(null);
  const [wizard, setWizard] = useState<ApplicationOut[] | null>(null);
  const [report, setReport] = useState<BulkReport | null>(null);
  const [clearSelection, setClearSelection] = useState<(() => void) | null>(null);

  const stagesQuery = useStages(true);
  const board = useBoard(demand.id, q);
  const transition = useTransitionApplication(demand.id);
  const stages = useMemo(() => liveStages(stagesQuery.data?.items ?? []), [stagesQuery.data]);
  const transitions = stagesQuery.data?.transitions;
  const stageByKey = (key: string) => stages.find((s) => s.key === key);
  const columns = useMemo(() => {
    const cols = board.data?.columns ?? [];
    return stageFilter ? cols.filter((c) => c.stage.id === stageFilter) : cols;
  }, [board.data, stageFilter]);

  if (!canRead) return <NoAccess what="this demand's pipeline" />;

  /** Optimistically move a card on the board, then call the API; a failure reverts via refetch. */
  const move = (app: ApplicationOut, to: PipelineStageOut, extra: Partial<ReasonValues> = {}) => {
    const key = pipelineKeys.boardQuery(demand.id, q);
    const previous = queryClient.getQueryData<PipelineBoardOut>(key);
    if (previous) {
      queryClient.setQueryData<PipelineBoardOut>(key, {
        ...previous,
        columns: previous.columns.map((c) => {
          if (c.stage.id === app.stage.id) return { ...c, count: c.count - 1, items: c.items.filter((i) => i.id !== app.id) };
          if (c.stage.id === to.id) {
            const moved: ApplicationOut = { ...app, stage: { id: to.id, key: to.key, label: to.label, kind: to.kind }, days_in_stage: 0 };
            return { ...c, count: c.count + 1, items: [moved, ...c.items] };
          }
          return c;
        }),
      });
    }
    return transition
      .mutateAsync({
        id: app.id,
        body: {
          to_stage_id: to.id,
          expected_stage_id: app.stage.id,
          reason_code: extra.reasonCode ?? null,
          note: extra.note || null,
          send_rejection_email: extra.sendRejectionEmail ?? false,
        },
      })
      .then(() => toast.success(`${app.candidate.full_name ?? "Candidate"} moved to ${to.label}.`))
      .catch((e) => {
        if (previous) queryClient.setQueryData(key, previous);
        toast.error(pipelineError(e));
        throw e;
      });
  };

  /** Route a requested stage change (drop, menu, drawer) to a move, the reason dialog or the wizard. */
  const request = (app: ApplicationOut, to: PipelineStageOut) => {
    const action = dropAction(app.stage, to, transitions);
    switch (action.kind) {
      case "move":
        move(app, to).catch(() => undefined);
        break;
      case "reason":
        setReason({ kind: action.reason, apps: [app], to });
        break;
      case "wizard":
        setWizard([app]);
        break;
      case "invalid":
        toast.info(action.why);
        break;
    }
  };

  const onAction = (app: ApplicationOut, a: DrawerAction) => {
    if (a.kind === "move") return request(app, a.stage);
    if (a.kind === "submit") return setWizard([app]);
    const key = a.kind === "reject" ? "rejected" : a.kind === "withdraw" ? "withdrawn" : "applied";
    const to = stageByKey(key);
    if (to) setReason({ kind: a.kind, apps: [app], to });
  };

  const runBulk = async (apps: ApplicationOut[], to: PipelineStageOut, values: Partial<ReasonValues>, title: string) => {
    try {
      const out = await pipelineApi.bulkTransition(demand.id, {
        application_ids: apps.map((a) => a.id),
        to_stage_id: to.id,
        reason_code: values.reasonCode ?? null,
        note: values.note || null,
        send_rejection_email: values.sendRejectionEmail ?? false,
      });
      setReport({ title, out, names: new Map(apps.map((a) => [a.id, a.candidate.full_name ?? a.human_id])) });
      clearSelection?.();
    } finally {
      await invalidate(demand.id);
    }
  };

  const onBulk = (req: BulkRequest, clear: () => void) => {
    setClearSelection(() => clear);
    if (req.kind === "submit") return setWizard(req.apps);
    if (req.kind === "move") {
      runBulk(req.apps, req.stage, {}, `Move to ${req.stage.label}`).catch((e) => toast.error(pipelineError(e)));
      return;
    }
    const to = stageByKey(req.kind === "reject" ? "rejected" : "withdrawn");
    if (to) setReason({ kind: req.kind, apps: req.apps, to });
  };

  const submitReason = async (values: ReasonValues) => {
    if (!reason) return;
    if (reason.apps.length === 1) {
      await move(reason.apps[0], reason.to, values);
    } else {
      await runBulk(reason.apps, reason.to, values, reason.kind === "reject" ? "Reject" : "Withdraw");
    }
  };

  const stageOptions = stages.map((s) => ({ id: s.id, label: s.label }));

  return (
    <>
      <div className={styles.toolbar}>
        <TabList
          size="small"
          selectedValue={view}
          onTabSelect={(_, d) => setView(d.value as View)}
          aria-label="Pipeline view"
        >
          <Tab value="board" icon={<Board20Regular />}>
            Board
          </Tab>
          <Tab value="list" icon={<List20Regular />}>
            List
          </Tab>
        </TabList>
        <SearchBox
          className={admin.search}
          placeholder="Search candidates in this pipeline"
          aria-label="Search candidates in this pipeline"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
        />
        <IdSelect label="Stage" className={admin.filter} options={stageOptions} value={stageFilter} onChange={setStageFilter} noneLabel="All stages" />
        <span className={styles.grow} />
        {view === "list" && (
          <ExportMenu
            kind="applications"
            filters={{
              demand_id: demand.id,
              ...(stageFilter && stages.find((s) => s.id === stageFilter)
                ? { stage: stages.find((s) => s.id === stageFilter)?.key }
                : {}),
            }}
          />
        )}
        {canAdd && (
          <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={() => setAdding(true)}>
            Add candidates
          </Button>
        )}
      </div>

      {report && (
        <div className={styles.bar} aria-live="polite">
          <MessageBar intent={report.out.items.some((i) => !i.ok) ? "warning" : "success"} layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>{report.title}</MessageBarTitle>
              {report.out.items.filter((i) => i.ok).length} succeeded, {report.out.items.filter((i) => !i.ok).length} failed.
              {report.out.items.some((i) => !i.ok) && (
                <ul className={styles.list}>
                  {report.out.items
                    .filter((i) => !i.ok)
                    .map((i) => (
                      <li key={i.application_id}>
                        {report.names.get(i.application_id) ?? i.application_id}:{" "}
                        {pipelineErrorMessage(
                          (i.error as { code?: string } | null)?.code,
                          String((i.error as { message?: string } | null)?.message ?? "Failed"),
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </MessageBarBody>
            <MessageBarActions containerAction={<Button appearance="transparent" aria-label="Dismiss" icon={<Dismiss20Regular />} onClick={() => setReport(null)} />} />
          </MessageBar>
        </div>
      )}

      {stagesQuery.isError && <ErrorBar title="Could not load the pipeline stages." message={errorMessage(stagesQuery.error)} />}

      {view === "board" ? (
        board.isPending ? (
          <GridSkeleton rows={6} />
        ) : board.isError ? (
          <ErrorBar title="Could not load the pipeline." message={errorMessage(board.error)} />
        ) : (
          <PipelineBoard
            columns={columns}
            transitions={transitions}
            onMove={request}
            onOpen={(a) => setOpenId(a.id)}
            onAction={(app, a) => onAction(app, a)}
            canMove={canMove}
            canSubmit={canSubmit}
            canReject={canReject}
            canConfirmRejection={canConfirmRejection}
          />
        )
      ) : (
        <PipelineList
          demandId={demand.id}
          q={q}
          stageId={stageFilter}
          stages={stages}
          onOpen={(a) => setOpenId(a.id)}
          onBulk={onBulk}
          canMove={canMove}
          canSubmit={canSubmit}
          canReject={canReject}
        />
      )}

      {adding && <AddCandidatesDialog demandId={demand.id} onClose={() => setAdding(false)} />}
      {openId && (
        <ApplicationDrawer
          applicationId={openId}
          stages={stages}
          transitions={transitions}
          onAction={onAction}
          onClose={() => setOpenId(null)}
        />
      )}
      {reason && (
        <ReasonDialog
          kind={reason.kind}
          subject={reason.apps.length === 1 ? (reason.apps[0].candidate.full_name ?? "candidate") : `${reason.apps.length} candidates`}
          onSubmit={submitReason}
          onClose={() => setReason(null)}
        />
      )}
      {wizard && <SubmitWizard demand={demand} apps={wizard} onClose={() => { setWizard(null); clearSelection?.(); }} />}
    </>
  );
}
