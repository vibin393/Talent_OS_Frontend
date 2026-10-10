"use client";

import {
  Avatar,
  Button,
  Caption1,
  Card,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowForward16Regular,
  ArrowUndo16Regular,
  DismissCircle16Regular,
  MoreHorizontal20Regular,
  PersonArrowLeft16Regular,
  ReOrderDotsVertical20Regular,
  Send16Regular,
} from "@fluentui/react-icons";
import { CreateOfferButton } from "@/features/offers/application-offer";
import { AssessmentCardBadge } from "@/features/assessments/integrations";
import { InternalCardBadge } from "@/features/mobility/pipeline-integrations";
import type { ApplicationOut, PipelineStageOut } from "@/lib/api/types";
import { ApplicationBadges, PendingRejectionBar } from "./badges";
import { daysLabel } from "./format";

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingHorizontalS,
    gap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  dragging: { opacity: 0.4 },
  overlay: { boxShadow: tokens.shadow28, cursor: "grabbing", transform: "rotate(2deg)" },
  top: { display: "flex", alignItems: "flex-start", gap: tokens.spacingHorizontalXS },
  handle: { cursor: "grab", minWidth: "24px", touchAction: "none", flexShrink: 0 },
  identity: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  name: {
    justifyContent: "flex-start",
    padding: 0,
    minWidth: 0,
    height: "auto",
    fontWeight: tokens.fontWeightSemibold,
    textAlign: "start",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    display: "block",
  },
  muted: { color: tokens.colorNeutralForeground3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXXS, alignItems: "center" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.spacingHorizontalXS },
});

export type CardAction =
  | { kind: "move"; stage: PipelineStageOut }
  | { kind: "submit" }
  | { kind: "reject" }
  | { kind: "withdraw" }
  | { kind: "reopen" };

/** A candidate card on the pipeline board (also rendered in the drag overlay). */
export function ApplicationCard({
  app,
  moveTargets,
  onOpen,
  onAction,
  handleProps,
  dragging,
  overlay,
  canMove,
  canSubmit,
  canReject,
  canConfirmRejection,
}: {
  app: ApplicationOut;
  /** Stages this card can be moved to directly (menu alternative to drag and drop). */
  moveTargets: PipelineStageOut[];
  onOpen: () => void;
  onAction: (action: CardAction) => void;
  handleProps?: React.HTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> };
  dragging?: boolean;
  overlay?: boolean;
  canMove: boolean;
  canSubmit: boolean;
  canReject: boolean;
  canConfirmRejection: boolean;
}) {
  const styles = useStyles();
  const name = app.candidate.full_name || app.candidate.human_id || "Candidate";
  const stageKey = app.stage.key;
  const terminal = stageKey === "hired" || stageKey === "rejected" || stageKey === "withdrawn";
  const interested = app.latest_submission?.feedback_status === "interested" && stageKey === "submitted";
  const interviewing = moveTargets.find((s) => s.key === "interviewing");

  return (
    <Card className={mergeClasses(styles.card, dragging && styles.dragging, overlay && styles.overlay)} size="small">
      <div className={styles.top}>
        {canMove && (
          <Button
            appearance="subtle"
            size="small"
            className={styles.handle}
            icon={<ReOrderDotsVertical20Regular />}
            aria-label={`Move ${name}`}
            {...handleProps}
          />
        )}
        <Avatar name={name} size={28} color="colorful" aria-hidden />
        <div className={styles.identity}>
          <Button appearance="transparent" className={styles.name} onClick={onOpen} title={name}>
            {name}
          </Button>
          <Caption1 className={styles.muted}>
            {[app.candidate.current_title, app.candidate.current_employer].filter(Boolean).join(" · ") || app.human_id}
          </Caption1>
        </div>
        {!overlay && (
          <Menu positioning={{ position: "below", align: "end" }}>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" size="small" icon={<MoreHorizontal20Regular />} aria-label={`Actions for ${name}`} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={onOpen}>Open</MenuItem>
                {canMove &&
                  moveTargets
                    .filter((s) => !["rejected", "withdrawn", "submitted"].includes(s.key) && !(terminal && s.key === "applied"))
                    .map((s) => (
                      <MenuItem key={s.id} icon={<ArrowForward16Regular />} onClick={() => onAction({ kind: "move", stage: s })}>
                        Move to {s.label}
                      </MenuItem>
                    ))}
                {canSubmit && stageKey === "shortlisted" && (
                  <MenuItem icon={<Send16Regular />} onClick={() => onAction({ kind: "submit" })}>
                    Submit to client…
                  </MenuItem>
                )}
                {canReject && !terminal && (
                  <MenuItem icon={<DismissCircle16Regular />} onClick={() => onAction({ kind: "reject" })}>
                    Reject…
                  </MenuItem>
                )}
                {canMove && !terminal && (
                  <MenuItem icon={<PersonArrowLeft16Regular />} onClick={() => onAction({ kind: "withdraw" })}>
                    Withdraw…
                  </MenuItem>
                )}
                {canMove && (stageKey === "rejected" || stageKey === "withdrawn") && (
                  <MenuItem icon={<ArrowUndo16Regular />} onClick={() => onAction({ kind: "reopen" })}>
                    Reopen…
                  </MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
      <div className={styles.badges}>
        <ApplicationBadges app={app} />
        {!overlay && <AssessmentCardBadge applicationId={app.id} />}
        {!overlay && <InternalCardBadge applicationId={app.id} demandId={app.demand_id} />}
      </div>
      {app.pending_client_rejection_id && !overlay && (
        <PendingRejectionBar feedbackId={app.pending_client_rejection_id} demandId={app.demand_id} canConfirm={canConfirmRejection} compact />
      )}
      <div className={styles.footer}>
        <Text size={200} className={styles.muted}>
          {daysLabel(app.days_in_stage)} in stage
        </Text>
        {interested && interviewing && canMove && !overlay && (
          <Button size="small" appearance="primary" onClick={() => onAction({ kind: "move", stage: interviewing })}>
            Move to Interviewing
          </Button>
        )}
        {stageKey === "selected" && !overlay && <CreateOfferButton applicationId={app.id} size="small" />}
      </div>
    </Card>
  );
}
