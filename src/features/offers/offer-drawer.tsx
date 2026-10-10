"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Spinner,
  Tab,
  TabList,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, DocumentEdit20Regular, MoreVertical20Regular, Prohibited20Regular, Send20Regular, ShieldTask20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { isCurrentApprover, latestRequest } from "./approval";
import { formatDate, formatMoney, OFFER_STATUS, offerErrorMessage, TERMINAL_STATUSES } from "./format";
import { OfferApprovalPanel } from "./offer-approval-panel";
import { OfferLetterPreview } from "./offer-letter-preview";
import { OfferStatusTimeline } from "./offer-status-timeline";
import { OfferTermsForm } from "./offer-terms-form";
import type { OfferDetailOut } from "./types";
import { useOffer } from "./use-offer";
import { useOfferAction } from "./use-offer-mutations";
import { offerPanels } from "./offer-panels";
import "@/features/predictions/register-panels";

const useStyles = makeStyles({
  head: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center", marginBottom: tokens.spacingVerticalM },
  tabs: { marginBottom: tokens.spacingVerticalM, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, overflowX: "auto" },
  muted: { color: tokens.colorNeutralForeground3 },
  summary: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalM },
});

type DrawerTab = "terms" | "letter" | "approval" | "timeline";

function errText(e: unknown): string {
  return isApiError(e) ? offerErrorMessage(e.code, errorMessage(e)) : errorMessage(e);
}

