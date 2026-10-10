"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  SpinButton,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowLeft20Regular,
  ArrowReset20Regular,
  ArrowUndo20Regular,
  Delete20Regular,
  Dismiss20Regular,
  Edit20Regular,
  Next20Regular,
  Trophy20Regular,
} from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { PersonPicker } from "@/features/activity/person-picker";
import { DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { EntityTasksCard } from "@/features/tasks/entity-tasks-card";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { TaskEntityType } from "@/lib/api/types";
import { crmKeys } from "../api";
import { formatDate, formatMoney, formatPercent, OPEN_STAGES, SERVICE_LABELS, SERVICES, STAGE_LABELS } from "../format";
import type { OpportunityLineIn, OpportunityOut, OpportunityStage, RateUnit, Service } from "../types";
import { HistoryList, ReasonDialog, StageBadge } from "../ui";
import { useOpportunity, useOpportunityHistory, useOpportunityMutations } from "../use-opportunity-board";
import { WonDialog } from "../won/won-dialog";
import { conflictMessage } from "./board-rules";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  header: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, alignItems: "flex-start", marginBottom: tokens.spacingVerticalM },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, flex: "1 1 320px", minWidth: 0 },
  line: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  tabs: { marginBottom: tokens.spacingVerticalL, borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  card: { padding: tokens.spacingHorizontalL },
  wide: { padding: tokens.spacingHorizontalL, marginTop: tokens.spacingVerticalL, overflowX: "auto" },
  prob: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  linesFoot: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS },
});

type LineDraft = { title: string; positions: number; rate: string; currency: string; unit: string; location: string };
const lineDraft = (o: OpportunityOut): LineDraft[] =>
  o.lines.map((l) => ({
    title: l.title,
    positions: l.positions,
    rate: l.expected_bill_rate ?? "",
    currency: l.currency,
    unit: l.rate_unit ?? "",
    location: l.location ?? "",
  }));

const RATE_UNITS: RateUnit[] = ["hour", "day", "month", "year"];

