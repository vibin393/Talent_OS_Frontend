"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Subtitle2,
  Tab,
  TabList,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowSwap20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  Edit20Regular,
  Call20Regular,
  ArrowUndo20Regular,
} from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { EntityTasksCard } from "@/features/tasks/entity-tasks-card";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { TaskEntityType } from "@/lib/api/types";
import { crmKeys } from "../api";
import { formatMoney, LEAD_STATUS_LABELS } from "../format";
import type { LeadStatus } from "../types";
import { HistoryList, LeadStatusBadge, ReasonDialog } from "../ui";
import { useLead, useLeadHistory, useLeadMutations, useLeadSources } from "../use-leads";
import { ConvertWizard } from "./convert-wizard";
import { rolesOf } from "./convert-logic";
import { LeadDrawer } from "./lead-drawer";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "flex-start", marginBottom: tokens.spacingVerticalM },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flex: "1 1 320px", minWidth: 0 },
  line: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  card: { padding: tokens.spacingHorizontalL },
  banner: { marginBottom: tokens.spacingVerticalM },
});

type Tab = "overview" | "activity" | "history";

/** `/leads/[id]`: lead header with status actions, details, activity timeline, tasks and history. */
export function LeadDetail({ leadId }: { leadId: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canRead = usePermission("lead:read");
  const canWrite = usePermission("lead:write");
  const canConvert = usePermission("opportunity:write");
  const query = useLead(leadId);
  const history = useLeadHistory(leadId);
  const sources = useLeadSources();
  const { transition } = useLeadMutations();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [reasonFor, setReasonFor] = useState<"disqualify" | "reopen" | null>(null);

  if (!canRead) return <NoAccess what="leads" />;

  const back = (
    <div className={styles.back}>
      <AppLink href="/leads">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Leads
      </AppLink>
    </div>
  );
  if (query.isPending) return (<>{back}<GridSkeleton rows={6} /></>);
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Lead not found</Subtitle2>} description={<Body1>This lead does not exist or you do not have access to it.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this lead." message={errorMessage(query.error)} />
        )}
      </>
    );
  }

  const lead = query.data;
  const converted = lead.status === "converted";
  const editable = canWrite && !converted && !lead.archived_at;
  const move = (to: LeadStatus, label: string) =>
    transition
      .mutateAsync({ id: lead.id, body: { to } })
      .then(() => toast.success(`Lead marked ${label}`))
      .catch((e) => toast.error(errorMessage(e)));
  const roles = rolesOf(lead);
  const sourceLabel = sources.data?.find((s) => s.code === lead.source_code)?.label ?? lead.source_code ?? "—";

  return (
    <>
      {back}
      {converted && (
        <MessageBar intent="success" className={styles.banner} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Converted {lead.converted_at ? formatDateTime(lead.converted_at) : ""}</MessageBarTitle>
            This lead is read-only.
          </MessageBarBody>
          <MessageBarActions>
            {lead.converted_opportunity_id && <AppLink href={`/opportunities/${lead.converted_opportunity_id}`}>Open opportunity</AppLink>}
            {lead.converted_client_id && <AppLink href={`/clients/${lead.converted_client_id}`}>Open client</AppLink>}
          </MessageBarActions>
        </MessageBar>
      )}
      <div className={styles.header}>
        <div className={styles.identity}>
          <Text className={styles.muted} weight="semibold">
            {lead.human_id}
          </Text>
          <div className={styles.line}>
            <Title2 as="h1">{lead.company_name}</Title2>
            <LeadStatusBadge status={lead.status} />
          </div>
          <div className={styles.line}>
            {lead.owner && <Text>Owner {lead.owner.name}</Text>}
            {lead.contact_name && <Text className={styles.muted}>{lead.contact_name}</Text>}
          </div>
        </div>
        {editable && (
          <div className={styles.actions}>
            {lead.status === "new" && (
              <Button icon={<Call20Regular />} disabled={transition.isPending} onClick={() => move("contacted", "contacted")}>
                Mark contacted
              </Button>
            )}
            {(lead.status === "new" || lead.status === "contacted") && (
              <Button icon={<Checkmark20Regular />} disabled={transition.isPending} onClick={() => move("qualified", "qualified")}>
                Qualify
              </Button>
            )}
            {lead.status === "qualified" && canConvert && (
              <Button appearance="primary" icon={<ArrowSwap20Regular />} onClick={() => setConverting(true)}>
                Convert
              </Button>
            )}
            {["new", "contacted", "qualified"].includes(lead.status) && (
              <Button icon={<Dismiss20Regular />} onClick={() => setReasonFor("disqualify")}>
                Disqualify
              </Button>
            )}
            {lead.status === "disqualified" && (
              <Button icon={<ArrowUndo20Regular />} onClick={() => setReasonFor("reopen")}>
                Reopen
              </Button>
            )}
            <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as Tab)} aria-label="Lead sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="activity">Activity</Tab>
        <Tab value="history">History</Tab>
      </TabList>

      {tab === "overview" && (
        <>
          <div className={styles.cards}>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
              <dl className={admin.detailList}>
                <dt>Website</dt>
                <dd>{lead.website ?? "—"}</dd>
                <dt>GSTIN</dt>
                <dd>{lead.gstin ?? "—"}</dd>
                <dt>Industry</dt>
                <dd>{lead.industry ?? "—"}</dd>
                <dt>Location</dt>
                <dd>{lead.location ?? "—"}</dd>
                <dt>Source</dt>
                <dd>{sourceLabel}</dd>
                <dt>Expected revenue</dt>
                <dd>{formatMoney(lead.expected_annual_revenue, lead.currency)}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(lead.created_at)}</dd>
                {lead.status === "disqualified" && (
                  <>
                    <dt>Disqualified</dt>
                    <dd>
                      {lead.disqualify_reason_code}
                      {lead.disqualify_note ? ` — ${lead.disqualify_note}` : ""}
                    </dd>
                  </>
                )}
              </dl>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2 as="h2">Contact</Subtitle2>} />
              <dl className={admin.detailList}>
                <dt>Name</dt>
                <dd>{lead.contact_name ?? "—"}</dd>
                <dt>Title</dt>
                <dd>{lead.contact_title ?? "—"}</dd>
                <dt>Email</dt>
                <dd>{lead.contact_email ?? "—"}</dd>
                <dt>Phone</dt>
                <dd>{lead.contact_phone ?? "—"}</dd>
              </dl>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2 as="h2">Estimated roles</Subtitle2>} />
              {roles.length === 0 ? (
                <Body1 className={styles.muted}>No roles yet.</Body1>
              ) : (
                <ul>
                  {roles.map((r, i) => (
                    <li key={i}>
                      {r.title} × {r.positions}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <EntityTasksCard entityType={"lead" as TaskEntityType} entityId={lead.id} />
        </>
      )}
      {tab === "activity" && (
        <ActivityTimeline
          entityType="leads"
          entityId={lead.id}
          onChanged={() => qc.invalidateQueries({ queryKey: crmKeys.lead(lead.id) })}
        />
      )}
      {tab === "history" && (
        <Card className={styles.card}>
          {history.data ? (
            <HistoryList items={history.data} label={(v) => LEAD_STATUS_LABELS[v as LeadStatus] ?? v} />
          ) : (
            <GridSkeleton rows={3} />
          )}
        </Card>
      )}

      {editing && <LeadDrawer lead={lead} onClose={() => setEditing(false)} />}
      {converting && <ConvertWizard lead={lead} onClose={() => setConverting(false)} />}
      {reasonFor !== null && (
      <ReasonDialog
        open
        title={reasonFor === "reopen" ? "Reopen lead" : "Disqualify lead"}
        kind={reasonFor === "reopen" ? "reopen" : "lead_disqualify"}
        confirmLabel={reasonFor === "reopen" ? "Reopen" : "Disqualify"}
        onClose={() => setReasonFor(null)}
        onConfirm={(r) =>
          transition
            .mutateAsync({ id: lead.id, body: { to: reasonFor === "reopen" ? "new" : "disqualified", reason_code: r.reason_code, note: r.note } })
            .then(() => toast.success(reasonFor === "reopen" ? "Lead reopened" : "Lead disqualified"))
        }
      />
      )}
    </>
  );
}
