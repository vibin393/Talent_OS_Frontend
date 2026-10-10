"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Combobox,
  createTableColumn,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Gift20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, IdSelect, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { demandsApi } from "@/features/demands/api";
import { EMPTY_DEMAND_FILTERS } from "@/features/demands/query";
import { errorMessage } from "@/lib/api/errors";
import { referralsApi } from "./api";
import {
  canLinkDemand,
  canVoidReward,
  CHANNEL_LABELS,
  EMPTY_FILTERS,
  formatDate,
  formatMoney,
  INELIGIBLE_LABELS,
  REFERRAL_STATUSES,
  type ReferralFilters,
  REWARD_STATUS_COLORS,
  REWARD_STATUS_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./logic";
import type { ReferralChannel, ReferralOut, RewardOut } from "./types";
import { referralKeys, usePrograms, useReferral, useReferralPermissions, useReferrals } from "./use-referrals";

const PAGE_SIZE = 25;

const useStyles = makeStyles({
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Demand search `Combobox` (title or req id). */
export function DemandSearch({
  label,
  value,
  onChange,
  required,
  clearLabel,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null, label: string) => void;
  required?: boolean;
  clearLabel?: string;
}) {
  const [text, setText] = useState("");
  const q = useDeferredValue(text.trim());
  const demands = useQuery({
    queryKey: ["demands", "picker", q],
    queryFn: ({ signal }) => demandsApi.list({ ...EMPTY_DEMAND_FILTERS, q }, 20, signal),
    placeholderData: (prev) => prev,
  });
  const items = demands.data?.items ?? [];
  return (
    <Field label={label} required={required}>
      <Combobox
        freeform
        placeholder="Search openings by title or ID"
        value={text}
        selectedOptions={value ? [value] : []}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null, "");
        }}
        onOptionSelect={(_, d) => {
          if (d.optionValue === "__clear__") {
            setText("");
            onChange(null, "");
            return;
          }
          const dm = items.find((x) => x.id === d.optionValue);
          if (!dm) return;
          const l = `${dm.title} (${dm.req_id})`;
          setText(l);
          onChange(dm.id, l);
        }}
      >
        {clearLabel && <Option value="__clear__">{clearLabel}</Option>}
        {items.map((d) => (
          <Option key={d.id} value={d.id} text={`${d.title} (${d.req_id})`}>
            {`${d.title} (${d.req_id})`}
          </Option>
        ))}
      </Combobox>
    </Field>
  );
}

