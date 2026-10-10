"use client";

import {
  Button,
  Hamburger,
  makeStyles,
  Menu,
  MenuGroup,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Apps20Regular, GridDots20Regular, Navigation20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthOut } from "@/lib/api/types";
import { DEFAULT_APP_PATH } from "@/lib/navigation";
import { GlobalSearch } from "./global-search";
import { CopilotToggle } from "@/features/copilot/copilot-toggle";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { UserMenu } from "./user-menu";

export const SUITE_HEADER_HEIGHT = "48px";

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
        <Menu positioning={{ position: "below", align: "start" }}>
          <MenuTrigger disableButtonEnhancement>
            <Tooltip content="App launcher" relationship="label">
              <Button
                appearance="subtle"
                className={styles.barButton}
                icon={<GridDots20Regular className={styles.barIcon} />}
              />
            </Tooltip>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuGroup>
                <MenuGroupHeader>Apps</MenuGroupHeader>
                <MenuItem icon={<Apps20Regular />} onClick={() => router.push(DEFAULT_APP_PATH)}>
                  Talent OS
                </MenuItem>
              </MenuGroup>
            </MenuList>
          </MenuPopover>
        </Menu>
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
