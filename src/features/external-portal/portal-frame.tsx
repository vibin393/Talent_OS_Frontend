"use client";

import {
  Button,
  makeStyles,
  mergeClasses,
  Skeleton,
  SkeletonItem,
  Text,
  tokens,
} from "@fluentui/react-components";
import { SignOut20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryBoundary } from "@/features/access-denied/query-boundary";
import { AuthFrame } from "@/features/auth/auth-frame";
import { isApiError } from "@/lib/api/errors";
import type { ExternalMeOut } from "@/lib/api/types";

export type PortalNavItem = { href: string; label: string; adminOnly?: boolean; permission?: string };

const useStyles = makeStyles({
  shell: { minHeight: "100svh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground3 },
  bar: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThick} solid ${tokens.colorBrandBackground}`,
  },
  barInner: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    minHeight: "56px",
  },
  brand: { fontWeight: tokens.fontWeightSemibold, marginInlineEnd: tokens.spacingHorizontalL },
  nav: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, flex: 1 },
  navLink: {
    minHeight: "40px",
    display: "inline-flex",
    alignItems: "center",
    padding: `0 ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  navActive: { fontWeight: tokens.fontWeightSemibold, boxShadow: `inset 0 -2px 0 ${tokens.colorBrandStroke1}` },
  who: { color: tokens.colorNeutralForeground3 },
  main: { flex: 1, width: "100%", maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box", padding: tokens.spacingHorizontalXL },
});

function isActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shell of the Client Portal (`/client`) and the Vendor Portal (`/vendor`): auth pages render in the
 * Talent OS auth frame; everything else needs a session (`me`), shows the portal nav and wraps content in
 * the FR-82 `QueryBoundary` (portal principals ask their Account Manager).
 */
export function ExternalPortalFrame({
  home,
  title,
  signInPath,
  publicPaths,
  nav,
  meKey,
  loadMe,
  logout,
  isAdmin,
  children,
}: {
  home: string;
  title: string;
  signInPath: string;
  publicPaths: readonly string[];
  nav: readonly PortalNavItem[];
  meKey: readonly unknown[];
  loadMe: (signal?: AbortSignal) => Promise<ExternalMeOut>;
  logout: () => Promise<void>;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const me = useQuery({ queryKey: meKey, queryFn: ({ signal }) => loadMe(signal), enabled: !isPublic, retry: false });
  const unauthorized = isApiError(me.error) && me.error.status === 401;
  useEffect(() => {
    if (!isPublic && unauthorized) router.replace(`${signInPath}?next=${encodeURIComponent(pathname)}`);
  }, [isPublic, unauthorized, router, signInPath, pathname]);

  if (isPublic) return <AuthFrame>{children}</AuthFrame>;
  if (!me.data) {
    return (
      <Skeleton aria-label="Loading" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonItem size={32} />
        <SkeletonItem size={16} />
        <SkeletonItem size={16} />
      </Skeleton>
    );
  }
  const permissions = new Set(me.data.portal_permissions);
  const items = nav.filter((n) => (!n.adminOnly || isAdmin) && (!n.permission || permissions.has(n.permission)));
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <Text className={styles.brand}>{title}</Text>
          <nav className={styles.nav} aria-label={title}>
            {items.map((n) => (
              <NextLink
                key={n.href}
                href={n.href}
                className={mergeClasses(styles.navLink, isActive(pathname, n.href, home) && styles.navActive)}
                aria-current={isActive(pathname, n.href, home) ? "page" : undefined}
              >
                {n.label}
              </NextLink>
            ))}
          </nav>
          <Text className={styles.who}>{me.data.display_name}</Text>
          <Button
            appearance="subtle"
            icon={<SignOut20Regular />}
            onClick={async () => {
              try {
                await logout();
              } finally {
                queryClient.clear();
                router.replace(signInPath);
              }
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <QueryBoundary ask="account_manager">{children}</QueryBoundary>
      </main>
    </div>
  );
}
