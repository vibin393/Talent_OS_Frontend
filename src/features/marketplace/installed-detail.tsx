"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  OverlayDrawer,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Textarea,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { HrmsMappingPage } from "@/features/hrms-sync/mapping-page";
import { LedgerMappingPage } from "@/features/ledger-sync/mapping-page";
import { errorMessage } from "@/lib/api/errors";
import { type ConnectorJob, type HealthLog, type Installation, marketplaceApi, marketplaceKeys } from "./api";
import { healthLabel, JOB_STATUS_LABELS, schemaFields, secretCaption, STATUS_LABELS, uninstallErasureCaption } from "./labels";
import { AccessTable, ConfigFields, FlowsTable } from "./listing-page";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px" },
  header: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "center", flexWrap: "wrap" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  tableWrap: { overflowX: "auto" },
});

type Tabs = "overview" | "configuration" | "sync" | "health" | "activity";

/** `/settings/integrations/installed/[id]`: an Installation's overview, configuration, jobs and health. */
export function InstalledDetail({ id }: { id: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: marketplaceKeys.installation(id), queryFn: ({ signal }) => marketplaceApi.installation(id, signal) });
  const [tab, setTab] = useState<Tabs>("overview");
  if (q.isPending) return <Spinner label="Loading" />;
  if (q.error || !q.data)
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  const inst = q.data;
  const st = STATUS_LABELS[inst.status];
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title3 as="h1">{inst.display_name}</Title3>
        <Badge appearance="tint" color={st.color}>
          {st.label}
        </Badge>
      </div>
      {inst.suspended_reason ? (
        <MessageBar intent="warning">
          <MessageBarBody>{inst.suspended_reason}</MessageBarBody>
        </MessageBar>
      ) : null}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as Tabs)}>
        <Tab value="overview">Overview</Tab>
        {inst.kind === "connector" ? <Tab value="configuration">Configuration</Tab> : null}
        {inst.kind === "connector" ? <Tab value="sync">Sync</Tab> : null}
        {inst.kind === "connector" ? <Tab value="health">Health</Tab> : null}
        <Tab value="activity">Activity</Tab>
      </TabList>
      {tab === "overview" ? <Overview inst={inst} /> : null}
      {tab === "configuration" ? <Configuration inst={inst} /> : null}
      {tab === "sync" ? <SyncJobs inst={inst} /> : null}
      {tab === "health" ? <HealthTab inst={inst} /> : null}
      {tab === "activity" ? (
        <Card>
          <div className={styles.section}>
            <Body1>Every change to this integration is in the audit log (entity: installation {inst.id}).</Body1>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

const HRMS_CONNECTORS = ["darwinbox", "keka"];
const LEDGER_CONNECTORS = ["zoho_books", "tally_xml"];

function Overview({ inst }: { inst: Installation }) {
  const styles = useStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canManage = usePermission("integration:manage");
  const canLedger = usePermission("ledger:sync");
  const canHrms = usePermission("hrms:sync");
  const [dialog, setDialog] = useState<"uninstall" | "suspend" | "resume" | "reconsent" | null>(null);
  const [mapping, setMapping] = useState<"hrms" | "ledger" | null>(null);
  const isHrms = inst.connector_key != null && HRMS_CONNECTORS.includes(inst.connector_key);
  const isLedger = inst.connector_key != null && LEDGER_CONNECTORS.includes(inst.connector_key);
  const listing = useQuery({
    queryKey: marketplaceKeys.listing(inst.connector_key ? inst.connector_key.replace(/_/g, "-") : `app-${inst.app_id}`),
    queryFn: ({ signal }) => marketplaceApi.listing((inst.connector_key ?? "").replace(/_/g, "-"), signal),
    enabled: !!inst.connector_key,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
  const test = useMutation({
    mutationFn: () => marketplaceApi.test(inst.id),
    onSuccess: (r) => {
      refresh();
      if (r.ok) toast.success("Connection works.");
      else toast.error(`We couldn't connect: ${r.message ?? "the test failed."}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sync = useMutation({ mutationFn: (key: string) => marketplaceApi.runSync(inst.id, key), onSuccess: () => toast.success("Sync queued."), onError: (e) => toast.error(errorMessage(e)) });
  const manualJobs = (listing.data?.sync_jobs ?? []).filter((j) => j.trigger === "manual" || j.trigger === "schedule");
  return (
    <Card>
      <div className={styles.section}>
        <Subtitle2 as="h2">Access granted</Subtitle2>
        <AccessTable scopes={inst.granted_scopes.map((s) => ({ key: s, reason: inst.sensitive_purposes[s] ?? "", sensitive: s in inst.sensitive_purposes }))} />
        {listing.data ? (
          <div className={styles.tableWrap}>
            <FlowsTable flows={listing.data.data_flows} name={inst.display_name} />
          </div>
        ) : null}
        <Caption1>Granted {formatDateTime(inst.granted_at)}</Caption1>
        {canManage && inst.status !== "uninstalled" ? (
          <div className={styles.row}>
            {inst.kind === "connector" ? (
              <Button onClick={() => test.mutate()} disabled={test.isPending}>
                Test connection
              </Button>
            ) : null}
            {manualJobs.length ? (
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button>Run sync now</Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {manualJobs.map((j) => (
                      <MenuItem key={j.key} onClick={() => sync.mutate(j.key)}>
                        {j.key}
                      </MenuItem>
                    ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            ) : null}
            {isHrms && canHrms ? <Button onClick={() => setMapping("hrms")}>Field mapping</Button> : null}
            {isLedger && canLedger ? <Button onClick={() => setMapping("ledger")}>Ledger mapping</Button> : null}
            {inst.status === "reconsent_required" || inst.pending_manifest_version ? <Button onClick={() => setDialog("reconsent")}>Review new version</Button> : null}
            {inst.status === "suspended" ? <Button onClick={() => setDialog("resume")}>Resume</Button> : <Button onClick={() => setDialog("suspend")}>Suspend</Button>}
            <Button appearance="secondary" onClick={() => setDialog("uninstall")}>
              Uninstall
            </Button>
          </div>
        ) : null}
      </div>
      {dialog === "uninstall" ? (
        <UninstallDialog
          inst={inst}
          erasureSupported={!!listing.data?.erasure_supported}
          onClose={() => setDialog(null)}
          onDone={() => {
            refresh();
            router.push("/settings/integrations?tab=installed");
          }}
        />
      ) : null}
      {dialog === "suspend" || dialog === "resume" ? <ReasonDialog inst={inst} mode={dialog} onClose={() => setDialog(null)} onDone={refresh} /> : null}
      {dialog === "reconsent" ? <ReconsentDialog inst={inst} onClose={() => setDialog(null)} onDone={refresh} /> : null}
      {mapping ? (
        <OverlayDrawer open onOpenChange={(_, d) => !d.open && setMapping(null)} position="end" size="large">
          <DrawerHeader>
            <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={() => setMapping(null)} />}>
              {mapping === "hrms" ? "Field mapping" : "Ledger mapping"}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            {mapping === "hrms" ? (
              <HrmsMappingPage installationId={inst.id} legalEntityIds={inst.legal_entity_ids} />
            ) : (
              <LedgerMappingPage installationId={inst.id} connectorKey={inst.connector_key ?? ""} legalEntityIds={inst.legal_entity_ids} />
            )}
          </DrawerBody>
        </OverlayDrawer>
      ) : null}
    </Card>
  );
}

export function UninstallDialog({ inst, erasureSupported, onClose, onDone }: { inst: Installation; erasureSupported: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [erase, setErase] = useState(false);
  const name = inst.display_name;
  const m = useMutation({ mutationFn: () => marketplaceApi.uninstall(inst.id, reason.trim(), erase), onSuccess: onDone });
  const caption = uninstallErasureCaption(name, erasureSupported);
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Uninstall {name}?</DialogTitle>
          <DialogContent>
            <Body1>
              We&apos;ll revoke its access within a minute, delete its stored credentials and stop its jobs. Sync history and the audit log are kept. Data already sent to {name} stays in {name}; your
              agreement with them governs it.
            </Body1>
            {caption ? <Caption1>{caption}</Caption1> : <Checkbox label={`Ask ${name} to delete the data it received from us`} checked={erase} onChange={(_, d) => setErase(Boolean(d.checked))} />}
            <Field label="Reason" required>
              <Textarea maxLength={500} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" style={{ backgroundColor: tokens.colorPaletteRedBackground3 }} disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
              Uninstall
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ReasonDialog({ inst, mode, onClose, onDone }: { inst: Installation; mode: "suspend" | "resume"; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => (mode === "suspend" ? marketplaceApi.suspend(inst.id, reason.trim()) : marketplaceApi.resume(inst.id, reason.trim())),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {mode === "suspend" ? "Suspend" : "Resume"} {inst.display_name}?
          </DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea maxLength={500} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
              {mode === "suspend" ? "Suspend" : "Resume"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ReconsentDialog({ inst, onClose, onDone }: { inst: Installation; onClose: () => void; onDone: () => void }) {
  const diff = useQuery({ queryKey: marketplaceKeys.diff(inst.id), queryFn: ({ signal }) => marketplaceApi.upgradeDiff(inst.id, signal) });
  const m = useMutation({
    mutationFn: () => marketplaceApi.upgrade(inst.id, diff.data?.manifest_sha256 ?? ""),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  const d = diff.data;
  return (
    <Dialog open onOpenChange={(_, x) => (!x.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Review changes in version {d?.to_version ?? inst.pending_manifest_version ?? ""}</DialogTitle>
          <DialogContent>
            {diff.isPending ? <Spinner /> : null}
            {d ? (
              <>
                <Subtitle2>New access</Subtitle2>
                <Body1>{d.added_scopes.join(", ") || "None"}</Body1>
                <Subtitle2>New data shared</Subtitle2>
                <Body1>{d.added_flows.map((f) => `${f.entity} (${f.purpose})`).join(", ") || "None"}</Body1>
                <Subtitle2>New destinations</Subtitle2>
                <Body1>{d.added_hosts.join(", ") || "None"}</Body1>
              </>
            ) : null}
            {m.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(m.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!d || m.isPending} onClick={() => m.mutate()}>
              Accept and update
            </Button>
            <Button onClick={onClose}>Not now</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Configuration({ inst }: { inst: Installation }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const canManage = usePermission("integration:manage");
  const listing = useQuery({
    queryKey: marketplaceKeys.listing((inst.connector_key ?? "").replace(/_/g, "-")),
    queryFn: ({ signal }) => marketplaceApi.listing((inst.connector_key ?? "").replace(/_/g, "-"), signal),
  });
  const fields = useMemo(() => schemaFields(listing.data?.config_schema), [listing.data?.config_schema]);
  const [config, setConfig] = useState<Record<string, unknown>>(inst.config);
  const [replacing, setReplacing] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const secrets = Object.fromEntries(Object.entries(replacing).filter(([, v]) => v.trim()));
      return marketplaceApi.configure(inst.id, { config, ...(Object.keys(secrets).length ? { secrets } : {}) });
    },
    onSuccess: () => {
      setReplacing({});
      void qc.invalidateQueries({ queryKey: marketplaceKeys.all });
      toast.success("Configuration saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card>
      <div className={styles.section}>
        <ConfigFields fields={fields} values={config} onChange={setConfig} />
        {inst.secrets.map((s) => (
          <Field key={s.name} label={s.name}>
            {s.name in replacing ? (
              <Input type="password" autoComplete="off" value={replacing[s.name]} onChange={(_, d) => setReplacing({ ...replacing, [s.name]: d.value })} />
            ) : (
              <div className={styles.row}>
                <Caption1>{s.has_secret ? secretCaption(s.fingerprint, s.rotated_at) : "Not set"}</Caption1>
                {canManage ? (
                  <Button size="small" onClick={() => setReplacing({ ...replacing, [s.name]: "" })}>
                    Replace
                  </Button>
                ) : null}
              </div>
            )}
          </Field>
        ))}
        {canManage ? (
          <div className={styles.row}>
            <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SyncJobs({ inst }: { inst: Installation }) {
  const qc = useQueryClient();
  const toast = useAppToast();
  const canManage = usePermission("integration:manage");
  const jobs = useQuery({ queryKey: marketplaceKeys.jobs(inst.id), queryFn: ({ signal }) => marketplaceApi.jobs(inst.id, signal) });
  const retry = useMutation({
    mutationFn: (jobId: string) => marketplaceApi.retryJob(inst.id, jobId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: marketplaceKeys.jobs(inst.id) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<ConnectorJob>[] = [
    createTableColumn({ columnId: "job", renderHeaderCell: () => "Job", renderCell: (j) => j.op.replace(/^sync:/, "") }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (j) => JOB_STATUS_LABELS[j.status] ?? j.status }),
    createTableColumn({ columnId: "attempts", renderHeaderCell: () => "Attempts", renderCell: (j) => String(j.attempts) }),
    createTableColumn({ columnId: "error", renderHeaderCell: () => "Last error", renderCell: (j) => j.last_error ?? "—" }),
    createTableColumn({ columnId: "age", renderHeaderCell: () => "Age", renderCell: (j) => formatDateTime(j.created_at) }),
    createTableColumn({
      columnId: "retry",
      renderHeaderCell: () => "",
      renderCell: (j) =>
        canManage && (j.status === "failed" || j.status === "dead") ? (
          <Button size="small" onClick={() => retry.mutate(j.id)}>
            Retry
          </Button>
        ) : null,
    }),
  ];
  return <AdminGrid items={jobs.data} columns={columns} getRowId={(j) => j.id} loading={jobs.isPending} error={jobs.error} emptyText="No jobs yet." label="Sync jobs" />;
}

function HealthTab({ inst }: { inst: Installation }) {
  const health = useQuery({ queryKey: marketplaceKeys.health(inst.id), queryFn: ({ signal }) => marketplaceApi.health(inst.id, signal) });
  const columns: TableColumnDefinition<HealthLog>[] = [
    createTableColumn({ columnId: "at", renderHeaderCell: () => "Checked", renderCell: (h) => formatDateTime(h.checked_at) }),
    createTableColumn({ columnId: "trigger", renderHeaderCell: () => "Trigger", renderCell: (h) => h.trigger }),
    createTableColumn({ columnId: "result", renderHeaderCell: () => "Result", renderCell: (h) => healthLabel(h.result) }),
    createTableColumn({ columnId: "error", renderHeaderCell: () => "Error", renderCell: (h) => h.error_code ?? "—" }),
    createTableColumn({ columnId: "latency", renderHeaderCell: () => "Latency", renderCell: (h) => (h.latency_ms != null ? `${h.latency_ms} ms` : "—") }),
  ];
  return (
    <AdminGrid
      items={health.data}
      columns={columns}
      getRowId={(h) => h.checked_at}
      loading={health.isPending}
      error={health.error}
      emptyText="Not checked yet."
      label="Health checks"
    />
  );
}
