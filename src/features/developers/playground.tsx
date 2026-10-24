"use client";

import {
  Badge,
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle1,
  Tab,
  TabList,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import bundle from "@/app/developers/_generated/docs-bundle.json";
import { errorMessage } from "@/lib/api/errors";
import { type AppOut, type SandboxOut, devApi } from "./api";
import { pkcePair } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "end" },
  mono: { fontFamily: "Consolas, monospace", wordBreak: "break-all" },
  pre: { fontFamily: "Consolas, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "320px", overflow: "auto", margin: 0 },
});

type Resource = "api" | "mcp";
type McpTool = { name: string; title: string; description: string; execution_class: string; input_schema: { properties?: Record<string, { type?: string; title?: string }>; required?: string[] } };

const BUNDLE = bundle as unknown as { openapi: { paths: Record<string, Record<string, unknown>> }; mcp: { tools: McpTool[]; protocol_versions: string[] } };
const GET_ENDPOINTS: string[] = Object.entries(BUNDLE.openapi.paths)
  .filter(([, methods]) => "get" in methods)
  .map(([path]) => path.replace(/^\/api/, ""))
  .sort();
const MCP_TOOLS: McpTool[] = BUNDLE.mcp.tools;
const MCP_PROTOCOL = BUNDLE.mcp.protocol_versions[0] ?? "2025-06-18";

/** The developer playground (Epic 74 §B6): get a token (server-to-server or acting for a user), try the public API,
 * try MCP, and jump to the sandbox webhooks. Tokens live in memory only; the PKCE verifier never touches storage. */
