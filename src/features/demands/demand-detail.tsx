"use client";

import { Body1, Card, CardHeader, makeStyles, Subtitle2, Tab, TabList, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { AiFieldsBar } from "./ai-field-badge";
import { AssignmentPicker } from "./assignment-picker";
import { DemandDrawer } from "./demand-drawer";
import { DemandHeader } from "./demand-header";
import type { DemandTab } from "./query";
import { allowedActions } from "./status";
import { ActivityTab } from "./tabs/activity-tab";
import { JdTab } from "./tabs/jd-tab";
import { MatchesTab } from "./tabs/matches-tab";
import { OverviewTab } from "./tabs/overview-tab";
import { PipelineTab } from "./tabs/pipeline-tab";
import { DemandInterviews } from "@/features/interviews/demand-interviews";
import { DemandOffers } from "@/features/offers/demand-offers";
import { useAssignments } from "./use-assignments";
import { useDemand, useInvalidateDemand } from "./use-demand";
import { DemandEmailButton } from "@/features/comms/demand-email-button";
import { EntityTasksCard } from "@/features/tasks/entity-tasks-card";
import { DemandVendorReleases } from "@/features/vendors/demand-releases-tab";
import "@/features/talent-pools/demand-tabs";
import "@/features/predictions/register-panels";
import "@/features/fairness/register-panels";
import "@/features/mobility/register-tabs";
import "@/features/job-boards/register";
import "@/features/agents/sourcing/register";
import "@/features/agents/demand/register";
import { DuplicateBanner } from "@/features/agents/demand/duplicate-banner";
import { demandExtensionTabs, isDemandExtensionTabKey } from "./demand-tabs";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  tabs: {
    marginBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflowX: "auto",
  },
  bar: { marginBottom: tokens.spacingVerticalM },
});

/** `/demands/[id]`: header with lifecycle actions and the Overview / JD / Pipeline / Matches / Activity tabs. */
export function DemandDetail({ demandId, initialTab }: { demandId: string; initialTab: DemandTab }) {
  const styles = useStyles();
  const router = useRouter();
  const permissions = usePermissions();
  const canRead = usePermission("demand:read");
  const canUpdate = usePermission("demand:update");
  const canAssign = usePermission("demand:assign");
  const canInterviews = usePermission("interview:read");
  const canPlanInterviews = usePermission("interview:schedule");
  const canOffers = usePermission("offer:read");
  const canVendors = usePermission("vendor:read");
  const query = useDemand(demandId);
  const invalidate = useInvalidateDemand();
  const [tab, setTab] = useState<DemandTab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [publishRequested, setPublishRequested] = useState(false);
  const assignments = useAssignments(demandId);
  const extensionTabs = demandExtensionTabs((perm) => perm in permissions);

  if (!canRead) return <NoAccess what="demands" />;

  const selectTab = (next: DemandTab) => {
    setTab(next);
    router.replace(next === "overview" ? `/demands/${demandId}` : `/demands/${demandId}?tab=${next}`, { scroll: false });
  };

  const back = (
    <div className={styles.back}>
      <AppLink href="/demands">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Demands
      </AppLink>
    </div>
  );

  if (query.isPending) {
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader
              header={<Subtitle2 as="h1">Demand not found</Subtitle2>}
              description={<Body1>This demand does not exist or you do not have access to it.</Body1>}
            />
          </Card>
        ) : (
          <ErrorBar title="Could not load this demand." message={errorMessage(query.error)} />
        )}
      </>
    );
  }

  const demand = query.data;
  const actions = allowedActions(demand.status, permissions, { archived: !!demand.archived_at });

  return (
    <>
      {back}
      <DemandHeader
        demand={demand}
        actions={actions}
        onEdit={() => setEditing(true)}
        onAssign={() => setAssigning(true)}
        onPublish={() => {
          selectTab("jd");
          setPublishRequested(true);
        }}
        extraActions={<DemandEmailButton demand={demand} />}
      />
      <DuplicateBanner demandId={demand.id} />
      {demand.ai_extracted_fields.length > 0 && (
        <div className={styles.bar}>
          <AiFieldsBar demandId={demand.id} extracted={demand.ai_extracted_fields} canConfirm={canUpdate} />
        </div>
      )}

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => selectTab(d.value as DemandTab)} aria-label="Demand sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="jd">Job description</Tab>
        <Tab value="pipeline">Pipeline</Tab>
        {(canInterviews || canPlanInterviews) && <Tab value="interviews">Interviews</Tab>}
        {canOffers && <Tab value="offers">Offers</Tab>}
        <Tab value="matches">Matches</Tab>
        <Tab value="activity">Activity</Tab>
        {canVendors && <Tab value="vendors">Vendor releases</Tab>}
        {extensionTabs.map((t) => (
          <Tab key={t.key} value={t.key}>
            {t.label}
          </Tab>
        ))}
      </TabList>

      {tab === "overview" && (
        <>
          <OverviewTab demand={demand} canAssign={canAssign} canUpdate={canUpdate} />
          <EntityTasksCard entityType="demand" entityId={demand.id} />
        </>
      )}
      {tab === "jd" && (
        <JdTab
          demand={demand}
          canUpdate={canUpdate}
          publishRequested={publishRequested}
          onPublishHandled={() => setPublishRequested(false)}
        />
      )}
      {tab === "pipeline" && <PipelineTab demand={demand} />}
      {tab === "interviews" && <DemandInterviews demandId={demand.id} />}
      {tab === "offers" && <DemandOffers demandId={demand.id} />}
      {tab === "matches" && <MatchesTab demandId={demand.id} onOpenPipeline={() => selectTab("pipeline")} />}
      {tab === "activity" && <ActivityTab demandId={demand.id} onChanged={() => invalidate(demand.id)} />}
      {tab === "vendors" && canVendors && <DemandVendorReleases demandId={demand.id} demandStatus={demand.status} />}
      {isDemandExtensionTabKey(tab) &&
        extensionTabs
          .filter((t) => t.key === tab)
          .map(({ key, component: TabComponent }) => <TabComponent key={key} demandId={demand.id} demandStatus={demand.status} />)}

      {editing && <DemandDrawer demand={demand} onClose={() => setEditing(false)} />}
      {assigning && assignments.data && (
        <AssignmentPicker demandId={demand.id} current={assignments.data.items} onClose={() => setAssigning(false)} />
      )}
    </>
  );
}