function EditDrawer({ o, onClose }: { o: OpportunityOut; onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const { update } = useOpportunityMutations();
  const open = OPEN_STAGES.includes(o.stage);
  const [d, setD] = useState({
    name: o.name,
    service: o.service,
    revenue: o.estimated_revenue,
    currency: o.currency,
    close: o.expected_close_date ?? "",
    prob: o.probability_pct,
    ownerId: o.owner_id,
    ownerName: o.owner?.name ?? "",
    amId: o.account_manager_id,
    amName: o.account_manager?.name ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));

  async function save() {
    setError(null);
    try {
      const body = open
        ? {
            name: d.name.trim(),
            service: d.service,
            estimated_revenue: d.revenue.trim() || "0",
            currency: d.currency,
            expected_close_date: d.close || null,
            owner_id: d.ownerId,
            account_manager_id: d.amId,
            ...(d.prob !== o.probability_pct ? { probability_pct: d.prob } : {}),
          }
        : { owner_id: d.ownerId, account_manager_id: d.amId };
      await update.mutateAsync({ id: o.id, body });
      toast.success("Saved");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <DetailsDrawer
      open
      title={`Edit ${o.human_id}`}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button appearance="primary" disabled={update.isPending} icon={update.isPending ? <Spinner size="tiny" /> : undefined} onClick={save}>
            Save changes
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div className={admin.form}>
        {error && <ErrorBar message={error} />}
        {open && (
          <>
            <Field label="Name" required>
              <Input value={d.name} maxLength={300} onChange={(_, v) => set({ name: v.value })} />
            </Field>
            <Field label="Service">
              <Dropdown value={SERVICE_LABELS[d.service]} selectedOptions={[d.service]} onOptionSelect={(_, v) => v.optionValue && set({ service: v.optionValue as Service })}>
                {SERVICES.map((s) => (
                  <Option key={s} value={s}>
                    {SERVICE_LABELS[s]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Estimated revenue">
              <Input inputMode="decimal" value={d.revenue} onChange={(_, v) => set({ revenue: v.value })} />
            </Field>
            <Field label="Currency">
              <Input value={d.currency} maxLength={3} onChange={(_, v) => set({ currency: v.value.toUpperCase() })} />
            </Field>
            <Field label="Expected close date">
              <Input type="date" value={d.close} onChange={(_, v) => set({ close: v.value })} />
            </Field>
            <Field label="Probability %" hint="Overrides the stage default.">
              <SpinButton
                min={0}
                max={100}
                value={Number(d.prob)}
                onChange={(_, v) => {
                  const n = v.value ?? Number(v.displayValue);
                  if (Number.isFinite(n) && (n as number) >= 0 && (n as number) <= 100) set({ prob: String(n) });
                }}
              />
            </Field>
          </>
        )}
        <PersonPicker label="Owner" value={d.ownerId} valueLabel={d.ownerName} onChange={(p) => p && set({ ownerId: p.id, ownerName: p.name })} />
        <PersonPicker
          label="Account manager"
          value={d.amId}
          valueLabel={d.amName}
          clearLabel="None"
          onChange={(p) => set({ amId: p?.id ?? null, amName: p?.name ?? "" })}
        />
      </div>
    </DetailsDrawer>
  );
}

function LinesCard({ o, editable }: { o: OpportunityOut; editable: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const { lines } = useOpportunityMutations();
  const [draft, setDraft] = useState<LineDraft[] | null>(null);
  const rows = draft ?? lineDraft(o);
  const setRow = (i: number, p: Partial<LineDraft>) => setDraft(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function save() {
    const body: OpportunityLineIn[] = rows
      .filter((r) => r.title.trim())
      .map((r) => ({
        title: r.title.trim(),
        positions: r.positions,
        expected_bill_rate: r.rate.trim() || null,
        currency: r.currency || null,
        rate_unit: (r.unit || null) as RateUnit | null,
        location: r.location.trim() || null,
      }));
    try {
      await lines.mutateAsync({ id: o.id, lines: body });
      setDraft(null);
      toast.success("Lines saved");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card className={styles.wide}>
      <CardHeader header={<Subtitle2 as="h2">Role lines</Subtitle2>} />
      {rows.length === 0 && !editable ? (
        <Body1 className={styles.muted}>No role lines.</Body1>
      ) : (
        <Table size="small" aria-label="Role lines">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell style={{ width: 110 }}>Positions</TableHeaderCell>
              <TableHeaderCell style={{ width: 140 }}>Bill rate</TableHeaderCell>
              <TableHeaderCell style={{ width: 80 }}>Currency</TableHeaderCell>
              <TableHeaderCell style={{ width: 120 }}>Per</TableHeaderCell>
              <TableHeaderCell>Location</TableHeaderCell>
              {editable && <TableHeaderCell style={{ width: 44 }} aria-label="Actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) =>
              editable ? (
                <TableRow key={i}>
                  <TableCell>
                    <Input aria-label="Title" value={r.title} onChange={(_, v) => setRow(i, { title: v.value })} />
                  </TableCell>
                  <TableCell>
                    <SpinButton
                      aria-label="Positions"
                      min={1}
                      value={r.positions}
                      onChange={(_, v) => {
                        const n = v.value ?? Number(v.displayValue);
                        if (Number.isFinite(n) && (n as number) >= 1) setRow(i, { positions: Math.round(n as number) });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input aria-label="Bill rate" inputMode="decimal" value={r.rate} onChange={(_, v) => setRow(i, { rate: v.value })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label="Currency" maxLength={3} value={r.currency} onChange={(_, v) => setRow(i, { currency: v.value.toUpperCase() })} />
                  </TableCell>
                  <TableCell>
                    <Dropdown aria-label="Rate unit" value={r.unit} selectedOptions={r.unit ? [r.unit] : []} onOptionSelect={(_, v) => setRow(i, { unit: v.optionValue ?? "" })}>
                      {RATE_UNITS.map((u) => (
                        <Option key={u} value={u}>
                          {u}
                        </Option>
                      ))}
                    </Dropdown>
                  </TableCell>
                  <TableCell>
                    <Input aria-label="Location" value={r.location} onChange={(_, v) => setRow(i, { location: v.value })} />
                  </TableCell>
                  <TableCell>
                    <Button appearance="subtle" icon={<Delete20Regular />} aria-label="Remove line" onClick={() => setDraft(rows.filter((_, j) => j !== i))} />
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={i}>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>{r.positions}</TableCell>
                  <TableCell>{r.rate ? formatMoney(r.rate, r.currency) : "—"}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell>{r.unit || "—"}</TableCell>
                  <TableCell>{r.location || "—"}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}
      {editable && (
        <div className={styles.linesFoot}>
          <Button icon={<Add20Regular />} onClick={() => setDraft([...rows, { title: "", positions: 1, rate: "", currency: o.currency, unit: "month", location: "" }])}>
            Add line
          </Button>
          {draft && (
            <>
              <Button appearance="primary" disabled={lines.isPending} onClick={save}>
                Save lines
              </Button>
              <Button onClick={() => setDraft(null)}>Discard</Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

type TabValue = "overview" | "activity" | "history";

/** `/opportunities/[id]`: overview, editable lines, probability override/reset, timeline and history. */
export function OpportunityDetail({ opportunityId }: { opportunityId: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canRead = usePermission("opportunity:read");
  const canWrite = usePermission("opportunity:write");
  const query = useOpportunity(opportunityId);
  const history = useOpportunityHistory(opportunityId);
  const { transition, resetProbability } = useOpportunityMutations();
  const [tab, setTab] = useState<TabValue>("overview");
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"lost" | "reopen" | "won" | null>(null);

  if (!canRead) return <NoAccess what="opportunities" />;
  const back = (
    <div className={styles.back}>
      <AppLink href="/opportunities">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Opportunities
      </AppLink>
    </div>
  );
  if (query.isPending) return (<>{back}<GridSkeleton rows={6} /></>);
  if (query.isError) {
    return (
      <>
        {back}
        {isApiError(query.error) && query.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Opportunity not found</Subtitle2>} description={<Body1>This opportunity does not exist or you do not have access to it.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this opportunity." message={errorMessage(query.error)} />
        )}
      </>
    );
  }

  const o = query.data;
  const isOpen = OPEN_STAGES.includes(o.stage);
  const nextStage = isOpen ? OPEN_STAGES[OPEN_STAGES.indexOf(o.stage) + 1] : undefined;
  const go = (to: OpportunityStage, extra: { reason_code?: string; competitor?: string | null; note?: string | null } = {}) =>
    transition.mutateAsync({ id: o.id, body: { to, expected_stage: o.stage, ...extra } }).catch((e) => {
      toast.error(isApiError(e) && e.status === 409 ? conflictMessage(e.code) : errorMessage(e));
      throw e;
    });

  return (
    <>
      {back}
      <div className={styles.header}>
        <div className={styles.identity}>
          <Text className={styles.muted} weight="semibold">
            {o.human_id}
          </Text>
          <div className={styles.line}>
            <Title2 as="h1">{o.name}</Title2>
            <StageBadge stage={o.stage} />
          </div>
          <div className={styles.line}>
            <AppLink href={`/clients/${o.client_id}`}>{o.client_name ?? "Client"}</AppLink>
            {o.lead_id && <AppLink href={`/leads/${o.lead_id}`}>From lead</AppLink>}
            {o.owner && <Text className={styles.muted}>Owner {o.owner.name}</Text>}
          </div>
        </div>
        {canWrite && (
          <div className={styles.actions}>
            {nextStage && (
              <Button icon={<Next20Regular />} disabled={transition.isPending} onClick={() => go(nextStage).catch(() => undefined)}>
                Move to {STAGE_LABELS[nextStage]}
              </Button>
            )}
            {isOpen && (
              <Button appearance="primary" icon={<Trophy20Regular />} onClick={() => setDialog("won")}>
                Mark won
              </Button>
            )}
            {isOpen && (
              <Button icon={<Dismiss20Regular />} onClick={() => setDialog("lost")}>
                Mark lost
              </Button>
            )}
            {o.stage === "lost" && (
              <Button icon={<ArrowUndo20Regular />} onClick={() => setDialog("reopen")}>
                Reopen
              </Button>
            )}
            <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabValue)} aria-label="Opportunity sections">
        <Tab value="overview">Overview</Tab>
        <Tab value="activity">Activity</Tab>
        <Tab value="history">History</Tab>
      </TabList>

      {tab === "overview" && (
        <>
          <div className={styles.cards}>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2 as="h2">Details</Subtitle2>} />
              <dl className={admin.detailList}>
                <dt>Service</dt>
                <dd>{SERVICE_LABELS[o.service]}</dd>
                <dt>Estimated revenue</dt>
                <dd>{formatMoney(o.estimated_revenue, o.currency)}</dd>
                <dt>Probability</dt>
                <dd>
                  <span className={styles.prob}>
                    {formatPercent(o.probability_pct)}
                    {o.probability_overridden && (
                      <>
                        <Badge appearance="tint" color="warning">
                          Overridden
                        </Badge>
                        {canWrite && isOpen && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<ArrowReset20Regular />}
                            disabled={resetProbability.isPending}
                            onClick={() => resetProbability.mutateAsync(o.id).catch((e) => toast.error(errorMessage(e)))}
                          >
                            Reset
                          </Button>
                        )}
                      </>
                    )}
                  </span>
                </dd>
                <dt>Weighted revenue</dt>
                <dd>{formatMoney(o.weighted_revenue, o.currency)}</dd>
                <dt>Expected close</dt>
                <dd>{formatDate(o.expected_close_date)}</dd>
                <dt>Account manager</dt>
                <dd>{o.account_manager?.name ?? "—"}</dd>
                <dt>In stage since</dt>
                <dd>{formatDateTime(o.stage_entered_at)}</dd>
                {o.stage === "lost" && (
                  <>
                    <dt>Lost</dt>
                    <dd>
                      {o.lost_reason_code}
                      {o.lost_competitor ? ` · ${o.lost_competitor}` : ""}
                      {o.lost_note ? ` — ${o.lost_note}` : ""}
                    </dd>
                  </>
                )}
                {o.won_at && (
                  <>
                    <dt>Won</dt>
                    <dd>{formatDateTime(o.won_at)}</dd>
                  </>
                )}
              </dl>
            </Card>
          </div>
          <LinesCard key={o.updated_at} o={o} editable={canWrite && isOpen} />
          <EntityTasksCard entityType={"opportunity" as TaskEntityType} entityId={o.id} />
        </>
      )}
      {tab === "activity" && (
        <ActivityTimeline entityType="opportunities" entityId={o.id} onChanged={() => qc.invalidateQueries({ queryKey: crmKeys.opportunity(o.id) })} />
      )}
      {tab === "history" && (
        <Card className={styles.card}>
          {history.data ? <HistoryList items={history.data} label={(v) => STAGE_LABELS[v as OpportunityStage] ?? v} /> : <GridSkeleton rows={3} />}
        </Card>
      )}

      {editing && <EditDrawer o={o} onClose={() => setEditing(false)} />}
      {dialog === "won" && <WonDialog opportunity={o} onClose={() => setDialog(null)} />}
      {(dialog === "lost" || dialog === "reopen") && (
        <ReasonDialog
          open
          title={dialog === "reopen" ? "Reopen opportunity" : "Mark opportunity lost"}
          kind={dialog === "reopen" ? "reopen" : "opportunity_lost"}
          confirmLabel={dialog === "reopen" ? "Reopen" : "Mark lost"}
          withCompetitor={dialog === "lost"}
          onClose={() => setDialog(null)}
          onConfirm={(r) => go(dialog === "reopen" ? "qualification" : "lost", { reason_code: r.reason_code, competitor: r.competitor, note: r.note })}
        />
      )}
    </>
  );
}
