"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  Spinner,
  SpinButton,
  Subtitle2,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Text,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  Warning16Filled,
  SubtractCircle16Regular,
  ArrowLeft20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { adminApi, adminKeys } from "@/features/admin/api";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { EvalsTable } from "@/features/ai-governance/evals-page";
import { RecordTimeline } from "@/features/audit/timeline/record-timeline";
import { usePermission } from "@/features/auth/use-permission";
import type { AutonomyMode } from "@/lib/api/agentic-types";
import type { AgentCatalogDetail, ChecklistItem } from "@/lib/api/governance-types";
import { errorMessage } from "@/lib/api/errors";
import { agentsApi, agentsKeys, useAgentsList, useChecklist } from "./api";
import {
  AGENT_TABS,
  agentErrorText,
  autoUnavailableReason,
  budgetErrors,
  CHANNEL_LABELS,
  CHECKLIST_STATUS,
  type ConfigDraft,
  configChanges,
  DAY_LABELS,
  draftFrom,
  effectiveModeText,
  enableDecision,
  expiryError,
  formatDate,
  inBurnIn,
  isDirty,
  LIMIT_FIELDS,
  modeOptions,
  overrideReasonError,
  WEEK_DAYS,
} from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "960px", minWidth: 0 },
  wrap: { overflowX: "auto" },
  grid: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))" },
  footer: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    justifyContent: "flex-end",
    position: "sticky",
    bottom: 0,
    paddingBlock: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  item: { display: "flex", alignItems: "flex-start", gap: tokens.spacingHorizontalS },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  days: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const STATUS_ICON: Record<string, React.ReactElement> = {
  ready: <CheckmarkCircle16Filled color={tokens.colorPaletteGreenForeground1} aria-label="Ready" />,
  missing: <DismissCircle16Filled color={tokens.colorPaletteRedForeground1} aria-label="Missing" />,
  warning: <Warning16Filled color={tokens.colorPaletteDarkOrangeForeground1} aria-label="Warning" />,
  not_applicable: <SubtractCircle16Regular color={tokens.colorNeutralForeground3} aria-label="Not applicable" />,
};

/** `/admin/ai/agents/[key]`: enable switch, burn-in, and the eight settings tabs with Save / Discard. */
export function AgentDetail({ agentKey }: { agentKey: string }) {
  const configure = usePermission("ai:agent_configure");
  const govern = usePermission("ai:govern");
  const list = useAgentsList(configure || govern);
  if (!configure && !govern) return <NoAccess what="AI agent settings" />;
  if (list.isPending) return <GridSkeleton rows={5} />;
  if (list.isError) return <ErrorBar title="Could not load the agent." message={errorMessage(list.error)} />;
  const agent = list.data.find((a) => a.key === agentKey);
  if (!agent) return <ErrorBar title="Agent not found." message="This agent does not exist." />;
  return <AgentEditor key={JSON.stringify(agent)} agent={agent} canEdit={configure} />;
}

