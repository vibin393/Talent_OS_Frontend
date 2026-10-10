"use client";

import { makeStyles, Tab, TabList, tokens } from "@fluentui/react-components";
import { usePathname, useRouter } from "next/navigation";
import { canAccessAdmin } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ADMIN_HOME, activeAdminHref, visibleAdminSections } from "./sections";
import { NoAccess } from "./ui";

const useStyles = makeStyles({
  tabs: {
    marginBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflowX: "auto",
  },
});

/** Admin area frame: permission gate plus the admin-center style `TabList` sub-navigation. */
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const permissions = usePermissions();

  if (!canAccessAdmin(permissions)) return <NoAccess what="workspace administration" />;

  const sections = visibleAdminSections(permissions);
  return (
    <>
      <TabList
        className={styles.tabs}
        selectedValue={activeAdminHref(pathname)}
        onTabSelect={(_, data) => router.push(String(data.value))}
        aria-label="Administration"
      >
        <Tab value={ADMIN_HOME}>Home</Tab>
        {sections.map((s) => (
          <Tab key={s.href} value={s.href}>
            {s.label}
          </Tab>
        ))}
      </TabList>
      {children}
    </>
  );
}
