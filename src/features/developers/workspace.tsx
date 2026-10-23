"use client";

import {
  Badge,
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle1,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title2,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { type AppOut, type MeOut, type RunOut, type SandboxOut, devApi, selectOrg } from "./api";
import { AppDetailDrawer } from "./app-detail";
import { Playground } from "./playground";
import { SubmissionsGrid } from "./submissions-grid";
import { CHECK_LABELS, SANDBOX_STATUS, canDo, canFinish, checkState, timeLeft } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "end" },
  secret: { fontFamily: "Consolas, monospace", wordBreak: "break-all" },
});

type TabKey = "sandboxes" | "apps" | "submissions" | "playground" | "conformance";

/** Partner workspace (Epic 74): org switcher, sandboxes, apps, playground token, conformance runs. */
export function Workspace() {
  const s = useStyles();
  const [me, setMe] = useState<MeOut | null>(null);
  const [org, setOrg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("sandboxes");
  const [sandboxes, setSandboxes] = useState<SandboxOut[]>([]);
  const [apps, setApps] = useState<AppOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [sbName, setSbName] = useState("");
  const [sbSize, setSbSize] = useState<"small" | "medium">("small");
  const [appName, setAppName] = useState("");
  const [shownSecret, setShownSecret] = useState<string | null>(null);
  const [pgApp, setPgApp] = useState<string>("");
  const [pgSandbox, setPgSandbox] = useState<string>("");
  const [run, setRun] = useState<RunOut | null>(null);
  const [manageApp, setManageApp] = useState<AppOut | null>(null);

  const role = me?.orgs.find((o) => o.id === org)?.role ?? null;
  const canWrite = canDo(role, "developer");

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!org) return;
    selectOrg(org);
    const [sb, ap] = await Promise.all([devApi.sandboxes(org), devApi.apps(org)]);
    setSandboxes(sb);
    setApps(ap);
  }, [org]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    void guard(async () => {
      const m = await devApi.me();
      setMe(m);
      if (m.orgs.length) setOrg(m.orgs[0].id);
    });
  }, [guard]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    void guard(refresh);
    const busy = sandboxes.some((x) => x.status.endsWith("ing"));
    if (!busy) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, refresh]);

  if (error && !me) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>
          {error} <a href="/developers/sign-in">Sign in</a>
        </MessageBarBody>
      </MessageBar>
    );
  }
  if (!me) return <Caption1>Loading…</Caption1>;

  if (!me.orgs.length) {
    return (
      <form
        className={s.root}
        onSubmit={(e) => {
          e.preventDefault();
          void guard(async () => {
            await devApi.createOrg(orgName, orgSlug);
            const m = await devApi.me();
            setMe(m);
            setOrg(m.orgs[0]?.id ?? null);
          });
        }}
      >
        <Title2 as="h1">Create your organisation</Title2>
        {error ? (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        ) : null}
        <Field label="Organisation name" required>
          <Input value={orgName} onChange={(_, d) => setOrgName(d.value)} />
        </Field>
        <Field label="URL name" required hint="Lowercase letters, digits and hyphens">
          <Input value={orgSlug} onChange={(_, d) => setOrgSlug(d.value)} />
        </Field>
        <Button appearance="primary" type="submit">
          Create organisation
        </Button>
      </form>
    );
  }

  const atLimit = sandboxes.length >= 3;
  return (
    <div className={s.root}>
      <div className={s.row}>
        <Title2 as="h1">Workspace</Title2>
        <Field label="Organisation">
          <Dropdown
            value={me.orgs.find((o) => o.id === org)?.name ?? ""}
            selectedOptions={org ? [org] : []}
            onOptionSelect={(_, d) => setOrg(d.optionValue ?? null)}
          >
            {me.orgs.map((o) => (
              <Option key={o.id} value={o.id}>
                {o.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Badge appearance="tint">{role}</Badge>
      </div>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      {notice ? (
        <MessageBar intent="info">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      ) : null}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)}>
        <Tab value="sandboxes">Sandboxes</Tab>
        <Tab value="apps">Apps</Tab>
        <Tab value="submissions">Submissions</Tab>
        <Tab value="playground">Playground</Tab>
        <Tab value="conformance">Conformance</Tab>
      </TabList>

      {tab === "sandboxes" ? (
        <section className={s.root} aria-label="Sandboxes">
          <MessageBar intent="warning">
            <MessageBarBody>Sandboxes must contain only fictitious data. Never import real people&apos;s details.</MessageBarBody>
          </MessageBar>
          <div className={s.row}>
            <Field label="Name">
              <Input value={sbName} onChange={(_, d) => setSbName(d.value)} />
            </Field>
            <RadioGroup value={sbSize} onChange={(_, d) => setSbSize(d.value as "small" | "medium")} aria-label="Data size">
              <Radio value="small" label="Small — about 50 candidates, 10 demands" />
              <Radio value="medium" label="Medium — about 500 candidates, 60 demands" />
            </RadioGroup>
            <Tooltip content="Your organisation can have up to 3 sandboxes" relationship="description">
              <Button
                appearance="primary"
                disabled={!canWrite || atLimit || !sbName}
                onClick={() =>
                  void guard(async () => {
                    setNotice("Setting up your sandbox… this usually takes under 2 minutes.");
                    await devApi.createSandbox(org!, sbName, sbSize);
                    await refresh();
                  })
                }
              >
                New sandbox
              </Button>
            </Tooltip>
          </div>
          <Table aria-label="Sandboxes">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Size</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sandboxes.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{x.size === "small" ? "Small" : "Medium"}</TableCell>
                  <TableCell>{SANDBOX_STATUS[x.status] ?? x.status}</TableCell>
                  <TableCell>{new Date(x.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      disabled={x.status !== "ready"}
                      onClick={() =>
                        void guard(async () => {
                          const out = await devApi.openSandbox(x.id);
                          window.open(out.url, "_blank", "noopener");
                        })
                      }
                    >
                      Open sandbox
                    </Button>{" "}
                    <Button
                      size="small"
                      disabled={!canWrite || x.status !== "ready"}
                      onClick={() =>
                        void guard(async () => {
                          if (!window.confirm(`Reset ${x.name}? All data is replaced with fresh sample data. Tokens stop working.`)) return;
                          await devApi.resetSandbox(x.id, true);
                          await refresh();
                        })
                      }
                    >
                      Reset
                    </Button>{" "}
                    <Button
                      size="small"
                      disabled={!canWrite}
                      onClick={() =>
                        void guard(async () => {
                          if (!window.confirm(`Delete ${x.name}? This can't be undone.`)) return;
                          await devApi.deleteSandbox(x.id);
                          await refresh();
                        })
                      }
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {tab === "apps" ? (
        <section className={s.root} aria-label="Apps">
          <div className={s.row}>
            <Field label="App name">
              <Input value={appName} onChange={(_, d) => setAppName(d.value)} />
            </Field>
            <Button
              appearance="primary"
              disabled={!canWrite || appName.length < 3}
              onClick={() =>
                void guard(async () => {
                  const out = await devApi.createApp(org!, {
                    name: appName,
                    client_type: "confidential",
                    grant_types: ["client_credentials"],
                    requested_scopes: ["candidates:read"],
                    scope_reasons: { "candidates:read": "Reads candidates to sync them into our product." },
                  });
                  setShownSecret(out.client_secret);
                  await refresh();
                })
              }
            >
              New app
            </Button>
          </div>
          {shownSecret ? (
            <MessageBar intent="warning">
              <MessageBarBody>
                Copy the client secret now — it is shown only once: <span className={s.secret}>{shownSecret}</span>
              </MessageBarBody>
            </MessageBar>
          ) : null}
          <Table aria-label="Apps">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Client ID</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className={s.secret}>{a.client_id}</TableCell>
                  <TableCell>{a.status === "development" ? "In development" : a.status}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      disabled={!canWrite}
                      onClick={() =>
                        void guard(async () => setShownSecret((await devApi.rotateSecret(a.id)).client_secret))
                      }
                    >
                      Rotate secret
                    </Button>{" "}
                    <Button
                      size="small"
                      disabled={!canWrite || !sandboxes.some((x) => x.status === "ready")}
                      onClick={() =>
                        void guard(async () => {
                          const sb = sandboxes.find((x) => x.status === "ready")!;
                          await devApi.installInSandbox(sb.id, a.id, ["candidates:read"]);
                          setNotice(`Installed ${a.name} in ${sb.name} as your sandbox user.`);
                        })
                      }
                    >
                      Install in sandbox
                    </Button>{" "}
                    <Button size="small" onClick={() => setManageApp(a)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {manageApp ? <AppDetailDrawer app={manageApp} onClose={() => setManageApp(null)} /> : null}
        </section>
      ) : null}

      {tab === "submissions" && org ? (
        <section className={s.root} aria-label="Submissions">
          <SubmissionsGrid org={org} />
        </section>
      ) : null}

      {tab === "playground" ? (
        <section className={s.root} aria-label="Playground">
          <Playground apps={apps} sandboxes={sandboxes} canWrite={canWrite} />
        </section>
      ) : null}

      {tab === "conformance" ? (
        <section className={s.root} aria-label="Conformance">
          <div className={s.row}>
            <Field label="App">
              <Dropdown selectedOptions={pgApp ? [pgApp] : []} value={apps.find((a) => a.id === pgApp)?.name ?? ""} onOptionSelect={(_, d) => setPgApp(d.optionValue ?? "")}>
                {apps.map((a) => (
                  <Option key={a.id} value={a.id}>
                    {a.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Sandbox">
              <Dropdown selectedOptions={pgSandbox ? [pgSandbox] : []} value={sandboxes.find((x) => x.id === pgSandbox)?.name ?? ""} onOptionSelect={(_, d) => setPgSandbox(d.optionValue ?? "")}>
                {sandboxes
                  .filter((x) => x.status === "ready")
                  .map((x) => (
                    <Option key={x.id} value={x.id}>
                      {x.name}
                    </Option>
                  ))}
              </Dropdown>
            </Field>
          </div>
          <MessageBar intent="info">
            <MessageBarBody>We&apos;ll simulate one temporary error and one rate limit to check your retry handling.</MessageBarBody>
          </MessageBar>
          <div className={s.row}>
            <Button appearance="primary" disabled={!canWrite || !pgApp || !pgSandbox} onClick={() => void guard(async () => setRun(await devApi.startRun(pgApp, pgSandbox)))}>
              Start a conformance run
            </Button>
            {run ? (
              <>
                <Button onClick={() => void guard(async () => setRun(await devApi.run(run.id)))}>Refresh</Button>
                <Button
                  disabled={!canFinish(run.created_at) || !["waiting", "running"].includes(run.status)}
                  onClick={() => void guard(async () => setRun(await devApi.finishRun(run.id)))}
                >
                  Finish run
                </Button>
                <Caption1>Time left {timeLeft(run.window_ends_at)}</Caption1>
              </>
            ) : null}
          </div>
          {run ? (
            <>
              <Subtitle1 as="h2">During the next 30 minutes, your app must:</Subtitle1>
              <ul>
                {Object.entries(CHECK_LABELS).map(([key, label]) => {
                  const c = run.checks.find((x) => x.key === key);
                  const state = checkState(c?.passed);
                  return (
                    <li key={key}>
                      <Badge appearance="tint" color={state === "passed" ? "success" : state === "failed" ? "danger" : "informative"}>
                        {state}
                      </Badge>{" "}
                      {label}
                      {c?.detail ? ` — ${c.detail}` : ""}
                    </li>
                  );
                })}
              </ul>
              {run.status === "passed" ? (
                <MessageBar intent="success">
                  <MessageBarBody>Passed — you can attach this report to a submission.</MessageBarBody>
                </MessageBar>
              ) : run.status === "failed" ? (
                <MessageBar intent="error">
                  <MessageBarBody>Failed — fix the checks marked below and run again.</MessageBarBody>
                </MessageBar>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
