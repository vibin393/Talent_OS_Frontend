"use client";

import { FluentProvider, makeStyles, tokens } from "@fluentui/react-components";
import { useMemo } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { careerThemes } from "./theme";

const useStyles = makeStyles({
  root: {
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
});

/**
 * Tenant-branded Fluent theme for the career site and the candidate portal. Nested inside the root
 * `Providers`, so it shares the app's Griffel renderer (`fluent-ssr.tsx`) and its styles are inserted into
 * the server-rendered HTML. Light during SSR/hydration, then follows the OS colour scheme.
 */
export function CareerThemeProvider({ brandColor, children }: { brandColor: string | null | undefined; children: React.ReactNode }) {
  const styles = useStyles();
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const themes = useMemo(() => careerThemes(brandColor), [brandColor]);
  return (
    <FluentProvider theme={dark ? themes.dark : themes.light} className={styles.root}>
      {children}
    </FluentProvider>
  );
}
