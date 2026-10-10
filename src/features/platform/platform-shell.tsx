"use client";

import {
  Avatar,
  Body1,
  Button,
  Card,
  CardFooter,
  CardHeader,
  Hamburger,
  makeStyles,
  Menu,
  MenuDivider,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  NavDrawer,
  NavDrawerBody,
  NavItem,
  Spinner,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import {
  Alert20Regular,
  Alert20Filled,
  AppsAddIn20Filled,
  AppsAddIn20Regular,
  bundleIcon,
  Building20Filled,
  Building20Regular,
  ErrorCircle24Regular,
  type FluentIcon,
  HeadsetVr20Filled,
  HeadsetVr20Regular,
  PeopleSettings20Filled,
  PeopleSettings20Regular,
  ShieldError20Filled,
  ShieldError20Regular,
  SignOut20Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { platformApi, platformKeys, setPlatformUnauthorizedHandler } from "@/lib/api/platform-client";
import { errorMessage } from "@/lib/api/errors";
import { platformGuard, platformLoginUrl } from "./guard";
import { PlatformMfaEnroll } from "./platform-mfa-enroll";

export const PLATFORM_NAV: { href: string; label: string; icon: FluentIcon }[] = [
  { href: "/platform/tenants", label: "Tenants", icon: bundleIcon(Building20Filled, Building20Regular) },
  { href: "/platform/support", label: "Support access", icon: bundleIcon(HeadsetVr20Filled, HeadsetVr20Regular) },
  { href: "/platform/incidents", label: "Incidents", icon: bundleIcon(ShieldError20Filled, ShieldError20Regular) },
  { href: "/platform/sub-processors", label: "Sub-processors", icon: bundleIcon(PeopleSettings20Filled, PeopleSettings20Regular) },
  { href: "/platform/notices", label: "Notices", icon: bundleIcon(Alert20Filled, Alert20Regular) },
  { href: "/platform/marketplace", label: "Marketplace review", icon: bundleIcon(AppsAddIn20Filled, AppsAddIn20Regular) },
  { href: "/platform/developers", label: "Developer verification", icon: bundleIcon(PeopleSettings20Filled, PeopleSettings20Regular) },
];

export function activePlatformHref(pathname: string): string {
  return PLATFORM_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.href ?? "";
}

const useStyles = makeStyles({
  shell: { display: "flex", flexDirection: "column", height: "100svh" },
  bar: {
    height: "48px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingInline: tokens.spacingHorizontalS,
    // Dark neutral suite bar: visibly different from the tenant app's brand-coloured bar.
    backgroundColor: "#1b1a19",
    color: "#ffffff",
  },
  barButton: {
    color: "#ffffff",
    ":hover": { backgroundColor: "#3b3a39", color: "#ffffff" },
    ":hover:active": { backgroundColor: "#484644", color: "#ffffff" },
  },
  product: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, whiteSpace: "nowrap" },
  grow: { flex: 1 },
  body: { display: "flex", flex: 1, minHeight: 0 },
  nav: { height: "100%", borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  main: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    backgroundColor: tokens.colorNeutralBackground3,
    "@media (max-width: 767px)": { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}` },
  },
  center: { minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: tokens.spacingHorizontalL },
  errorCard: { maxWidth: "420px" },
});

/** `/platform` console shell: guard (operator session + MFA), dark suite bar and `NavDrawer`. */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const narrow = useMediaQuery("(max-width: 767px)");
  const [nav, setNav] = useState({ narrow, open: !narrow });
  if (nav.narrow !== narrow) setNav({ narrow, open: !narrow });

  const me = useQuery({ queryKey: platformKeys.me, queryFn: ({ signal }) => platformApi.me(signal), retry: false, staleTime: 60_000 });
  const state = platformGuard({ mePending: me.isPending, me: me.data, meError: me.error });

  useEffect(() => {
    return setPlatformUnauthorizedHandler(() => {
      queryClient.removeQueries({ queryKey: platformKeys.all });
      window.location.replace(platformLoginUrl(`${window.location.pathname}${window.location.search}`));
    });
  }, [queryClient]);

  useEffect(() => {
    if (state === "login") router.replace(platformLoginUrl(pathname));
  }, [state, router, pathname]);

  if (state === "loading" || state === "login") {
    return (
      <div className={styles.center}>
        <Spinner label="Loading the platform console" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className={styles.center}>
        <Card className={styles.errorCard}>
          <CardHeader image={<ErrorCircle24Regular aria-hidden />} header={<Subtitle2 as="h1">Could not load the console</Subtitle2>} description={<Body1 role="alert">{errorMessage(me.error)}</Body1>} />
          <CardFooter>
            <Button appearance="primary" onClick={() => me.refetch()}>
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  if (state === "enroll") {
    return (
      <PlatformMfaEnroll
        operator={me.data!}
        onDone={async () => {
          await queryClient.invalidateQueries({ queryKey: platformKeys.all });
        }}
      />
    );
  }

  const operator = me.data!;
  const signOut = async () => {
    try {
      await platformApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: platformKeys.all });
      window.location.replace("/platform/login");
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Hamburger className={styles.barButton} aria-expanded={nav.open} onClick={() => setNav({ narrow, open: !nav.open })} />
        <span className={styles.product}>Talent OS · Platform admin</span>
        <span className={styles.grow} />
        <Menu positioning={{ position: "below", align: "end" }}>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" className={styles.barButton} aria-label={`Account: ${operator.name}`} icon={<Avatar name={operator.name} size={28} color="neutral" />} />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuGroupHeader>
                {operator.name} · {operator.email}
              </MenuGroupHeader>
              <MenuDivider />
              <MenuItem icon={<SignOut20Regular />} onClick={signOut}>
                Sign out
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </header>
      <div className={styles.body}>
        <NavDrawer
          type={narrow ? "overlay" : "inline"}
          open={nav.open}
          onOpenChange={(_, d) => setNav({ narrow, open: d.open })}
          selectedValue={activePlatformHref(pathname)}
          aria-label="Platform"
          className={narrow ? undefined : styles.nav}
        >
          <NavDrawerBody>
            {PLATFORM_NAV.map(({ href, label, icon: Icon }) => (
              <NavItem
                key={href}
                href={href}
                value={href}
                icon={<Icon />}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  router.push(href);
                  if (narrow) setNav({ narrow, open: false });
                }}
              >
                {label}
              </NavItem>
            ))}
          </NavDrawerBody>
        </NavDrawer>
        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
