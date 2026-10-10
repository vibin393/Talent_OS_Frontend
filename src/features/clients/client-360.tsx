"use client";

import {
  Avatar,
  Body1,
  Button,
  Card,
  CardHeader,
  Link,
  makeStyles,
  Subtitle2,
  Tab,
  TabList,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  Archive20Regular,
  ArchiveArrowBack20Regular,
  ArrowLeft20Regular,
  Building24Regular,
  Edit20Regular,
} from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ActivityTimeline, type ParticipantOption } from "@/features/activity/activity-timeline";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { Client360Out } from "@/lib/api/types";
import { canActOnOwned } from "./access";
import { clientKeys, clientsApi } from "./api";
import { ClientDrawer } from "./client-drawer";
import { ClientStatusBadge } from "./clients-view";
import { ContactsTab } from "./contacts-tab";
import { clientComposeContext } from "@/features/comms/compose-contexts";
import { EmailButton } from "@/features/comms/email-button";
import { EntityTasksCard } from "@/features/tasks/entity-tasks-card";
import { CONTACT_TYPE_LABELS, formatLocation, websiteLabel } from "./format";
import type { ClientTab } from "./query";
import { ClientSubmissionsCard } from "@/features/submissions/client-submissions-card";
import { useArchiveClient } from "./use-archive-client";
import { FromOpportunityTag } from "@/features/crm/opportunities/from-opportunity-tag";
import { ClientOpportunitiesCard } from "@/features/crm/opportunities/client-opportunities-card";
import "@/features/commercials/client-tabs";
import "@/features/client-access/client-tabs";
import "@/features/client-portal/client-tabs";
import "@/features/client-sso/client-tabs";
import "@/features/projects/client-tabs";
import "@/features/agents/submission/client-tabs";
import { client360Tabs, isExtensionTabKey } from "./client-360-tabs";


const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalM,
  },
  logo: {
    width: "56px",
    height: "56px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusLarge,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flex: "1 1 320px", minWidth: 0 },
  line: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  owner: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  tabs: {
    marginBottom: tokens.spacingVerticalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    overflowX: "auto",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  stat: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalXXS },
  statValue: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
  },
  card: { padding: tokens.spacingHorizontalL },
  contactList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  contact: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    ":last-child": { borderBottom: "none" },
  },
  contactText: { display: "flex", flexDirection: "column", minWidth: 0 },
});

function Stat({ label, value }: { label: string; value: number }) {
  const styles = useStyles();
  return (
    <Card className={styles.stat} appearance="filled-alternative">
      <Text size={200} className={styles.muted}>
        {label}
      </Text>
      <span className={styles.statValue}>{value}</span>
    </Card>
  );
}

