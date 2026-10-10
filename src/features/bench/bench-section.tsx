"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { matchingApi } from "@/features/matching/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { benchDaysLabel, costText, formatDate, sectionItems } from "./format";
import type { BenchMatchItem } from "./types";
import { useBenchMatches, useBenchReviewMutations } from "./use-bench-matches";

const useStyles = makeStyles({
  root: { marginBottom: tokens.spacingVerticalL },
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  card: { display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  who: { display: "flex", flexDirection: "column", minWidth: "180px", flex: "1 1 220px" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  strong: { borderLeft: `3px solid ${tokens.colorBrandStroke1}` },
});

function scoreColor(item: BenchMatchItem): "success" | "brand" | "informative" {
  if (item.strong) return "success";
  return item.overall !== null && item.overall >= 50 ? "brand" : "informative";
}

function DismissDialog({ item, busy, onClose, onConfirm }: {
  item: BenchMatchItem | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!item} onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Dismiss {item?.candidate.display_name ?? "this worker"} for this demand?</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea value={reason} maxLength={1000} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!reason.trim() || busy} onClick={() => onConfirm(reason.trim())}>
              Dismiss
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Collapsible **Bench** section above the demand's main match list (FR-126). Order comes from the API. */
export function BenchSection({ demandId }: { demandId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const canRead = usePermission("bench:read");
  const canReview = usePermission("bench:review_matches");
  const canAdd = usePermission("match:write");
  const q = useBenchMatches(demandId, canRead);
  const { review, complete } = useBenchReviewMutations(demandId);
  const [dismissing, setDismissing] = useState<BenchMatchItem | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  if (!canRead) return null;
  // A non-open demand has no bench section (409 demand_not_open); other errors leave the main list usable.
  if (q.isError) return null;
  if (q.isPending) return <Spinner size="tiny" label="Loading bench matches" />;
  const data = q.data;
  const decide = (item: BenchMatchItem, decision: "reviewed" | "dismissed", reason: string | null) =>
    review.mutate(
      { candidateId: item.candidate.id, decision, reason },
      {
        onSuccess: () => {
          setDismissing(null);
          toast.success(decision === "reviewed" ? "Marked reviewed." : "Dismissed.");
        },
        onError: (e) => toast.error(errorMessage(e, "Could not save the review.")),
      },
    );
  const addToPipeline = async (item: BenchMatchItem) => {
    if (!item.match_id) return;
    setAdding(item.match_id);
    try {
      await matchingApi.addToPipeline(item.match_id);
      toast.success(`${item.candidate.display_name ?? "Worker"} added to the pipeline.`);
      void q.refetch();
    } catch (e) {
      toast.error(errorMessage(e, "Could not add to the pipeline."));
    } finally {
      setAdding(null);
    }
  };
  return (
    <section className={styles.root} aria-label="Bench matches">
      <Accordion collapsible defaultOpenItems={["bench"]}>
        <AccordionItem value="bench">
          <AccordionHeader>
            <Text weight="semibold">Bench ({data.items.length})</Text>
          </AccordionHeader>
          <AccordionPanel>
            {data.unreviewed_strong > 0 && !data.reviewed_complete && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  {data.unreviewed_strong} strong bench match{data.unreviewed_strong === 1 ? "" : "es"} not yet reviewed
                </MessageBarBody>
              </MessageBar>
            )}
            {canReview && !data.reviewed_complete && (
              <MessageBar intent="info">
                <MessageBarBody>Confirm the bench was considered before releasing to vendors.</MessageBarBody>
                <MessageBarActions>
                  <Button
                    size="small"
                    disabled={complete.isPending}
                    onClick={() =>
                      complete.mutate(undefined, {
                        onSuccess: () => toast.success("Bench matches marked reviewed."),
                        onError: (e) =>
                          toast.error(
                            isApiError(e) && e.code === "bench_matches_unreviewed"
                              ? "Review or dismiss every strong bench match first."
                              : errorMessage(e),
                          ),
                      })
                    }
                  >
                    Mark bench reviewed
                  </Button>
                </MessageBarActions>
              </MessageBar>
            )}
            {data.reviewed_complete && (
              <MessageBar intent="success">
                <MessageBarBody>Bench matches reviewed {formatDate(data.completed_at)}.</MessageBarBody>
              </MessageBar>
            )}
            {data.items.length === 0 ? (
              <Body1 className={styles.muted}>No one is on the bench or rolling off soon.</Body1>
            ) : (
              <div className={styles.list}>
                {sectionItems(data.items).map((item) => (
                  <Card key={item.candidate.id} className={mergeClasses(styles.card, item.strong && styles.strong)} size="small">
                    <div className={styles.who}>
                      <Text weight="semibold">{item.candidate.display_name ?? item.candidate.human_id ?? "Worker"}</Text>
                      <Caption1 className={styles.muted}>
                        {[item.candidate.current_title, item.candidate.city].filter(Boolean).join(" · ") || "—"}
                      </Caption1>
                    </div>
                    <div className={styles.badges}>
                      {item.score_pending ? (
                        <Spinner size="extra-tiny" label="Scoring" />
                      ) : item.overall !== null ? (
                        <Badge appearance="filled" color={scoreColor(item)}>
                          Match {Math.round(item.overall)}
                        </Badge>
                      ) : (
                        <Badge appearance="outline" color="informative">
                          {item.score_unavailable_reason === "no_consent" ? "No AI consent" : "Not scored"}
                        </Badge>
                      )}
                      {item.pool === "rolling_off" ? (
                        <Badge appearance="tint" color="important">
                          Rolling off {formatDate(item.rolling_off_end_date)}
                        </Badge>
                      ) : (
                        <Badge appearance="tint" color="warning">
                          {benchDaysLabel(item.bench_days)}
                        </Badge>
                      )}
                      {item.review_decision && (
                        <Badge appearance="outline" color={item.review_decision === "reviewed" ? "success" : "subtle"}>
                          {item.review_decision === "reviewed" ? "Reviewed" : "Dismissed"}
                        </Badge>
                      )}
                    </div>
                    {!item.cost_masked && item.pool === "bench" && (
                      <Caption1>{costText(item.cost_per_day, item.cost_currency, false)}/day</Caption1>
                    )}
                    <div className={styles.actions}>
                      {canAdd && item.match_id && !item.application_id && (
                        <Button size="small" disabled={adding === item.match_id} onClick={() => void addToPipeline(item)}>
                          Add to pipeline
                        </Button>
                      )}
                      {canReview && (
                        <>
                          <Button size="small" disabled={review.isPending} onClick={() => decide(item, "reviewed", null)}>
                            Mark reviewed
                          </Button>
                          <Button size="small" appearance="subtle" onClick={() => setDismissing(item)}>
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      <DismissDialog
        key={dismissing?.candidate.id ?? "none"}
        item={dismissing}
        busy={review.isPending}
        onClose={() => setDismissing(null)}
        onConfirm={(reason) => dismissing && decide(dismissing, "dismissed", reason)}
      />
    </section>
  );
}
