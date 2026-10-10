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
import { useMyApprovalsCount } from "@/features/approvals/use-my-approvals";
import type { PermissionMap } from "@/features/auth/permissions";
import { useMyProposalsCount } from "@/features/proposal-inbox/api";
import { useTaskSummary } from "@/features/tasks/use-tasks";
import {
  activeNavHref,
  AI_NAV_GROUP,
  BOTTOM_NAV_HREFS,
  type NavGroup,
  type NavItem as NavItemType,
  NAV_ITEMS,
  NAV_SECTIONS,
  REPORTS_NAV_GROUP,
  TOP_NAV_HREFS,
  visibleNavItems,
} from "./nav-items";

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
  const activeHref = activeNavHref(pathname) ?? "";

  const go = (href: string) => (event: React.MouseEvent) => {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    router.push(href);
    if (overlay) onOpenChange(false);
  };

  // Finance / HR / Account Manager steps resolve by role or user, so being the current approver also opens the inbox.
  const isVisible = (item: NavItemType) =>
    visibleNavItems([item], permissions).length > 0 || (item.counter === "approvals" && pendingApprovals > 0);
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i] as const));
  const pick = (hrefs: readonly string[]): NavItemType[] =>
    hrefs.map((h) => byHref.get(h)).filter((i): i is NavItemType => !!i && isVisible(i));

  const topItems = pick(TOP_NAV_HREFS);
  const bottomItems = pick(BOTTOM_NAV_HREFS);
  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: pick(s.hrefs) })).filter((s) => s.items.length > 0);

  // Anything visible but not pinned or placed in a section still shows top-level, so nothing silently disappears.
  const placed = new Set<string>([...TOP_NAV_HREFS, ...BOTTOM_NAV_HREFS, ...NAV_SECTIONS.flatMap((s) => s.hrefs)]);
  const leftovers = NAV_ITEMS.filter((i) => isVisible(i) && !placed.has(i.href));

  const reportItems = visibleNavItems([REPORTS_NAV_GROUP], permissions).length
    ? visibleNavItems(REPORTS_NAV_GROUP.items, permissions)
    : [];
  // Epic 65: collapsible "AI" group (Copilot history, AI governance, AI agents).
  const aiItems = visibleNavItems([AI_NAV_GROUP], permissions).length ? visibleNavItems(AI_NAV_GROUP.items, permissions) : [];

  // Which collapsible category (section or group) holds the active route — so it opens and highlights.
  const activeCategory =
    sections.find((s) => s.items.some((i) => i.href === activeHref))?.value ??
    (reportItems.some((i) => i.href === activeHref)
      ? REPORTS_NAV_GROUP.value
      : aiItems.some((i) => i.href === activeHref)
        ? AI_NAV_GROUP.value
        : "");

  const renderTop = (item: NavItemType) => {
    const Icon = item.icon;
    return (
      <NavItem key={item.href} href={item.href} value={item.href} icon={<Icon />} onClick={go(item.href)}>
        {item.label}
        {item.counter === "approvals" && <ApprovalsCounter />}
        {item.counter === "tasks" && <TasksCounter />}
        {item.counter === "proposals" && <ProposalsCounter />}
      </NavItem>
    );
  };

  const renderCategory = (value: string, label: string, Icon: NavGroup["icon"], groupItems: readonly { href: string; label: string }[]) => {
    if (groupItems.length === 0) return null;
    return (
      <NavCategory key={value} value={value}>
        <NavCategoryItem icon={<Icon />}>{label}</NavCategoryItem>
        <NavSubItemGroup>
          {groupItems.map(({ href, label: subLabel }) => (
            <NavSubItem key={href} href={href} value={href} onClick={go(href)}>
              {subLabel}
            </NavSubItem>
          ))}
        </NavSubItemGroup>
      </NavCategory>
    );
  };

  return (
    <NavDrawer
      type={overlay ? "overlay" : "inline"}
      open={open}
      onOpenChange={(_, data) => onOpenChange(data.open)}
      selectedValue={activeHref}
      // Always a string: switching between undefined and a value flips Fluent's controlled state.
      selectedCategoryValue={activeCategory}
      defaultOpenCategories={activeCategory ? [activeCategory] : []}
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
        {topItems.map(renderTop)}
        {sections.map((s) => renderCategory(s.value, s.label, s.icon, s.items))}
        {leftovers.map(renderTop)}
        {renderCategory(REPORTS_NAV_GROUP.value, REPORTS_NAV_GROUP.label, REPORTS_NAV_GROUP.icon, reportItems)}
        {renderCategory(AI_NAV_GROUP.value, AI_NAV_GROUP.label, AI_NAV_GROUP.icon, aiItems)}
        {bottomItems.map(renderTop)}
      </NavDrawerBody>
    </NavDrawer>
  );
}
