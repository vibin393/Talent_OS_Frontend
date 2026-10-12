"use client";

import { Skeleton, SkeletonItem } from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryBoundary } from "@/features/access-denied/query-boundary";
import { AuthFrame } from "@/features/auth/auth-frame";
import { isApiError } from "@/lib/api/errors";
import type { ExternalMeOut } from "@/lib/api/types";
import { PortalSidebarLayout } from "./portal-sidebar";

export type PortalNavItem = { href: string; label: string; adminOnly?: boolean; permission?: string };

/**
 * Shell of the Client Portal (`/client`) and the Vendor Portal (`/vendor`): auth pages render in the
 * Talent OS auth frame; everything else needs a session (`me`), shows a left sidebar (M365 look) and wraps
 * content in the FR-82 `QueryBoundary` (portal principals ask their Account Manager).
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
  const items = nav
    .filter((n) => (!n.adminOnly || isAdmin) && (!n.permission || permissions.has(n.permission)))
    .map((n) => ({ href: n.href, label: n.label }));
  const signOut = async () => {
    try {
      await logout();
    } finally {
      queryClient.clear();
      router.replace(signInPath);
    }
  };
  return (
    <PortalSidebarLayout
      title={title}
      home={home}
      items={items}
      pathname={pathname}
      userName={me.data.display_name}
      onSignOut={signOut}
    >
      <QueryBoundary ask="account_manager">{children}</QueryBoundary>
    </PortalSidebarLayout>
  );
}
