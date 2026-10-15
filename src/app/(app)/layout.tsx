"use client";

import {
  Body1,
  Button,
  Card,
  CardFooter,
  CardHeader,
  makeStyles,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppNav } from "@/components/app-shell/app-nav";
import { NoticeBanner } from "@/components/app-shell/notice-banner";
import { SupportBanner } from "@/components/app-shell/support-banner";
import { SandboxBanner } from "@/lib/api/sandbox-banner";
import { SUITE_HEADER_HEIGHT, SuiteHeader } from "@/components/app-shell/suite-header";
import { QueryBoundary } from "@/features/access-denied/query-boundary";
import { authKeys } from "@/features/auth/api";
import { ForcedMfaEnrollment } from "@/features/auth/forced-mfa-enrollment";
import { useMe } from "@/features/auth/use-me";
import { useEntitlements } from "@/features/entitlements/use-entitlements";
import { CopilotPanel } from "@/features/copilot/copilot-panel";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useMediaQuery } from "@/lib/use-media-query";

const useStyles = makeStyles({
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100svh",
  },
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    // Page scrolls vertically only; wide children (tab strips, tables) manage their own horizontal
    // scroll. Without this the whole page could slide sideways under the fixed left nav.
    overflowX: "hidden",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    backgroundColor: tokens.colorNeutralBackground3,
    "@media (max-width: 767px)": {
      padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    },
    ":focus": { outlineStyle: "none" },
  },
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
  // Loading skeleton mirroring the shell layout.
  skeletonHeader: {
    height: SUITE_HEADER_HEIGHT,
    flexShrink: 0,
    backgroundColor: tokens.colorBrandBackground,
  },
  skeletonNav: {
    width: "260px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 767px)": { display: "none" },
  },
  skeletonMain: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
  skeletonTitle: { width: "200px", height: "32px" },
  skeletonCard: { maxWidth: "560px", height: "120px" },
  // Error state.
  center: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingHorizontalL,
  },
  errorCard: { width: "100%", maxWidth: "400px" },
  errorIcon: { color: tokens.colorPaletteRedForeground1 },
});

function ShellSkeleton() {
  const styles = useStyles();
  return (
    <div className={styles.shell} aria-busy="true" aria-label="Loading">
      <div className={styles.skeletonHeader} />
      <div className={styles.body}>
        <Skeleton className={styles.skeletonNav} aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonItem key={i} size={32} />
          ))}
        </Skeleton>
        <Skeleton className={styles.skeletonMain} aria-hidden>
          <SkeletonItem className={styles.skeletonTitle} />
          <SkeletonItem className={styles.skeletonCard} />
        </Skeleton>
      </div>
    </div>
  );
}

/**
 * Authenticated shell. Guards every (app) route with the `me` query: while it loads a skeleton is
 * shown; a 401 fires the global unauthorized handler, which redirects to /login?next=<current>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const me = useMe();
  const entitlements = useEntitlements();
  const queryClient = useQueryClient();
  // Latched while the tenant forces MFA enrolment, so a `me` refetch right after confirming (which clears
  // the flag) does not unmount the one-time recovery codes before the user acknowledged them.
  const [forcedMfa, setForcedMfa] = useState(false);
  if (me.data?.mfa_enrollment_required && !forcedMfa) setForcedMfa(true);
  // Below 768px the navigation is an overlay drawer, closed by default; above it is inline and open.
  const narrow = useMediaQuery("(max-width: 767px)");
  const [nav, setNav] = useState({ narrow, open: !narrow });
  if (nav.narrow !== narrow) setNav({ narrow, open: !narrow }); // reset when crossing the breakpoint
  const navOpen = nav.open;
  const setNavOpen = (open: boolean) => setNav({ narrow, open });

  if (me.isPending || (me.isError && isApiError(me.error) && me.error.status === 401)) {
    return <ShellSkeleton />;
  }

  if (me.isError && !me.data) {
    return (
      <div className={styles.center}>
        <Card className={styles.errorCard}>
          <CardHeader
            image={<ErrorCircle24Regular className={styles.errorIcon} aria-hidden />}
            header={<Subtitle2 as="h1">Could not load your account</Subtitle2>}
            description={<Body1 role="alert">{errorMessage(me.error)}</Body1>}
          />
          <CardFooter>
            <Button appearance="primary" onClick={() => me.refetch()} disabled={me.isFetching}>
              Try again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const session = me.data;
  if (!session) return <ShellSkeleton />;

  // Phase 2: the tenant's entitled modules drive the nav. `null` while loading/errored -> show all.
  const modules = entitlements.data ? new Set(entitlements.data.modules) : null;

  if (forcedMfa) {
    return (
      <ForcedMfaEnrollment
        me={session}
        onDone={async () => {
          await queryClient.invalidateQueries({ queryKey: authKeys.me });
          setForcedMfa(false);
        }}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <SuiteHeader me={session} navOpen={navOpen} onToggleNav={() => setNavOpen(!navOpen)} />
      <SupportBanner me={session} />
      <SandboxBanner />
      <div className={styles.body}>
        <AppNav
          permissions={session.permissions}
          modules={modules}
          open={navOpen}
          overlay={narrow}
          onOpenChange={setNavOpen}
        />
        <main id="main" tabIndex={-1} className={styles.main}>
          <NoticeBanner />
          <QueryBoundary>{children}</QueryBoundary>
        </main>
        <CopilotPanel />
      </div>
    </div>
  );
}
