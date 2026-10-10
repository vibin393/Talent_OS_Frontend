"use client";

import {
  CounterBadge,
  Hamburger,
  makeStyles,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavCategory,
  NavCategoryItem,
  NavItem,
  NavSubItem,
  NavSubItemGroup,
  Text,
  tokens,
} from "@fluentui/react-components";
import { usePathname, useRouter } from "next/navigation";
import { Fragment } from "react";
import { useMyApprovalsCount } from "@/features/approvals/use-my-approvals";
import type { PermissionMap } from "@/features/auth/permissions";
import { useMyProposalsCount } from "@/features/proposal-inbox/api";
import { useTaskSummary } from "@/features/tasks/use-tasks";
import { activeNavHref, AI_NAV_GROUP, type NavGroup, NAV_ITEMS, REPORTS_NAV_GROUP, visibleNavItems } from "./nav-items";

const useStyles = makeStyles({
  inline: {
    height: "100%",
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  overlayHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
});

function isModifiedClick(event: React.MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** Pending approvals for the signed-in user (hidden at zero). */
function ApprovalsCounter() {
  const count = useMyApprovalsCount();
  if (count === 0) return null;
  return (
    <CounterBadge
      count={count}
      size="small"
      color="brand"
      aria-label={`${count} pending`}
      style={{ marginLeft: tokens.spacingHorizontalS }}
    />
  );
}

/** Overdue tasks of the signed-in user (hidden at zero). */
function TasksCounter() {
  const { data } = useTaskSummary();
  const count = data?.overdue ?? 0;
  if (count === 0) return null;
  return (
    <CounterBadge
      count={count}
      size="small"
      color="danger"
      aria-label={`${count} overdue`}
      style={{ marginLeft: tokens.spacingHorizontalS }}
    />
  );
}

/** Pending Proposals assigned to me + my queues (Epic 65; polled every 60 s, hidden at zero). */
function ProposalsCounter() {
  const count = useMyProposalsCount();
  if (count === 0) return null;
  return (
    <CounterBadge
      count={count}
      size="small"
      color="brand"
      aria-label={`${count} pending`}
      style={{ marginLeft: tokens.spacingHorizontalS }}
    />
  );
}

/**
 * Left navigation in Microsoft 365 style: an inline, collapsible `NavDrawer` on wide screens and an
 * overlay drawer below 768px. Items are real links (`href`) so middle/ctrl-click open a new tab; plain
 * clicks use client-side navigation.
 */
export function AppNav({
  permissions,
  open,
  overlay,
  onOpenChange,
}: {
  permissions: PermissionMap;
  open: boolean;
  overlay: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const styles = useStyles();
  const pathname = usePathname();
  const router = useRouter();
  const pendingApprovals = useMyApprovalsCount();
  // Finance / HR / Account Manager steps resolve by role or user, so being the current approver also opens the inbox.
  const items = NAV_ITEMS.filter(
    (item) => visibleNavItems([item], permissions).length > 0 || (item.counter === "approvals" && pendingApprovals > 0),
  );
  const activeHref = activeNavHref(pathname) ?? "";
  const reportItems = visibleNavItems([REPORTS_NAV_GROUP], permissions).length
    ? visibleNavItems(REPORTS_NAV_GROUP.items, permissions)
    : [];
  const inReports = reportItems.some((i) => i.href === activeHref);
  // Epic 65: collapsible "AI" group (Copilot history, AI governance, AI agents).
  const aiItems = visibleNavItems([AI_NAV_GROUP], permissions).length ? visibleNavItems(AI_NAV_GROUP.items, permissions) : [];
  const inAi = aiItems.some((i) => i.href === activeHref);
  const renderGroup = (group: NavGroup, groupItems: NavGroup["items"]) => {
    if (groupItems.length === 0) return null;
    const GroupIcon = group.icon;
    return (
      <NavCategory value={group.value}>
        <NavCategoryItem icon={<GroupIcon />}>{group.label}</NavCategoryItem>
        <NavSubItemGroup>
          {groupItems.map(({ href, label }) => (
            <NavSubItem
              key={href}
              href={href}
              value={href}
              onClick={(event) => {
                if (isModifiedClick(event)) return;
                event.preventDefault();
                router.push(href);
                if (overlay) onOpenChange(false);
              }}
            >
              {label}
            </NavSubItem>
          ))}
        </NavSubItemGroup>
      </NavCategory>
    );
  };
  const reportsGroup = renderGroup(REPORTS_NAV_GROUP, reportItems);
  const aiGroup = renderGroup(AI_NAV_GROUP, aiItems);

  return (
    <NavDrawer
      type={overlay ? "overlay" : "inline"}
      open={open}
      onOpenChange={(_, data) => onOpenChange(data.open)}
      selectedValue={activeHref}
      // Always a string: switching between undefined and a value flips Fluent's controlled state.
      selectedCategoryValue={inReports ? REPORTS_NAV_GROUP.value : inAi ? AI_NAV_GROUP.value : ""}
      defaultOpenCategories={inReports ? [REPORTS_NAV_GROUP.value] : inAi ? [AI_NAV_GROUP.value] : []}
      aria-label="Main"
      className={overlay ? undefined : styles.inline}
    >
      {overlay && (
        <NavDrawerHeader className={styles.overlayHeader}>
          <Hamburger aria-label="Close navigation" onClick={() => onOpenChange(false)} />
          <Text weight="semibold" size={400}>
            Talent OS
          </Text>
        </NavDrawerHeader>
      )}
      <NavDrawerBody>
        {items.map(({ href, label, icon: Icon, counter }) => (
          <Fragment key={href}>
            {href === REPORTS_NAV_GROUP.before && reportsGroup}
            {href === AI_NAV_GROUP.before && aiGroup}
            <NavItem
              href={href}
              value={href}
              icon={<Icon />}
              onClick={(event) => {
                if (isModifiedClick(event)) return;
                event.preventDefault();
                router.push(href);
                if (overlay) onOpenChange(false);
              }}
            >
              {label}
              {counter === "approvals" && <ApprovalsCounter />}
              {counter === "tasks" && <TasksCounter />}
              {counter === "proposals" && <ProposalsCounter />}
            </NavItem>
          </Fragment>
        ))}
        {!items.some((i) => i.href === REPORTS_NAV_GROUP.before) && reportsGroup}
        {!items.some((i) => i.href === AI_NAV_GROUP.before) && aiGroup}
      </NavDrawerBody>
    </NavDrawer>
  );
}
