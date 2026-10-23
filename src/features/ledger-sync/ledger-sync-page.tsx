"use client";

import { Dropdown, Field, makeStyles, Option, Tab, TabList, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import { DocumentsTab } from "./documents-tab";
import { ReconciliationTab } from "./reconciliation-tab";
import { SuggestionsTab } from "./suggestions-tab";
import { TallyTab } from "./tally-tab";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  header: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "end", flexWrap: "wrap" },
});

type TabKey = "documents" | "suggestions" | "reconciliation" | "tally";

/** `/finance/ledger-sync`: legal-entity picker plus Documents, Payment suggestions, Reconciliation and Tally files. */
export function LedgerSyncPage() {
  const styles = useStyles();
  const [tab, setTab] = useState<TabKey>("documents");
  const [le, setLe] = useState<string | null>(null);
  const les = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal) });
  const entities = les.data ?? [];
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    if (!le && entities.length) setLe(entities[0].id);
  }, [le, entities]);
  const leName = entities.find((e) => e.id === le)?.name ?? "";

  return (
    <div className={styles.root}>
      <PageHeader title="Ledger sync" subtitle="Invoices, notes and payments synced with your accounting system." />
      <div className={styles.header}>
        <Field label="Legal entity">
          <Dropdown value={leName} selectedOptions={le ? [le] : []} onOptionSelect={(_, d) => d.optionValue && setLe(d.optionValue)}>
            {entities.map((e) => (
              <Option key={e.id} value={e.id}>
                {e.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)}>
        <Tab value="documents">Documents</Tab>
        <Tab value="suggestions">Payment suggestions</Tab>
        <Tab value="reconciliation">Reconciliation</Tab>
        <Tab value="tally">Tally files</Tab>
      </TabList>
      {tab === "documents" ? <DocumentsTab legalEntityId={le} installationId={null} /> : null}
      {tab === "suggestions" ? <SuggestionsTab legalEntityId={le} /> : null}
      {tab === "reconciliation" ? <ReconciliationTab legalEntityId={le} /> : null}
      {tab === "tally" ? <TallyTab legalEntityId={le} installationId={null} /> : null}
    </div>
  );
}
