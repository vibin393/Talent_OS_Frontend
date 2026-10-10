"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle16Filled, Circle16Regular, DismissCircle16Filled } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate, maskedRate } from "@/features/placements/format";
import { exitApi, exitKeys } from "./api";
import {
  ChecksPanel,
  ConfirmExtensionDialog,
  ProposeExtensionDrawer,
  ReasonDialog,
  RecordResponseDialog,
  SecureLinkDialog,
} from "./extension-dialogs";
import { ConversionDialog, EarlyTerminationDialog, StartOffboardingDialog } from "./exit-dialogs";
import {
  CASE_REASON_LABELS,
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  canConfirmExtension,
  EXTENSION_STATUS_COLORS,
  EXTENSION_STATUS_LABELS,
  exitErrorMessage,
  isCaseOpen,
  isOpenExtension,
  overridableFails,
  TRACKER_STEPS,
  trackerStep,
} from "./logic";
import type { ExtensionOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tracker: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, listStyleType: "none", margin: 0, padding: 0 },
  step: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
  stepDone: { color: tokens.colorPaletteGreenForeground1 },
  stepCurrent: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  timeline: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  timelineItem: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    paddingBlock: tokens.spacingVerticalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  dl: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
});

/** Proposed → Approval → Client → Confirmed. */
export function ExtensionTracker({ status }: { status: ExtensionOut["status"] }) {
  const styles = useStyles();
  const current = trackerStep(status);
  if (current < 0) {
    return (
      <Text className={styles.step}>
        <DismissCircle16Filled aria-hidden /> {EXTENSION_STATUS_LABELS[status]}
      </Text>
    );
  }
  return (
    <ol className={styles.tracker} aria-label="Extension progress">
      {TRACKER_STEPS.map((label, i) => {
        const done = i < current || (i === 3 && current === 3);
        const cls = done ? styles.stepDone : i === current ? styles.stepCurrent : undefined;
        return (
          <li key={label} className={mergeClasses(styles.step, cls)} aria-current={i === current ? "step" : undefined}>
            {done ? <CheckmarkCircle16Filled aria-hidden /> : <Circle16Regular aria-hidden />}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

type ExtDialog = "exception" | "withdraw" | "confirm" | "record" | "link" | null;

function OpenExtensionCard({ ext, canWrite, canConfirm, canViewComp }: { ext: ExtensionOut; canWrite: boolean; canConfirm: boolean; canViewComp: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [dialog, setDialog] = useState<ExtDialog>(null);
  const recheck = useMutation({
    mutationFn: () => exitApi.recheck(ext.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: exitKeys.all });
      toast.success("Checks re-run");
    },
    onError: (e) => toast.error(exitErrorMessage(e)),
  });
  const cur = ext.currency ?? "INR";
  const needsException = overridableFails(ext.checks).length > 0 && ext.exception_status !== "approved";
  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Subtitle2>
            {ext.human_id} · until {formatDate(ext.new_end_date)}
          </Subtitle2>
        }
        description={<Caption1>Proposed {formatDate(ext.created_at)}</Caption1>}
        action={
          <Badge appearance="tint" color={EXTENSION_STATUS_COLORS[ext.status]}>
            {EXTENSION_STATUS_LABELS[ext.status]}
          </Badge>
        }
      />
      <ExtensionTracker status={ext.status} />
      <dl className={styles.dl}>
        <dt>Current end date</dt>
        <dd>{formatDate(ext.current_end_date)}</dd>
        <dt>New end date</dt>
        <dd>{formatDate(ext.new_end_date)}</dd>
        {(ext.rate_unit || ext.bill_rate || ext.pay_rate) && (
          <>
            <dt>Bill / pay rate</dt>
            <dd>
              {maskedRate(ext.bill_rate, cur, canViewComp)} / {maskedRate(ext.pay_rate, cur, canViewComp)}
              {ext.rate_unit ? ` per ${ext.rate_unit}` : ""}
            </dd>
          </>
        )}
        {ext.exception_status && ext.exception_status !== "none" && (
          <>
            <dt>Exception</dt>
            <dd>{ext.exception_status}</dd>
          </>
        )}
        {ext.client_comment && (
          <>
            <dt>Client comment</dt>
            <dd>{ext.client_comment}</dd>
          </>
        )}
      </dl>
      <ChecksPanel checks={ext.checks} onRequestException={canWrite && needsException ? () => setDialog("exception") : undefined} />
      <div className={styles.actions}>
        {canConfirm && canConfirmExtension(ext.status) && (
          <Button appearance="primary" onClick={() => setDialog("confirm")}>
            ★ Confirm
          </Button>
        )}
        {canWrite && ext.status === "pending_client_confirmation" && (
          <>
            <Button onClick={() => setDialog("link")}>Send secure link</Button>
            <Button onClick={() => setDialog("record")}>Record response</Button>
          </>
        )}
        {canWrite && (
          <Button disabled={recheck.isPending} icon={recheck.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => recheck.mutate()}>
            Re-run checks
          </Button>
        )}
        {canWrite && <Button onClick={() => setDialog("withdraw")}>Withdraw</Button>}
      </div>
      {dialog === "exception" && (
        <ReasonDialog
          title="Request exception"
          primary="Request"
          success="Exception requested"
          intro="An approver reviews the failed overridable checks."
          run={(r) => exitApi.requestException(ext.id, r)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "withdraw" && (
        <ReasonDialog
          title="Withdraw extension"
          primary="Withdraw"
          success="Extension withdrawn"
          run={(r) => exitApi.withdraw(ext.id, r)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "confirm" && <ConfirmExtensionDialog ext={ext} onClose={() => setDialog(null)} />}
      {dialog === "record" && <RecordResponseDialog ext={ext} onClose={() => setDialog(null)} />}
      {dialog === "link" && (
        <SecureLinkDialog title="Client secure link" issue={() => exitApi.extensionLink(ext.id)} onClose={() => setDialog(null)} />
      )}
    </Card>
  );
}

type PlacementLite = {
  id: string;
  status: string;
  end_date: string | null;
  planned_end_date: string | null;
  currency: string;
  po_id?: string | null;
};

/** Placement detail "Extension" tab: open extension, history timeline, conversion and offboarding actions. */
export function PlacementExtensionTab({ placement }: { placement: PlacementLite }) {
  const styles = useStyles();
  const canWrite = usePermission("extension:write");
  const canConfirm = usePermission("extension:confirm");
  const canConvert = usePermission("conversion:write");
  const canOffboard = usePermission("offboarding:write");
  const canViewComp = usePermission("compensation:view");
  const [dialog, setDialog] = useState<"propose" | "convert" | "offboard" | "early" | null>(null);
  const exts = useQuery({ queryKey: exitKeys.extensions(placement.id), queryFn: ({ signal }) => exitApi.extensions(placement.id, signal) });
  const kase = useQuery({ queryKey: exitKeys.placementCase(placement.id), queryFn: ({ signal }) => exitApi.placementCase(placement.id, signal) });
  const conv = useQuery({ queryKey: exitKeys.conversion(placement.id), queryFn: ({ signal }) => exitApi.conversion(placement.id, signal) });
  const endDate = placement.end_date ?? placement.planned_end_date;
  const active = placement.status === "active";
  const list = exts.data ?? [];
  const open = list.find((e) => isOpenExtension(e.status)) ?? null;
  const caseOpen = kase.data ? isCaseOpen(kase.data.status) : false;

  return (
    <div className={styles.root}>
      <div className={styles.actions}>
        {canWrite && active && !open && !caseOpen && endDate && (
          <Button appearance="primary" onClick={() => setDialog("propose")}>
            Propose extension
          </Button>
        )}
        {canConvert && active && !conv.data && !caseOpen && <Button onClick={() => setDialog("convert")}>Record conversion</Button>}
        {canOffboard && active && !caseOpen && (
          <>
            <Button onClick={() => setDialog("offboard")}>Start offboarding</Button>
            <Button onClick={() => setDialog("early")}>Early termination</Button>
          </>
        )}
      </div>
      {kase.data && (
        <MessageBar intent={caseOpen ? "warning" : "info"}>
          <MessageBarBody>
            Offboarding {kase.data.human_id} ({CASE_REASON_LABELS[kase.data.reason]}, last working day {formatDate(kase.data.last_working_day)}){" "}
            <Badge appearance="tint" color={CASE_STATUS_COLORS[kase.data.status]}>
              {CASE_STATUS_LABELS[kase.data.status]}
            </Badge>{" "}
            <NextLink href={`/offboarding/${kase.data.id}`}>Open case</NextLink>
          </MessageBarBody>
        </MessageBar>
      )}
      {conv.data && (
        <MessageBar intent="info">
          <MessageBarBody>Converted to hire on {formatDate(conv.data.conversion_date)}.</MessageBarBody>
        </MessageBar>
      )}
      {exts.isPending && <Spinner label="Loading extensions" />}
      {exts.isError && (
        <MessageBar intent="error">
          <MessageBarBody>{exitErrorMessage(exts.error)}</MessageBarBody>
        </MessageBar>
      )}
      {open && <OpenExtensionCard ext={open} canWrite={canWrite} canConfirm={canConfirm} canViewComp={canViewComp} />}
      <Card className={styles.card}>
        <Subtitle2>Extension history</Subtitle2>
        {list.length === 0 ? (
          <Body1 className={styles.muted}>No extensions yet.</Body1>
        ) : (
          <ul className={styles.timeline}>
            {list.map((e) => (
              <li key={e.id} className={styles.timelineItem}>
                <Text weight="semibold">{e.human_id}</Text>
                <Text>
                  {formatDate(e.current_end_date)} → {formatDate(e.new_end_date)}
                </Text>
                <Badge appearance="tint" color={EXTENSION_STATUS_COLORS[e.status]}>
                  {EXTENSION_STATUS_LABELS[e.status]}
                </Badge>
                <Caption1 className={styles.muted}>
                  {e.confirmed_at ? `confirmed ${formatDate(e.confirmed_at)}` : `proposed ${formatDate(e.created_at)}`}
                  {e.withdraw_reason ? ` · ${e.withdraw_reason}` : ""}
                </Caption1>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {dialog === "propose" && endDate && (
        <ProposeExtensionDrawer
          placementId={placement.id}
          currentEndDate={endDate}
          defaultPoId={placement.po_id ?? null}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "convert" && <ConversionDialog placementId={placement.id} currency={placement.currency} onClose={() => setDialog(null)} />}
      {dialog === "offboard" && <StartOffboardingDialog placementId={placement.id} defaultLwd={endDate} onClose={() => setDialog(null)} />}
      {dialog === "early" && <EarlyTerminationDialog placementId={placement.id} noticePeriodDays={null} onClose={() => setDialog(null)} />}
    </div>
  );
}
