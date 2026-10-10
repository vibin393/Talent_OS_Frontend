"use client";

import {
  Avatar,
  Badge,
  Body1,
  Button,
  Caption1,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  OverlayDrawer,
  Subtitle2,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowForward20Regular, Dismiss24Regular, Open20Regular, Send20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ApplicationInterviews } from "@/features/interviews/application-interviews";
import { ApplicationOffer, CreateOfferButton } from "@/features/offers/application-offer";
import { AppLink } from "@/components/app-link";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { AiScreeningPanel } from "@/features/screening/ai-screening-panel";
import { RecruiterScreening } from "@/features/screening/recruiter-screening";
import { SubmissionsPanel } from "@/features/submissions/submissions-panel";
import { errorMessage } from "@/lib/api/errors";
import type { ApplicationDetailOut, ApplicationOut, PipelineStageOut, PipelineStageTransition } from "@/lib/api/types";
import { ApplicationBadges, PendingRejectionBar } from "./badges";
import { actorLabel, daysLabel, SOURCE_LABELS } from "./format";
import { dropAction } from "./transitions";
import { useApplication } from "./use-pipeline";
import { InviteToAssessmentButton } from "@/features/assessments/invite-dialog";
import { InternalApplicationActions } from "@/features/mobility/pipeline-integrations";
import { usePermissions } from "@/features/auth/use-permission";
import { applicationPanels } from "./application-panels";
import "@/features/agents/screening/register";
import "@/features/voice/register";
import "@/features/agents/scheduling/register";
import "@/features/agents/submission/register";