/** `/referrals`: every referral, with filters and a detail drawer (needs `referral:read`). */
export function ReferralsList() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const { canRead, canManage } = useReferralPermissions();
  const [filters, setFilters] = useState<ReferralFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useReferrals(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE, canRead);
  const programs = usePrograms(true, canRead);
  if (!canRead) return <NoAccess what="referrals" />;

  const setFilter = (k: keyof ReferralFilters, v: string | null) => {
    setFilters((prev) => ({ ...prev, [k]: v ?? "" }));
    setPage(1);
  };

  const columns: TableColumnDefinition<ReferralOut>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Referral",
      renderCell: (r) => (
        <div className={admin.cellStack}>
          <Text weight="semibold">{r.referee_name ?? "Referee (pending)"}</Text>
          <Caption1 className={admin.muted}>{r.human_id}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={STATUS_COLORS[r.status] ?? "informative"}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "demand", renderHeaderCell: () => "Opening", renderCell: (r) => r.demand_title ?? "General" }),
    createTableColumn({
      columnId: "referrer",
      renderHeaderCell: () => "Referrer",
      renderCell: (r) => `${r.referrer_name ?? "—"}${r.referrer_kind === "worker" ? " (worker)" : ""}`,
    }),
    createTableColumn({ columnId: "channel", renderHeaderCell: () => "Channel", renderCell: (r) => CHANNEL_LABELS[r.channel] ?? r.channel }),
    createTableColumn({ columnId: "program", renderHeaderCell: () => "Program", renderCell: (r) => r.program_name ?? "—" }),
    createTableColumn({
      columnId: "reward",
      renderHeaderCell: () => "Reward",
      renderCell: (r) =>
        r.reward ? (
          <Badge appearance="outline" color={REWARD_STATUS_COLORS[r.reward.status]}>
            {`${REWARD_STATUS_LABELS[r.reward.status]} · ${formatMoney(r.reward.amount, r.reward.currency)}`}
          </Badge>
        ) : (
          "—"
        ),
    }),
    createTableColumn({ columnId: "created", renderHeaderCell: () => "Referred", renderCell: (r) => formatDate(r.created_at) }),
  ];

  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Referrals" subtitle="Referrals from employees and workers, their status and rewards" />
        <Button icon={<Gift20Regular />} onClick={() => router.push("/referrals/rewards")}>
          Referral rewards
        </Button>
      </div>
      <div className={admin.toolbar}>
        <IdSelect
          className={admin.filter}
          label="Status"
          noneLabel="All statuses"
          value={filters.status || null}
          options={REFERRAL_STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s] }))}
          onChange={(v) => setFilter("status", v)}
        />
        <DemandSearch label="Opening" value={filters.demand_id || null} clearLabel="All openings" onChange={(id) => setFilter("demand_id", id)} />
        <IdSelect
          className={admin.filter}
          label="Program"
          noneLabel="All programs"
          value={filters.program_id || null}
          options={(programs.data ?? []).map((p) => ({ id: p.id, label: p.name }))}
          onChange={(v) => setFilter("program_id", v)}
        />
        <IdSelect
          className={admin.filter}
          label="Channel"
          noneLabel="All channels"
          value={filters.channel || null}
          options={(Object.keys(CHANNEL_LABELS) as ReferralChannel[]).map((c) => ({ id: c, label: CHANNEL_LABELS[c] }))}
          onChange={(v) => setFilter("channel", v)}
        />
      </div>
      <AdminGrid
        items={q.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No referrals match these filters."
        label="Referrals"
        onRowClick={(r) => setOpenId(r.id)}
        footer={<PagingBar page={page} pageSize={PAGE_SIZE} total={q.data?.total ?? 0} onPageChange={setPage} busy={q.isFetching} />}
      />
      {openId && <ReferralDrawer id={openId} canManage={canManage} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ReferralDrawer({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const q = useReferral(id);
  const [demand, setDemand] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<RewardOut | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: referralKeys.all });
  };
  const link = useMutation({
    mutationFn: () => referralsApi.linkDemand(id, demand as string),
    onSuccess: (r) => {
      qc.setQueryData(referralKeys.detail(id), r);
      refresh();
    },
  });
  const download = useMutation({ mutationFn: () => referralsApi.downloadResume(id) });
  const r = q.data;
  return (
    <DetailsDrawer open title={r ? `${r.referee_name ?? "Referral"} · ${r.human_id}` : "Referral"} onClose={onClose} size="medium">
      {q.isPending ? (
        <Spinner label="Loading referral" />
      ) : q.isError ? (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : r ? (
        <div className={styles.stack}>
          <div className={styles.row}>
            <Badge appearance="tint" color={STATUS_COLORS[r.status]}>
              {STATUS_LABELS[r.status]}
            </Badge>
            <Badge appearance="outline">{CHANNEL_LABELS[r.channel] ?? r.channel}</Badge>
            {!r.reward_eligible && r.ineligible_reason && (
              <Badge appearance="tint" color="warning">
                {`Not reward-eligible: ${INELIGIBLE_LABELS[r.ineligible_reason] ?? r.ineligible_reason}`}
              </Badge>
            )}
          </div>

          <Subtitle2 as="h3">Referee</Subtitle2>
          <dl className={admin.detailList}>
            <dt>Name</dt>
            <dd>{r.referee_name ?? "—"}</dd>
            <dt>Email</dt>
            <dd>{r.referee_email ?? "—"}</dd>
            <dt>Phone</dt>
            <dd>{r.referee_phone ?? "—"}</dd>
            <dt>Relationship</dt>
            <dd>{r.relationship ?? "—"}</dd>
            <dt>Note</dt>
            <dd>{r.note ?? "—"}</dd>
            <dt>Resume</dt>
            <dd>
              {r.has_resume ? (
                <Button
                  size="small"
                  appearance="transparent"
                  icon={<ArrowDownload20Regular />}
                  disabled={download.isPending}
                  onClick={() => download.mutate()}
                >
                  Download resume
                </Button>
              ) : (
                "Not available"
              )}
            </dd>
          </dl>
          {download.isError && (
            <MessageBar intent="error" role="alert">
              <MessageBarBody>{errorMessage(download.error)}</MessageBarBody>
            </MessageBar>
          )}

          <Subtitle2 as="h3">Referral</Subtitle2>
          <dl className={admin.detailList}>
            <dt>Referrer</dt>
            <dd>
              {r.referrer_kind === "worker" && r.referrer_candidate_id ? (
                <AppLink href={`/candidates/${r.referrer_candidate_id}`}>{r.referrer_name ?? "Worker"}</AppLink>
              ) : (
                (r.referrer_name ?? "—")
              )}
              {r.referrer_kind === "worker" ? " (worker)" : ""}
            </dd>
            <dt>Opening</dt>
            <dd>{r.demand_id ? <AppLink href={`/demands/${r.demand_id}`}>{r.demand_title ?? "Open demand"}</AppLink> : "General referral"}</dd>
            <dt>Program</dt>
            <dd>{r.program_name ?? "—"}</dd>
            <dt>Referred</dt>
            <dd>{formatDate(r.created_at)}</dd>
            <dt>Accepted</dt>
            <dd>{formatDate(r.accepted_at)}</dd>
            <dt>Decided</dt>
            <dd>{formatDate(r.decided_at)}</dd>
            {r.placement_id && (
              <>
                <dt>Placement</dt>
                <dd>
                  <AppLink href={`/placements/${r.placement_id}`}>Open placement</AppLink>
                </dd>
              </>
            )}
          </dl>

          {(r.status === "duplicate" || r.candidate_id) && (
            <section className={styles.panel} aria-label="Candidate record">
              <Text weight="semibold">{r.status === "duplicate" ? "Already in the talent database" : "Candidate record"}</Text>
              {r.status === "duplicate" && (
                <Body1>This person matched an existing candidate with recent activity, so no new application was created and no reward applies.</Body1>
              )}
              {r.candidate_id && <AppLink href={`/candidates/${r.candidate_id}`}>Open the candidate</AppLink>}
            </section>
          )}

          {canManage && canLinkDemand(r) && (
            <section className={styles.panel} aria-label="Link to opening">
              <Text weight="semibold">Link to an opening</Text>
              <Caption1 className={styles.muted}>A general referral was accepted. Choose the opening to consider them for.</Caption1>
              <DemandSearch label="Opening" required value={demand} onChange={(v) => setDemand(v)} />
              <div>
                <Button appearance="primary" disabled={!demand || link.isPending} onClick={() => link.mutate()}>
                  {link.isPending ? <Spinner size="tiny" label="Linking…" /> : "Link to opening"}
                </Button>
              </div>
              {link.isError && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{errorMessage(link.error)}</MessageBarBody>
                </MessageBar>
              )}
            </section>
          )}

          <Subtitle2 as="h3">Reward</Subtitle2>
          {r.reward ? (
            <>
              <dl className={admin.detailList}>
                <dt>Status</dt>
                <dd>
                  <Badge appearance="tint" color={REWARD_STATUS_COLORS[r.reward.status]}>
                    {REWARD_STATUS_LABELS[r.reward.status]}
                  </Badge>
                </dd>
                <dt>Amount</dt>
                <dd>{formatMoney(r.reward.amount, r.reward.currency)}</dd>
                <dt>Condition due</dt>
                <dd>{formatDate(r.reward.condition_due_on)}</dd>
                <dt>Payout</dt>
                <dd>{r.reward.payout_channel === "payroll" ? "Next payroll export" : "Payout export"}</dd>
                {r.reward.approval_request_id && (
                  <>
                    <dt>Approval</dt>
                    <dd>
                      <AppLink href={`/approvals?request=${r.reward.approval_request_id}`}>Open the approval</AppLink>
                    </dd>
                  </>
                )}
                {r.reward.void_reason && (
                  <>
                    <dt>Void reason</dt>
                    <dd>{r.reward.void_reason}</dd>
                  </>
                )}
              </dl>
              {canManage && canVoidReward(r.reward.status) && (
                <div>
                  <Button onClick={() => setVoiding(r.reward)}>Void reward</Button>
                </div>
              )}
            </>
          ) : (
            <Body1 className={styles.muted}>No reward yet. A reward is created when the referee is hired under a matching program.</Body1>
          )}
          {error && (
            <MessageBar intent="error" role="alert">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
      ) : null}
      <VoidRewardDialog
        reward={voiding}
        reason={voidReason}
        setReason={setVoidReason}
        onClose={() => {
          setVoiding(null);
          setVoidReason("");
        }}
        onDone={() => {
          setError(null);
          refresh();
        }}
        onError={(e) => setError(errorMessage(e))}
      />
    </DetailsDrawer>
  );
}

export function VoidRewardDialog({
  reward,
  reason,
  setReason,
  onClose,
  onDone,
  onError,
}: {
  reward: RewardOut | null;
  reason: string;
  setReason: (v: string) => void;
  onClose: () => void;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [tried, setTried] = useState(false);
  const missing = tried && !reason.trim();
  return (
    <ConfirmDialog
      open={reward !== null}
      title="Void this reward?"
      confirmLabel="Void reward"
      onClose={() => {
        setTried(false);
        onClose();
      }}
      onConfirm={async () => {
        if (!reward) return;
        setTried(true);
        if (!reason.trim()) throw new Error("reason required");
        try {
          await referralsApi.voidReward(reward.id, reason.trim());
          onDone();
        } catch (e) {
          onError(e);
          throw e;
        }
      }}
    >
      <Field
        label="Reason"
        required
        hint="Recorded on the reward and in the audit log."
        validationState={missing ? "error" : "none"}
        validationMessage={missing ? "Enter a reason." : undefined}
      >
        <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} />
      </Field>
    </ConfirmDialog>
  );
}
