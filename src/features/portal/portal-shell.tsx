"use client";

import { makeStyles, Skeleton, SkeletonItem, Text, tokens } from "@fluentui/react-components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CareerThemeProvider } from "@/features/careers/career-theme-provider";
import { useNavWithMessages } from "@/features/agents/screening/portal-chats"; // Epic 57: "Messages"
import { PortalSidebarLayout } from "@/features/external-portal/portal-sidebar";
import { isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys, setPortalUnauthorizedHandler } from "@/lib/api/portal-client";
import type { PortalMe } from "@/lib/api/types";
import { rememberedTenant, rememberTenant, signInUrl } from "./format";
import { ErrorBlock } from "./ui";

const AUTH_PATHS = ["/portal/sign-in", "/portal/verify"];

export const NAV = [
  { href: "/portal", label: "My applications" },
  { href: "/portal/profile", label: "Profile" },
  { href: "/portal/work", label: "My work" }, // Epic 19
  { href: "/portal/privacy", label: "Privacy" },
] as const;

const useStyles = makeStyles({
  main: { flex: 1, width: "100%", maxWidth: "1080px", margin: "0 auto", boxSizing: "border-box", padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}` },
  skeleton: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL, maxWidth: "860px", margin: "0 auto", width: "100%" },
});

function Guarded({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const pathname = usePathname();
  const nav = useNavWithMessages(NAV);
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: portalKeys.me, queryFn: ({ signal }) => portalApi.me(signal), staleTime: 60_000, retry: false });
  const [leaving, setLeaving] = useState(false);

  const toSignIn = () => {
    setLeaving(true);
    const slug = queryClient.getQueryData<PortalMe>(portalKeys.me)?.tenant.slug ?? rememberedTenant();
    queryClient.removeQueries({ queryKey: portalKeys.all });
    window.location.replace(signInUrl(slug));
  };

  useEffect(() => setPortalUnauthorizedHandler(toSignIn));
  const unauthorized = me.isError && isApiError(me.error) && me.error.status === 401;
  useEffect(() => {
    if (unauthorized) window.location.replace(signInUrl(rememberedTenant()));
  }, [unauthorized]);
  useEffect(() => {
    if (me.data) rememberTenant(me.data.tenant.slug);
  }, [me.data]);

  if (me.isPending || unauthorized || leaving) {
    return (
      <CareerThemeProvider brandColor={null}>
        <Skeleton className={styles.skeleton} aria-label="Loading your portal" aria-busy="true">
          <SkeletonItem size={40} />
          <SkeletonItem size={96} />
          <SkeletonItem size={96} />
        </Skeleton>
      </CareerThemeProvider>
    );
  }
  if (me.isError || !me.data) {
    return (
      <CareerThemeProvider brandColor={null}>
        <main className={styles.main}>
          <ErrorBlock error={me.error} onRetry={() => me.refetch()} />
        </main>
      </CareerThemeProvider>
    );
  }

  const signOut = async () => {
    setLeaving(true);
    const slug = me.data.tenant.slug;
    try {
      await portalApi.logout();
    } catch {
      // the session may already be gone; sign-out is local anyway
    }
    queryClient.removeQueries({ queryKey: portalKeys.all });
    window.location.replace(signInUrl(slug));
  };

  return (
    <CareerThemeProvider brandColor={me.data.tenant.branding.brand_color}>
      <PortalSidebarLayout
        title={`${me.data.tenant.display_name} · Candidate portal`}
        home="/portal"
        items={nav}
        pathname={pathname}
        onSignOut={signOut}
      >
        {children}
        <footer style={{ textAlign: "center", padding: 16 }}>
          <Text size={200}>Signed in to {me.data.tenant.display_name}</Text>
        </footer>
      </PortalSidebarLayout>
    </CareerThemeProvider>
  );
}

/**
 * Candidate Portal shell (Epic 9, B4): a client guard over `GET /portal/me` (the `tos_candidate` cookie is
 * httpOnly), the tenant brand theme and a left sidebar (M365 look) shared with the client/vendor portals.
 * The sign-in and verify pages render without the guard.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return <Guarded>{children}</Guarded>;
}