export function Playground({ apps, sandboxes, canWrite }: { apps: AppOut[]; sandboxes: SandboxOut[]; canWrite: boolean }) {
  const s = useStyles();
  const [tab, setTab] = useState<"token" | "api" | "mcp" | "webhooks">("token");
  const [app, setApp] = useState("");
  const [sandbox, setSandbox] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tokenResource, setTokenResource] = useState<Resource>("api");
  const [error, setError] = useState<string | null>(null);
  const readySandboxes = sandboxes.filter((x) => x.status === "ready");
  const appObj = apps.find((a) => a.id === app);
  const sandboxObj = readySandboxes.find((x) => x.id === sandbox);

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  return (
    <div className={s.root}>
      <div className={s.row}>
        <Field label="App">
          <Dropdown selectedOptions={app ? [app] : []} value={appObj?.name ?? ""} onOptionSelect={(_, d) => setApp(d.optionValue ?? "")}>
            {apps.map((a) => (
              <Option key={a.id} value={a.id}>
                {a.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Sandbox">
          <Dropdown selectedOptions={sandbox ? [sandbox] : []} value={sandboxObj?.name ?? ""} onOptionSelect={(_, d) => setSandbox(d.optionValue ?? "")}>
            {readySandboxes.map((x) => (
              <Option key={x.id} value={x.id}>
                {x.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        {token ? (
          <Badge appearance="tint" color="success">
            Token ready ({tokenResource === "api" ? "Public API" : "MCP"})
          </Badge>
        ) : null}
      </div>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)}>
        <Tab value="token">Get a token</Tab>
        <Tab value="api">Try the API</Tab>
        <Tab value="mcp">Try MCP</Tab>
        <Tab value="webhooks">Webhooks</Tab>
      </TabList>

      {tab === "token" ? (
        <GetTokenTab
          app={appObj}
          sandbox={sandboxObj}
          canWrite={canWrite}
          onToken={(t, r) => {
            setToken(t);
            setTokenResource(r);
          }}
          token={token}
          guard={guard}
        />
      ) : null}
      {tab === "api" ? <TryApiTab token={token} tokenResource={tokenResource} guard={guard} /> : null}
      {tab === "mcp" ? <TryMcpTab token={token} tokenResource={tokenResource} guard={guard} /> : null}
      {tab === "webhooks" ? <WebhooksTab sandbox={sandboxObj} /> : null}
    </div>
  );
}

function GetTokenTab({
  app,
  sandbox,
  canWrite,
  onToken,
  token,
  guard,
}: {
  app: AppOut | undefined;
  sandbox: SandboxOut | undefined;
  canWrite: boolean;
  onToken: (t: string, r: Resource) => void;
  token: string | null;
  guard: (fn: () => Promise<void>) => Promise<void>;
}) {
  const s = useStyles();
  const [sub, setSub] = useState<"s2s" | "user">("s2s");
  const [secret, setSecret] = useState("");
  const [resource, setResource] = useState<Resource>("api");
  const [show, setShow] = useState(false);
  const verifierRef = useRef<string>("");
  const stateRef = useRef<string>("");
  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/developers/playground/callback` : "/developers/playground/callback";

  // "Acting for a user": the callback tab posts the code back; this tab holds the PKCE verifier in memory and exchanges.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; code?: string; state?: string };
      if (data?.source !== "tos-playground-callback" || !data.code) return;
      if (data.state !== stateRef.current) return;
      void guard(async () => {
        if (!app || !sandbox) return;
        const out = await devApi.playgroundExchange({
          app_id: app.id,
          sandbox_id: sandbox.id,
          code: data.code!,
          code_verifier: verifierRef.current,
          redirect_uri: redirectUri,
          ...(secret ? { client_secret: secret } : {}),
        });
        onToken(out.access_token, resource);
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [app, sandbox, secret, resource, redirectUri, onToken, guard]);

  const startUserFlow = async () => {
    if (!app) return;
    const { verifier, challenge } = await pkcePair();
    verifierRef.current = verifier;
    stateRef.current = crypto.randomUUID();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: app.client_id,
      redirect_uri: redirectUri,
      resource,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: stateRef.current,
    });
    window.open(`/oauth/authorize?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <section className={s.root} aria-label="Get a token">
      <TabList selectedValue={sub} onTabSelect={(_, d) => setSub(d.value as typeof sub)}>
        <Tab value="s2s">Server-to-server</Tab>
        <Tab value="user">Acting for a user</Tab>
      </TabList>
      {sub === "s2s" ? (
        <>
          <Field label="Client secret" hint="Used once to get a token. Never stored.">
            <Input type="password" value={secret} onChange={(_, d) => setSecret(d.value)} />
          </Field>
          <div>
            <Button
              appearance="primary"
              disabled={!canWrite || !app || !sandbox || !secret}
              onClick={() =>
                void guard(async () => {
                  const out = await devApi.playgroundToken(app!.id, sandbox!.id, secret);
                  setSecret("");
                  onToken(out.access_token, "api");
                })
              }
            >
              Get token
            </Button>
          </div>
        </>
      ) : (
        <>
          <RadioGroup value={resource} onChange={(_, d) => setResource(d.value as Resource)} aria-label="Connect to" layout="horizontal">
            <Radio value="api" label="Public API" />
            <Radio value="mcp" label="MCP" />
          </RadioGroup>
          <Field label="Redirect URI" hint="Add this redirect URI to your app first.">
            <div className={s.row}>
              <Input readOnly className={s.mono} value={redirectUri} style={{ minWidth: 320 }} />
              <Button onClick={() => void navigator.clipboard?.writeText(redirectUri)}>Copy</Button>
            </div>
          </Field>
          {app && app.client_type === "confidential" ? (
            <Field label="Client secret (confidential apps)" hint="Used once to exchange the code. Never stored.">
              <Input type="password" value={secret} onChange={(_, d) => setSecret(d.value)} />
            </Field>
          ) : null}
          <div>
            <Button appearance="primary" disabled={!canWrite || !app || !sandbox} onClick={() => void guard(startUserFlow)}>
              Start sign-in
            </Button>
          </div>
        </>
      )}
      {token ? (
        <MessageBar intent="success">
          <MessageBarBody>
            Token ready. <span className={s.mono}>{show ? token : `${token.slice(0, 6)}…`}</span>{" "}
            <Button size="small" onClick={() => setShow((v) => !v)}>
              {show ? "Hide" : "Show"}
            </Button>{" "}
            <Button size="small" onClick={() => void navigator.clipboard?.writeText(token)}>
              Copy
            </Button>
          </MessageBarBody>
        </MessageBar>
      ) : null}
    </section>
  );
}

function TryApiTab({ token, tokenResource, guard }: { token: string | null; tokenResource: Resource; guard: (fn: () => Promise<void>) => Promise<void> }) {
  const s = useStyles();
  const [endpoint, setEndpoint] = useState(GET_ENDPOINTS[0] ?? "");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ status: number; headers: Record<string, string>; body: string } | null>(null);
  const pathParams = useMemo(() => [...endpoint.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]), [endpoint]);
  const [params, setParams] = useState<Record<string, string>>({});

  const send = () =>
    void guard(async () => {
      let path = endpoint;
      for (const p of pathParams) path = path.replace(`{${p}}`, encodeURIComponent(params[p] ?? ""));
      const url = `/api${path}${query ? `?${query}` : ""}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" }, cache: "no-store" });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k.startsWith("ratelimit") || k.startsWith("x-talentos") || k === "content-type") headers[k] = v;
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResult({ status: res.status, headers, body });
    });

  return (
    <section className={s.root} aria-label="Try the API">
      {!token ? <Caption1>Get a token first (any resource works, but use a Public API token).</Caption1> : tokenResource !== "api" ? <Caption1>The current token is an MCP token; get a Public API token for best results.</Caption1> : null}
      <Field label="Endpoint">
        <Dropdown selectedOptions={[endpoint]} value={endpoint} onOptionSelect={(_, d) => d.optionValue && setEndpoint(d.optionValue)}>
          {GET_ENDPOINTS.map((e) => (
            <Option key={e} value={e}>
              {e}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {pathParams.map((p) => (
        <Field key={p} label={p}>
          <Input value={params[p] ?? ""} onChange={(_, d) => setParams((prev) => ({ ...prev, [p]: d.value }))} />
        </Field>
      ))}
      <Field label="Query string" hint="e.g. limit=10&cursor=…">
        <Input value={query} onChange={(_, d) => setQuery(d.value)} />
      </Field>
      <div>
        <Button appearance="primary" disabled={!token} onClick={send}>
          Send
        </Button>
      </div>
      {result ? (
        <>
          <Subtitle1 as="h3">Status {result.status}</Subtitle1>
          <Caption1>Headers</Caption1>
          <pre className={s.pre}>{Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`).join("\n") || "—"}</pre>
          <Caption1>Body</Caption1>
          <pre className={s.pre}>{result.body}</pre>
        </>
      ) : null}
    </section>
  );
}

