"use client";

import { Tab, TabList } from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { useRcvStyles } from "@/features/receivables/components";
import { DscPendingView } from "./pending-view";
import { DscPoliciesView } from "./policies-view";

/** `/finance/dsc`: pending-signature queue and DSC policies (Epic 51). */
export function DscView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const canQueue = hasAnyPermission(perms, ["invoice:issue", "dsc:configure"]);
  const canPolicies = hasAnyPermission(perms, ["dsc:configure", "billing:read"]);
  const [tab, setTab] = useState<"pending" | "policies">(canQueue ? "pending" : "policies");
  if (!canQueue && !canPolicies) return <NoAccess what="DSC signing" />;
  const current = tab === "pending" && !canQueue ? "policies" : tab;
  return (
    <div className={s.page}>
      <PageHeader title="DSC signing" subtitle="Digitally signed invoices and credit notes" />
      <TabList selectedValue={current} onTabSelect={(_, d) => setTab(d.value as "pending" | "policies")}>
        {canQueue && <Tab value="pending">Pending signatures</Tab>}
        {canPolicies && <Tab value="policies">Policies</Tab>}
      </TabList>
      {current === "pending" ? <DscPendingView /> : <DscPoliciesView />}
    </div>
  );
}
