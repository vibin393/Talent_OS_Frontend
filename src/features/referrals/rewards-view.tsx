"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, CheckmarkCircle20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { referralsApi } from "./api";
import { canVoidReward, formatDate, formatMoney, REWARD_STATUS_COLORS, REWARD_STATUS_LABELS, todayIso } from "./logic";
import { VoidRewardDialog } from "./referrals-list";
import type { RewardOut, RewardStatus } from "./types";
import { referralKeys, useReferralPermissions, useRewards } from "./use-referrals";

const useStyles = makeStyles({
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  tabs: { marginBottom: tokens.spacingVerticalM },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  pickList: { listStyleType: "none", margin: 0, padding: 0, maxHeight: "260px", overflowY: "auto" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const TABS: { value: RewardStatus; label: string }[] = [
  { value: "pending_condition", label: "Pending" },
  { value: "eligible", label: "Eligible" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

/** `/referrals/rewards`: the reward queue by status; payout export and "mark paid" (needs `referral:read`, actions `referral:manage`). */
export function RewardsView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const { canRead, canManage } = useReferralPermissions();
  const [tab, setTab] = useState<RewardStatus>("pending_condition");
  const [exportOpen, setExportOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [voiding, setVoiding] = useState<RewardOut | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const q = useRewards(tab, canRead);
  if (!canRead) return <NoAccess what="referral rewards" />;

  const columns: TableColumnDefinition<RewardOut>[] = [
    createTableColumn({
      columnId: "referral",
      renderHeaderCell: () => "Referral",
      renderCell: (r) => (
        <div className={admin.cellStack}>
          <Text weight="semibold">{r.referee_name ?? "Referee"}</Text>
          <Caption1 className={admin.muted}>{r.referral_human_id}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "referrer",
      renderHeaderCell: () => "Referrer",
      renderCell: (r) => `${r.referrer_name ?? "—"}${r.referrer_kind === "worker" ? " (worker)" : ""}`,
    }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (r) => formatMoney(r.amount, r.currency) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={REWARD_STATUS_COLORS[r.status]}>
          {REWARD_STATUS_LABELS[r.status]}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "payout",
      renderHeaderCell: () => "Payout",
      renderCell: (r) => (r.payout_channel === "payroll" ? "Payroll" : "Payout export"),
    }),
    createTableColumn({
      columnId: "when",
      renderHeaderCell: () => (tab === "pending_condition" ? "Condition due" : tab === "paid" ? "Paid" : "Updated"),
      renderCell: (r) =>
        tab === "pending_condition"
          ? formatDate(r.condition_due_on)
          : tab === "paid"
            ? `${formatDate(r.paid_at)}${r.payout_ref ? ` · ${r.payout_ref}` : ""}`
            : tab === "void"
              ? (r.void_reason ?? "—")
              : formatDate(r.approved_at ?? r.eligible_at ?? r.created_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (r) => (
        <div className={styles.actions}>
          {r.status === "eligible" && r.approval_request_id && (
            <AppLink href={`/approvals?request=${r.approval_request_id}`}>Open approval</AppLink>
          )}
          {canManage && canVoidReward(r.status) && (
            <Button size="small" onClick={() => setVoiding(r)}>
              Void
            </Button>
          )}
        </div>
      ),
    }),
  ];

  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Referral rewards" subtitle="Rewards wait for the joining condition, are approved in Approvals, then paid" />
        {canManage && (
          <div className={styles.actions}>
            <Button icon={<ArrowDownload20Regular />} onClick={() => setExportOpen(true)}>
              Payout export
            </Button>
            <Button appearance="primary" icon={<CheckmarkCircle20Regular />} onClick={() => setPaidOpen(true)}>
              Mark paid
            </Button>
          </div>
        )}
      </div>
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as RewardStatus)} aria-label="Reward status">
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      {tab === "eligible" && (
        <Body1 className={styles.muted}>Eligible rewards are approved by a Finance approver in Approvals. Workflows can never approve them.</Body1>
      )}
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No rewards in this status."
        label={`${REWARD_STATUS_LABELS[tab]} rewards`}
      />
      {exportOpen && <PayoutExportDialog onClose={() => setExportOpen(false)} />}
      {paidOpen && (
        <MarkPaidDialog
          onClose={() => setPaidOpen(false)}
          onDone={(n) => {
            toast.success(`${n} reward${n === 1 ? "" : "s"} marked paid.`);
            void qc.invalidateQueries({ queryKey: ["referrals"] });
          }}
        />
      )}
      <VoidRewardDialog
        reward={voiding}
        reason={voidReason}
        setReason={setVoidReason}
        onClose={() => {
          setVoiding(null);
          setVoidReason("");
        }}
        onDone={() => {
          toast.success("Reward voided.");
          void qc.invalidateQueries({ queryKey: referralKeys.all });
        }}
        onError={(e) => toast.error(errorMessage(e))}
      />
    </>
  );
}

function PayoutExportDialog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const run = useMutation({ mutationFn: () => referralsApi.payoutExport(format), onSuccess: () => onClose() });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Payout export</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>
              Download the approved rewards paid outside payroll (employee referrers). Worker rewards flow through the next payroll export
              instead.
            </Body1>
            <Field label="File format">
              <RadioGroup value={format} onChange={(_, d) => setFormat(d.value as "xlsx" | "csv")}>
                <Radio value="xlsx" label="Excel (.xlsx)" />
                <Radio value="csv" label="CSV" />
              </RadioGroup>
            </Field>
            {run.isError && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{errorMessage(run.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={run.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={run.isPending} icon={run.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => run.mutate()}>
              Download
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function MarkPaidDialog({ onClose, onDone }: { onClose: () => void; onDone: (updated: number) => void }) {
  const styles = useStyles();
  const approved = useRewards("approved");
  const candidates = (approved.data ?? []).filter((r) => r.payout_channel === "payout_export");
  const [selected, setSelected] = useState<string[]>([]);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [ref, setRef] = useState("");
  const [touched, setTouched] = useState(false);
  const run = useMutation({
    mutationFn: () => referralsApi.markPaid({ ids: selected, paid_on: paidOn, payout_ref: ref.trim() }),
    onSuccess: (r) => {
      onDone(r.updated);
      onClose();
    },
  });
  const errors = {
    selected: selected.length === 0 ? "Select at least one reward." : undefined,
    paidOn: !paidOn ? "Choose the payment date." : undefined,
    ref: !ref.trim() ? "Enter the payout reference." : undefined,
  };
  const valid = !errors.selected && !errors.paidOn && !errors.ref;
  const toggle = (id: string, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) run.mutate();
          }}
          noValidate
        >
          <DialogBody>
            <DialogTitle>Mark rewards paid</DialogTitle>
            <DialogContent className={styles.form}>
              {approved.isPending ? (
                <Spinner label="Loading approved rewards" />
              ) : candidates.length === 0 ? (
                <Body1>No approved rewards are waiting for a payout export payment.</Body1>
              ) : (
                <Field
                  label="Approved rewards (payout export)"
                  required
                  validationState={touched && errors.selected ? "error" : "none"}
                  validationMessage={touched ? errors.selected : undefined}
                >
                  <Checkbox
                    label="Select all"
                    checked={selected.length === candidates.length ? true : selected.length > 0 ? "mixed" : false}
                    onChange={(_, d) => setSelected(d.checked ? candidates.map((c) => c.id) : [])}
                  />
                  <ul className={styles.pickList}>
                    {candidates.map((r) => (
                      <li key={r.id}>
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onChange={(_, d) => toggle(r.id, Boolean(d.checked))}
                          label={`${r.referral_human_id} · ${r.referrer_name ?? "Referrer"} · ${formatMoney(r.amount, r.currency)}`}
                        />
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              <Field
                label="Paid on"
                required
                validationState={touched && errors.paidOn ? "error" : "none"}
                validationMessage={touched ? errors.paidOn : undefined}
              >
                <Input type="date" value={paidOn} onChange={(_, d) => setPaidOn(d.value)} />
              </Field>
              <Field
                label="Payout reference"
                required
                hint="For example the bank batch or UTR number."
                validationState={touched && errors.ref ? "error" : "none"}
                validationMessage={touched ? errors.ref : undefined}
              >
                <Input value={ref} maxLength={100} onChange={(_, d) => setRef(d.value)} />
              </Field>
              {run.isError && (
                <MessageBar intent="error" role="alert">
                  <MessageBarBody>{errorMessage(run.error)}</MessageBarBody>
                </MessageBar>
              )}
            </DialogContent>
            <DialogActions>
              <Button disabled={run.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={run.isPending || candidates.length === 0}
                icon={run.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Mark paid
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
