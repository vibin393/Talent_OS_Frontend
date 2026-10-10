"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  Link,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle16Filled, Circle16Regular, DismissCircle16Filled, ShieldCheckmark16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { placementKeys, placementsApi } from "./api";
import {
  DROPOUT_RULE_LABELS,
  formatDate,
  formatPct,
  GATE_COLORS,
  GATE_LABELS,
  maskedRate,
  segmentLabel,
  SETUP_ITEM_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./format";
import { AddSegmentDialog, DropDialog, MarkJoinedDialog, OverrideDialog, useSegments } from "./placement-dialogs";
import type { PlacementOut, StartGateOut } from "./types";
import { PlacementOnboardingTab } from "@/features/onboarding/case-view";
import { PlacementBgvSummary } from "@/features/bgv/bgv-summary";
import { PlacementComplianceTab } from "@/features/compliance/placement-compliance-tab";
import { PlacementExtensionTab } from "@/features/placement-exit/extension-tab";
import { placementPanels } from "./placement-panels";
import "@/features/predictions/register-panels";
import "@/features/hrms-sync/register-panels";
import "@/features/agents/compliance/register";

const useStyles = makeStyles({
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  tabs: { marginBottom: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  met: { color: tokens.colorPaletteGreenForeground1 },
  failed: { color: tokens.colorPaletteRedForeground1 },
  pending: { color: tokens.colorNeutralForeground3 },
  timeline: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

type TabKey = "overview" | "rates" | "gates" | "prejoining" | "onboarding" | "bgv" | "compliance" | "extension" | "history";
const PRE_START = ["pre_joining", "joining_confirmed"];

function GateIcon({ g }: { g: StartGateOut }) {
  const styles = useStyles();
  if (g.status === "met" || g.status === "waived" || g.status === "not_required") return <CheckmarkCircle16Filled className={mergeClasses(styles.met)} />;
  if (g.status === "failed") return <DismissCircle16Filled className={mergeClasses(styles.failed)} />;
  return <Circle16Regular className={mergeClasses(styles.pending)} />;
}

function Overview({ p }: { p: PlacementOut }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      {p.setup_items.length > 0 && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Setup incomplete</MessageBarTitle>
            <ul>
              {p.setup_items.map((item) => {
                const meta = SETUP_ITEM_LABELS[item] ?? { label: item };
                return (
                  <li key={item}>
                    {meta.href ? (
                      <Link as="a" href={meta.href}>
                        {meta.label}
                      </Link>
                    ) : (
                      meta.label
                    )}
                  </li>
                );
              })}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      <dl className={admin.detailList}>
        <dt>Worker</dt>
        <dd>
          <NextLink href={`/workers/${p.candidate_id}`}>{p.candidate_name ?? p.candidate_id}</NextLink>
          {p.worker_human_id ? ` (${p.worker_human_id})` : ""}
        </dd>
        <dt>Client</dt>
        <dd>{p.client_name ?? "—"}</dd>
        <dt>Role</dt>
        <dd>{p.role_title ?? "—"}</dd>
        <dt>Engagement</dt>
        <dd>
          {p.engagement_kind ?? "—"} · {p.worker_type?.replace("_", " ") ?? "permanent"} · paid to {p.payee_kind}
        </dd>
        <dt>Legal entity</dt>
        <dd>{p.legal_entity_name ?? "—"}</dd>
        <dt>GST registration</dt>
        <dd>{p.supplier_gst_registration_id ? "Assigned" : "—"}</dd>
        <dt>Location</dt>
        <dd>{[p.work_location_text, p.work_state_code].filter(Boolean).join(" · ") || "—"}</dd>
        <dt>Planned</dt>
        <dd>
          {formatDate(p.planned_start_date)} – {formatDate(p.planned_end_date)}
        </dd>
        <dt>Actual start</dt>
        <dd>{formatDate(p.actual_start_date)}</dd>
        {p.drop_reason && (
          <>
            <dt>Dropped</dt>
            <dd>
              {p.drop_reason}
              {p.drop_note ? ` — ${p.drop_note}` : ""}
            </dd>
          </>
        )}
      </dl>
    </Card>
  );
}

function Rates({ p }: { p: PlacementOut }) {
  const styles = useStyles();
  const canRates = usePermission("placement:rates");
  const canView = usePermission("compensation:view");
  const segments = useSegments(p.id);
  const [adding, setAdding] = useState(false);
  return (
    <Card className={styles.card}>
      {canRates && !["ended", "dropped"].includes(p.status) && (
        <div>
          <Button appearance="primary" onClick={() => setAdding(true)}>
            Add rate segment
          </Button>
        </div>
      )}
      {segments.isPending ? (
        <Spinner size="small" label="Loading rates" />
      ) : (
        <Table aria-label="Rate segments" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Period</TableHeaderCell>
              <TableHeaderCell>Pay</TableHeaderCell>
              <TableHeaderCell>Bill</TableHeaderCell>
              <TableHeaderCell>Margin</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(segments.data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  {segmentLabel(s)} · per {s.rate_unit}
                </TableCell>
                <TableCell>{maskedRate(s.pay_rate, s.currency, canView)}</TableCell>
                <TableCell>{maskedRate(s.bill_rate, s.currency, canView)}</TableCell>
                <TableCell>{canView ? `${maskedRate(s.margin_amount, s.currency, true)} (${formatPct(s.margin_pct)})` : "••••"}</TableCell>
                <TableCell>
                  <Badge appearance="tint" color={s.status === "active" ? "success" : s.status === "rejected" ? "danger" : "warning"}>
                    {s.status === "pending_approval" ? "Pending approval" : s.status === "active" ? "Active" : "Rejected"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {adding && <AddSegmentDialog placement={p} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function Gates({ p, gates }: { p: PlacementOut; gates: StartGateOut[] }) {
  const styles = useStyles();
  const overrides = useQuery({ queryKey: placementKeys.overrides(p.id), queryFn: ({ signal }) => placementsApi.overrides(p.id, signal) });
  return (
    <Card className={styles.card}>
      {gates.length === 0 ? (
        <Body1>No start gates for this placement.</Body1>
      ) : (
        <Table aria-label="Start gates" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Gate</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Required</TableHeaderCell>
              <TableHeaderCell>Checked</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gates.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <GateIcon g={g} /> {g.label ?? g.kind}
                </TableCell>
                <TableCell>
                  <Badge appearance="tint" color={GATE_COLORS[g.status]}>
                    {GATE_LABELS[g.status]}
                  </Badge>
                </TableCell>
                <TableCell>{g.required ? "Yes" : "No"}</TableCell>
                <TableCell>{formatDateTime(g.refreshed_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Text weight="semibold">Override history</Text>
      {(overrides.data ?? []).length === 0 ? (
        <Body1>No overrides requested.</Body1>
      ) : (
        <ul className={styles.timeline}>
          {(overrides.data ?? []).map((o) => (
            <li key={o.id}>
              <ShieldCheckmark16Regular /> {formatDateTime(o.created_at)} — {o.status}: {o.reason}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PreJoining({ p }: { p: PlacementOut }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const canUpdate = usePermission("placement:update");
  const tps = useQuery({ queryKey: placementKeys.touchpoints(p.id), queryFn: ({ signal }) => placementsApi.touchpoints(p.id, signal) });
  const refresh = () => void qc.invalidateQueries({ queryKey: placementKeys.detail(p.id) });
  const clear = useMutation({ mutationFn: () => placementsApi.clearDropout(p.id, null), onSuccess: refresh });
  const counter = useMutation({ mutationFn: () => placementsApi.counterOffer(p.id, null), onSuccess: refresh });
  return (
    <Card className={styles.card}>
      {p.dropout_risk && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Dropout risk</MessageBarTitle>
            {p.dropout_risk_rules.map((r) => DROPOUT_RULE_LABELS[r] ?? r).join(" · ")}
          </MessageBarBody>
          {canUpdate && (
            <MessageBarActions>
              <Button size="small" onClick={() => clear.mutate()} disabled={clear.isPending}>
                Clear
              </Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
      <Text>
        Joining confirmation:{" "}
        {p.joining_confirmed_at ? `confirmed ${formatDateTime(p.joining_confirmed_at)} (${p.joining_confirmed_via})` : "not yet"}
      </Text>
      <Text>Onboarding: {p.onboarding_pct === null ? "—" : `${p.onboarding_pct} %`}</Text>
      <Text>Counter-offer: {p.counter_offer_at ? formatDateTime(p.counter_offer_at) : "none recorded"}</Text>
      {canUpdate && PRE_START.includes(p.status) && !p.counter_offer_at && (
        <div>
          <Button onClick={() => counter.mutate()} disabled={counter.isPending}>
            Record counter-offer
          </Button>
        </div>
      )}
      <ErrorBar message={clear.isError ? errorMessage(clear.error) : counter.isError ? errorMessage(counter.error) : null} />
      <Text weight="semibold">Touchpoints</Text>
      {(tps.data ?? []).length === 0 ? (
        <Body1>No touchpoints sent yet.</Body1>
      ) : (
        <ul className={styles.timeline}>
          {(tps.data ?? []).map((t) => (
            <li key={t.id}>
              T-{t.offset_days} ({formatDate(t.due_on)}): {t.sent_at ? "sent" : "scheduled"}
              {t.response ? ` · ${t.response === "confirmed" ? "confirmed" : "has a question"}` : ""}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function History({ id }: { id: string }) {
  const styles = useStyles();
  const h = useQuery({ queryKey: placementKeys.history(id), queryFn: ({ signal }) => placementsApi.history(id, signal) });
  return (
    <Card className={styles.card}>
      <ul className={styles.timeline}>
        {(h.data ?? []).map((r) => (
          <li key={r.id}>
            {formatDateTime(r.at)} — {r.from_status ? `${r.from_status} → ` : ""}
            {r.to_status} ({r.actor_kind}){r.reason ? ` · ${r.reason}` : ""}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** `/placements/[id]`: header with actions; Overview, Rates, Start gates, Pre-joining and History tabs. */
export function PlacementDetail({ id }: { id: string }) {
  const styles = useStyles();
  const canRead = usePermission("placement:read");
  const canJoin = usePermission("placement:join");
  const canDrop = usePermission("placement:drop");
  const canOverride = usePermission("start_gate:override");
  const canOnboarding = usePermission("onboarding:read");
  const canBgv = usePermission("bgv:read");
  const canCompliance = usePermission("compliance:read");
  const permissionMap = usePermissions();
  const extraPanels = placementPanels((perm) => perm in permissionMap);
  const [tab, setTab] = useState<TabKey>("overview");
  const [dialog, setDialog] = useState<"join" | "drop" | "override" | null>(null);
  const q = useQuery({ queryKey: placementKeys.detail(id), queryFn: ({ signal }) => placementsApi.get(id, signal), enabled: canRead });
  const gates = useQuery({ queryKey: placementKeys.gates(id), queryFn: ({ signal }) => placementsApi.gates(id, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="placements" />;
  if (q.isPending) return <Spinner label="Loading placement" />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  const p = q.data;
  const pre = PRE_START.includes(p.status);
  return (
    <>
      <PageHeader
        title={`${p.human_id} · ${p.candidate_name ?? "Worker"}`}
        subtitle={
          <span>
            {p.client_name ?? ""}{" "}
            <Badge appearance="tint" color={STATUS_COLORS[p.status]}>
              {STATUS_LABELS[p.status]}
            </Badge>
          </span>
        }
      />
      <div className={styles.actions}>
        {pre && canJoin && (
          <Button appearance="primary" onClick={() => setDialog("join")}>
            Mark joined
          </Button>
        )}
        {pre && canOverride && <Button onClick={() => setDialog("override")}>Request override</Button>}
        {pre && canDrop && <Button onClick={() => setDialog("drop")}>Drop</Button>}
      </div>
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)}>
        <Tab value="overview">Overview</Tab>
        <Tab value="rates">Rates</Tab>
        <Tab value="gates">Start gates</Tab>
        <Tab value="prejoining">Pre-joining</Tab>
        {canOnboarding && <Tab value="onboarding">Onboarding</Tab>}
        {canBgv && <Tab value="bgv">BGV</Tab>}
        {canCompliance && <Tab value="compliance">Compliance</Tab>}
        <Tab value="extension">Extension</Tab>
        <Tab value="history">History</Tab>
      </TabList>
      {tab === "overview" && <Overview p={p} />}
      {tab === "overview" &&
        extraPanels.map(({ key, component: Panel }) => (
          <div key={key} style={{ marginTop: tokens.spacingVerticalM }}>
            <Panel placementId={p.id} placementStatus={p.status} />
          </div>
        ))}
      {tab === "rates" && <Rates p={p} />}
      {tab === "gates" && <Gates p={p} gates={gates.data ?? []} />}
      {tab === "prejoining" && <PreJoining p={p} />}
      {tab === "onboarding" && <PlacementOnboardingTab placementId={p.id} />}
      {tab === "bgv" && <PlacementBgvSummary placementId={p.id} candidateId={p.candidate_id} />}
      {tab === "compliance" && <PlacementComplianceTab placementId={p.id} candidateId={p.candidate_id} />}
      {tab === "extension" && <PlacementExtensionTab placement={p} />}
      {tab === "history" && <History id={p.id} />}
      {dialog === "join" && <MarkJoinedDialog placement={p} gates={gates.data ?? []} onClose={() => setDialog(null)} />}
      {dialog === "drop" && <DropDialog placement={p} onClose={() => setDialog(null)} />}
      {dialog === "override" && <OverrideDialog placement={p} gates={gates.data ?? []} onClose={() => setDialog(null)} />}
    </>
  );
}
