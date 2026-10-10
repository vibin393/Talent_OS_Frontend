"use client";

import {
  Button,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  Archive20Regular,
  ArrowRedo20Regular,
  Dismiss20Regular,
  Edit20Regular,
  Globe20Regular,
  LockClosed20Regular,
  MoreHorizontal20Regular,
  Pause20Regular,
  PersonAdd20Regular,
  Play20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog } from "@/features/admin/ui";
import { isApiError } from "@/lib/api/errors";
import type { DemandOut } from "@/lib/api/types";
import { DemandStatusBadge, PriorityBadge, ProgressBadge, SlaBadge, sortClocks } from "./badges";
import { demandErrorMessage } from "./errors";
import { type DemandAction, reasonLabel, STATUS_LABELS } from "./status";
import { type ReasonTarget, TransitionDialog } from "./transition-dialog";
import { useArchiveDemand, useSubmitDemand, useTransitionDemand } from "./use-demand";
import { FromOpportunityTag } from "@/features/crm/opportunities/from-opportunity-tag";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalM },
  top: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: tokens.spacingHorizontalL },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flex: "1 1 360px", minWidth: 0 },
  line: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
});

/**
 * Demand header: REQ ID, title, status/progress/priority badges, client link and SLA badges, plus the
 * lifecycle actions allowed for the status and the user's permissions (`actions`).
 */
export function DemandHeader({
  demand,
  actions,
  onEdit,
  onAssign,
  onPublish,
  extraActions,
}: {
  demand: DemandOut;
  actions: readonly DemandAction[];
  onEdit: () => void;
  onAssign: () => void;
  onPublish: () => void;
  /** Extra header buttons from other features (e.g. Email), shown before the overflow menu. */
  extraActions?: React.ReactNode;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const submit = useSubmitDemand(demand.id);
  const transition = useTransitionDemand(demand.id);
  const archive = useArchiveDemand(demand.id);
  const [reasonFor, setReasonFor] = useState<ReasonTarget | null>(null);
  const [confirm, setConfirm] = useState<"resume" | "reopen" | "archive" | null>(null);
  const has = (a: DemandAction) => actions.includes(a);
  const openClocks = sortClocks(demand.sla ?? []).filter((c) => !c.completed_at);

  const doSubmit = async () => {
    try {
      const d = await submit.mutateAsync(undefined);
      toast.success(d.status === "open" ? `${d.req_id} is now Open` : `${d.req_id} was sent for approval`);
    } catch (e) {
      toast.error(demandErrorMessage(e));
    }
  };

  const overflow = [
    has("hold") && { key: "hold", label: "Put on hold", icon: <Pause20Regular />, onClick: () => setReasonFor("on_hold") },
    has("close") && { key: "close", label: "Close", icon: <LockClosed20Regular />, onClick: () => setReasonFor("closed") },
    has("cancel") && { key: "cancel", label: "Cancel demand", icon: <Dismiss20Regular />, onClick: () => setReasonFor("cancelled") },
    has("archive") && { key: "archive", label: "Archive", icon: <Archive20Regular />, onClick: () => setConfirm("archive") },
  ].filter(Boolean) as { key: string; label: string; icon: React.ReactElement; onClick: () => void }[];

  const returned = demand.status === "draft" && !!demand.status_comment;
  const reasoned = ["on_hold", "cancelled", "closed"].includes(demand.status) && !!demand.status_reason_code;

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div className={styles.identity}>
          <Text className={styles.muted} weight="semibold">
            {demand.req_id}
          </Text>
          <div className={styles.line}>
            <Title2 as="h1">{demand.title}</Title2>
            <DemandStatusBadge demand={demand} />
            {demand.progress && <ProgressBadge progress={demand.progress} />}
            <PriorityBadge priority={demand.priority} />
            <FromOpportunityTag kind="demand" recordId={demand.id} />
          </div>
          <div className={styles.line}>
            <AppLink href={`/clients/${demand.client_id}`}>{demand.client_name ?? "Client"}</AppLink>
            {demand.primary_recruiter?.name && <Text className={styles.muted}>· Primary recruiter {demand.primary_recruiter.name}</Text>}
            {openClocks.map((c) => (
              <SlaBadge key={`${c.milestone}:${c.ref_id ?? ""}`} status={c.status} clock={c} />
            ))}
          </div>
        </div>
        <div className={styles.actions}>
          {has("submit") && (
            <Button
              appearance="primary"
              icon={submit.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
              disabled={submit.isPending}
              onClick={doSubmit}
            >
              Submit
            </Button>
          )}
          {has("resume") && (
            <Button appearance="primary" icon={<Play20Regular />} onClick={() => setConfirm("resume")}>
              Resume
            </Button>
          )}
          {has("reopen") && (
            <Button icon={<ArrowRedo20Regular />} onClick={() => setConfirm("reopen")}>
              Reopen
            </Button>
          )}
          {has("publish") && (
            <Button icon={<Globe20Regular />} onClick={onPublish}>
              {demand.published_jd_version_id ? "Posting" : "Publish"}
            </Button>
          )}
          {has("assign") && (
            <Button icon={<PersonAdd20Regular />} onClick={onAssign}>
              Assign
            </Button>
          )}
          {has("edit") && (
            <Button icon={<Edit20Regular />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {extraActions}
          {overflow.length > 0 && (
            <Menu positioning={{ position: "below", align: "end" }}>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={<MoreHorizontal20Regular />} aria-label="More actions" />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {overflow.map((a) => (
                    <MenuItem key={a.key} icon={a.icon} onClick={a.onClick}>
                      {a.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>
      </div>

      {returned && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Returned to draft by the approver</MessageBarTitle>
            {demand.status_comment}
          </MessageBarBody>
        </MessageBar>
      )}
      {demand.status === "pending_approval" && (
        <MessageBar intent="info">
          <MessageBarBody>Waiting for approval. The demand opens when the last approval step is approved.</MessageBarBody>
        </MessageBar>
      )}
      {reasoned && (
        <MessageBar intent={demand.status === "on_hold" ? "warning" : "info"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>
              {STATUS_LABELS[demand.status]}: {reasonLabel(demand.status_reason_code)}
            </MessageBarTitle>
            {demand.status_comment}
          </MessageBarBody>
        </MessageBar>
      )}

      {reasonFor && <TransitionDialog demand={demand} to={reasonFor} onClose={() => setReasonFor(null)} />}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "archive" ? "Archive demand?" : confirm === "reopen" ? "Reopen demand?" : "Resume demand?"}
        confirmLabel={confirm === "archive" ? "Archive" : confirm === "reopen" ? "Reopen" : "Resume"}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            if (confirm === "archive") await archive.mutateAsync(undefined);
            else await transition.mutateAsync({ to: "open" });
            toast.success(confirm === "archive" ? `Archived ${demand.req_id}` : `${demand.req_id} is Open again`);
          } catch (e) {
            toast.error(
              isApiError(e) && e.code === "reopen_guard"
                ? "Raise the number of positions (Edit) before reopening a filled demand."
                : demandErrorMessage(e),
            );
            throw e;
          }
        }}
      >
        {confirm === "archive"
          ? `${demand.req_id} will be hidden from the demand list.`
          : confirm === "reopen"
            ? `${demand.req_id} goes back to Open so recruiters can fill the remaining positions.`
            : `${demand.req_id} goes back to Open and its SLA clocks continue.`}
      </ConfirmDialog>
    </div>
  );
}
