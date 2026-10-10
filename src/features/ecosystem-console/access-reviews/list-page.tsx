"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type AccessReview, type AccessReviewSettings, consoleApi, consoleKeys } from "../api";
import { AUTO_REVOKE_WARNING, reviewStatusColor, reviewStatusLabel } from "../logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1000px" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "end" },
});

/** `/admin/integrations/access-reviews` — review list and the review settings (Epic 79 story 79.2, FR-406). */
export function AccessReviewsPage() {
  const styles = useStyles();
  const router = useRouter();
  const canManage = usePermission("integration:manage");
  const reviews = useQuery({ queryKey: consoleKeys.reviews, queryFn: ({ signal }) => consoleApi.reviews(signal), enabled: canManage });

  if (!canManage) {
    return (
      <>
        <PageHeader title="Access reviews" />
        <NoAccess what="access reviews" />
      </>
    );
  }

  const columns: TableColumnDefinition<AccessReview>[] = [
    createTableColumn({
      columnId: "period",
      renderHeaderCell: () => "Period",
      renderCell: (r) => (
        <Text weight="semibold">
          {r.period_start} – {r.period_end}
        </Text>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={reviewStatusColor(r.status)}>
          {reviewStatusLabel(r.status)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "items", renderHeaderCell: () => "Items", renderCell: (r) => r.item_count }),
    createTableColumn({ columnId: "decided", renderHeaderCell: () => "Decided", renderCell: (r) => `${r.decided_count} / ${r.item_count}` }),
    createTableColumn({ columnId: "opened", renderHeaderCell: () => "Due", renderCell: (r) => formatDateTime(r.completed_at ?? r.opened_at) }),
  ];

  return (
    <div className={styles.root}>
      <PageHeader title="Access reviews" subtitle="Review who and what still has access, every quarter." />
      <SettingsCard />
      <AdminGrid
        items={reviews.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={reviews.isPending}
        error={reviews.error}
        emptyText="No access reviews have been opened yet."
        label="Access reviews"
        onRowClick={(r) => router.push(`/admin/integrations/access-reviews/${r.id}`)}
      />
    </div>
  );
}

function SettingsCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: consoleKeys.reviewSettings, queryFn: ({ signal }) => consoleApi.reviewSettings(signal) });
  const [draft, setDraft] = useState<AccessReviewSettings | null>(null);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: AccessReviewSettings) => consoleApi.setReviewSettings(body),
    onSuccess: (next) => {
      qc.setQueryData(consoleKeys.reviewSettings, next);
      setDraft(next);
      toast.success("Access review settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.error)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  if (!draft) return null;

  return (
    <Card>
      <CardHeader header={<Subtitle2>Review settings</Subtitle2>} />
      <div className={styles.card}>
        <div className={styles.row}>
          <Field label="Review every (months)">
            <SpinButton
              min={1}
              max={12}
              value={draft.cadence_months}
              onChange={(_, d) => {
                const v = d.value ?? Number(d.displayValue);
                if (typeof v === "number" && !Number.isNaN(v)) setDraft({ ...draft, cadence_months: v });
              }}
            />
          </Field>
          <Field label="Flag as stale after (days)">
            <SpinButton
              min={1}
              max={3650}
              value={draft.stale_after_days}
              onChange={(_, d) => {
                const v = d.value ?? Number(d.displayValue);
                if (typeof v === "number" && !Number.isNaN(v)) setDraft({ ...draft, stale_after_days: v });
              }}
            />
          </Field>
        </div>
        <Switch
          label="Revoke stale access automatically after 14 days"
          checked={draft.auto_revoke_stale}
          onChange={(_, d) => setDraft({ ...draft, auto_revoke_stale: d.checked })}
        />
        {draft.auto_revoke_stale ? (
          <MessageBar intent="warning">
            <MessageBarBody>{AUTO_REVOKE_WARNING}</MessageBarBody>
          </MessageBar>
        ) : null}
        <Body1>
          <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate(draft)}>
            Save
          </Button>
        </Body1>
      </div>
    </Card>
  );
}
