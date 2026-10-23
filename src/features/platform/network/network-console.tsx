"use client";

import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Textarea,
  Title3,
} from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import {
  networkConsoleApi,
  type PlatformListing,
  type PlatformMember,
  type PlatformNetworkAnalytics,
  type PlatformReport,
} from "./api";

type TabValue = "verification" | "held" | "reports" | "members" | "analytics";

type PendingAction = { title: string; run: (reason: string) => Promise<unknown> };

function ReasonDialog({ action, onDone }: { action: PendingAction | null; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    setReason("");
    setErr(null);
  }, [action]);
  if (!action) return null;
  return (
    <Dialog open modalType="modal" onOpenChange={() => onDone()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{action.title}</DialogTitle>
          <DialogContent>
            <Field label="Reason (shown to the agency)" validationMessage={err ?? undefined} validationState={err ? "error" : "none"}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} rows={3} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onDone}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy}
              onClick={async () => {
                if (reason.trim().length < 10) {
                  setErr("A reason of at least 10 characters is required");
                  return;
                }
                setBusy(true);
                try {
                  await action.run(reason.trim());
                  onDone();
                } catch {
                  setErr("Action failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function NetworkConsole() {
  const [tab, setTab] = useState<TabValue>("verification");
  const [action, setAction] = useState<PendingAction | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Title3 as="h1">Job network</Title3>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabValue)}>
        <Tab value="verification">Verification queue</Tab>
        <Tab value="held">Held listings</Tab>
        <Tab value="reports">Reports</Tab>
        <Tab value="members">Members</Tab>
        <Tab value="analytics">Analytics</Tab>
      </TabList>
      {tab === "verification" ? <VerificationQueue key={version} onAction={setAction} /> : null}
      {tab === "held" ? <HeldListings key={version} onAction={setAction} /> : null}
      {tab === "reports" ? <Reports key={version} onAction={setAction} /> : null}
      {tab === "members" ? <Members key={version} onAction={setAction} /> : null}
      {tab === "analytics" ? <Analytics /> : null}
      <ReasonDialog
        action={action}
        onDone={() => {
          setAction(null);
          refresh();
        }}
      />
    </div>
  );
}

type ActionSetter = (a: PendingAction) => void;

function VerificationQueue({ onAction }: { onAction: ActionSetter }) {
  const [rows, setRows] = useState<PlatformMember[] | null>(null);
  useEffect(() => {
    void networkConsoleApi.verificationQueue().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Table aria-label="Verification queue">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Agency</TableHeaderCell>
          <TableHeaderCell>Legal entity</TableHeaderCell>
          <TableHeaderCell>GSTIN</TableHeaderCell>
          <TableHeaderCell>Requested</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell>{m.display_name}</TableCell>
            <TableCell>On file</TableCell>
            <TableCell>On file</TableCell>
            <TableCell>{m.requested_at ? new Date(m.requested_at).toLocaleDateString() : "—"}</TableCell>
            <TableCell>
              <Button size="small" onClick={() => onAction({ title: "Verify", run: (r) => networkConsoleApi.verifyMember(m.id, r) })}>
                Verify
              </Button>{" "}
              <Button size="small" onClick={() => onAction({ title: "Reject", run: (r) => networkConsoleApi.rejectMember(m.id, r) })}>
                Reject
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HeldListings({ onAction }: { onAction: ActionSetter }) {
  const [rows, setRows] = useState<PlatformListing[] | null>(null);
  useEffect(() => {
    void networkConsoleApi.heldListings().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Table aria-label="Held listings">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell>Agency</TableHeaderCell>
          <TableHeaderCell>Issues</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((l) => (
          <TableRow key={l.id}>
            <TableCell>{l.title}</TableCell>
            <TableCell>{l.agency}</TableCell>
            <TableCell>{l.hold_reasons.join(", ") || "—"}</TableCell>
            <TableCell>
              <Button size="small" onClick={() => onAction({ title: "Release hold", run: (r) => networkConsoleApi.releaseHold(l.id, r) })}>
                Release hold
              </Button>{" "}
              <Button size="small" onClick={() => onAction({ title: "Remove", run: (r) => networkConsoleApi.removeListing(l.id, r) })}>
                Remove
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Reports({ onAction }: { onAction: ActionSetter }) {
  const [rows, setRows] = useState<PlatformReport[] | null>(null);
  useEffect(() => {
    void networkConsoleApi.reports().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Table aria-label="Reports">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell>Reason</TableHeaderCell>
          <TableHeaderCell>Details</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.listing_title}</TableCell>
            <TableCell>{r.reason}</TableCell>
            <TableCell>{r.details ?? "—"}</TableCell>
            <TableCell>
              <Button size="small" onClick={() => onAction({ title: "Uphold", run: (x) => networkConsoleApi.upholdReport(r.id, x) })}>
                Uphold
              </Button>{" "}
              <Button size="small" onClick={() => onAction({ title: "Dismiss", run: (x) => networkConsoleApi.dismissReport(r.id, x) })}>
                Dismiss
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Members({ onAction }: { onAction: ActionSetter }) {
  const [rows, setRows] = useState<PlatformMember[] | null>(null);
  useEffect(() => {
    void networkConsoleApi.members().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Table aria-label="Members">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Agency</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Violations</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell>{m.display_name}</TableCell>
            <TableCell>{m.status}</TableCell>
            <TableCell>{m.violation_count}</TableCell>
            <TableCell>
              <Button size="small" onClick={() => onAction({ title: "Suspend", run: (r) => networkConsoleApi.suspendMember(m.id, r) })}>
                Suspend
              </Button>{" "}
              <Button size="small" onClick={() => onAction({ title: "Reinstate", run: (r) => networkConsoleApi.reinstateMember(m.id, r) })}>
                Reinstate
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Analytics() {
  const [data, setData] = useState<PlatformNetworkAnalytics | null>(null);
  useEffect(() => {
    void networkConsoleApi.analytics().then(setData).catch(() => setData({ by_status: {}, by_category: {}, by_country: {} }));
  }, []);
  if (!data) return <Spinner label="Loading…" />;
  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {(["by_status", "by_category", "by_country"] as const).map((k) => (
        <div key={k}>
          <Body1>{k.replace("by_", "By ")}</Body1>
          <ul>
            {Object.entries(data[k]).map(([label, count]) => (
              <li key={label}>
                {label}: {count}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
