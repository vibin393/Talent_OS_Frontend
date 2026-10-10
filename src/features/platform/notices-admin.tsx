"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  type TableColumnDefinition,
  Textarea,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { humanize } from "@/features/privacy/format";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { PlatformNoticeCreate, PlatformNoticeOut } from "@/lib/api/types";
import { platformErrorMessage, SEVERITIES, SEVERITY_COLORS } from "./errors";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  preview: { padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium },
});

const ALL_TENANTS = "__all__";
type Audience = NonNullable<PlatformNoticeCreate["audience"]>;
type Kind = NonNullable<PlatformNoticeCreate["kind"]>;
type Severity = NonNullable<PlatformNoticeCreate["severity"]>;

/** `/platform/notices`: in-app notices to tenant admins or all users (maintenance, incidents, sub-processors). */
export function NoticesAdmin() {
  const styles = useAdminStyles();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PlatformNoticeOut | null>(null);
  const list = useQuery({ queryKey: platformKeys.notices, queryFn: ({ signal }) => platformApi.notices(signal) });
  const tenants = useQuery({ queryKey: [...platformKeys.tenants, "all"], queryFn: ({ signal }) => platformApi.tenants(1, 100, signal) });
  const tenantName = (id: string | null) => (id ? (tenants.data?.items.find((t) => t.id === id)?.name ?? "One tenant") : "All tenants");
  const columns: TableColumnDefinition<PlatformNoticeOut>[] = [
    createTableColumn({ columnId: "title", compare: (a, b) => a.title.localeCompare(b.title), renderHeaderCell: () => "Title", renderCell: (n) => n.title }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (n) => humanize(n.kind) }),
    createTableColumn({
      columnId: "severity",
      renderHeaderCell: () => "Severity",
      renderCell: (n) => (
        <Badge appearance="tint" color={SEVERITY_COLORS[n.severity] ?? "informative"}>
          {humanize(n.severity)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "to", renderHeaderCell: () => "Audience", renderCell: (n) => `${tenantName(n.tenant_id)} · ${n.audience === "admins" ? "admins" : "all users"}` }),
    createTableColumn({ columnId: "created", compare: (a, b) => a.created_at.localeCompare(b.created_at), renderHeaderCell: () => "Posted", renderCell: (n) => formatDateTime(n.created_at) }),
    createTableColumn({ columnId: "expires", renderHeaderCell: () => "Expires", renderCell: (n) => (n.expires_at ? formatDateTime(n.expires_at) : "—") }),
    createTableColumn({
      columnId: "view",
      renderHeaderCell: () => "",
      renderCell: (n) => (
        <Button size="small" appearance="subtle" onClick={() => setViewing(n)}>
          View
        </Button>
      ),
    }),
  ];
  return (
    <>
      <PageHeader title="Notices" subtitle="Banners shown inside tenant workspaces until acknowledged." />
      <Toolbar aria-label="Notice commands" className={styles.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          Post notice
        </ToolbarButton>
      </Toolbar>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(n) => n.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No notices posted."
        label="Notices"
        sortable
      />
      <DetailsDrawer open={viewing !== null} title={viewing?.title ?? ""} onClose={() => setViewing(null)}>
        {viewing && <MarkdownView source={viewing.body_md} />}
      </DetailsDrawer>
      {creating && <CreateNoticeDrawer tenants={(tenants.data?.items ?? []).map((t) => ({ id: t.id, name: t.name }))} onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateNoticeDrawer({ tenants, onClose }: { tenants: { id: string; name: string }[]; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState<string>(ALL_TENANTS);
  const [audience, setAudience] = useState<Audience>("admins");
  const [kind, setKind] = useState<Kind>("maintenance");
  const [severity, setSeverity] = useState<Severity>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expires, setExpires] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      platformApi.createNotice({
        tenant_id: tenantId === ALL_TENANTS ? null : tenantId,
        audience,
        kind,
        severity,
        title: title.trim(),
        body_md: body,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      }),
    onSuccess: async () => {
      toast.success("Notice posted");
      await queryClient.invalidateQueries({ queryKey: platformKeys.notices });
      onClose();
    },
    onError: (e) => setError(platformErrorMessage(e)),
  });
  return (
    <DetailsDrawer
      open
      size="large"
      title="Post notice"
      onClose={() => !create.isPending && onClose()}
      footer={
        <>
          <Button appearance="primary" disabled={!title.trim() || !body.trim() || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => create.mutate()}>
            Post
          </Button>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorBar message={error} />
        <Field label="Tenant">
          <Dropdown
            value={tenantId === ALL_TENANTS ? "All tenants" : (tenants.find((t) => t.id === tenantId)?.name ?? "")}
            selectedOptions={[tenantId]}
            onOptionSelect={(_, d) => d.optionValue && setTenantId(d.optionValue)}
          >
            <Option value={ALL_TENANTS}>All tenants</Option>
            {tenants.map((t) => (
              <Option key={t.id} value={t.id}>
                {t.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Audience">
          <Dropdown value={audience === "admins" ? "Tenant admins" : "All users"} selectedOptions={[audience]} onOptionSelect={(_, d) => d.optionValue && setAudience(d.optionValue as Audience)}>
            <Option value="admins">Tenant admins</Option>
            <Option value="all_users">All users</Option>
          </Dropdown>
        </Field>
        <Field label="Kind">
          <Dropdown value={humanize(kind)} selectedOptions={[kind]} onOptionSelect={(_, d) => d.optionValue && setKind(d.optionValue as Kind)}>
            {(["maintenance", "incident", "sub_processor"] as const).map((k) => (
              <Option key={k} value={k}>
                {humanize(k)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Severity">
          <Dropdown value={humanize(severity)} selectedOptions={[severity]} onOptionSelect={(_, d) => d.optionValue && setSeverity(d.optionValue as Severity)}>
            {SEVERITIES.map((s) => (
              <Option key={s} value={s}>
                {humanize(s)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Title" required>
          <Input value={title} onChange={(_, d) => setTitle(d.value)} maxLength={200} />
        </Field>
        <Field label="Message (Markdown)" required>
          <Textarea value={body} onChange={(_, d) => setBody(d.value)} rows={8} resize="vertical" maxLength={20000} />
        </Field>
        {body.trim() && (
          <div>
            <Caption1>Preview</Caption1>
            <div className={styles.preview}>
              <MarkdownView source={body} />
            </div>
          </div>
        )}
        <Field label="Expires" hint="Optional: the banner disappears after this date.">
          <Input type="date" value={expires} onChange={(_, d) => setExpires(d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