function TryMcpTab({ token, tokenResource, guard }: { token: string | null; tokenResource: Resource; guard: (fn: () => Promise<void>) => Promise<void> }) {
  const s = useStyles();
  const [tool, setTool] = useState<McpTool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const idRef = useRef(0);

  const rpc = (method: string, params?: unknown) =>
    guard(async () => {
      idRef.current += 1;
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": MCP_PROTOCOL,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: idRef.current, method, params: params ?? {} }),
        cache: "no-store",
      });
      const text = await res.text();
      setResult(text);
    });

  return (
    <section className={s.root} aria-label="Try MCP">
      {!token ? <Caption1>Get an MCP token first.</Caption1> : tokenResource !== "mcp" ? <Caption1>The current token is a Public API token; get an MCP token (resource “MCP”).</Caption1> : null}
      <div className={s.row}>
        <Button appearance="primary" disabled={!token} onClick={() => void rpc("initialize", { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: "Talent OS playground", version: "1" } })}>
          Initialize
        </Button>
        <Button disabled={!token} onClick={() => void rpc("tools/list")}>
          List tools
        </Button>
      </div>
      <Field label="Tool">
        <Dropdown selectedOptions={tool ? [tool.name] : []} value={tool?.title ?? ""} onOptionSelect={(_, d) => setTool(MCP_TOOLS.find((t) => t.name === d.optionValue) ?? null)}>
          {MCP_TOOLS.map((t) => (
            <Option key={t.name} value={t.name} text={t.title}>
              {t.title} ({t.execution_class})
            </Option>
          ))}
        </Dropdown>
      </Field>
      {tool
        ? Object.entries(tool.input_schema.properties ?? {}).map(([name, spec]) => (
            <Field key={name} label={`${spec.title ?? name}${(tool.input_schema.required ?? []).includes(name) ? " *" : ""}`}>
              <Input value={args[name] ?? ""} onChange={(_, d) => setArgs((prev) => ({ ...prev, [name]: d.value }))} />
            </Field>
          ))
        : null}
      {tool ? (
        <div>
          <Button
            appearance="primary"
            disabled={!token}
            onClick={() => {
              const cleaned = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== ""));
              void rpc("tools/call", { name: tool.name, arguments: cleaned });
            }}
          >
            Call tool
          </Button>
        </div>
      ) : null}
      {result ? (
        <>
          <Caption1>Result</Caption1>
          <Textarea readOnly value={result} rows={12} />
        </>
      ) : null}
    </section>
  );
}

function WebhooksTab({ sandbox }: { sandbox: SandboxOut | undefined }) {
  const s = useStyles();
  return (
    <section className={s.root} aria-label="Webhooks">
      <Caption1>Webhooks and the Echo endpoint live inside your sandbox. Open the sandbox to manage subscriptions and send a test event.</Caption1>
      <div className={s.row}>
        <Button
          disabled={!sandbox}
          onClick={() =>
            void devApi.openSandbox(sandbox!.id).then((out) => window.open(out.url.replace(/\/dashboard$/, "/settings/integrations/webhooks"), "_blank", "noopener"))
          }
        >
          Open webhooks in your sandbox
        </Button>
        <Button
          disabled={!sandbox}
          onClick={() => void devApi.openSandbox(sandbox!.id).then((out) => window.open(out.url.replace(/\/dashboard$/, "/settings/integrations/webhooks/echo"), "_blank", "noopener"))}
        >
          Open the echo endpoint
        </Button>
      </div>
    </section>
  );
}
