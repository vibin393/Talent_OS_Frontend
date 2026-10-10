"use client";

import { Tab, TabList, makeStyles, tokens } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { QuestionnairesAdmin } from "./questionnaires-admin";
import { ReasonCodesAdmin } from "./reason-codes-admin";
import { PipelineSettingsAdmin } from "./settings-admin";
import { StagesAdmin } from "./stages-admin";
import { PIPELINE_ADMIN_TABS, type PipelineAdminTab } from "./tabs";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL, overflowX: "auto" },
});

/** `/admin/pipeline`: stages, reason codes, questionnaires and submission settings (`pipeline:configure`). */
export function PipelineAdmin({ initialTab }: { initialTab: PipelineAdminTab }) {
  const styles = useStyles();
  const router = useRouter();
  const canConfigure = usePermission("pipeline:configure");
  const [tab, setTab] = useState<PipelineAdminTab>(initialTab);
  if (!canConfigure) return <NoAccess what="pipeline settings" />;
  return (
    <>
      <PageHeader title="Pipeline" subtitle="Stages, rejection and withdrawal reasons, screening questionnaires and submission rules." />
      <TabList
        className={styles.tabs}
        selectedValue={tab}
        onTabSelect={(_, d) => {
          const next = d.value as PipelineAdminTab;
          setTab(next);
          router.replace(`/admin/pipeline?tab=${next}`, { scroll: false });
        }}
        aria-label="Pipeline settings sections"
      >
        {PIPELINE_ADMIN_TABS.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      {tab === "stages" && <StagesAdmin />}
      {tab === "reasons" && <ReasonCodesAdmin />}
      {tab === "questionnaires" && <QuestionnairesAdmin />}
      {tab === "settings" && <PipelineSettingsAdmin />}
    </>
  );
}
