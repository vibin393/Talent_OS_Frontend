"use client";

import { Dropdown, Field, Input, Option, Tab, TabList } from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { LegalEntitySelect, useRcvStyles } from "../components";
import { currentFy, isValidFy, QUARTERS } from "./logic";
import { TdsExceptionsView } from "./exceptions-view";
import { TdsRunsView } from "./runs-view";
import { TdsStatusView } from "./status-view";
import { TdsTansView } from "./tans-view";

type TabValue = "runs" | "exceptions" | "status" | "tans";
const ALL = "all";

/** `/finance/tds-reconciliation`: 26AS / AIS runs, exceptions, Client x quarter status and TAN mappings (Epic 51). */
export function TdsReconView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["receivables:read", "tds_recon:write"]);
  const [tab, setTab] = useState<TabValue>("runs");
  const [le, setLe] = useState<string | null>(null);
  const [fyInput, setFyInput] = useState(currentFy);
  const [quarter, setQuarter] = useState<string>(ALL);
  if (!canRead) return <NoAccess what="TDS reconciliation" />;
  const fy = isValidFy(fyInput) ? fyInput.trim() : "";
  const filters = { legal_entity_id: le, fy: fy || null, quarter: quarter === ALL ? null : quarter };
  return (
    <div className={s.page}>
      <PageHeader title="TDS reconciliation" subtitle="Match Form 26AS / AIS credits against TDS recorded on receipts" />
      {tab !== "tans" && (
        <div className={s.row}>
          <LegalEntitySelect value={le} onChange={setLe} />
          <Field
            label="Financial year"
            validationState={fy ? "none" : "error"}
            validationMessage={fy ? undefined : "Use the format 2026-27."}
          >
            <Input value={fyInput} onChange={(_, d) => setFyInput(d.value)} className={s.narrow} />
          </Field>
          {tab !== "status" && (
            <Field label="Quarter">
              <Dropdown
                value={quarter === ALL ? "All quarters" : quarter}
                selectedOptions={[quarter]}
                onOptionSelect={(_, d) => d.optionValue && setQuarter(d.optionValue)}
                className={s.narrow}
              >
                <Option value={ALL}>All quarters</Option>
                {QUARTERS.map((qq) => (
                  <Option key={qq} value={qq}>
                    {qq}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
        </div>
      )}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabValue)}>
        <Tab value="runs">Runs</Tab>
        <Tab value="exceptions">Exceptions</Tab>
        <Tab value="status">Status</Tab>
        <Tab value="tans">TAN mappings</Tab>
      </TabList>
      {tab === "runs" && <TdsRunsView filters={filters} />}
      {tab === "exceptions" && <TdsExceptionsView filters={filters} />}
      {tab === "status" && <TdsStatusView fy={fy} legalEntityId={le} />}
      {tab === "tans" && <TdsTansView />}
    </div>
  );
}