const useStyles = makeStyles({
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, minWidth: 0 },
  identity: { display: "flex", flexDirection: "column", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  bar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center", marginTop: tokens.spacingVerticalS },
  tabs: { marginBlock: tokens.spacingVerticalM, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`, overflowX: "auto" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  timeline: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  event: {
    paddingInlineStart: tokens.spacingHorizontalM,
    borderLeft: `2px solid ${tokens.colorBrandStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  facts: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
});

type DrawerTab = "overview" | "screening" | "submissions" | "feedback" | "interviews" | "offer";

export type DrawerAction =
  | { kind: "move"; stage: PipelineStageOut }
  | { kind: "reject" }
  | { kind: "withdraw" }
  | { kind: "reopen" }
  | { kind: "submit" };

/** Application drawer: header with stage and actions; Overview (history), Screening, Submissions and Feedback tabs. */
export function ApplicationDrawer({
  applicationId,
  stages,
  transitions,
  onAction,
  onClose,
}: {
  applicationId: string;
  stages: PipelineStageOut[];
  transitions: PipelineStageTransition[] | null | undefined;
  onAction: (app: ApplicationOut, action: DrawerAction) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const query = useApplication(applicationId);
  const [tab, setTab] = useState<DrawerTab>("overview");
  const canMove = usePermission("application:move");
  const canReject = usePermission("application:reject");
  const canSubmit = usePermission("submission:create");
  const canScreen = usePermission("screening:write");
  const canFeedback = usePermission("submission:update");
  const perms = usePermissions();
  const extraPanels = applicationPanels((perm) => perm in perms);
  const submissionPanels = applicationPanels((perm) => perm in perms, "submissions");
  const app = query.data;
  const name = app?.candidate.full_name || app?.candidate.human_id || "Application";

  return (
    <OverlayDrawer position="end" size="large" open onOpenChange={(_, d) => !d.open && onClose()}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          <span className={styles.head}>
            <Avatar name={name} size={40} color="colorful" aria-hidden />
            <span className={styles.identity}>
              <span>{name}</span>
              {app && (
                <Caption1 className={styles.muted}>
                  {app.human_id} · {app.candidate.current_title ?? "—"}
                </Caption1>
              )}
            </span>
          </span>
        </DrawerHeaderTitle>
        {app && <DrawerActions app={app} stages={stages} transitions={transitions} onAction={onAction} canMove={canMove} canReject={canReject} canSubmit={canSubmit} />}
      </DrawerHeader>
      <DrawerBody>
        {query.isPending ? (
          <GridSkeleton rows={6} />
        ) : query.isError ? (
          <ErrorBar title="Could not load this application." message={errorMessage(query.error)} />
        ) : (
          app && (
            <>
              {app.pending_client_rejection_id && (
                <PendingRejectionBar feedbackId={app.pending_client_rejection_id} demandId={app.demand_id} canConfirm={canFeedback} />
              )}
              <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as DrawerTab)} aria-label="Application sections">
                <Tab value="overview">Overview</Tab>
                <Tab value="screening">Screening</Tab>
                <Tab value="submissions">Submissions{app.submissions?.length ? ` (${app.submissions.length})` : ""}</Tab>
                <Tab value="feedback">Feedback</Tab>
                <Tab value="interviews">Interviews</Tab>
                <Tab value="offer">Offer</Tab>
              </TabList>
              {tab === "overview" && <Overview app={app} stages={stages} />}
              {tab === "screening" && (
                <div className={styles.section}>
                  {extraPanels.map(({ key, component: Panel }) => (
                    <Panel key={key} applicationId={app.id} stageKey={app.stage.key} demandId={app.demand_id} />
                  ))}
                  <RecruiterScreening key={app.id} app={app} canWrite={canScreen} />
                  <AiScreeningPanel app={app} canWrite={canScreen} />
                </div>
              )}
              {tab === "submissions" && (
                <div className={styles.section}>
                  {submissionPanels.map(({ key, component: Panel }) => (
                    <Panel key={key} applicationId={app.id} stageKey={app.stage.key} demandId={app.demand_id} />
                  ))}
                  <SubmissionsPanel app={app} />
                </div>
              )}
              {tab === "feedback" && <SubmissionsPanel app={app} feedbackOnly />}
              {tab === "interviews" && <ApplicationInterviews applicationId={app.id} demandId={app.demand_id} candidateName={name} />}
              {tab === "offer" && <ApplicationOffer applicationId={app.id} stageKey={app.stage.key} />}
            </>
          )
        )}
      </DrawerBody>
    </OverlayDrawer>
  );
}

function DrawerActions({
  app,
  stages,
  transitions,
  onAction,
  canMove,
  canReject,
  canSubmit,
}: {
  app: ApplicationDetailOut;
  stages: PipelineStageOut[];
  transitions: PipelineStageTransition[] | null | undefined;
  onAction: (app: ApplicationOut, action: DrawerAction) => void;
  canMove: boolean;
  canReject: boolean;
  canSubmit: boolean;
}) {
  const styles = useStyles();
  const key = app.stage.key;
  const terminal = key === "hired" || key === "rejected" || key === "withdrawn";
  const moves = stages.filter((s) => dropAction(app.stage, s, transitions).kind === "move");
  const interviewing = moves.find((s) => s.key === "interviewing");
  const interested = app.latest_submission?.feedback_status === "interested" && key === "submitted";
  return (
    <div className={styles.bar}>
      <Badge appearance="filled" color={terminal ? "subtle" : "brand"} size="large">
        {app.stage.label}
      </Badge>
      <Text size={200} className={styles.muted}>
        {daysLabel(app.days_in_stage)} in stage
      </Text>
      <ApplicationBadges app={app} />
      <InternalApplicationActions applicationId={app.id} />
      <span style={{ flex: 1 }} />
      {interested && interviewing && canMove && (
        <Button appearance="primary" onClick={() => onAction(app, { kind: "move", stage: interviewing })}>
          Move to Interviewing
        </Button>
      )}
      {key === "selected" && <CreateOfferButton applicationId={app.id} />}
      <InviteToAssessmentButton
        context={{ kind: "application", apps: [{ applicationId: app.id, candidateId: app.candidate.id, name: app.candidate.full_name || app.candidate.human_id || "Candidate" }] }}
      />
      {canSubmit && key === "shortlisted" && (
        <Button appearance="primary" icon={<Send20Regular />} onClick={() => onAction(app, { kind: "submit" })}>
          Submit to client
        </Button>
      )}
      {canMove && moves.length > 0 && (
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button icon={<ArrowForward20Regular />}>Move to</Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {moves.map((s) => (
                <MenuItem key={s.id} onClick={() => onAction(app, { kind: "move", stage: s })}>
                  {s.label}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
      )}
      {canReject && !terminal && <Button onClick={() => onAction(app, { kind: "reject" })}>Reject</Button>}
      {canMove && !terminal && (
        <Button appearance="subtle" onClick={() => onAction(app, { kind: "withdraw" })}>
          Withdraw
        </Button>
      )}
      {canMove && (key === "rejected" || key === "withdrawn") && <Button onClick={() => onAction(app, { kind: "reopen" })}>Reopen</Button>}
    </div>
  );
}

function Overview({ app, stages }: { app: ApplicationDetailOut; stages: PipelineStageOut[] }) {
  const styles = useStyles();
  const label = (id: string | null, key: string | null | undefined) =>
    (id && stages.find((s) => s.id === id)?.label) || key || "—";
  const history = [...app.history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className={styles.section}>
      <dl className={styles.facts}>
        <dt>Candidate</dt>
        <dd>
          <AppLink href={`/candidates/${app.candidate.id}`}>
            Open Candidate 360 <Open20Regular aria-hidden style={{ verticalAlign: "middle" }} />
          </AppLink>
        </dd>
        <dt>Source</dt>
        <dd>{SOURCE_LABELS[app.source] ?? app.source}</dd>
        <dt>Added</dt>
        <dd>{formatDateTime(app.created_at)}</dd>
        <dt>In stage since</dt>
        <dd>{formatDateTime(app.stage_entered_at)}</dd>
      </dl>
      <section aria-label="Stage history">
        <Subtitle2 as="h3">History</Subtitle2>
        {history.length === 0 ? (
          <Body1 className={styles.muted}>No stage changes yet.</Body1>
        ) : (
          <ol className={styles.timeline}>
            {history.map((h) => (
              <li key={h.id} className={styles.event}>
                <Text weight="semibold">
                  {h.from_stage_id ? `${label(h.from_stage_id, h.from_key)} → ${label(h.to_stage_id, h.to_key)}` : `Added to ${label(h.to_stage_id, h.to_key)}`}
                </Text>
                <Caption1 className={styles.muted}>
                  {formatDateTime(h.at)} · {actorLabel(h.actor_kind)}
                  {h.reason_code ? ` · ${h.reason_code.replace(/_/g, " ")}` : ""}
                </Caption1>
                {h.note && <Body1>{h.note}</Body1>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
