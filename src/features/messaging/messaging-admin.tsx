"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ConnectorsTab } from "./admin-connectors";
import { ChannelSettingsTab, ManualQueueTab, OptOutsTab, UnmatchedTab } from "./admin-ops";
import { TemplatesTab } from "./admin-templates";

const useStyles = makeStyles({ tabs: { marginBottom: tokens.spacingVerticalL } });

const TABS = [
  { id: "connectors", label: "Connectors" },
  { id: "templates", label: "Templates" },
  { id: "settings", label: "Channel settings" },
  { id: "opt-outs", label: "Opt-outs" },
  { id: "manual", label: "Manual queue" },
  { id: "unmatched", label: "Unmatched inbound" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** `/admin/messaging` (Epic 33): SMS / WhatsApp providers, templates, settings, opt-outs and operator queues. */
export function MessagingAdmin() {
  const styles = useStyles();
  const allowed = usePermission("messaging:configure");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "connectors";
  if (!allowed) return <NoAccess what="messaging settings" />;
  return (
    <>
      <PageHeader title="Messaging" subtitle="SMS and WhatsApp for transactional messages: providers, DLT / approved templates, quiet hours and opt-outs." />
      <TabList
        selectedValue={tab}
        onTabSelect={(_, d) => router.replace(`${pathname}?tab=${d.value as string}`, { scroll: false })}
        aria-label="Messaging sections"
        className={styles.tabs}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      {tab === "connectors" && <ConnectorsTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "settings" && <ChannelSettingsTab />}
      {tab === "opt-outs" && <OptOutsTab />}
      {tab === "manual" && <ManualQueueTab />}
      {tab === "unmatched" && <UnmatchedTab />}
    </>
  );
}