function Overview({ data, onShowContacts }: { data: Client360Out; onShowContacts?: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const { client, contacts, counts } = data;
  const canReadSubmissions = usePermission("submission:read");
  const shown = contacts.slice(0, 5);
  return (
    <>
      <div className={styles.stats}>
        <Stat label="Contacts" value={counts.contacts} />
        <Stat label="Open demands" value={counts.open_demands} />
        <Stat label="Demands" value={counts.demands} />
        <Stat label="Submissions" value={counts.submissions} />
        <Stat label="Activities" value={counts.activities} />
      </div>
      <div className={styles.cards}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
          <dl className={admin.detailList}>
            <dt>Status</dt>
            <dd>
              <ClientStatusBadge client={client} />
            </dd>
            <dt>Owner</dt>
            <dd>{client.owner?.name ?? "—"}</dd>
            <dt>Industry</dt>
            <dd>{client.industry || "—"}</dd>
            <dt>Website</dt>
            <dd>
              {client.website ? (
                <Link href={client.website} target="_blank" rel="noopener noreferrer">
                  {websiteLabel(client.website)}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt>GSTIN</dt>
            <dd>{client.gstin || "—"}</dd>
            <dt>Locations</dt>
            <dd>
              {client.locations.length
                ? client.locations.map((l, i) => <div key={i}>{formatLocation(l)}</div>)
                : "—"}
            </dd>
            <dt>Created</dt>
            <dd>{formatDateTime(client.created_at)}</dd>
            <dt>Last updated</dt>
            <dd>{formatDateTime(client.updated_at)}</dd>
            {client.archived_at && (
              <>
                <dt>Archived</dt>
                <dd>{formatDateTime(client.archived_at)}</dd>
              </>
            )}
          </dl>
        </Card>
        {onShowContacts && (
          <Card className={styles.card}>
            <CardHeader
              header={<Subtitle2 as="h2">Contacts</Subtitle2>}
              action={
                <Button appearance="transparent" size="small" onClick={onShowContacts}>
                  {contacts.length > 0 ? "View all" : "Manage"}
                </Button>
              }
            />
            {shown.length === 0 ? (
              <Body1 className={styles.muted}>No contacts yet.</Body1>
            ) : (
              <ul className={styles.contactList}>
                {shown.map((c) => (
                  <li key={c.id} className={styles.contact}>
                    <Avatar name={c.name} size={32} color="colorful" aria-hidden />
                    <span className={styles.contactText}>
                      <Text weight="semibold">{c.name}</Text>
                      <Text size={200} className={styles.muted}>
                        {[c.title, CONTACT_TYPE_LABELS[c.type]].filter(Boolean).join(" · ")}
                      </Text>
                      {c.email && (
                        <Link href={`mailto:${c.email}`} className={admin.truncate}>
                          {c.email}
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {canReadSubmissions && <ClientSubmissionsCard submissions={data.submissions ?? []} />}
      </div>
    </>
  );
}

/** `/clients/[id]`: Client 360 header (status, owner, Edit/Archive) with Overview, Contacts and Activity tabs. */
export function Client360({ clientId, initialTab }: { clientId: string; initialTab: ClientTab }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const permissions = usePermissions();
  const canRead = usePermission("client:read");
  const canReadContacts = usePermission("contact:read");
  const extensionTabs = client360Tabs((perm) => perm in permissions);
  const [tab, setTab] = useState<ClientTab>(
    (initialTab === "contacts" && !canReadContacts) || (isExtensionTabKey(initialTab) && !extensionTabs.some((t) => t.key === initialTab))
      ? "overview"
      : initialTab,
  );
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const archive = useArchiveClient();

  const query = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: ({ signal }) => clientsApi.get360(clientId, signal),
    enabled: canRead,
  });

  if (!canRead) return <NoAccess what="clients" />;

  const selectTab = (next: ClientTab) => {
    setTab(next);
    router.replace(next === "overview" ? `/clients/${clientId}` : `/clients/${clientId}?tab=${next}`, { scroll: false });
  };

  const back = (
    <div className={styles.back}>
      <AppLink href="/clients">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Clients
      </AppLink>
    </div>
  );

  if (query.isPending) {
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader
              header={<Subtitle2 as="h1">Client not found</Subtitle2>}
              description={<Body1>This client does not exist or you do not have access to it.</Body1>}
            />
          </Card>
        ) : (
          <ErrorBar title="Could not load this client." message={errorMessage(query.error)} />
        )}
      </>
    );
  }

  const data = query.data;
  const { client } = data;
  const canEdit = canActOnOwned(permissions, "client:update", client.owner_id, me?.user.id) && !client.archived_at;
  const canArchive = canActOnOwned(permissions, "client:delete", client.owner_id, me?.user.id);
  const participants: ParticipantOption[] = data.contacts.map((c) => ({ id: c.id, name: c.name, kind: "contact" }));

  return (
    <>
      {back}
      <div className={styles.header}>
        <span className={styles.logo} aria-hidden>
          <Building24Regular />
        </span>
        <div className={styles.identity}>
          <div className={styles.line}>
            <Title2 as="h1">{client.name}</Title2>
            <ClientStatusBadge client={client} />
            <FromOpportunityTag kind="client" recordId={client.id} />
          </div>
          <div className={styles.line}>
            {client.owner && (
              <span className={styles.owner}>
                <Avatar name={client.owner.name} size={24} color="colorful" aria-hidden />
                <Text size={300}>
                  <span className={styles.muted}>Owner </span>
                  {client.owner.name}
                </Text>
              </span>
            )}
            {client.industry && <Text className={styles.muted}>{client.industry}</Text>}
            {client.website && (
              <Link href={client.website} target="_blank" rel="noopener noreferrer">
                {websiteLabel(client.website)}
              </Link>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <EmailButton context={() => clientComposeContext(client, data.contacts)} />
          {canEdit && (
            <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canArchive &&
            (client.archived_at ? (
              <Button
                icon={<ArchiveArrowBack20Regular />}
                disabled={archive.isPending}
                onClick={() => archive.mutateAsync(client).catch((e) => toast.error(archive.message(e)))}
              >
                Restore
              </Button>
            ) : (
              <Button icon={<Archive20Regular />} onClick={() => setArchiving(true)}>
                Archive
              </Button>
            ))}
        </div>
      </div>

      <TabList
        className={styles.tabs}
        selectedValue={tab}
        onTabSelect={(_, d) => selectTab(d.value as ClientTab)}
        aria-label="Client sections"
      >
        <Tab value="overview">Overview</Tab>
        {canReadContacts && <Tab value="contacts">Contacts ({data.counts.contacts})</Tab>}
        {extensionTabs.map((t) => (
          <Tab key={t.key} value={t.key}>
            {t.label}
          </Tab>
        ))}
        <Tab value="activity">Activity</Tab>
      </TabList>

      {tab === "overview" && (
        <>
          <Overview data={data} onShowContacts={canReadContacts ? () => selectTab("contacts") : undefined} />
          <EntityTasksCard entityType="client" entityId={client.id} />
          <ClientOpportunitiesCard clientId={client.id} />
        </>
      )}
      {tab === "contacts" && canReadContacts && (
        <ContactsTab clientId={client.id} clientOwnerId={client.owner_id} clientArchived={!!client.archived_at} />
      )}
      {extensionTabs
        .filter((t) => t.key === tab)
        .map((t) => (
          <t.component key={t.key} clientId={client.id} clientName={client.name} clientArchived={!!client.archived_at} />
        ))}
      {tab === "activity" && (
        <ActivityTimeline
          entityType="clients"
          entityId={client.id}
          participantOptions={participants}
          onChanged={() => queryClient.invalidateQueries({ queryKey: clientKeys.detail(client.id) })}
        />
      )}

      {editing && <ClientDrawer client={client} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={archiving}
        title="Archive client?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={() =>
          archive.mutateAsync(client).catch((e) => {
            toast.error(archive.message(e));
            throw e;
          })
        }
      >
        {`${client.name} will be hidden from the client list and cannot receive new demands. You can restore it later.`}
      </ConfirmDialog>
    </>
  );
}
