"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  Textarea,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, Dismiss20Regular, Pause20Regular, Play20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { reasonLabel } from "@/features/audiences/logic";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { campaignsApi, marketingKeys } from "./api";
import { CopyBanner } from "./copy/copy-banner";
import { DraftCopyButton } from "./copy/request-dialog";
import { CampaignStatusBadge } from "./campaigns-view";
import { FunnelChart } from "./funnel-chart";
import { campaignErrorMessage, campaignTimeline, canCancel, canPause, canResume, channelLabel, formatRate } from "./logic";
import type { CampaignMessageOut, CampaignOut } from "./types";

const PAGE_SIZE = 50;

const MESSAGE_STATUSES = ["queued", "deferred", "sent", "delivered", "bounced", "failed", "suppressed", "cancelled"];

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
    "@media (max-width: 1000px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  timeline: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  timelineItem: {
    borderLeftWidth: "2px",
    borderLeftStyle: "solid",
    borderLeftColor: tokens.colorBrandStroke1,
    paddingInlineStart: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
  },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { marginBottom: tokens.spacingVerticalL },
  toolbar: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-end", marginBottom: tokens.spacingVerticalS, flexWrap: "wrap" },
  variants: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: tokens.spacingHorizontalL },
});

/** `/marketing/campaigns/[id]`: status, timeline, funnel, messages and Pause / Resume / Cancel. */
export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const styles = useStyles();
  const canRead = usePermission("campaign:read");
  const query = useQuery({
    queryKey: marketingKeys.campaign(campaignId),
    queryFn: ({ signal }) => campaignsApi.get(campaignId, signal),
    enabled: canRead,
    refetchInterval: (q) => (q.state.data?.status === "sending" ? 15_000 : false),
  });
  if (!canRead) return <NoAccess what="campaigns" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/marketing/campaigns">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Campaigns
      </AppLink>
    </div>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Campaign not found</Subtitle2>} description={<Body1>It may have been removed.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this campaign." message={errorMessage(query.error)} />
        )}
      </>
    );
  return (
    <>
      {back}
      <CampaignBody campaign={query.data} />
    </>
  );
}

type Confirm = "pause" | "resume" | "cancel" | "submit" | null;

