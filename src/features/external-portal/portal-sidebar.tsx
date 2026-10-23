"use client";

import {
  Button,
  makeStyles,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  Briefcase20Filled,
  Briefcase20Regular,
  bundleIcon,
  type FluentIcon,
  BuildingBank20Filled,
  BuildingBank20Regular,
  CalendarClock20Filled,
  CalendarClock20Regular,
  CalendarLtr20Filled,
  CalendarLtr20Regular,
  CheckmarkCircle20Filled,
  CheckmarkCircle20Regular,
  ClipboardTask20Filled,
  ClipboardTask20Regular,
  DataTrending20Filled,
  DataTrending20Regular,
  DocumentSignature20Filled,
  DocumentSignature20Regular,
  DocumentText20Filled,
  DocumentText20Regular,
  FolderBriefcase20Filled,
  FolderBriefcase20Regular,
  Globe20Filled,
  Globe20Regular,
  Home20Filled,
  Home20Regular,
  LockClosed20Filled,
  LockClosed20Regular,
  Navigation20Regular,
  People20Filled,
  People20Regular,
  PeopleQueue20Filled,
  PeopleQueue20Regular,
  PeopleTeam20Filled,
  PeopleTeam20Regular,
  Person20Filled,
  Person20Regular,
  PersonAdd20Filled,
  PersonAdd20Regular,
  QuestionCircle20Filled,
  QuestionCircle20Regular,
  Receipt20Filled,
  Receipt20Regular,
  ReceiptMoney20Filled,
  ReceiptMoney20Regular,
  ShieldCheckmark20Filled,
  ShieldCheckmark20Regular,
  SignOut20Regular,
  Chat20Filled,
  Chat20Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

export type SidebarItem = { href: string; label: string };

const Doc = bundleIcon(DocumentText20Filled, DocumentText20Regular);
const RULES: [RegExp, FluentIcon][] = [
  [/home|my applications/i, bundleIcon(Home20Filled, Home20Regular)],
  [/profile/i, bundleIcon(Person20Filled, Person20Regular)],
  [/privacy/i, bundleIcon(LockClosed20Filled, LockClosed20Regular)],
  [/timesheet/i, bundleIcon(CalendarClock20Filled, CalendarClock20Regular)],
  [/leave/i, bundleIcon(CalendarLtr20Filled, CalendarLtr20Regular)],
  [/expense/i, bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular)],
  [/invoice|statement/i, bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular)],
  [/purchase order/i, bundleIcon(Receipt20Filled, Receipt20Regular)],
  [/placement|team|my work/i, bundleIcon(PeopleTeam20Filled, PeopleTeam20Regular)],
  [/approval/i, bundleIcon(CheckmarkCircle20Filled, CheckmarkCircle20Regular)],
  [/demand|requirement|release|opportunit/i, bundleIcon(Briefcase20Filled, Briefcase20Regular)],
  [/scorecard/i, bundleIcon(ClipboardTask20Filled, ClipboardTask20Regular)],
  [/compliance|credential|background|bgv/i, bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular)],
  [/project/i, bundleIcon(FolderBriefcase20Filled, FolderBriefcase20Regular)],
  [/forecast/i, bundleIcon(DataTrending20Filled, DataTrending20Regular)],
  [/refer|submit candidate/i, bundleIcon(PersonAdd20Filled, PersonAdd20Regular)],
  [/bank/i, bundleIcon(BuildingBank20Filled, BuildingBank20Regular)],
  [/sign|offer/i, bundleIcon(DocumentSignature20Filled, DocumentSignature20Regular)],
  [/immigration/i, bundleIcon(Globe20Filled, Globe20Regular)],
  [/bench/i, bundleIcon(PeopleQueue20Filled, PeopleQueue20Regular)],
  [/message/i, bundleIcon(Chat20Filled, Chat20Regular)],
  [/help|support/i, bundleIcon(QuestionCircle20Filled, QuestionCircle20Regular)],
  [/people|candidate/i, bundleIcon(People20Filled, People20Regular)],
];

export function iconFor(label: string): FluentIcon {
  for (const [re, Icon] of RULES) if (re.test(label)) return Icon;
  return Doc;
}

const useStyles = makeStyles({
  shell: { minHeight: "100svh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground3 },
  bar: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `0 ${tokens.spacingHorizontalL}`,
    minHeight: "48px",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  brand: { fontWeight: tokens.fontWeightSemibold, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  who: { color: tokens.colorNeutralForegroundOnBrand, opacity: 0.9 },
  barBtn: { color: tokens.colorNeutralForegroundOnBrand },
  body: { flex: 1, display: "flex", minHeight: 0 },
  drawer: { borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  main: { flex: 1, minWidth: 0, overflow: "auto" },
  inner: { maxWidth: "1200px", margin: "0 auto", boxSizing: "border-box", padding: tokens.spacingHorizontalXL },
});

function isActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home || (home === "/portal" && pathname.startsWith("/portal/applications"));
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left-sidebar portal shell (M365 look), shared by the client, vendor and candidate portals. */
export function PortalSidebarLayout({
  title,
  home,
  items,
  pathname,
  userName,
  onSignOut,
  children,
}: {
  title: string;
  home: string;
  items: readonly SidebarItem[];
  pathname: string;
  userName?: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const router = useRouter();
  const overlay = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
  useEffect(() => setOpen(!overlay), [overlay]);
  const active = items.find((n) => isActive(pathname, n.href, home))?.href ?? "";

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Button
          appearance="transparent"
          className={styles.barBtn}
          icon={<Navigation20Regular />}
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        />
        <Text className={styles.brand}>{title}</Text>
        {userName && <Text className={styles.who}>{userName}</Text>}
        <Button appearance="transparent" className={styles.barBtn} icon={<SignOut20Regular />} onClick={onSignOut}>
          Sign out
        </Button>
      </header>
      <div className={styles.body}>
        <NavDrawer
          type={overlay ? "overlay" : "inline"}
          open={open}
          onOpenChange={(_, d) => setOpen(d.open)}
          selectedValue={active}
          aria-label={title}
          className={overlay ? undefined : styles.drawer}
        >
          {overlay && <NavDrawerHeader />}
          <NavDrawerBody>
            {items.map((n) => {
              const Icon = iconFor(n.label);
              return (
                <NavItem
                  key={n.href}
                  href={n.href}
                  value={n.href}
                  icon={<Icon />}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    router.push(n.href);
                    if (overlay) setOpen(false);
                  }}
                >
                  {n.label}
                </NavItem>
              );
            })}
          </NavDrawerBody>
        </NavDrawer>
        <main id="main" tabIndex={-1} className={styles.main}>
          <div className={styles.inner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
