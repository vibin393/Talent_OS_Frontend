"use client";

import {
  Button,
  makeStyles,
  Menu,
  MenuItemLink,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Skeleton,
  SkeletonItem,
  Text,
  tokens, mergeClasses } from "@fluentui/react-components";
import { Navigation24Regular, SignOut20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CareerThemeProvider } from "@/features/careers/career-theme-provider";
import { isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys, setPortalUnauthorizedHandler } from "@/lib/api/portal-client";
import type { PortalMe } from "@/lib/api/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { rememberedTenant, rememberTenant, signInUrl } from "./format";
import { ErrorBlock } from "./ui";
import { useNavWithMessages } from "@/features/agents/screening/portal-chats"; // Epic 57: "Messages"

const AUTH_PATHS = ["/portal/sign-in", "/portal/verify"];

export const NAV = [
  { href: "/portal", label: "My applications" },
  { href: "/portal/profile", label: "Profile" },
  { href: "/portal/work", label: "My work" }, // Epic 19
  { href: "/portal/privacy", label: "Privacy" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal" || pathname.startsWith("/portal/applications");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const useStyles = makeStyles({
  skipLink: {
    position: "absolute",
    left: tokens.spacingHorizontalS,
    top: "-100px",
    zIndex: 100,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForegroundLink,
    boxShadow: tokens.shadow16,
    ":focus": { top: tokens.spacingVerticalS },
  },
  bar: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThick} solid ${tokens.colorBrandBackground}`,
  },
  barInner: {
    maxWidth: "1080px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    minHeight: "56px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    minHeight: "44px",
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
  logo: { height: "32px", width: "auto", maxWidth: "140px", objectFit: "contain" },
  brandName: { fontWeight: tokens.fontWeightSemibold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  nav: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  navLink: {
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    padding: `0 ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    borderBottom: `${tokens.strokeWidthThick} solid transparent`,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  navActive: { fontWeight: tokens.fontWeightSemibold, borderBottomColor: tokens.colorBrandStroke1 },
  button: { minHeight: "44px", minWidth: "44px" },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "1080px",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
    ":focus": { outlineStyle: "none" },
  },
  skeleton: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL, maxWidth: "860px", margin: "0 auto", width: "100%" },
});

function TopBar({ me, onSignOut }: { me: PortalMe; onSignOut: () => void }) {
  const styles = useStyles();
  const pathname = usePathname();
  const narrow = useMediaQuery("(max-width: 639px)");
  const nav = useNavWithMessages(NAV);
  const logo = me.tenant.branding.logo_url;
  return (
    <header className={styles.bar}>
      <div className={styles.barInner}>
        <NextLink href="/portal" className={styles.brand}>
          {logo && <Image src={logo} alt="" width={140} height={32} className={styles.logo} unoptimized />}
          <span className={styles.brandName}>{me.tenant.display_name} candidate portal</span>
        </NextLink>
        {narrow ? (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<Navigation24Regular />} aria-label="Menu" className={styles.button} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {nav.map((n) => (
                  <MenuItemLink key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
                    {n.label}
                  </MenuItemLink>
                ))}
                <MenuItem icon={<SignOut20Regular />} onClick={onSignOut}>
                  Sign out
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        ) : (
          <nav aria-label="Candidate portal" className={styles.nav}>
            {nav.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <NextLink key={n.href} href={n.href} className={mergeClasses(styles.navLink, active ? styles.navActive : "")} aria-current={active ? "page" : undefined}>
                  {n.label}
                </NextLink>
              );
            })}
            <Button appearance="subtle" icon={<SignOut20Regular />} onClick={onSignOut} className={styles.button}>
              Sign out
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}

function Guarded({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
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
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <TopBar me={me.data} onSignOut={signOut} />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <footer style={{ textAlign: "center", padding: 16 }}>
        <Text size={200}>Signed in to {me.data.tenant.display_name}</Text>
      </footer>
    </CareerThemeProvider>
  );
}

/**
 * Candidate Portal shell (Epic 9, B4): a client guard over `GET /portal/me` (the `tos_candidate` cookie is
 * httpOnly), the tenant brand theme and a simple top bar that collapses into a `Menu` under 640 px.
 * The sign-in and verify pages render without the guard.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return <>{children}</>;
  return <Guarded>{children}</Guarded>;
}
