"use client";

import { Body1, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import {
  Building24Regular,
  DocumentText24Regular,
  type FluentIcon,
  MailArrowUp24Regular,
  People24Regular,
  PeopleTeam24Regular,
  KeyMultiple24Regular,
  History24Regular,
  BrainCircuit24Regular,
  Lightbulb24Regular,
  ShieldKeyhole24Regular,
  Settings24Regular,
  ShieldLock24Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { useMe } from "@/features/auth/use-me";
import { visibleAdminSections } from "./sections";

const ICONS: Record<string, FluentIcon> = {
  "/admin/users": People24Regular,
  "/admin/invitations": MailArrowUp24Regular,
  "/admin/roles": KeyMultiple24Regular,
  "/admin/teams": PeopleTeam24Regular,
  "/admin/business-units": Building24Regular,
  "/admin/audit-log": History24Regular,
  "/admin/skills": Lightbulb24Regular,
  "/admin/ai": BrainCircuit24Regular,
  "/admin/security": ShieldKeyhole24Regular,
  "/admin/settings": Settings24Regular,
  "/admin/privacy": ShieldLock24Regular,
  "/admin/documents/templates": DocumentText24Regular,
};

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  },
  icon: { color: tokens.colorBrandForeground1 },
  description: { color: tokens.colorNeutralForeground2 },
});

/** Admin landing: one card per section the user may open (Microsoft 365 admin center home). */
export function AdminHome() {
  const styles = useStyles();
  const router = useRouter();
  const { data: me } = useMe();
  const sections = visibleAdminSections(me?.permissions);
  return (
    <>
      <PageHeader title="Admin center" subtitle={me ? `Manage ${me.tenant.name}` : undefined} />
      <div className={styles.grid}>
        {sections.map((s) => {
          const Icon = ICONS[s.href] ?? People24Regular;
          return (
            <Card key={s.href} onClick={() => router.push(s.href)} aria-label={s.label}>
              <CardHeader
                image={<Icon className={styles.icon} aria-hidden />}
                header={<Subtitle2 as="h2">{s.label}</Subtitle2>}
                description={<Body1 className={styles.description}>{s.description}</Body1>}
              />
            </Card>
          );
        })}
      </div>
    </>
  );
}
