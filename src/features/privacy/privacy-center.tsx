"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { hasPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ConsentTab } from "./consent-tab";
import { DsrRequestsTab } from "./dsr-requests";
import { LegalHoldsTab } from "./legal-holds";
import { RetentionTab } from "./retention-tab";
import { SupportAccessTab } from "./support-access-tab";

export const PRIVACY_TABS = [
  { value: "requests", label: "Requests", permission: "dsr:read" },
  { value: "holds", label: "Legal holds", permission: "privacy:manage" },
  { value: "consent", label: "Consent", permission: "privacy:manage" },
  { value: "retention", label: "Retention", permission: "retention:manage" },
  { value: "support", label: "Support access", permission: "support_access:approve" },
] as const;

export type PrivacyTab = (typeof PRIVACY_TABS)[number]["value"];

/** Permissions that open at least one privacy center tab. */
export const PRIVACY_PERMISSIONS = [...new Set(PRIVACY_TABS.map((t) => t.permission))];

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL },
});

/** `/admin/privacy`: DSRs, legal holds, consent, retention and support access (Epic 12). */
export function PrivacyCenter({ initialTab }: { initialTab?: string }) {
  const styles = useStyles();
  const router = useRouter();
  const permissions = usePermissions();
  const tabs = PRIVACY_TABS.filter((t) => hasPermission(permissions, t.permission));
  const [tab, setTab] = useState<string | undefined>(initialTab);
  if (tabs.length === 0) return <NoAccess what="the privacy center" />;
  const current = tabs.find((t) => t.value === tab)?.value ?? tabs[0].value;
  return (
    <>
      <PageHeader
        title="Privacy center"
        subtitle={
          <>
            Handle data subject requests, legal holds, consent notices, retention and vendor support access.{" "}
            <AppLink href="/sub-processors">View sub-processors</AppLink>
          </>
        }
      />
      <TabList
        className={styles.tabs}
        selectedValue={current}
        onTabSelect={(_, d) => {
          const value = String(d.value);
          setTab(value);
          router.replace(`/admin/privacy?tab=${value}`, { scroll: false });
        }}
        aria-label="Privacy center"
      >
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <div role="tabpanel" aria-label={tabs.find((t) => t.value === current)?.label}>
        {current === "requests" && <DsrRequestsTab />}
        {current === "holds" && <LegalHoldsTab />}
        {current === "consent" && <ConsentTab />}
        {current === "retention" && <RetentionTab />}
        {current === "support" && <SupportAccessTab />}
      </div>
    </>
  );
}
