"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Link,
  makeStyles,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Switch,
  Textarea,
  Toast,
  ToastTitle,
  ToastTrigger,
  tokens,
  useToastController,
} from "@fluentui/react-components";
import { PeopleSearch24Regular } from "@fluentui/react-icons";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar, GridSkeleton, NoAccess, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { APP_TOASTER_ID, useAppToast } from "@/components/toast";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { DismissReason, MatchOut } from "@/lib/api/types";
import { MATCH_PAGE_SIZE, matchingApi, matchingKeys } from "./api";
import { FunnelCard } from "./funnel-card";
import { MatchCard } from "./match-card";
import { DISMISS_REASONS } from "./score";
import { BenchSection } from "@/features/bench/bench-section";
import { MatchingPoolsBadge } from "@/features/talent-pools/demand-pools-tab";
import { MatchSections } from "@/features/mobility/match-sections";

const useStyles = makeStyles({
  toolbar: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalS },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

const POLL_MS = 5000;
/** After a recompute request, poll this long for the run to show up. */
const POLL_WINDOW_MS = 60_000;

function DismissDialog({
  match,
  onClose,
  onConfirm,
}: {
  match: MatchOut | null;
  onClose: () => void;
  onConfirm: (reason: DismissReason, note: string) => Promise<unknown>;
}) {
  const styles = useStyles();
  const [reason, setReason] = useState<DismissReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={!!match} onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Dismiss {match?.candidate.display_name || "this candidate"}?</DialogTitle>
          <DialogContent>
            <div className={styles.form}>
              <Body1>Dismissed matches are hidden from the ranking; you can restore them later.</Body1>
              <Field label="Reason" required>
                <RadioGroup value={reason} onChange={(_, d) => setReason(d.value as DismissReason)}>
                  {DISMISS_REASONS.map((r) => (
                    <Radio key={r.value} value={r.value} label={r.label} />
                  ))}
                </RadioGroup>
              </Field>
              <Field label="Note (optional)">
                <Textarea value={note} maxLength={1000} resize="vertical" onChange={(_, d) => setNote(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!reason || busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                if (!reason) return;
                setBusy(true);
                try {
                  await onConfirm(reason, note.trim());
                  onClose();
                } catch {
                  // Reported by the caller; keep the dialog open.
                } finally {
                  setBusy(false);
                }
              }}
            >
              Dismiss
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Demand **Matches** tab: rediscovery funnel + ranked matches with sub-scores, explanations and actions. */
export function MatchesView({ demandId, onOpenPipeline }: { demandId: string; onOpenPipeline?: () => void }) {
  const styles = useStyles();
  const canRead = usePermission("match:read");
  const canWrite = usePermission("match:write");
  const toast = useAppToast();
  const { dispatchToast } = useToastController(APP_TOASTER_ID);
  const queryClient = useQueryClient();
  const [showDismissed, setShowDismissed] = useState(false);
  const [page, setPage] = useState(1);
  const [pollUntil, setPollUntil] = useState(0);
  const [dismissing, setDismissing] = useState<MatchOut | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const matches = useQuery({
    queryKey: matchingKeys.list(demandId, showDismissed, page),
    queryFn: ({ signal }) => matchingApi.list(demandId, showDismissed, page, signal),
    enabled: canRead,
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.last_run?.status === "running" || Date.now() < pollUntil ? POLL_MS : false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: matchingKeys.demand(demandId) });

  const recompute = useMutation({
    mutationFn: () => matchingApi.recompute(demandId),
    onSuccess: (out) => {
      if (out.status === "queued" || out.status === "running") {
        setPollUntil(Date.now() + POLL_WINDOW_MS);
        toast.info("Recomputing matches…");
      } else if (out.status === "skipped") {
        toast.info("Matches are already up to date.");
      } else if (out.status === "failed") {
        toast.error("Recompute failed. Try again later.");
      }
      void invalidate();
    },
    onError: (e) =>
      toast.error(
        isApiError(e) && e.code === "demand_not_open"
          ? "Matches are computed for open demands only."
          : errorMessage(e, "Could not recompute matches."),
      ),
  });

  const restore = async (match: MatchOut, silent = false) => {
    setBusyId(match.id);
    try {
      await matchingApi.restore(match.id);
      if (!silent) toast.success("Match restored.");
    } catch (e) {
      toast.error(errorMessage(e, "Could not restore the match."));
    } finally {
      setBusyId(null);
      void invalidate();
    }
  };

  const dismiss = async (match: MatchOut, reason: DismissReason, note: string) => {
    try {
      await matchingApi.dismiss(match.id, { reason, note: note || null });
    } catch (e) {
      toast.error(errorMessage(e, "Could not dismiss the match."));
      throw e;
    }
    void invalidate();
    dispatchToast(
      <Toast>
        <ToastTitle
          action={
            <ToastTrigger>
              <Link onClick={() => void restore(match, true)}>Undo</Link>
            </ToastTrigger>
          }
        >
          {match.candidate.display_name || "Candidate"} dismissed
        </ToastTitle>
      </Toast>,
      { intent: "success", timeout: 8000 },
    );
  };

  const add = async (match: MatchOut) => {
    setBusyId(match.id);
    try {
      await matchingApi.addToPipeline(match.id);
      toast.success(`${match.candidate.display_name || "Candidate"} added to the pipeline.`);
    } catch (e) {
      toast.error(
        isApiError(e) && e.code === "pipeline_unavailable"
          ? "The pipeline is not available yet."
          : errorMessage(e, "Could not add to the pipeline."),
      );
    } finally {
      setBusyId(null);
      void invalidate();
    }
  };

  if (!canRead) return <NoAccess what="matches" />;
  if (matches.isPending) return <GridSkeleton rows={6} />;
  if (matches.isError) {
    return <ErrorBar title="Could not load matches." message={errorMessage(matches.error)} />;
  }

  const data = matches.data;
  return (
    <>
      <BenchSection demandId={demandId} />
      <FunnelCard
        funnel={data.funnel}
        lastRun={data.last_run}
        canRecompute={canWrite}
        recomputing={recompute.isPending}
        onRecompute={() => recompute.mutate()}
        footExtra={<MatchingPoolsBadge demandId={demandId} />}
      />
      <div className={styles.toolbar}>
        <Switch
          label="Show dismissed"
          checked={showDismissed}
          onChange={(_, d) => {
            setShowDismissed(d.checked);
            setPage(1);
          }}
        />
        {matches.isFetching && <Spinner size="extra-tiny" aria-label="Refreshing" />}
      </div>

      {/* Epic 41: optional sections (e.g. "Internal (3)") above the ranked list. */}
      <MatchSections<MatchOut>
        data={data}
        renderItem={(m, i) => (
          <MatchCard
            match={m}
            rank={m.rank ?? i + 1}
            canWrite={canWrite}
            canAddToPipeline={data.can_add_to_pipeline}
            busy={busyId === m.id}
            onAdd={() => void add(m)}
            onDismiss={() => setDismissing(m)}
            onRestore={() => void restore(m)}
            onOpenPipeline={onOpenPipeline}
          />
        )}
      />
      {data.items.length === 0 ? (
        <Card style={{ maxWidth: 560 }}>
          <CardHeader
            image={<PeopleSearch24Regular aria-hidden />}
            header={<Subtitle2 as="h2">No matches yet</Subtitle2>}
            description={
              <Body1>
                {data.last_run?.status === "running"
                  ? "Ranking your talent pool against this demand…"
                  : "Matches appear when the demand is Open and candidates fit its requirements."}
              </Body1>
            }
          />
        </Card>
      ) : (
        <div className={styles.list}>
          {data.items.map((m, i) => (
            <MatchCard
              key={m.id}
              match={m}
              rank={m.rank ?? (page - 1) * MATCH_PAGE_SIZE + i + 1}
              canWrite={canWrite}
              canAddToPipeline={data.can_add_to_pipeline}
              busy={busyId === m.id}
              onAdd={() => void add(m)}
              onDismiss={() => setDismissing(m)}
              onRestore={() => void restore(m)}
              onOpenPipeline={onOpenPipeline}
            />
          ))}
          <PagingBar page={page} pageSize={MATCH_PAGE_SIZE} total={data.total} onPageChange={setPage} busy={matches.isFetching} />
        </div>
      )}

      <DismissDialog
        key={dismissing?.id ?? "none"}
        match={dismissing}
        onClose={() => setDismissing(null)}
        onConfirm={(reason, note) => (dismissing ? dismiss(dismissing, reason, note) : Promise.resolve())}
      />
    </>
  );
}
