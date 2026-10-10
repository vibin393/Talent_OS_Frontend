"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  createTableColumn,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SearchBox,
  Spinner,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { type AppPolicy, ecosystemApi, ecosystemKeys } from "@/features/ecosystem/api";
import { KillSwitchCard } from "@/features/ecosystem/kill-switch-card";
import { FeatureReadinessPanel } from "@/features/settings/integrations/feature-readiness";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { type Installation, type ListingCard, marketplaceApi, marketplaceKeys } from "./api";
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  healthLabel,
  installStateBadge,
  policyWarning,
  PUBLISHER_OPTIONS,
  publisherBadge,
  STATUS_LABELS,
} from "./labels";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1200px" },
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "end" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: tokens.spacingHorizontalM },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minHeight: "180px" },
  cardBody: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`, flexGrow: 1 },
  badges: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  logo: { width: "32px", height: "32px", borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground3, display: "grid", placeItems: "center", fontWeight: tokens.fontWeightSemibold },
  empty: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalS, padding: tokens.spacingVerticalL },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
});

type TabKey = "marketplace" | "installed" | "policy" | "ecosystem";
const TABS: { key: TabKey; label: string }[] = [
  { key: "marketplace", label: "Marketplace" },
  { key: "installed", label: "Installed" },
  { key: "policy", label: "App policy" },
  { key: "ecosystem", label: "Ecosystem" },
];

/** Settings → Integrations (Epic 69; the Epic 66 placeholder becomes a tabbed page). */
export function IntegrationsPage() {
  const styles = useStyles();
  const canView = usePermission("integration:view");
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get("tab") as TabKey | null) ?? "marketplace";
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initial) ? initial : "marketplace");
  if (!canView)
    return (
      <>
        <PageHeader title="Integrations" />
        <NoAccess what="integrations" />
      </>
    );
  return (
    <div className={styles.root}>
      <PageHeader title="Integrations" subtitle="Connect Talent OS to the tools your teams use. You decide what each one can access." />
      <TabList
        selectedValue={tab}
        onTabSelect={(_, d) => {
          setTab(d.value as TabKey);
          router.replace(`/settings/integrations?tab=${d.value as string}`);
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      {tab === "marketplace" ? <MarketplaceTab /> : null}
      {tab === "installed" ? <InstalledTab /> : null}
      {tab === "policy" ? <PolicyTab /> : null}
      {tab === "ecosystem" ? <EcosystemTab /> : null}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function ListingCardView({ card }: { card: ListingCard }) {
  const styles = useStyles();
  const pub = publisherBadge(card.publisher_kind, card.publisher_badge);
  const state = installStateBadge(card.install_state);
  return (
    <Card className={styles.card}>
      <CardHeader
        image={
          card.logo_url ? (
            <img src={card.logo_url} alt="" width={32} height={32} />
          ) : (
            <span className={styles.logo} aria-hidden>
              {initials(card.name)}
            </span>
          )
        }
        header={<Subtitle2>{card.name}</Subtitle2>}
        description={<Caption1>{categoryLabel(card.category)}</Caption1>}
      />
      <div className={styles.cardBody}>
        <Body1>{card.tagline}</Body1>
        <div className={styles.badges}>
          <Badge appearance="tint" color={pub.color}>
            {pub.label}
          </Badge>
          {state ? (
            <Badge appearance="tint" color={state.color}>
              {state.label}
            </Badge>
          ) : null}
          {!card.install_allowed && card.not_allowed_reason ? <Caption1>{card.not_allowed_reason}</Caption1> : null}
        </div>
        <div>
          <Link href={`/settings/integrations/marketplace/${encodeURIComponent(card.slug)}`}>
            <Button appearance="secondary" aria-label={`View ${card.name}`}>
              View
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function MarketplaceTab() {
  const styles = useStyles();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [publisher, setPublisher] = useState("");
  const [installedOnly, setInstalledOnly] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const filters = { q: debounced || undefined, category: category || undefined, publisher: publisher || undefined, installed: installedOnly || undefined };
  const list = useQuery({ queryKey: marketplaceKeys.listings(filters), queryFn: ({ signal }) => marketplaceApi.listings(filters, signal) });
  const clear = () => {
    setQ("");
    setCategory("");
    setPublisher("");
    setInstalledOnly(false);
  };
  return (
    <>
      <div className={styles.filters}>
        <SearchBox placeholder="Search integrations" value={q} onChange={(_, d) => setQ(d.value)} aria-label="Search integrations" />
        <Field label="Category">
          <Dropdown
            value={CATEGORY_OPTIONS.find((c) => c.value === category)?.label}
            selectedOptions={[category]}
            onOptionSelect={(_, d) => setCategory(d.optionValue ?? "")}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <Option key={c.value || "all"} value={c.value}>
                {c.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Publisher">
          <Dropdown
            value={PUBLISHER_OPTIONS.find((p) => p.value === publisher)?.label}
            selectedOptions={[publisher]}
            onOptionSelect={(_, d) => setPublisher(d.optionValue ?? "")}
          >
            {PUBLISHER_OPTIONS.map((p) => (
              <Option key={p.value || "all"} value={p.value}>
                {p.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Installed only" checked={installedOnly} onChange={(_, d) => setInstalledOnly(d.checked)} />
      </div>
      {list.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(list.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {list.isPending ? <Spinner label="Loading integrations" /> : null}
      {list.data && list.data.data.length === 0 ? (
        <div className={styles.empty}>
          <Body1>No integrations match your filters.</Body1>
          <Button onClick={clear}>Clear filters</Button>
        </div>
      ) : null}
      {list.data && list.data.data.length > 0 ? (
        <div className={styles.grid}>
          {list.data.data.map((card) => (
            <ListingCardView key={card.slug} card={card} />
          ))}
        </div>
      ) : null}
    </>
  );
}

const STATUS_FILTERS = ["", "pending_consent", "pending_approval", "active", "degraded", "reconsent_required", "suspended"] as const;

function InstalledTab() {
  const router = useRouter();
  const styles = useStyles();
  const [status, setStatus] = useState("");
  const [showUninstalled, setShowUninstalled] = useState(false);
  const list = useQuery({
    queryKey: marketplaceKeys.installations(status, showUninstalled),
    queryFn: ({ signal }) => marketplaceApi.installations(status || undefined, showUninstalled, signal),
  });
  const columns: TableColumnDefinition<Installation>[] = [
    createTableColumn({ columnId: "name", compare: (a, b) => a.display_name.localeCompare(b.display_name), renderHeaderCell: () => "Integration", renderCell: (i) => i.display_name }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <Badge appearance="tint" color={STATUS_LABELS[i.status].color}>
          {STATUS_LABELS[i.status].label}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "health", renderHeaderCell: () => "Health", renderCell: (i) => healthLabel(i.health_status) }),
    createTableColumn({ columnId: "le", renderHeaderCell: () => "Legal entities", renderCell: (i) => (i.legal_entity_ids.length ? String(i.legal_entity_ids.length) : "All") }),
    createTableColumn({ columnId: "accountable", renderHeaderCell: () => "Accountable", renderCell: (i) => (i.accountable_user_id ? "Assigned" : "—") }),
    createTableColumn({ columnId: "installed", compare: (a, b) => a.created_at.localeCompare(b.created_at), renderHeaderCell: () => "Installed on", renderCell: (i) => formatDateTime(i.created_at) }),
    createTableColumn({ columnId: "sync", renderHeaderCell: () => "Last sync", renderCell: (i) => formatDateTime(i.last_sync_at) }),
  ];
  return (
    <>
      <div className={styles.filters}>
        <Field label="Status">
          <Dropdown
            value={status ? STATUS_LABELS[status as keyof typeof STATUS_LABELS].label : "All statuses"}
            selectedOptions={[status]}
            onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
          >
            {STATUS_FILTERS.map((s) => (
              <Option key={s || "all"} value={s}>
                {s ? STATUS_LABELS[s].label : "All statuses"}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Show uninstalled" checked={showUninstalled} onChange={(_, d) => setShowUninstalled(d.checked)} />
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={list.isPending}
        error={list.error}
        emptyText="Nothing is installed yet. Browse the Marketplace to connect a tool."
        label="Installed integrations"
        sortable
        onRowClick={(i) => router.push(`/settings/integrations/installed/${i.id}`)}
      />
    </>
  );
}

type Chain = { id: string; name: string; subject_type: string; is_active: boolean };

function PolicyTab() {
  const styles = useStyles();
  const canManage = usePermission("integration:manage");
  const toast = useAppToast();
  const qc = useQueryClient();
  const policy = useQuery({ queryKey: marketplaceKeys.policy, queryFn: ({ signal }) => marketplaceApi.policy(signal) });
  const chains = useQuery({ queryKey: ["approval-chains"], queryFn: ({ signal }) => api.get<Chain[]>("/api/v1/approval-chains", { signal }), retry: false });
  const [draft, setDraft] = useState<AppPolicy | null>(null);
  useEffect(() => {
    if (policy.data && !draft)
      setDraft({
        publisher_kinds: policy.data.publisher_kinds,
        private_apps: policy.data.private_apps,
        user_self_authorize: policy.data.user_self_authorize,
        sensitive_approval_chain_id: policy.data.sensitive_approval_chain_id,
      });
  }, [policy.data, draft]);
  const save = useMutation({
    mutationFn: () => ecosystemApi.setAppPolicy(draft as AppPolicy),
    onSuccess: (next) => {
      qc.setQueryData(ecosystemKeys.state, next);
      void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
      toast.success("App policy saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (policy.isPending || !draft) return <Spinner label="Loading the app policy" />;
  const warning = policyWarning(policy.data?.affected_installations.length ?? 0);
  const toggle = (kind: "platform" | "partner", on: boolean) =>
    setDraft((p) => (p ? { ...p, publisher_kinds: on ? [...new Set([...p.publisher_kinds, kind])] : p.publisher_kinds.filter((k) => k !== kind) } : p));
  const chainName = (chains.data ?? []).find((c) => c.id === draft.sensitive_approval_chain_id)?.name;
  return (
    <Card>
      <div className={styles.stack}>
        {warning ? (
          <MessageBar intent="warning">
            <MessageBarBody>{warning}</MessageBarBody>
          </MessageBar>
        ) : null}
        <Field label="Allowed publishers">
          <Checkbox label="Talent OS" disabled={!canManage} checked={draft.publisher_kinds.includes("platform")} onChange={(_, d) => toggle("platform", Boolean(d.checked))} />
          <Checkbox label="Verified partners" disabled={!canManage} checked={draft.publisher_kinds.includes("partner")} onChange={(_, d) => toggle("partner", Boolean(d.checked))} />
        </Field>
        <Switch
          label="Allow private apps built by your organisation"
          disabled={!canManage}
          checked={draft.private_apps}
          onChange={(_, d) => setDraft({ ...draft, private_apps: d.checked })}
        />
        <Switch
          label="Let people connect installed apps to their own account"
          disabled={!canManage}
          checked={draft.user_self_authorize}
          onChange={(_, d) => setDraft({ ...draft, user_self_authorize: d.checked })}
        />
        <Field label="Approval for sensitive access">
          <Dropdown
            disabled={!canManage}
            value={chainName ?? "No approval needed"}
            selectedOptions={[draft.sensitive_approval_chain_id ?? ""]}
            onOptionSelect={(_, d) => setDraft({ ...draft, sensitive_approval_chain_id: d.optionValue || null })}
          >
            <Option value="">No approval needed</Option>
            {(chains.data ?? [])
              .filter((c) => c.is_active)
              .map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                </Option>
              ))}
          </Dropdown>
        </Field>
        <Caption1>Changing the policy never widens access you&apos;ve already granted.</Caption1>
        {canManage ? (
          <div className={styles.row}>
            <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save policy
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function EcosystemTab() {
  const q = useQuery({ queryKey: ecosystemKeys.state, queryFn: ({ signal }) => ecosystemApi.state(signal) });
  if (q.error)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  if (!q.data) return <Spinner label="Loading" />;
  return (
    <>
      <KillSwitchCard state={q.data} />
      <FeatureReadinessPanel />
      <Text size={200}>
        <Link href="/settings/integrations/webhooks">Webhooks</Link>
      </Text>
    </>
  );
}