function AgentEditor({ agent, canEdit }: { agent: AgentCatalogDetail; canEdit: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const base = useMemo(() => draftFrom(agent), [agent]);
  const [draft, setDraft] = useState<ConfigDraft>(base);
  const [tab, setTab] = useState<string>("actions");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [enableDialog, setEnableDialog] = useState<ChecklistItem[] | null>(null);
  const [burnInDialog, setBurnInDialog] = useState(false);
  const burnIn = inBurnIn(agent.burn_in_until);
  const dirty = isDirty(base, draft);
  const checklist = useChecklist(agent.key);
  const limits = useQuery({ queryKey: agentsKeys.limits(agent.key), queryFn: ({ signal }) => agentsApi.limits(agent.key, signal), retry: false });
  const tools = useQuery({ queryKey: agentsKeys.tools, queryFn: ({ signal }) => agentsApi.tools(signal), retry: false, staleTime: 300_000 });
  const canRoles = usePermission("role:read");
  const roles = useQuery({ queryKey: adminKeys.roles, queryFn: ({ signal }) => adminApi.listRoles(signal), enabled: canRoles, retry: false });
  const errors = budgetErrors(draft, limits.data?.ceiling, limits.data?.tenant_monthly_token_budget);
  const expiryErr = expiryError(draft.proposal_expiry_hours);

  // Unsaved-changes guard: the browser prompt on reload / close, and a dialog for in-app navigation.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const refresh = () => qc.invalidateQueries({ queryKey: agentsKeys.list });
  const setEnabled = useMutation({
    mutationFn: async (v: { enabled: boolean; reason?: string }) => {
      const out = await agentsApi.setEnabled(agent.key, v.enabled);
      if (v.enabled && v.reason) await agentsApi.acknowledge(agent.key, v.reason);
      return out;
    },
    onSuccess: () => {
      setEnableDialog(null);
      void refresh();
    },
    onError: (e) => setSaveError(agentErrorText(e)),
  });
  const save = useMutation({
    mutationFn: async () => {
      const { patch, actions } = configChanges(base, draft);
      if (Object.keys(patch).length) await agentsApi.patch(agent.key, patch);
      for (const a of actions) await agentsApi.setAction(agent.key, a.tool_key, a.mode, a.route_role_key);
    },
    onSuccess: () => {
      setSaveError(null);
      void refresh();
    },
    onError: (e) => {
      setSaveError(agentErrorText(e));
      void refresh();
    },
  });

  const navigate = (href: string) => (dirty ? setLeaveTo(href) : router.push(href));
  const onToggle = (on: boolean) => {
    setSaveError(null);
    if (!on) return setEnabled.mutate({ enabled: false });
    const d = enableDecision(checklist.data?.items);
    if (d.kind === "confirm") setEnableDialog(d.missing);
    else setEnabled.mutate({ enabled: true });
  };
  const set = (patch: Partial<ConfigDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toolDescription = (key: string) => tools.data?.find((t) => t.key === key)?.description ?? "—";
  const roleOptions = (roles.data ?? []).map((r) => ({ key: r.key, name: r.name }));
  const queueLabel = (k: string | null) => (k ? (roleOptions.find((r) => r.key === k)?.name ?? k) : "Accountable owner (default)");
  const declared = agent.declared_channels ?? agent.channels ?? [];

  return (
    <div className={styles.root}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => navigate("/admin/ai/agents")}>
          AI agents
        </Button>
      </div>
      <div className={styles.head}>
        <PageHeader title={agent.name} subtitle={agent.purpose} />
        <Switch
          label="Agent enabled"
          checked={agent.enabled}
          disabled={!canEdit || setEnabled.isPending || agent.placeholder}
          onChange={(_, d) => onToggle(d.checked)}
        />
      </div>
      {burnIn && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>Suggest-only burn-in until {formatDate(agent.burn_in_until)}. Every action is a proposal until then.</MessageBarBody>
          {canEdit && (
            <MessageBarActions>
              <Button size="small" onClick={() => setBurnInDialog(true)}>
                End burn-in early
              </Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
      {saveError && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{saveError}</MessageBarBody>
        </MessageBar>
      )}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} aria-label="Agent settings" style={{ overflowX: "auto" }}>
        {AGENT_TABS.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>

      <div className={styles.panel} role="tabpanel" aria-label={AGENT_TABS.find((t) => t.value === tab)?.label}>
        {tab === "actions" && (
          <div className={styles.wrap}>
            <Table aria-label="Actions and autonomy" style={{ minWidth: 760 }}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>What it does</TableHeaderCell>
                  <TableHeaderCell>Risk</TableHeaderCell>
                  <TableHeaderCell>Mode</TableHeaderCell>
                  <TableHeaderCell>Effective mode</TableHeaderCell>
                  <TableHeaderCell>Proposal queue</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.tools.map((t) => {
                  const current = draft.actions[t.key] ?? { mode: t.mode, route_role_key: t.route_role_key };
                  const opts = modeOptions(t.risk, burnIn);
                  const why = autoUnavailableReason(t.risk, burnIn);
                  const update = (patch: Partial<typeof current>) => set({ actions: { ...draft.actions, [t.key]: { ...current, ...patch } } });
                  return (
                    <TableRow key={t.key}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{toolDescription(t.key)}</TableCell>
                      <TableCell>
                        <Badge appearance="tint" color={t.risk === "high" ? "danger" : t.risk === "low" ? "informative" : "subtle"}>
                          {t.risk === "high" ? "High" : t.risk === "low" ? "Low" : "Read"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip content={why ?? "Off, Suggest or Auto"} relationship="description">
                          <Dropdown
                            aria-label={`Mode for ${t.title}`}
                            disabled={!canEdit}
                            value={opts.find((o) => o.value === current.mode)?.label ?? current.mode}
                            selectedOptions={[current.mode]}
                            onOptionSelect={(_, d) => d.optionValue && update({ mode: d.optionValue as AutonomyMode })}
                            style={{ minWidth: 120 }}
                          >
                            {opts.map((o) => (
                              <Option key={o.value} value={o.value} disabled={o.disabled} text={o.label}>
                                {o.disabled && o.tooltip ? `${o.label} (${o.tooltip})` : o.label}
                              </Option>
                            ))}
                          </Dropdown>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{effectiveModeText(t.mode, t.mode_reason)}</TableCell>
                      <TableCell>
                        <Dropdown
                          aria-label={`Proposal queue for ${t.title}`}
                          disabled={!canEdit}
                          value={queueLabel(current.route_role_key)}
                          selectedOptions={[current.route_role_key ?? "__owner__"]}
                          onOptionSelect={(_, d) => update({ route_role_key: d.optionValue === "__owner__" ? null : (d.optionValue ?? null) })}
                          style={{ minWidth: 180 }}
                        >
                          <Option value="__owner__">Accountable owner (default)</Option>
                          {roleOptions.map((r) => (
                            <Option key={r.key} value={r.key}>
                              {r.name}
                            </Option>
                          ))}
                        </Dropdown>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {tab === "triggers" &&
          (agent.triggers.length === 0 ? (
            <Body1>This agent has no automatic triggers.</Body1>
          ) : (
            <ul className={styles.list}>
              {agent.triggers.map((t) => (
                <li key={t.key}>
                  <Switch
                    label={t.description ?? `${t.key.replace(/[._]/g, " ")} (${t.kind})`}
                    checked={draft.triggers_enabled[t.key] ?? t.enabled}
                    disabled={!canEdit}
                    onChange={(_, d) => set({ triggers_enabled: { ...draft.triggers_enabled, [t.key]: d.checked } })}
                  />
                </li>
              ))}
            </ul>
          ))}

        {tab === "routing" && (
          <Field
            label="Proposal expiry (hours)"
            validationState={expiryErr ? "error" : "none"}
            validationMessage={expiryErr ?? undefined}
            hint="Pending proposals expire after this many hours."
            style={{ maxWidth: 280 }}
          >
            <SpinButton
              min={1}
              max={720}
              disabled={!canEdit}
              value={draft.proposal_expiry_hours}
              onChange={(_, d) => {
                const v = d.value ?? (d.displayValue !== undefined ? Number.parseInt(d.displayValue, 10) : NaN);
                set({ proposal_expiry_hours: Number.isFinite(v) ? (v as number) : null });
              }}
            />
          </Field>
        )}

        {tab === "budget" && (
          <div className={styles.grid}>
            <Field
              label="Monthly token budget"
              hint={
                limits.data?.tenant_monthly_token_budget != null
                  ? `Tenant monthly budget: ${limits.data.tenant_monthly_token_budget.toLocaleString("en-US")} tokens`
                  : undefined
              }
              validationState={errors.monthly_token_budget ? "error" : "none"}
              validationMessage={errors.monthly_token_budget}
            >
              <Input
                type="number"
                min={0}
                disabled={!canEdit}
                placeholder="Uses the tenant budget only"
                value={draft.monthly_token_budget === null ? "" : String(draft.monthly_token_budget)}
                onChange={(_, d) => set({ monthly_token_budget: d.value.trim() === "" ? null : Number(d.value) })}
              />
            </Field>
            {LIMIT_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                hint={limits.data?.ceiling[f.key] !== undefined ? `Platform limit: ${limits.data.ceiling[f.key].toLocaleString("en-US")}` : undefined}
                validationState={errors[f.key] ? "error" : "none"}
                validationMessage={errors[f.key]}
              >
                <SpinButton
                  min={1}
                  disabled={!canEdit}
                  value={draft.limits[f.key] ?? null}
                  onChange={(_, d) => {
                    const v = d.value ?? (d.displayValue !== undefined ? Number.parseInt(d.displayValue, 10) : NaN);
                    const next = { ...draft.limits };
                    if (Number.isFinite(v)) next[f.key] = v as number;
                    else delete next[f.key];
                    set({ limits: next });
                  }}
                />
              </Field>
            ))}
          </div>
        )}

        {tab === "channels" && (
          <>
            <Subtitle2 as="h2">Channels</Subtitle2>
            {declared.length === 0 ? (
              <Body1 className={styles.muted}>This agent does not send messages.</Body1>
            ) : (
              <div className={styles.days}>
                {declared
                  .filter((c) => CHANNEL_LABELS[c])
                  .map((c) => (
                    <Checkbox
                      key={c}
                      label={CHANNEL_LABELS[c]}
                      disabled={!canEdit}
                      checked={draft.channels.includes(c)}
                      onChange={(_, d) => set({ channels: d.checked ? [...draft.channels, c] : draft.channels.filter((x) => x !== c) })}
                    />
                  ))}
              </div>
            )}
            <Subtitle2 as="h2">Working hours</Subtitle2>
            <Checkbox
              label="Only act during working hours"
              disabled={!canEdit}
              checked={draft.working_hours !== null}
              onChange={(_, d) =>
                set({
                  working_hours: d.checked
                    ? { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "18:00", time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                    : null,
                })
              }
            />
            {draft.working_hours && (
              <>
                <div className={styles.days} role="group" aria-label="Days">
                  {WEEK_DAYS.map((day) => (
                    <Checkbox
                      key={day}
                      label={DAY_LABELS[day]}
                      disabled={!canEdit}
                      checked={draft.working_hours?.days.includes(day) ?? false}
                      onChange={(_, d) => {
                        const wh = draft.working_hours!;
                        set({ working_hours: { ...wh, days: d.checked ? [...wh.days, day] : wh.days.filter((x) => x !== day) } });
                      }}
                    />
                  ))}
                </div>
                <div className={styles.grid}>
                  <Field label="From">
                    <Input type="time" disabled={!canEdit} value={draft.working_hours.from} onChange={(_, d) => set({ working_hours: { ...draft.working_hours!, from: d.value } })} />
                  </Field>
                  <Field label="To">
                    <Input type="time" disabled={!canEdit} value={draft.working_hours.to} onChange={(_, d) => set({ working_hours: { ...draft.working_hours!, to: d.value } })} />
                  </Field>
                  <Field label="Time zone">
                    <Input disabled={!canEdit} value={draft.working_hours.time_zone} onChange={(_, d) => set({ working_hours: { ...draft.working_hours!, time_zone: d.value } })} />
                  </Field>
                </div>
              </>
            )}
          </>
        )}

        {tab === "readiness" &&
          (checklist.isPending ? (
            <GridSkeleton rows={3} />
          ) : checklist.isError ? (
            <ErrorBar message={errorMessage(checklist.error)} />
          ) : (
            <ChecklistList items={checklist.data.items} />
          ))}

        {tab === "evaluation" && <EvalsTable agentKey={agent.key} />}

        {tab === "history" && (
          <>
            <Subtitle2 as="h2">Agent settings</Subtitle2>
            <RecordTimeline subjectType="agent_config" subjectId={agent.key} />
            <Subtitle2 as="h2">Action policies</Subtitle2>
            <RecordTimeline subjectType="agent_action_policy" subjectId={agent.key} />
          </>
        )}
      </div>

      {canEdit && (
        <div className={styles.footer}>
          <Button disabled={!dirty || save.isPending} onClick={() => setDraft(base)}>
            Discard
          </Button>
          <Button
            appearance="primary"
            disabled={!dirty || save.isPending || Object.keys(errors).length > 0 || !!expiryErr}
            icon={save.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => save.mutate()}
          >
            Save changes
          </Button>
        </div>
      )}

      {enableDialog && (
        <PrerequisitesDialog
          missing={enableDialog}
          busy={setEnabled.isPending}
          onFix={() => {
            setEnableDialog(null);
            setTab("readiness");
          }}
          onClose={() => setEnableDialog(null)}
          onEnable={(reason) => setEnabled.mutate({ enabled: true, reason })}
        />
      )}
      {burnInDialog && <EndBurnInDialog agentKey={agent.key} onClose={() => setBurnInDialog(false)} onDone={() => void refresh()} />}
      <Dialog open={leaveTo !== null} onOpenChange={(_, d) => !d.open && setLeaveTo(null)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogContent>Your changes to this agent are not saved.</DialogContent>
            <DialogActions>
              <Button onClick={() => setLeaveTo(null)}>Keep editing</Button>
              <Button appearance="primary" onClick={() => leaveTo && router.push(leaveTo)}>
                Discard
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function ChecklistList({ items }: { items: ChecklistItem[] }) {
  const styles = useStyles();
  if (items.length === 0) return <Body1>No prerequisites.</Body1>;
  return (
    <ul className={styles.list}>
      {items.map((i) => (
        <li key={i.key} className={styles.item}>
          {STATUS_ICON[i.status] ?? null}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Text weight="semibold">
              {i.label} <Caption1 className={styles.muted}>· {CHECKLIST_STATUS[i.status]?.label ?? i.status}</Caption1>
            </Text>
            {i.detail && <Caption1>{i.detail}</Caption1>}
            {i.fix_link && i.status !== "ready" && <AppLink href={i.fix_link}>Fix</AppLink>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PrerequisitesDialog({
  missing,
  busy,
  onFix,
  onClose,
  onEnable,
}: {
  missing: ChecklistItem[];
  busy: boolean;
  onFix: () => void;
  onClose: () => void;
  onEnable: (reason: string) => void;
}) {
  const [anyway, setAnyway] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const err = touched ? overrideReasonError(anyway, reason) : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Some prerequisites are missing</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <ChecklistList items={missing} />
            <Checkbox label="Enable anyway" checked={anyway} onChange={(_, d) => setAnyway(!!d.checked)} />
            {anyway && (
              <Field label="Reason" required hint="The override is recorded in the audit log." validationState={err ? "error" : "none"} validationMessage={err ?? undefined}>
                <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={500} />
              </Field>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onFix} disabled={busy}>
              Fix first
            </Button>
            <Button
              appearance="primary"
              disabled={!anyway || busy}
              onClick={() => {
                setTouched(true);
                if (!overrideReasonError(anyway, reason)) onEnable(reason.trim());
              }}
            >
              Enable
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function EndBurnInDialog({ agentKey, onClose, onDone }: { agentKey: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const end = useMutation({
    mutationFn: () => agentsApi.endBurnIn(agentKey, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  const err = touched && reason.trim().length < 10 ? "Enter at least 10 characters." : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !end.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>End burn-in early?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>After the burn-in, low-risk actions you set to Auto run without a person&apos;s approval.</Body1>
            <Field label="Reason" required validationState={err ? "error" : "none"} validationMessage={err ?? undefined}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} maxLength={500} />
            </Field>
            {end.error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{agentErrorText(end.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={end.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={end.isPending}
              onClick={() => {
                setTouched(true);
                if (reason.trim().length >= 10) end.mutate();
              }}
            >
              End burn-in
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
