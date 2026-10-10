"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { SlaSettings } from "@/features/demands/sla-settings";
import { SlaTargetsTab } from "./sla-targets-tab";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
});

/** `/admin/sla` (Epic 32 B2): Demands (the Phase 1 editor, unchanged) and Phase 2 generic targets. */
export function SlaAdmin() {
  const styles = useStyles();
  const canDemand = usePermission("settings:manage");
  const canGeneric = usePermission("sla:read");
  const [tab, setTab] = useState<"demands" | "phase2">(canDemand ? "demands" : "phase2");
  if (!canDemand && !canGeneric) return <NoAccess what="SLA settings" />;
  if (!canGeneric) return <SlaSettings />;
  return (
    <>
      {tab === "phase2" && <PageHeader title="SLAs" subtitle="Service levels for demands and Phase 2 records." />}
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "demands" | "phase2")}>
        {canDemand && <Tab value="demands">Demands</Tab>}
        <Tab value="phase2">Phase 2</Tab>
      </TabList>
      {tab === "demands" ? <SlaSettings /> : <SlaTargetsTab />}
    </>
  );
}
