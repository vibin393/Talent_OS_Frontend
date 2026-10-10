"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Spinner,
  Switch,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { AppLink } from "@/components/app-link";
import { errorMessage } from "@/lib/api/errors";
import { type AccessDecision, type AccessReviewItem, consoleApi, consoleKeys } from "../api";
import {
  canCompleteReview,
  decisionColor,
  decisionLabel,
  reviewItemKindLabel,
  REVIEW_ITEM_KIND_FILTERS,
  reviewStatusColor,
  reviewStatusLabel,
  staleBadge,
} from "../logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px" },
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "end" },
  actions: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
});

/** `/admin/integrations/access-reviews/[id]` — a review with its items (keep / reduce / revoke) and completion. */
export function AccessReviewDetailPage({ reviewId }: { reviewId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canManage = usePermission("integration:manage");
  const [staleOnly, setStaleOnly] = useState(false);
  const [kind, setKind] = useState("");
  const [decide, setDecide] = useState<{ item: AccessReviewItem; decision: AccessDecision } | null>(null);

  const query = `${staleOnly ? "stale" : "all"}|${kind}`;
  const reviews = useQuery({ queryKey: consoleKeys.reviews, queryFn: ({ signal }) => consoleApi.reviews(signal), enabled: canManage });
  const items = useQuery({
    queryKey: consoleKeys.reviewItems(reviewId, query),
    queryFn: ({ signal }) => consoleApi.reviewItems(reviewId, { stale_only: staleOnly || undefined, kind: kind || null }, signal),
    enabled: canManage,
  });
  const review = reviews.data?.find((r) => r.id === reviewId);

  const complete = useMutation({
    mutationFn: () => consoleApi.completeReview(reviewId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: consoleKeys.all });
      toast.success("Review completed.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canManage) {
    return (
      <>
        <PageHeader title="Access review" />
        <NoAccess what="access reviews" />
      </>
    );
  }

  const open = review?.status === "open";
  const columns: TableColumnDefinition<AccessReviewItem>[] = [
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Type", renderCell: (i) => reviewItemKindLabel(i.kind) }),
    createTableColumn({
      columnId: "subject",
      renderHeaderCell: () => "Access",
      renderCell: (i) => {
        const name = typeof i.snapshot?.name === "string" ? i.snapshot.name : null;
        const scopes = Array.isArray(i.snapshot?.scopes) ? (i.snapshot.scopes as string[]).join(", ") : null;
        return (
          <div>
            <Text weight="semibold">{name ?? i.subject_id}</Text>
            {scopes ? (
              <>
                <br />
                <Text size={200}>{scopes}</Text>
              </>
            ) : null}
            {staleBadge(i) ? (
              <>
                {" "}
                <Badge appearance="tint" color="warning" size="small">
                  {staleBadge(i)}
                </Badge>
              </>
            ) : null}
          </div>
        );
      },
    }),
    createTableColumn({
      columnId: "decision",
      renderHeaderCell: () => "Decision",
      renderCell: (i) => (
        <Badge appearance="tint" color={decisionColor(i.decision)}>
          {decisionLabel(i.decision)}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (i) =>
        open ? (
          <div className={styles.actions}>
            <Button size="small" onClick={() => setDecide({ item: i, decision: "confirmed" })}>
              Keep
            </Button>
            <Button size="small" onClick={() => setDecide({ item: i, decision: "reduced" })}>
              Reduce access
            </Button>
            <Button size="small" appearance="outline" onClick={() => setDecide({ item: i, decision: "revoked" })}>
              Revoke
            </Button>
          </div>
        ) : null,
    }),
  ];

  const completable = review && items.data ? canCompleteReview(review, items.data) : false;

  return (
    <div className={styles.root}>
      <PageHeader
        title="Access review"
        subtitle={review ? `${review.period_start} – ${review.period_end}` : undefined}
      />
      <AppLink href="/admin/integrations/access-reviews">&larr; All access reviews</AppLink>
      {review ? (
        <div style={{ display: "flex", gap: tokens.spacingHorizontalM, alignItems: "center", flexWrap: "wrap" }}>
          <Badge appearance="tint" color={reviewStatusColor(review.status)}>
            {reviewStatusLabel(review.status)}
          </Badge>
          <Text>
            {review.decided_count} of {review.item_count} decided
          </Text>
          {open ? (
            <Button
              appearance="primary"
              disabled={!completable || complete.isPending}
              icon={complete.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => complete.mutate()}
            >
              Complete review
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className={styles.filters}>
        <Switch label="Stale only" checked={staleOnly} onChange={(_, d) => setStaleOnly(d.checked)} />
        <Field label="Type">
          <Dropdown
            selectedOptions={[kind]}
            value={REVIEW_ITEM_KIND_FILTERS.find((o) => o.value === kind)?.label ?? "All types"}
            onOptionSelect={(_, d) => setKind(String(d.optionValue))}
            style={{ minWidth: 200 }}
          >
            {REVIEW_ITEM_KIND_FILTERS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>

      {reviews.error ? <ErrorBar message={errorMessage(reviews.error)} /> : null}
      <AdminGrid
        items={items.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={items.isPending}
        error={items.error}
        emptyText="No items match these filters."
        label="Access review items"
      />
      {decide ? <DecideDialog item={decide.item} decision={decide.decision} reviewId={reviewId} query={query} onClose={() => setDecide(null)} /> : null}
    </div>
  );
}

const DECISION_TITLES: Record<AccessDecision, string> = {
  confirmed: "Keep this access?",
  reduced: "Reduce this access?",
  revoked: "Revoke this access?",
};

function DecideDialog({
  item,
  decision,
  reviewId,
  query,
  onClose,
}: {
  item: AccessReviewItem;
  decision: AccessDecision;
  reviewId: string;
  query: string;
  onClose: () => void;
}) {
  const toast = useAppToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const reasonRequired = decision === "revoked";
  const error = reasonRequired && note.trim().length === 0 ? "A reason is required to revoke access." : null;
  const m = useMutation({
    mutationFn: () => consoleApi.decideItem(item.id, decision, note.trim() || null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: consoleKeys.reviewItems(reviewId, query) });
      void qc.invalidateQueries({ queryKey: consoleKeys.reviews });
      toast.success("Decision recorded.");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{DECISION_TITLES[decision]}</DialogTitle>
          <DialogContent>
            {decision === "reduced" ? (
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>
                Reducing access re-opens the app&apos;s grant screen so a human can choose fewer scopes. Record why below.
              </Body1>
            ) : null}
            <Field label={reasonRequired ? "Reason" : "Note (optional)"} required={reasonRequired} validationState={error ? "error" : "none"} validationMessage={error ?? undefined}>
              <Textarea value={note} maxLength={500} onChange={(_, d) => setNote(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={m.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={m.isPending || !!error} icon={m.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => !error && m.mutate()}>
              {decisionLabel(decision === "confirmed" ? "confirmed" : decision)}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
