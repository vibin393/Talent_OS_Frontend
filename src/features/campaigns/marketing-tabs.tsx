"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { usePermission } from "@/features/auth/use-permission";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
});

export const MARKETING_SECTIONS = [
  { href: "/marketing", label: "Overview" },
  { href: "/marketing/audiences", label: "Audiences" },
  { href: "/marketing/campaigns", label: "Campaigns" },
  { href: "/marketing/sequences", label: "Sequences" },
  { href: "/marketing/settings", label: "Settings", requires: "marketing:configure" },
] as const;

/** The section a marketing path belongs to (longest matching prefix). */
export function marketingSection(pathname: string): string {
  const match = [...MARKETING_SECTIONS]
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? "/marketing";
}

/** Header + section tabs for the list pages of `/marketing` (hidden on detail and wizard pages). */
export function MarketingTabs() {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const canConfigure = usePermission("marketing:configure");
  const isListPage = MARKETING_SECTIONS.some((s) => s.href === pathname);
  if (!isListPage) return null;
  return (
    <>
      <PageHeader title="Recruitment marketing" subtitle="Audiences, campaigns and nurture sequences for your talent pools" />
      <TabList
        className={styles.tabs}
        selectedValue={marketingSection(pathname)}
        onTabSelect={(_, d) => router.push(String(d.value))}
        aria-label="Marketing sections"
      >
        {MARKETING_SECTIONS.filter((s) => !("requires" in s) || canConfigure).map((s) => (
          <Tab key={s.href} value={s.href}>
            {s.label}
          </Tab>
        ))}
      </TabList>
    </>
  );
}
