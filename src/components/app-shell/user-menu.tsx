"use client";

import {
  Avatar,
  Button,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  Text,
  tokens,
} from "@fluentui/react-components";
import { AppsListDetail20Regular, Bot20Regular, CalendarClock20Regular, CalendarLtr20Regular, ShieldKeyhole20Regular, SignOut20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useLogout } from "@/features/auth/use-logout";
import type { AuthOut } from "@/lib/api/types";

const useStyles = makeStyles({
  trigger: {
    minWidth: "auto",
    padding: tokens.spacingHorizontalXXS,
    ":hover": { backgroundColor: tokens.colorBrandBackgroundHover },
    ":hover:active": { backgroundColor: tokens.colorBrandBackgroundPressed },
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    maxWidth: "320px",
  },
  details: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  secondary: {
    color: tokens.colorNeutralForeground2,
  },
});

/** Account manager in the suite header: avatar button opening name, tenant, email and Sign out. */
export function UserMenu({ me }: { me: AuthOut }) {
  const { user, tenant } = me;
  const styles = useStyles();
  const logout = useLogout();
  const router = useRouter();
  // Avatar derives initials from `name`; fall back to the email when the name is blank.
  const displayName = user.name.trim() || user.email;

  return (
    <Menu positioning={{ position: "below", align: "end" }}>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="transparent" shape="circular" className={styles.trigger} aria-label={`Account manager for ${displayName}`}>
          <Avatar name={displayName} size={32} color="colorful" />
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <div className={styles.card}>
          <Avatar name={displayName} size={48} color="colorful" aria-hidden />
          <div className={styles.details}>
            <Text weight="semibold" className={styles.truncate}>
              {displayName}
            </Text>
            <Text size={200} className={mergeClasses(styles.truncate, styles.secondary)}>
              {tenant.name}
            </Text>
            <Text size={200} className={mergeClasses(styles.truncate, styles.secondary)}>
              {user.email}
            </Text>
          </div>
        </div>
        <MenuDivider />
        <MenuList>
          <MenuItem icon={<ShieldKeyhole20Regular />} onClick={() => router.push("/settings/security")}>
            Security settings
          </MenuItem>
          {me.permissions?.["connection:manage_own"] && (
            <MenuItem icon={<CalendarLtr20Regular />} onClick={() => router.push("/settings/connections")}>
              Calendar connections
            </MenuItem>
          )}
          {/* Epic 59: working hours, time zone and holidays the Scheduling Agent uses for interview slots. */}
          <MenuItem icon={<CalendarClock20Regular />} onClick={() => router.push("/me/scheduling")}>
            My scheduling preferences
          </MenuItem>
          {/* Epic 67: apps and AI assistants the user allowed to act for them. */}
          <MenuItem icon={<AppsListDetail20Regular />} onClick={() => router.push("/me/connected-apps")}>
            Connected apps
          </MenuItem>
          {/* Epic 73: the user's own external AI assistant (MCP) sessions. */}
          {me.permissions?.["mcp:use"] && (
            <MenuItem icon={<Bot20Regular />} onClick={() => router.push("/me/ai-assistants")}>
              AI assistants
            </MenuItem>
          )}
          <MenuItem icon={<SignOut20Regular />} disabled={logout.isPending} onClick={() => logout.mutate()}>
            Sign out
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
