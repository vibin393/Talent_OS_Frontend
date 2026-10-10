"use client";

import {
  Badge,
  Button,
  Caption1,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Textarea,
  tokens,
  Toolbar,
  ToolbarButton,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type AppCreateIn, type AppOut, appsApi, appsKeys, type ScopeInfo } from "./api";
import { type ClientType, redirectUriError, scopeReasonError, SENSITIVE_HINT, statusLabel } from "./rules";
import { SecretOnceDialog } from "./secret-once-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1100px" },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  scope: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, paddingLeft: tokens.spacingHorizontalS },
});

/** Admin → Apps (Epic 67, spec B4): private apps, show-once secrets and rotation. */
export function PrivateAppsPage() {
  const styles = useStyles();
  const canDevelop = usePermission("app:develop");
  const canView = usePermission("integration:view");
  const qc = useQueryClient();
  const toast = useAppToast();
  const [registering, setRegistering] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const list = useQuery({ queryKey: appsKeys.list, queryFn: ({ signal }) => appsApi.list(signal), enabled: canDevelop || canView });
  const rotate = useMutation({
    mutationFn: (id: string) => appsApi.rotate(id),
    onSuccess: (out) => setSecret(out.client_secret),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canDevelop && !canView)
    return (
      <>
        <PageHeader title="Private apps" />
        <NoAccess what="private apps" />
      </>
    );
  const rows = list.data ?? [];
  return (
    <div className={styles.root}>
      <PageHeader title="Private apps" subtitle="Apps your organisation builds for its own integrations. They are visible only in your organisation." />
      {canDevelop ? (
        <Toolbar>
          <ToolbarButton icon={<Add20Regular />} onClick={() => setRegistering(true)}>
            New app
          </ToolbarButton>
        </Toolbar>
      ) : null}
      {list.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(list.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {rows.length === 0 && !list.isLoading ? (
        <Caption1>No private apps yet. Register one to get a client ID for the Public API.</Caption1>
      ) : (
        <Table aria-label="Private apps">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Client ID</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Access</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a: AppOut) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell className={styles.mono}>{a.client_id}</TableCell>
                <TableCell>{a.client_type === "confidential" ? "Server-side" : "Desktop, mobile or CLI"}</TableCell>
                <TableCell>{a.resources.map((r) => (r === "mcp" ? "MCP" : "API")).join(", ")}</TableCell>
                <TableCell>
                  <Badge appearance="tint">{statusLabel(a.status)}</Badge>
                </TableCell>
                <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {canDevelop && a.client_type === "confidential" && a.status !== "retired" ? (
                    <Button size="small" onClick={() => rotate.mutate(a.id)}>
                      Rotate secret
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {registering ? (
        <RegisterAppDialog
          onClose={() => setRegistering(false)}
          onCreated={(s) => {
            setRegistering(false);
            void qc.invalidateQueries({ queryKey: appsKeys.list });
            setSecret(s);
          }}
        />
      ) : null}
      <SecretOnceDialog secret={secret} onDone={() => setSecret(null)} />
    </div>
  );
}

function RegisterAppDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string | null) => void }) {
  const styles = useStyles();
  const [step, setStep] = useState<"details" | "access" | "review">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientType, setClientType] = useState<ClientType>("confidential");
  const [delegated, setDelegated] = useState(true);
  const [serverToServer, setServerToServer] = useState(true);
  const [mcp, setMcp] = useState(false);
  const [uris, setUris] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const scopes = useQuery({ queryKey: appsKeys.scopes, queryFn: ({ signal }) => appsApi.scopes(signal) });
  const uriList = uris.split("\n").map((u) => u.trim()).filter(Boolean);
  const uriErrors = uriList.map((u) => redirectUriError(u, clientType)).filter(Boolean);
  const chosen = Object.keys(reasons);
  const reasonErrors = chosen.filter((k) => scopeReasonError(reasons[k]));
  const create = useMutation({
    mutationFn: (body: AppCreateIn) => appsApi.create(body),
    onSuccess: (out) => onCreated(out.client_secret),
  });
  const grants = [...(delegated ? ["authorization_code"] : []), ...(serverToServer && clientType === "confidential" ? ["client_credentials"] : [])];
  const valid = name.trim().length >= 3 && grants.length > 0 && uriErrors.length === 0 && chosen.length > 0 && reasonErrors.length === 0 && (!delegated || uriList.length > 0);
  const available = (scopes.data ?? []).filter((s: ScopeInfo) => s.resources.includes("api") || (mcp && s.resources.includes("mcp")));
  return (
    <Dialog open onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New app</DialogTitle>
          <DialogContent className={styles.form}>
            <TabList selectedValue={step} onTabSelect={(_, d) => setStep(d.value as typeof step)}>
              <Tab value="details">Details</Tab>
              <Tab value="access">Access</Tab>
              <Tab value="review">Review</Tab>
            </TabList>
            {step === "details" ? (
              <>
                <Field label="App name" required>
                  <Input value={name} onChange={(_, d) => setName(d.value)} />
                </Field>
                <Field label="Description">
                  <Textarea value={description} onChange={(_, d) => setDescription(d.value)} />
                </Field>
                <Field label="App type">
                  <RadioGroup value={clientType} onChange={(_, d) => setClientType(d.value as ClientType)}>
                    <Radio value="confidential" label="Server-side (keeps a secret)" />
                    <Radio value="public" label="Desktop, mobile or command line (can't keep a secret)" />
                  </RadioGroup>
                </Field>
              </>
            ) : null}
            {step === "access" ? (
              <>
                <Field label="How the app signs in">
                  <Checkbox label="Acts for a signed-in user (authorization code)" checked={delegated} onChange={(_, d) => setDelegated(Boolean(d.checked))} />
                  <Checkbox
                    label="Server-to-server (client credentials)"
                    disabled={clientType === "public"}
                    checked={serverToServer && clientType === "confidential"}
                    onChange={(_, d) => setServerToServer(Boolean(d.checked))}
                  />
                  {clientType === "public" ? <Caption1>Only server-side apps can use client credentials</Caption1> : null}
                </Field>
                <Field label="Where the app connects">
                  <Checkbox label="Public API" checked disabled />
                  <Checkbox label="AI assistant tools (MCP)" checked={mcp} disabled={!delegated} onChange={(_, d) => setMcp(Boolean(d.checked))} />
                </Field>
                <Field
                  label="Redirect URIs"
                  hint="Use https, or http://127.0.0.1 or http://localhost for desktop and command-line apps. URIs must match exactly."
                  validationMessage={uriErrors[0] ?? undefined}
                >
                  <Textarea value={uris} onChange={(_, d) => setUris(d.value)} placeholder="One URI per line" />
                </Field>
                {available.map((s: ScopeInfo) => (
                  <div key={s.key} className={styles.scope}>
                    <Checkbox
                      label={`${s.label}${s.sensitive ? " (Sensitive)" : ""}`}
                      checked={s.key in reasons}
                      onChange={(_, d) =>
                        setReasons((r) => {
                          const next = { ...r };
                          if (d.checked) next[s.key] = "";
                          else delete next[s.key];
                          return next;
                        })
                      }
                    />
                    {s.sensitive ? <Caption1>{SENSITIVE_HINT}</Caption1> : null}
                    {s.key in reasons ? (
                      <Field label="Why does the app need this?" required validationMessage={scopeReasonError(reasons[s.key]) ?? undefined}>
                        <Input value={reasons[s.key]} onChange={(_, d) => setReasons((r) => ({ ...r, [s.key]: d.value }))} />
                      </Field>
                    ) : null}
                  </div>
                ))}
              </>
            ) : null}
            {step === "review" ? (
              <>
                <Caption1>
                  {name || "Unnamed app"} · {chosen.length} permission(s) · {uriList.length} redirect URI(s)
                </Caption1>
                <MessageBar intent="info">
                  <MessageBarBody>An Integration Administrator must install the app before it can get tokens.</MessageBarBody>
                </MessageBar>
              </>
            ) : null}
            {create.error ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(create.error)}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!valid || create.isPending}
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  description: description || undefined,
                  client_type: clientType,
                  grant_types: grants,
                  redirect_uris: uriList,
                  resources: mcp ? ["api", "mcp"] : ["api"],
                  requested_scopes: chosen,
                  scope_reasons: Object.fromEntries(chosen.map((k) => [k, reasons[k].trim()])),
                })
              }
            >
              Register app
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
