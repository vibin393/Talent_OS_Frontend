"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
  createTableColumn,
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
  MessageBarBody,
  Option,
  SpinButton,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowRepeatAll20Regular, Copy20Regular, DataUsage20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { fieldErrors } from "@/lib/api/errors";
import type { ApiKeyCreated, ApiKeyOut, ApiKeyUsageOut } from "@/lib/api/types";

type UsageRow = ApiKeyUsageOut["recent"][number];
import { apiKeyErrorMessage, apiKeyKeys, apiKeysApi } from "./api";
import {
  canCloseShowOnce,
  delegableScopes,
  groupScopes,
  groupState,
  KEY_STATUS_COLORS,
  maskedKey,
  RATE_LIMIT_DEFAULT,
  RATE_LIMIT_MAX,
  RATE_LIMIT_MIN,
  ROTATE_GRACE_OPTIONS,
} from "./scopes";

const useStyles = makeStyles({
  section: { marginTop: tokens.spacingVerticalXXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  keyBox: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflowWrap: "anywhere",
    userSelect: "all",
  },
  tree: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  children: { display: "flex", flexDirection: "column", paddingInlineStart: tokens.spacingHorizontalXXL },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  scopes: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

/** API keys section of `/admin/security` (`api_key:manage`). */
export function ApiKeysSection() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("api_key:manage");
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<ApiKeyCreated | null>(null);
  const [rotating, setRotating] = useState<ApiKeyOut | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyOut | null>(null);
  const [usageOf, setUsageOf] = useState<ApiKeyOut | null>(null);
  const keys = useQuery({ queryKey: apiKeyKeys.all, queryFn: ({ signal }) => apiKeysApi.list(signal), enabled: canManage });
  if (!canManage) return null;

  const columns: TableColumnDefinition<ApiKeyOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Name",
      renderCell: (k) => (
        <div className={admin.cellStack}>
          <span>{k.name}</span>
          <Caption1 className={styles.mono}>{maskedKey(k.prefix)}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "scopes",
      renderHeaderCell: () => "Scopes",
      renderCell: (k) => (
        <span className={admin.truncate} title={k.scopes.join(", ")}>
          {k.scopes.length <= 2 ? k.scopes.join(", ") : `${k.scopes.slice(0, 2).join(", ")} +${k.scopes.length - 2}`}
        </span>
      ),
    }),
    createTableColumn({ columnId: "limit", compare: (a, b) => a.rate_limit_per_min - b.rate_limit_per_min, renderHeaderCell: () => "Limit", renderCell: (k) => `${k.rate_limit_per_min}/min` }),
    createTableColumn({
      columnId: "used",
      compare: (a, b) => (a.last_used_at ?? "").localeCompare(b.last_used_at ?? ""),
      renderHeaderCell: () => "Last used",
      renderCell: (k) => (k.last_used_at ? formatDateTime(k.last_used_at) : "Never"),
    }),
    createTableColumn({ columnId: "expires", renderHeaderCell: () => "Expires", renderCell: (k) => (k.expires_at ? formatDateTime(k.expires_at) : "Never") }),
    createTableColumn({
      columnId: "status",
      compare: (a, b) => (a.status ?? "").localeCompare(b.status ?? ""),
      renderHeaderCell: () => "Status",
      renderCell: (k) => (
        <Badge appearance="tint" color={KEY_STATUS_COLORS[k.status ?? "active"] ?? "subtle"}>
          {(k.status ?? "active").replace(/^./, (c) => c.toUpperCase())}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (k) => (
        <RowActions
          label={k.name}
          actions={[
            { label: "Usage", icon: <DataUsage20Regular />, onClick: () => setUsageOf(k) },
            ...(k.status === "active" || !k.status
              ? [
                  { label: "Rotate", icon: <ArrowRepeatAll20Regular />, onClick: () => setRotating(k) },
                  { label: "Revoke", icon: <Delete20Regular />, onClick: () => setRevoking(k) },
                ]
              : []),
          ]}
        />
      ),
    }),
  ];

  return (
    <section className={styles.section} id="api-keys" aria-labelledby="api-keys-title">
      <Subtitle2 as="h2" id="api-keys-title">
        API keys
      </Subtitle2>
      <Body1>Scoped keys let integrations call the Talent OS API. A key can only do what its scopes allow, at organization scope.</Body1>
      <Toolbar aria-label="API key commands" className={admin.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          Create API key
        </ToolbarButton>
      </Toolbar>
      <AdminGrid
        items={keys.data}
        columns={columns}
        getRowId={(k) => k.id}
        loading={keys.isPending}
        error={keys.error}
        emptyText="No API keys yet."
        label="API keys"
        sortable
      />
      {creating && (
        <CreateKeyDrawer
          onClose={() => setCreating(false)}
          onCreated={(k) => {
            setCreating(false);
            setShown(k);
          }}
        />
      )}
      <ShowKeyDialog created={shown} onClose={() => setShown(null)} />
      {rotating && (
        <RotateDialog
          apiKey={rotating}
          onClose={() => setRotating(null)}
          onRotated={(k) => {
            setRotating(null);
            setShown(k);
          }}
        />
      )}
      <ConfirmDialog
        open={revoking !== null}
        title={`Revoke "${revoking?.name ?? ""}"?`}
        confirmLabel="Revoke"
        onClose={() => setRevoking(null)}
        onConfirm={() =>
          apiKeysApi
            .revoke(revoking!.id)
            .then(async () => {
              toast.success("API key revoked");
              await queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
            })
            .catch((e) => {
              toast.error(apiKeyErrorMessage(e));
              throw e;
            })
        }
      >
        Integrations using this key stop working immediately. This cannot be undone.
      </ConfirmDialog>
      <UsageDrawer apiKey={usageOf} onClose={() => setUsageOf(null)} />
    </section>
  );
}

function CreateKeyDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKeyCreated) => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const server = useQuery({ queryKey: apiKeyKeys.delegable, queryFn: ({ signal }) => apiKeysApi.delegableScopes(signal) });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(RATE_LIMIT_DEFAULT);
  const [expires, setExpires] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const groups = groupScopes(delegableScopes(permissions, server.data));
  const create = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: name.trim(),
        scopes: [...selected].sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0)),
        rate_limit_per_min: limit,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      }),
    onSuccess: async (k) => {
      await queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
      onCreated(k);
    },
    onError: (e) => {
      setFields(fieldErrors(e));
      setError(apiKeyErrorMessage(e));
    },
  });
  const toggle = (scopes: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of scopes) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  const valid = name.trim().length > 0 && selected.size > 0;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <DetailsDrawer
      open
      size="medium"
      title="Create API key"
      onClose={() => !create.isPending && onClose()}
      footer={
        <>
          <Button
            appearance="primary"
            disabled={!valid || create.isPending}
            icon={create.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={() => {
              setError(null);
              create.mutate();
            }}
          >
            Create
          </Button>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorBar message={error} />
        <Field label="Name" required validationMessage={fields.name} validationState={fields.name ? "error" : "none"}>
          <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={100} placeholder="e.g. Job board sync" />
        </Field>
        <Field
          label="Scopes"
          required
          hint="Only permissions you hold and that may be delegated are listed. Administrative permissions are never available."
          validationMessage={fields.scopes}
          validationState={fields.scopes ? "error" : "none"}
        >
          {server.isPending ? (
            <GridSkeleton rows={3} />
          ) : groups.length === 0 ? (
            <Body1>You hold no permissions that can be given to an API key.</Body1>
          ) : (
            <div className={styles.tree} role="tree" aria-label="Scopes">
              {groups.map((g) => (
                <div key={g.resource} role="treeitem" aria-expanded="true" aria-selected={groupState(g, selected) === true}>
                  <Checkbox
                    label={g.label}
                    checked={groupState(g, selected)}
                    onChange={(_, d) => toggle(g.scopes, d.checked === true)}
                  />
                  <div className={styles.children} role="group">
                    {g.scopes.map((s) => (
                      <Checkbox
                        key={s}
                        label={<span className={styles.mono}>{s}</span>}
                        checked={selected.has(s)}
                        onChange={(_, d) => toggle([s], d.checked === true)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Field>
        <Field label="Rate limit (requests per minute)" hint={`${RATE_LIMIT_MIN}–${RATE_LIMIT_MAX}`} validationMessage={fields.rate_limit_per_min} validationState={fields.rate_limit_per_min ? "error" : "none"}>
          <SpinButton
            value={limit}
            min={RATE_LIMIT_MIN}
            max={RATE_LIMIT_MAX}
            step={60}
            onChange={(_, d) => {
              const v = d.value ?? Number(d.displayValue);
              if (Number.isFinite(v)) setLimit(Math.min(RATE_LIMIT_MAX, Math.max(RATE_LIMIT_MIN, Math.round(v))));
            }}
          />
        </Field>
        <Field label="Expires" hint="Leave empty for a key that does not expire.">
          <Input type="date" min={today} value={expires} onChange={(_, d) => setExpires(d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}

/** Shows a newly created key once; closes only after "I have copied the key" is ticked. */
export function ShowKeyDialog({ created, onClose }: { created: ApiKeyCreated | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const close = () => {
    if (!canCloseShowOnce(acknowledged)) return;
    setAcknowledged(false);
    onClose();
  };
  return (
    <Dialog open={created !== null} onOpenChange={(_, d) => !d.open && close()} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Copy your new API key</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MessageBar intent="warning" layout="multiline">
              <MessageBarBody>
                This is the only time the full key is shown. Store it in your integration&apos;s secret store now; Talent OS
                keeps only a fingerprint and cannot show it again.
              </MessageBarBody>
            </MessageBar>
            <code className={styles.keyBox} aria-label="API key">
              {created?.key}
            </code>
            <div>
              <Button
                icon={<Copy20Regular />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created?.key ?? "");
                    toast.success("API key copied");
                  } catch {
                    toast.error("Could not copy. Select the key and copy it manually.");
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <Checkbox checked={acknowledged} onChange={(_, d) => setAcknowledged(d.checked === true)} label="I have copied the key" />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!canCloseShowOnce(acknowledged)} onClick={close}>
              Done
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RotateDialog({ apiKey, onClose, onRotated }: { apiKey: ApiKeyOut; onClose: () => void; onRotated: (k: ApiKeyCreated) => void }) {
  const queryClient = useQueryClient();
  const [grace, setGrace] = useState<number>(24);
  const [error, setError] = useState<string | null>(null);
  const rotate = useMutation({
    mutationFn: () => apiKeysApi.rotate(apiKey.id, grace),
    onSuccess: async (k) => {
      await queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
      onRotated(k);
    },
    onError: (e) => setError(apiKeyErrorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !rotate.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Rotate &ldquo;{apiKey.name}&rdquo;</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            <Body1>A new key with the same scopes is created. The old key keeps working for the grace period so you can switch over.</Body1>
            <Field label="Old key stops working">
              <Dropdown
                value={ROTATE_GRACE_OPTIONS.find((o) => o.hours === grace)?.label ?? ""}
                selectedOptions={[String(grace)]}
                onOptionSelect={(_, d) => d.optionValue !== undefined && setGrace(Number(d.optionValue))}
              >
                {ROTATE_GRACE_OPTIONS.map((o) => (
                  <Option key={o.hours} value={String(o.hours)}>
                    {o.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={rotate.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={rotate.isPending}
              icon={rotate.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => rotate.mutate()}
            >
              Rotate key
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function UsageDrawer({ apiKey, onClose }: { apiKey: ApiKeyOut | null; onClose: () => void }) {
  const admin = useAdminStyles();
  const usage = useQuery({
    queryKey: apiKeyKeys.usage(apiKey?.id ?? ""),
    queryFn: ({ signal }) => apiKeysApi.usage(apiKey!.id, signal),
    enabled: apiKey !== null,
  });
  return (
    <DetailsDrawer open={apiKey !== null} size="large" title={apiKey ? `Usage · ${apiKey.name}` : ""} onClose={onClose}>
      {usage.isPending ? (
        <GridSkeleton rows={4} />
      ) : usage.isError ? (
        <ErrorBar message={apiKeyErrorMessage(usage.error)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Body1>
            {usage.data.total_last_24h.toLocaleString()} request(s) in the last 24 hours
            {Object.keys(usage.data.by_status).length > 0 &&
              ` · ${Object.entries(usage.data.by_status)
                .map(([s, n]) => `${s}: ${n}`)
                .join(", ")}`}
          </Body1>
          <AdminGrid
            items={usage.data.recent}
            columns={[
              createTableColumn<UsageRow>({ columnId: "at", renderHeaderCell: () => "When", renderCell: (r) => formatDateTime(r.at) }),
              createTableColumn<UsageRow>({ columnId: "req", renderHeaderCell: () => "Request", renderCell: (r) => `${r.method} ${r.route_template}` }),
              createTableColumn<UsageRow>({
                columnId: "status",
                renderHeaderCell: () => "Status",
                renderCell: (r) => (
                  <Badge appearance="tint" color={r.status < 400 ? "success" : r.status === 429 ? "warning" : "danger"}>
                    {r.status}
                  </Badge>
                ),
              }),
              createTableColumn<UsageRow>({ columnId: "ip", renderHeaderCell: () => "IP", renderCell: (r) => r.ip ?? "—" }),
            ]}
            getRowId={(r) => `${r.at}-${r.request_id ?? ""}-${r.route_template}`}
            loading={false}
            error={null}
            emptyText="No requests recorded."
            label="Recent requests"
          />
          <Caption1 className={admin.muted}>Request logs are kept for 90 days.</Caption1>
        </div>
      )}
    </DetailsDrawer>
  );
}
