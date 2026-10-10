"use client";

import { Button, Link as FluentLink, makeStyles, Text, tokens } from "@fluentui/react-components";
import Image from "next/image";
import NextLink from "next/link";
import type { PublicBranding } from "@/lib/api/types";
import { CareerThemeProvider } from "./career-theme-provider";
import { careersPath, portalSignInPath } from "./format";

export const useCareerStyles = makeStyles({
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
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThick} solid ${tokens.colorBrandBackground}`,
  },
  headerInner: {
    maxWidth: "1080px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    minHeight: "56px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    minHeight: "44px",
    minWidth: 0,
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
  logo: { height: "36px", width: "auto", maxWidth: "160px", objectFit: "contain" },
  brandName: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, overflowWrap: "anywhere" },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  nav: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  navLink: { minHeight: "44px", minWidth: "44px" },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "1080px",
    margin: "0 auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
    ":focus": { outlineStyle: "none" },
  },
  footer: {
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  footerInner: {
    maxWidth: "1080px",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalL,
    justifyContent: "space-between",
    color: tokens.colorNeutralForeground2,
  },
});

/** Branded chrome of a tenant career site: skip link, header (logo, Jobs, Sign in), main and footer. */
export function CareerFrame({ branding, children }: { branding: PublicBranding; children: React.ReactNode }) {
  return (
    <CareerThemeProvider brandColor={branding.brand_color}>
      <CareerChrome branding={branding}>{children}</CareerChrome>
    </CareerThemeProvider>
  );
}

function CareerChrome({ branding, children }: { branding: PublicBranding; children: React.ReactNode }) {
  const styles = useCareerStyles();
  const home = careersPath(branding.slug);
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NextLink href={home} className={styles.brand}>
            {branding.logo_url ? (
              <Image
                src={branding.logo_url}
                alt={branding.display_name}
                width={160}
                height={36}
                className={styles.logo}
                unoptimized
                priority
              />
            ) : null}
            {branding.logo_url ? (
              <span className={styles.srOnly}> careers home</span>
            ) : (
              <span className={styles.brandName}>Careers at {branding.display_name}</span>
            )}
          </NextLink>
          <nav aria-label="Career site" className={styles.nav}>
            <Button as="a" href={home} appearance="subtle" className={styles.navLink}>
              Jobs
            </Button>
            <Button as="a" href={portalSignInPath(branding.slug)} appearance="primary" className={styles.navLink}>
              Sign in
            </Button>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Text>© {branding.display_name}</Text>
          {branding.privacy_contact_email && (
            <Text>
              Privacy questions:{" "}
              <FluentLink href={`mailto:${branding.privacy_contact_email}`}>{branding.privacy_contact_email}</FluentLink>
            </Text>
          )}
        </div>
      </footer>
    </>
  );
}
