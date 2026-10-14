"use client";

import {
  Badge,
  Body1,
  Button,
  Checkbox,
  Field,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
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
  Title3,
} from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import {
  LISTING_STATUS_LABELS,
  type MyListing,
  type NetworkAnalytics,
  networkAdminApi,
  type NetworkSettings,
} from "./api";

type TabValue = "settings" | "listings" | "analytics";

function StatusBadge({ settings }: { settings: NetworkSettings }) {
  if (settings.member_status === "suspended") {
    return <Badge color="danger">Suspended — {settings.suspended_reason ?? "contact support"}</Badge>;
  }
  if (settings.verification_status === "verified") return <Badge color="success">Verified</Badge>;
  return <Badge color="warning">Verification pending</Badge>;
}

export function JobNetworkAdmin() {
  const [settings, setSettings] = useState<NetworkSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("settings");

  const load = useCallback(async () => {
    try {
      setSettings(await networkAdminApi.settings());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load Job network settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{error}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!settings) return <Spinner label="Loading…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title3 as="h1" block>Job network</Title3>
        <Body1 block>List your open jobs on Talent OS Jobs. Applications still come to your careers site.</Body1>
      </div>

      {settings.sandbox ? (
        <MessageBar intent="info">
          <MessageBarBody>Sandbox tenant — you see a private preview only.</MessageBarBody>
        </MessageBar>
      ) : null}

      {!settings.joined ? (
        <JoinCard settings={settings} onJoined={setSettings} />
      ) : (
        <>
          <StatusBadge settings={settings} />
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabValue)}>
            <Tab value="settings">Settings</Tab>
            <Tab value="listings">Listings</Tab>
            <Tab value="analytics">Analytics</Tab>
          </TabList>
          {tab === "settings" ? <JoinedSettings settings={settings} onChange={setSettings} /> : null}
          {tab === "listings" ? <ListingsTab /> : null}
          {tab === "analytics" ? <AnalyticsTab /> : null}
        </>
      )}
    </div>
  );
}

function JoinCard({ settings, onJoined }: { settings: NetworkSettings; onJoined: (s: NetworkSettings) => void }) {
  const [accepted, setAccepted] = useState(false);
  const [listMode, setListMode] = useState("choose");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setErr(null);
    try {
      onJoined(await networkAdminApi.join({ terms_version: settings.terms_version_current, list_mode: listMode, show_logo: true }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--colorNeutralStroke2)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <Subtitle2 as="h2">Join Talent OS Jobs</Subtitle2>
      <ul>
        <li>Active legal entity</li>
        <li>GSTIN on file</li>
        <li>Career site turned on</li>
      </ul>
      <Checkbox
        checked={accepted}
        onChange={(_, d) => setAccepted(!!d.checked)}
        label={`I accept the Talent OS Jobs listing terms (${settings.terms_version_current})`}
      />
      <RadioGroup value={listMode} onChange={(_, d) => setListMode(d.value)}>
        <Radio value="all" label="List all eligible jobs" />
        <Radio value="choose" label="Choose jobs one by one" />
      </RadioGroup>
      {err ? (
        <MessageBar intent="error">
          <MessageBarBody>{err}</MessageBarBody>
        </MessageBar>
      ) : null}
      <div>
        <Button appearance="primary" disabled={!accepted || busy || settings.sandbox} onClick={join}>
          Join network
        </Button>
      </div>
    </div>
  );
}

function JoinedSettings({ settings, onChange }: { settings: NetworkSettings; onChange: (s: NetworkSettings) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function patch(body: { list_mode?: string; show_logo?: boolean }) {
    setBusy(true);
    try {
      onChange(await networkAdminApi.update(body));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      onChange(await networkAdminApi.leave());
      setConfirmLeave(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Field label="Listing mode">
        <RadioGroup value={settings.list_mode} disabled={busy} onChange={(_, d) => void patch({ list_mode: d.value })}>
          <Radio value="all" label="List all eligible jobs" />
          <Radio value="choose" label="Choose jobs one by one" />
        </RadioGroup>
      </Field>
      <Switch checked={settings.show_logo} disabled={busy} label="Show our logo" onChange={(_, d) => void patch({ show_logo: !!d.checked })} />
      <Field label="Never list jobs for these clients">
        <Body1>{settings.exclude_client_ids.length === 0 ? "None" : `${settings.exclude_client_ids.length} client(s) excluded`}</Body1>
      </Field>
      {confirmLeave ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            Leaving removes all your jobs from Talent OS Jobs within 15 minutes.
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <Button appearance="primary" disabled={busy} onClick={leave}>
                Leave network
              </Button>
              <Button disabled={busy} onClick={() => setConfirmLeave(false)}>
                Cancel
              </Button>
            </div>
          </MessageBarBody>
        </MessageBar>
      ) : (
        <div>
          <Button disabled={busy} onClick={() => setConfirmLeave(true)}>
            Leave network
          </Button>
        </div>
      )}
    </div>
  );
}

function ListingsTab() {
  const [rows, setRows] = useState<MyListing[] | null>(null);
  useEffect(() => {
    void networkAdminApi.listings().then((p) => setRows(p.items)).catch(() => setRows([]));
  }, []);
  if (!rows) return <Spinner label="Loading listings…" />;
  return (
    <Table aria-label="Listings">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Issues</TableHeaderCell>
          <TableHeaderCell>Views</TableHeaderCell>
          <TableHeaderCell>Apply clicks</TableHeaderCell>
          <TableHeaderCell>Applications</TableHeaderCell>
          <TableHeaderCell>Listed on</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.listing_id}>
            <TableCell>{r.title}</TableCell>
            <TableCell>{LISTING_STATUS_LABELS[r.status] ?? r.status}</TableCell>
            <TableCell>{r.hold_reasons.join(", ") || "—"}</TableCell>
            <TableCell>{r.views}</TableCell>
            <TableCell>{r.apply_clicks}</TableCell>
            <TableCell>{r.applications}</TableCell>
            <TableCell>{r.listed_at ? new Date(r.listed_at).toLocaleDateString() : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState<NetworkAnalytics | null>(null);
  useEffect(() => {
    void networkAdminApi.analytics().then(setData).catch(() => setData({ rows: [], totals: null }));
  }, []);
  if (!data) return <Spinner label="Loading analytics…" />;
  const t = data.totals;
  const tiles: Array<[string, string | number]> = [
    ["Impressions", t?.impressions ?? 0],
    ["Views", t?.views ?? 0],
    ["Apply clicks", t?.apply_clicks ?? 0],
    ["Applications", t?.applications ?? 0],
    ["Conversion", t ? `${Math.round(t.conversion * 100)}%` : "0%"],
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {tiles.map(([label, value]) => (
        <div key={label} style={{ border: "1px solid var(--colorNeutralStroke2)", borderRadius: 8, padding: 16, minWidth: 120 }}>
          <Body1>{label}</Body1>
          <Title3>{value}</Title3>
        </div>
      ))}
    </div>
  );
}