function WithdrawDialog({ offer, onClose }: { offer: OfferDetailOut; onClose: () => void }) {
  const toast = useAppToast();
  const action = useOfferAction(offer.id);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const released = offer.status === "released" || offer.status === "viewed";
  const submit = async () => {
    if (reason.trim().length < 5) return setFieldError("Give a reason of at least 5 characters");
    try {
      await action.mutateAsync({ action: "withdraw", reason: reason.trim() });
      toast.success(`Withdrew ${offer.human_id}`);
      onClose();
    } catch (e) {
      setError(errText(e));
    }
  };
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !action.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Withdraw {offer.human_id}?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              {released
                ? "The candidate's link stops working, they are emailed that the offer was withdrawn, and the application returns to Selected."
                : offer.status === "pending_approval"
                  ? "The pending approval request is cancelled."
                  : "The offer is closed. You can create a new offer for this application afterwards."}
            </Body1>
            <ErrorBar message={error} />
            <Field label="Reason" required validationState={fieldError ? "error" : "none"} validationMessage={fieldError}>
              <Textarea
                value={reason}
                maxLength={2000}
                onChange={(_, d) => {
                  setReason(d.value);
                  setFieldError(null);
                }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={action.isPending} icon={action.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Withdraw offer
            </Button>
            <Button disabled={action.isPending} onClick={onClose}>
              Keep
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ReleaseDialog({ offer, onClose }: { offer: OfferDetailOut; onClose: () => void }) {
  const toast = useAppToast();
  const action = useOfferAction(offer.id);
  const [error, setError] = useState<string | null>(null);
  const v = offer.current_version;
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !action.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Release {offer.human_id} to {offer.candidate_name ?? "the candidate"}?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              The candidate is emailed a secure link to view version {v.version_no} and accept or decline it until the end of {formatDate(v.expiry_date)}. The
              application moves to Offered.
            </Body1>
            <ErrorBar message={error} />
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={action.isPending}
              icon={action.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
              onClick={async () => {
                try {
                  await action.mutateAsync({ action: "release" });
                  toast.success(`Released ${offer.human_id}. The candidate has been emailed.`);
                  onClose();
                } catch (e) {
                  setError(errText(e));
                }
              }}
            >
              Release
            </Button>
            <Button disabled={action.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * Offer drawer (right `OverlayDrawer`, large): header with OFR id, version and status, one primary action by
 * status (Submit for approval / Release / Withdraw) plus Withdraw / Revise in the kebab menu, and the Terms,
 * Letter, Approval and Timeline tabs.
 */
export function OfferDrawer({ offerId, onClose, initialTab = "terms" }: { offerId: string; onClose: () => void; initialTab?: DrawerTab }) {
  const styles = useStyles();
  const q = useOffer(offerId);
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  return (
    <OverlayDrawer position="end" size="large" open onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {q.data ? (
            <div className={styles.head}>
              <span>
                {q.data.human_id} · {q.data.candidate_name ?? "Candidate"}
              </span>
              <span className={styles.badges}>
                <Badge appearance="outline" color="informative">
                  v{q.data.current_version.version_no}
                </Badge>
                <Badge appearance="tint" color={OFFER_STATUS[q.data.status].color}>
                  {OFFER_STATUS[q.data.status].label}
                </Badge>
                {q.data.demand_title && <Caption1 className={styles.muted}>{q.data.demand_title}</Caption1>}
              </span>
            </div>
          ) : (
            "Offer"
          )}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {q.isPending ? (
          <GridSkeleton rows={8} />
        ) : q.isError ? (
          <ErrorBar title="Could not load this offer." message={errorMessage(q.error)} />
        ) : (
          <OfferDrawerBody offer={q.data} tab={tab} setTab={setTab} />
        )}
      </DrawerBody>
    </OverlayDrawer>
  );
}

function OfferDrawerBody({ offer, tab, setTab }: { offer: OfferDetailOut; tab: DrawerTab; setTab: (t: DrawerTab) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { data: me } = useMe();
  const canWrite = usePermission("offer:write");
  const canRelease = usePermission("offer:release");
  const canWithdraw = usePermission("offer:withdraw");
  const canApprove = usePermission("offer:approve");
  const action = useOfferAction(offer.id);
  const [dialog, setDialog] = useState<"withdraw" | "release" | null>(null);
  const terminal = TERMINAL_STATUSES.includes(offer.status);
  const v = offer.current_version;
  const approver = offer.status === "pending_approval" && isCurrentApprover(latestRequest(offer.approvals), me?.user.id, canApprove);
  const extraPanels = offerPanels((perm) => !!me?.permissions && perm in me.permissions);

  const submit = async () => {
    try {
      const r = await action.mutateAsync({ action: "submit" });
      toast.success(r.status === "approved" ? `${r.human_id} was approved automatically. You can release it.` : `${r.human_id} submitted for approval.`);
      if (r.status === "pending_approval") setTab("approval");
    } catch (e) {
      toast.error(errText(e));
    }
  };

  let primary: React.ReactNode = null;
  if (offer.status === "draft" && canWrite)
    primary = (
      <Button appearance="primary" icon={action.isPending ? <Spinner size="tiny" /> : <ShieldTask20Regular />} disabled={action.isPending} onClick={submit}>
        Submit for approval
      </Button>
    );
  else if (offer.status === "approved" && canRelease)
    primary = (
      <Button appearance="primary" icon={<Send20Regular />} onClick={() => setDialog("release")}>
        Release
      </Button>
    );
  else if ((offer.status === "released" || offer.status === "viewed") && canWithdraw)
    primary = (
      <Button appearance="primary" icon={<Prohibited20Regular />} onClick={() => setDialog("withdraw")}>
        Withdraw
      </Button>
    );
  else if (approver)
    primary = (
      <Button appearance="primary" icon={<ShieldTask20Regular />} onClick={() => setTab("approval")}>
        Review and decide
      </Button>
    );

  const canRevise = canWrite && (offer.status === "approved" || offer.status === "released" || offer.status === "viewed");

  return (
    <>
      <div className={styles.actions}>
        {primary}
        {!terminal && (canWithdraw || canRevise) && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button aria-label="More offer actions" icon={<MoreVertical20Regular />} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {canRevise && (
                  <MenuItem icon={<DocumentEdit20Regular />} onClick={() => setTab("terms")}>
                    Revise terms
                  </MenuItem>
                )}
                {canWithdraw && (
                  <MenuItem icon={<Prohibited20Regular />} onClick={() => setDialog("withdraw")}>
                    Withdraw
                  </MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>

      <div className={styles.summary}>
        <Caption1>
          Pay <strong>{formatMoney(v.pay_rate, v.pay_rate_unit)}</strong>
        </Caption1>
        <Caption1>
          Start <strong>{formatDate(v.start_date)}</strong>
        </Caption1>
        <Caption1>
          Expires <strong>{offer.expires_at ? formatDateTime(offer.expires_at) : formatDate(v.expiry_date)}</strong>
        </Caption1>
        {offer.released_at && (
          <Caption1>
            Released <strong>{formatDateTime(offer.released_at)}</strong>
          </Caption1>
        )}
        {offer.viewed_at && (
          <Caption1>
            Viewed <strong>{formatDateTime(offer.viewed_at)}</strong>
          </Caption1>
        )}
      </div>

      {offer.withdrawn_reason && (
        <MessageBar intent="info">
          <MessageBarBody>Withdrawn: {offer.withdrawn_reason}</MessageBarBody>
        </MessageBar>
      )}
      {(offer.warnings ?? []).length > 0 && (
        <MessageBar intent="warning" layout="multiline" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{(offer.warnings ?? []).map((w) => w.replace(/_/g, " ")).join(" · ")}</MessageBarBody>
        </MessageBar>
      )}

      {extraPanels.map(({ key, component: Panel }) => (
        <div key={key} style={{ marginBottom: tokens.spacingVerticalM }}>
          <Panel offerId={offer.id} offerStatus={offer.status} />
        </div>
      ))}

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as DrawerTab)} aria-label="Offer sections">
        <Tab value="terms">Terms</Tab>
        <Tab value="letter">Letter</Tab>
        <Tab value="approval">Approval</Tab>
        <Tab value="timeline">Timeline</Tab>
      </TabList>
      {tab === "terms" && <OfferTermsForm key={`${offer.lock_version}-${v.version_no}`} offer={offer} />}
      {tab === "letter" && <OfferLetterPreview offer={offer} />}
      {tab === "approval" && <OfferApprovalPanel offer={offer} />}
      {tab === "timeline" && <OfferStatusTimeline offer={offer} />}

      {dialog === "withdraw" && <WithdrawDialog offer={offer} onClose={() => setDialog(null)} />}
      {dialog === "release" && <ReleaseDialog offer={offer} onClose={() => setDialog(null)} />}
    </>
  );
}
