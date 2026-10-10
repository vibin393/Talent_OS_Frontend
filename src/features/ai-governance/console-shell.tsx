"use client";

import { makeStyles, Tab, TabList, Title2, tokens } from "@fluentui/react-components";
import { usePathname, useRouter } from "next/navigation";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import { KillSwitchBanner, KillSwitchControl } from "./kill-switch-control";
import { activeConsoleTab, CONSOLE_TABS } from "./logic";

const useStyles = makeStyles({
  head: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  tabs: { overflowX: "auto", marginBottom: tokens.spacingVerticalM, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
});

/**
 * Shared frame of every `/admin/ai/*` console page: title "AI governance", the kill switch, its banner and the
 * console `TabList`. `permission` gates the page body (default `ai:govern`).
 */
export function ConsoleShell({
  children,
  permission = "ai:govern",
  anyOf = [],
}: {
  children: React.ReactNode;
  permission?: string;
  anyOf?: readonly string[];
}) {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const main = usePermission(permission);
  const perms = me?.permissions ?? {};
  const allowed = main || anyOf.some((p) => p in perms);
  return (
    <>
      <div className={styles.head}>
        <Title2 as="h1">AI governance</Title2>
        <KillSwitchControl />
      </div>
      <TabList
        className={styles.tabs}
        selectedValue={activeConsoleTab(pathname)}
        onTabSelect={(_, d) => router.push(String(d.value))}
        aria-label="AI governance"
      >
        {CONSOLE_TABS.map((t) => (
          <Tab key={t.href} value={t.href}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <div className={styles.body}>
        <KillSwitchBanner />
        {me && !allowed ? <NoAccess what="the AI governance console" /> : children}
      </div>
    </>
  );
}
