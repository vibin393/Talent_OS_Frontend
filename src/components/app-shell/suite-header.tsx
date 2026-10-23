"use client";

import {
  Button,
  Hamburger,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { GridDots20Regular, Navigation20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthOut } from "@/lib/api/types";
import { DEFAULT_APP_PATH } from "@/lib/navigation";
import {
  EXTERNAL_APP_ENTRIES,
  HOME_ENTRY,
  type LauncherEntry,
} from "@/features/entitlements/catalog";
import { GlobalSearch } from "./global-search";
import { CopilotToggle } from "@/features/copilot/copilot-toggle";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { UserMenu } from "./user-menu";

export const SUITE_HEADER_HEIGHT = "48px";

// Per-app tile colours for the M365-style waffle launcher grid (keyed by launcher entry key).
const TILE_COLORS: Record<string, string> = {
  home: "#0f6cbd",
  talent_acquisition: "#0f6cbd",
  sales: "#c239b3",
  vendor_mgmt: "#005b70",
  contracts: "#8764b8",
  workforce: "#498205",
  time_expense: "#ca5010",
  finance: "#986f0b",
  payroll: "#986f0b",
  onboarding: "#038387",
  assessments: "#8764b8",
  surveys: "#0078d4",
  experience: "#e3008c",
  intelligence: "#5c2e91",
  analytics: "#c239b3",
  ai_copilot: "#0f548c",
  croar: "#8764b8",
  "feedback-iq": "#107c10",
  portal: "#d83b01",
  marketplace: "#605e5c",
};
const tileColor = (key: string) => TILE_COLORS[key] ?? "#0f6cbd";

const useStyles = makeStyles({
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    flexShrink: 0,
    height: SUITE_HEADER_HEIGHT,
    display: "grid",
    gridTemplateColumns: "1fr minmax(0, 468px) 1fr",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    paddingInline: tokens.spacingHorizontalXS,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    "@media (max-width: 639px)": {
      gridTemplateColumns: "1fr auto",
    },
  },
  start: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    minWidth: 0,
  },
  end: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalXS,
    paddingInlineEnd: tokens.spacingHorizontalS,
  },
  // Icon buttons sitting on the brand-coloured bar.
  barButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": { backgroundColor: tokens.colorBrandBackgroundHover, color: tokens.colorNeutralForegroundOnBrand },
    ":hover:active": { backgroundColor: tokens.colorBrandBackgroundPressed, color: tokens.colorNeutralForegroundOnBrand },
    ":disabled": { backgroundColor: "transparent" },
  },
  barIcon: {
    color: tokens.colorNeutralForegroundOnBrand,
  },
  productName: {
    marginInlineStart: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForegroundOnBrand,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
    textDecorationLine: "none",
    whiteSpace: "nowrap",
    borderRadius: tokens.borderRadiusMedium,
    paddingInline: tokens.spacingHorizontalXS,
    ":hover": { textDecorationLine: "underline" },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  search: {
    width: "100%",
    maxWidth: "100%",
    "@media (max-width: 639px)": { display: "none" },
  },
  // ---- App launcher (waffle) tile grid, M365-style ----
  launcherSurface: {
    padding: tokens.spacingHorizontalL,
    width: "360px",
    maxWidth: "calc(100vw - 16px)",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  launcherTitle: { marginBottom: tokens.spacingVerticalXXS },
  launcherSection: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  groupHeader: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: tokens.spacingHorizontalXS,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    border: "none",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: tokens.fontFamilyBase,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  tileIcon: {
    width: "48px",
    height: "48px",
    borderRadius: tokens.borderRadiusLarge,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    "& svg": { width: "24px", height: "24px" },
  },
  tileLabel: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
});

/**
 * Microsoft 365 style suite header: 48px brand bar with navigation toggle, app launcher waffle,
 * product name, centred global search, notifications (placeholder) and the account manager.
 */
export function SuiteHeader({
  me,
  navOpen,
  onToggleNav,
}: {
  me: AuthOut;
  navOpen: boolean;
  onToggleNav: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const [launcherOpen, setLauncherOpen] = useState(false);
  // The apps you can switch to: Talent OS itself + the embedded platform apps.
  // (Talent OS's own modules live in the left sidebar, not the launcher.)
  const appEntries: LauncherEntry[] = [HOME_ENTRY, ...EXTERNAL_APP_ENTRIES];

  // A single waffle-launcher tile: a colored rounded icon square with the app label beneath (M365 style).
  const renderTile = (entry: LauncherEntry) => {
    const Icon = entry.icon;
    return (
      <button
        key={entry.key}
        type="button"
        className={styles.tile}
        onClick={() => {
          setLauncherOpen(false);
          router.push(entry.href);
        }}
      >
        <span className={styles.tileIcon} style={{ backgroundColor: tileColor(entry.key) }} aria-hidden>
          <Icon />
        </span>
        <span className={styles.tileLabel}>{entry.label}</span>
      </button>
    );
  };

  return (
    <header className={styles.header}>
      <div className={styles.start}>
        <Tooltip content={navOpen ? "Collapse navigation" : "Expand navigation"} relationship="label">
          <Hamburger
            className={styles.barButton}
            icon={<Navigation20Regular className={styles.barIcon} />}
            aria-expanded={navOpen}
            onClick={onToggleNav}
          />
        </Tooltip>
        <Popover
          open={launcherOpen}
          onOpenChange={(_, data) => setLauncherOpen(data.open)}
          positioning={{ position: "below", align: "start" }}
        >
          <PopoverTrigger disableButtonEnhancement>
            <Tooltip content="App launcher" relationship="label">
              <Button
                appearance="subtle"
                aria-label="App launcher"
                className={styles.barButton}
                icon={<GridDots20Regular className={styles.barIcon} />}
              />
            </Tooltip>
          </PopoverTrigger>
          <PopoverSurface className={styles.launcherSurface}>
            <Text as="h2" weight="semibold" size={500} className={styles.launcherTitle}>
              Apps
            </Text>
            <div className={styles.grid}>{appEntries.map(renderTile)}</div>
          </PopoverSurface>
        </Popover>
        <Link href={DEFAULT_APP_PATH} className={styles.productName}>
          Talent OS
        </Link>
      </div>

      {/* Global search (Epic 5): grouped results popover, Alt+Q focuses it. */}
      <GlobalSearch className={styles.search} />

      <div className={styles.end}>
        <CopilotToggle buttonClassName={styles.barButton} iconClassName={styles.barIcon} />
        <NotificationBell buttonClassName={styles.barButton} iconClassName={styles.barIcon} />
        <UserMenu me={me} />
      </div>
    </header>
  );
}