function CampaignBody({ campaign: c }: { campaign: CampaignOut }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canWrite = usePermission("campaign:write");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns });
  const analytics = useQuery({
    queryKey: marketingKeys.analytics(c.id),
    queryFn: ({ signal }) => campaignsApi.analytics(c.id, signal),
    enabled: c.status !== "draft",
  });
  const testSend = useMutation({
    mutationFn: () => campaignsApi.testSend(c.id),
    onSuccess: (r) => (r.queued ? toast.success(r.message || "Test sent to you.") : toast.error(r.message || "The test was not sent.")),
    onError: (e) => toast.error(campaignErrorMessage(e) ?? errorMessage(e, "Could not send the test.")),
  });

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      invalidate();
    } catch (e) {
      toast.error(campaignErrorMessage(e) ?? errorMessage(e, "That did not work."));
      throw e;
    }
  };

  const timeline = campaignTimeline(c);
  const f = analytics.data;

  return (
    <>
      <div className={styles.header}>
        <Title2 as="h1">{c.name}</Title2>
        <CampaignStatusBadge status={c.status} />
        <Badge appearance="outline" color="informative">
          {channelLabel(c.channel)}
        </Badge>
        <span className={styles.grow} />
        {canWrite && (
          <div className={styles.actions}>
            {c.status === "draft" && (
              <>
                <DraftCopyButton campaignId={c.id} audienceId={c.audience_id} channel={c.channel} />
                <Button icon={<Send20Regular />} disabled={testSend.isPending} onClick={() => testSend.mutate()}>
                  Send test to me
                </Button>
                <Button appearance="primary" onClick={() => setConfirm("submit")}>
                  Submit
                </Button>
              </>
            )}
            {canPause(c) && (
              <Button icon={<Pause20Regular />} onClick={() => setConfirm("pause")}>
                Pause
              </Button>
            )}
            {canResume(c) && (
              <Button icon={<Play20Regular />} onClick={() => setConfirm("resume")}>
                Resume
              </Button>
            )}
            {canCancel(c) && (
              <Button icon={<Dismiss20Regular />} onClick={() => setConfirm("cancel")}>
                Cancel campaign
              </Button>
            )}
          </div>
        )}
      </div>
      <CopyBanner campaignId={c.id} className={styles.section} />
      {c.status === "pending_approval" && (
        <MessageBar intent="warning" className={styles.section}>
          <MessageBarBody>Waiting for approval. Nothing is sent until it is approved.</MessageBarBody>
        </MessageBar>
      )}
      {c.cancel_reason && (
        <MessageBar intent="info" className={styles.section}>
          <MessageBarBody>Cancelled: {c.cancel_reason}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.grid}>
        <Card>
          <CardHeader header={<Subtitle2 as="h2">Funnel</Subtitle2>} />
          {c.status === "draft" ? (
            <Text className={styles.muted}>Results appear once the campaign starts sending.</Text>
          ) : analytics.isPending ? (
            <GridSkeleton rows={4} />
          ) : analytics.isError ? (
            <ErrorBar title="Could not load results." message={errorMessage(analytics.error)} />
          ) : (
            f && <FunnelChart counts={f.counts} rates={f.rates} />
          )}
        </Card>
        <Card>
          <CardHeader header={<Subtitle2 as="h2">Timeline</Subtitle2>} />
          <ol className={styles.timeline}>
            {timeline.map((t) => (
              <li key={t.label} className={styles.timelineItem}>
                <Text weight="semibold">{t.label}</Text>
                <Text size={200} className={styles.muted}>
                  {formatDateTime(t.at)}
                </Text>
              </li>
            ))}
          </ol>
          <dl className={admin.detailList}>
            <dt>Audience</dt>
            <dd>
              <AppLink href={`/marketing/audiences/${c.audience_id}`}>{c.audience_name ?? "Open audience"}</AppLink>
            </dd>
            {c.email_subject && (
              <>
                <dt>Subject</dt>
                <dd>{c.email_subject}</dd>
              </>
            )}
            {c.ab_test && (
              <>
                <dt>A/B test</dt>
                <dd>
                  {c.ab_test.sample_pct}% sample by {c.ab_test.metric}s, {c.ab_test.window_hours} h
                  {c.ab_test.winner_key ? `. Winner: ${c.ab_test.winner_key}` : ""}
                </dd>
              </>
            )}
          </dl>
        </Card>
      </div>
      {f && f.variants.length > 0 && (
        <Card className={styles.section}>
          <CardHeader header={<Subtitle2 as="h2">A/B variants</Subtitle2>} />
          <div className={styles.variants}>
            {f.variants.map((v) => (
              <div key={v.key}>
                <Text weight="semibold">
                  {v.label} · open {formatRate(v.rates.open_rate)} · click {formatRate(v.rates.click_rate)}
                </Text>
                <FunnelChart counts={v.counts} rates={v.rates} label={`Variant ${v.key} funnel`} opensApproximate={false} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {f && Object.keys(f.suppressed_by_reason).length > 0 && (
        <Card className={styles.section}>
          <CardHeader header={<Subtitle2 as="h2">Suppressed</Subtitle2>} />
          <dl className={admin.detailList}>
            {Object.entries(f.suppressed_by_reason).map(([r, n]) => (
              <div key={r} style={{ display: "contents" }}>
                <dt>{reasonLabel(r)}</dt>
                <dd>{n.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {c.status !== "draft" && <MessagesGrid campaignId={c.id} />}

      <ConfirmDialog open={confirm === "submit"} title="Submit this campaign?" confirmLabel="Submit" onClose={() => setConfirm(null)} onConfirm={() => act(() => campaignsApi.submit(c.id, c.scheduled_at), "Campaign submitted.")}>
        Large campaigns go to approval first. Consent, opt-outs and frequency caps are checked before each message.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "pause"} title="Pause this campaign?" confirmLabel="Pause" onClose={() => setConfirm(null)} onConfirm={() => act(() => campaignsApi.pause(c.id), "Campaign paused.")}>
        Unsent messages wait until you resume.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "resume"} title="Resume this campaign?" confirmLabel="Resume" onClose={() => setConfirm(null)} onConfirm={() => act(() => campaignsApi.resume(c.id), "Campaign resumed.")}>
        Sending continues within the allowed send hours.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "cancel"}
        title="Cancel this campaign?"
        confirmLabel="Cancel campaign"
        onClose={() => {
          setConfirm(null);
          setReason("");
        }}
        onConfirm={() => {
          if (!reason.trim()) return Promise.reject(new Error("reason"));
          return act(() => campaignsApi.cancel(c.id, reason.trim()), "Campaign cancelled.");
        }}
      >
        <Field label="Reason" required hint="All unsent messages are stopped. This cannot be undone.">
          <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function MessagesGrid({ campaignId }: { campaignId: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const messages = useQuery({
    queryKey: marketingKeys.messages(campaignId, status, page),
    queryFn: ({ signal }) => campaignsApi.messages(campaignId, status, page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const columns: TableColumnDefinition<CampaignMessageOut>[] = [
    createTableColumn({ columnId: "candidate", renderHeaderCell: () => "Candidate", renderCell: (m) => (
      <AppLink href={`/candidates/${m.candidate_id}`}>{m.candidate_name ?? "Candidate"}</AppLink>
    ) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) => (
        <span className={admin.cellStack}>
          <Text size={200}>{m.status.replace(/_/g, " ")}</Text>
          {m.suppression_reason && <Text size={100} className={styles.muted}>{reasonLabel(m.suppression_reason)}</Text>}
          {m.defer_until && <Text size={100} className={styles.muted}>Until {formatDateTime(m.defer_until)}</Text>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "variant", renderHeaderCell: () => "Variant", renderCell: (m) => m.variant_key ?? "—" }),
    createTableColumn({ columnId: "sent", renderHeaderCell: () => "Sent", renderCell: (m) => formatDateTime(m.sent_at) }),
  ];
  return (
    <section aria-labelledby="campaign-messages">
      <div className={styles.toolbar}>
        <Subtitle2 as="h2" id="campaign-messages">
          Messages
        </Subtitle2>
        <span className={styles.grow} />
        <Dropdown
          aria-label="Message status"
          value={status ? status.replace(/_/g, " ") : "All statuses"}
          selectedOptions={[status ?? ""]}
          onOptionSelect={(_, d) => {
            setStatus(d.optionValue || null);
            setPage(1);
          }}
        >
          <Option value="">All statuses</Option>
          {MESSAGE_STATUSES.map((s) => (
            <Option key={s} value={s}>
              {s}
            </Option>
          ))}
        </Dropdown>
      </div>
      <AdminGrid
        items={messages.data?.items}
        columns={columns}
        getRowId={(m) => m.id}
        loading={messages.isPending}
        error={messages.error}
        emptyText="No messages match this filter."
        label="Campaign messages"
        footer={
          messages.data && (
            <PagingBar page={page} pageSize={PAGE_SIZE} total={messages.data.total} onPageChange={setPage} busy={messages.isFetching} />
          )
        }
      />
    </section>
  );
}
