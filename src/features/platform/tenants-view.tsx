"use client";

import {
  Badge,
  Body1,
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  Spinner,
  type TableColumnDefinition,
  Text,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowClockwise20Regular, Checkmark20Filled, Copy20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { slugFromName } from "@/features/auth/schemas";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { CompanyAdminOut, CompanyProvisionOut, PlatformTenantOut, TenantLifecycleOut } from "@/lib/api/types";
import { platformErrorMessage, TENANT_STATUS_COLORS } from "./errors";

const PAGE_SIZE = 50;

export type TenantRow = PlatformTenantOut &
  Partial<Pick<TenantLifecycleOut, "ai_budget" | "ai_usage_percent" | "delete_after">> & {
    plan?: string | null;
    admin_email?: string | null;
  };

export function joinTenants(
  tenants: readonly PlatformTenantOut[],
  overview: readonly TenantLifecycleOut[] | undefined,
  companies: readonly CompanyAdminOut[] | undefined,
): TenantRow[] {
  const byId = new Map((overview ?? []).map((o) => [o.id, o]));
  const infoById = new Map((companies ?? []).map((c) => [c.id, c]));
  return tenants.map((t) => {
    const o = byId.get(t.id);
    const info = infoById.get(t.id);
    return {
      ...t,
      ...(o ? { status: o.status, ai_budget: o.ai_budget, ai_usage_percent: o.ai_usage_percent, delete_after: o.delete_after } : {}),
      plan: info?.plan ?? null,
      admin_email: info?.admin_email ?? null,
    };
  });
}

/** `/platform/tenants`: every company on the platform (incl. self-serve signups), plus cross-app create. */
export function TenantsView() {
  const styles = useAdminStyles();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const tenants = useQuery({
    queryKey: platformKeys.tenantList(page),
    queryFn: ({ signal }) => platformApi.tenants(page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const overview = useQuery({
    queryKey: [...platformKeys.tenants, "overview", page],
    queryFn: ({ signal }) => platformApi.tenantsOverview(page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const companies = useQuery({
    queryKey: platformKeys.companies,
    queryFn: ({ signal }) => platformApi.companies(signal),
    placeholderData: (prev) => prev,
  });
  const rows = tenants.data ? joinTenants(tenants.data.items, overview.data?.items, companies.data) : undefined;

  const columns: TableColumnDefinition<TenantRow>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Company",
      renderCell: (t) => <AppLink href={`/platform/tenants/${t.id}`}>{t.name}</AppLink>,
    }),
    createTableColumn({ columnId: "slug", compare: (a, b) => a.slug.localeCompare(b.slug), renderHeaderCell: () => "Workspace", renderCell: (t) => t.slug }),
    createTableColumn({
      columnId: "status",
      compare: (a, b) => a.status.localeCompare(b.status),
      renderHeaderCell: () => "Status",
      renderCell: (t) => (
        <Badge appearance="tint" color={TENANT_STATUS_COLORS[t.status] ?? "informative"}>
          {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "admin_email",
      compare: (a, b) => (a.admin_email ?? "").localeCompare(b.admin_email ?? ""),
      renderHeaderCell: () => "Admin email",
      renderCell: (t) => (t.admin_email ? <Text>{t.admin_email}</Text> : <Text italic>—</Text>),
    }),
    createTableColumn({
      columnId: "plan",
      compare: (a, b) => (a.plan ?? "").localeCompare(b.plan ?? ""),
      renderHeaderCell: () => "Plan",
      renderCell: (t) =>
        t.plan ? (
          <Badge appearance="ghost" color="brand">
            {t.plan.charAt(0).toUpperCase() + t.plan.slice(1)}
          </Badge>
        ) : (
          <Text italic>—</Text>
        ),
    }),
    createTableColumn({ columnId: "created", compare: (a, b) => a.created_at.localeCompare(b.created_at), renderHeaderCell: () => "Created", renderCell: (t) => formatDateTime(t.created_at) }),
  ];

  return (
    <>
      <PageHeader title="Companies" subtitle="Every organization on the unified platform — operator-created and self-serve signups." />
      <Toolbar aria-label="Company commands" className={styles.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          Create company
        </ToolbarButton>
        <ToolbarButton
          icon={<ArrowClockwise20Regular />}
          onClick={() => {
            void tenants.refetch();
            void overview.refetch();
            void companies.refetch();
          }}
        >
          Refresh
        </ToolbarButton>
      </Toolbar>
      <AdminGrid
        items={rows}
        columns={columns}
        getRowId={(t) => t.id}
        loading={tenants.isPending}
        error={tenants.error}
        emptyText="No companies yet. Create the first one."
        label="Companies"
        sortable
        footer={tenants.data && <PagingBar page={page} pageSize={PAGE_SIZE} total={tenants.data.total} onPageChange={setPage} busy={tenants.isFetching} />}
      />
      {creating && <CreateCompanyDialog onClose={() => setCreating(false)} />}
    </>
  );
}

const useDialogStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  linkBox: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  linkRow: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center" },
  linkInput: { flex: 1 },
  note: { color: tokens.colorNeutralForeground3 },
});

const EMAIL_RE = /^\S+@\S+\.\S+$/; // NOSONAR
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Cross-app "Create company": provisions across every app, then shows the admin invite link to copy. */
function CreateCompanyDialog({ onClose }: { onClose: () => void }) {
  const styles = useDialogStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const lastSuggested = useRef("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CompanyProvisionOut | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-suggest the slug from the company name until the operator edits it themselves.
  useEffect(() => {
    const suggestion = slugFromName(name);
    if (slug === lastSuggested.current) {
      lastSuggested.current = suggestion;
      setSlug(suggestion);
    }
  }, [name, slug]);

  const create = useMutation({
    mutationFn: () =>
      platformApi.createCompany({ company_name: name.trim(), slug: slug.trim(), admin_name: adminName.trim(), admin_email: adminEmail.trim() }),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: platformKeys.tenants });
      await queryClient.invalidateQueries({ queryKey: platformKeys.companies });
    },
    onError: (e) => {
      setFields(fieldErrors(e));
      if (isApiError(e) && (e.code === "slug_taken" || e.code === "invalid_slug")) {
        setFields((f) => ({ ...f, slug: e.code === "slug_taken" ? "This workspace ID is already taken" : errorMessage(e) }));
        setError(null);
      } else {
        setError(platformErrorMessage(e));
      }
    },
  });

  const valid = name.trim().length > 0 && SLUG_RE.test(slug.trim()) && adminName.trim().length > 0 && EMAIL_RE.test(adminEmail.trim());
  const f = (k: string) => ({ validationMessage: fields[k], validationState: fields[k] ? ("error" as const) : ("none" as const) });

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  }

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        {result ? (
          <DialogBody>
            <DialogTitle>Company created</DialogTitle>
            <DialogContent className={styles.content}>
              <Body1>
                <Text weight="semibold">{result.tenant_slug}.talentos.localhost</Text> is provisioned across every app.
              </Body1>
              <div className={styles.linkBox}>
                <Text weight="semibold">Admin invitation link</Text>
                <Body1 className={styles.note}>
                  Open this to set a password for <Text weight="semibold">{result.admin_email}</Text>. In production it is emailed; locally it is shown here.
                </Body1>
                <div className={styles.linkRow}>
                  <Input className={styles.linkInput} readOnly value={result.invite_url} aria-label="Admin invitation link" />
                  <Button appearance="primary" icon={copied ? <Checkmark20Filled /> : <Copy20Regular />} onClick={copyLink}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={onClose}>
                Done
              </Button>
            </DialogActions>
          </DialogBody>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (valid) create.mutate();
            }}
          >
            <DialogBody>
              <DialogTitle>Create company</DialogTitle>
              <DialogContent className={styles.content}>
                <Body1 className={styles.note}>Provisions a workspace across every app (Talent OS, Croar, Feedback IQ). Defaults: Asia/Kolkata · INR · enterprise plan.</Body1>
                <ErrorBar message={error} />
                <Field label="Company name" required {...f("company_name")}>
                  <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={200} autoFocus />
                </Field>
                <Field label="Workspace ID" required hint="Sign-in address: <id>.talentos.localhost. Lowercase letters, digits and hyphens." {...f("slug")}>
                  <Input
                    value={slug}
                    onChange={(_, d) => setSlug(d.value.toLowerCase())}
                    maxLength={40}
                  />
                </Field>
                <Field label="Administrator name" required {...f("admin_name")}>
                  <Input value={adminName} onChange={(_, d) => setAdminName(d.value)} maxLength={200} />
                </Field>
                <Field label="Administrator email" required hint="They receive the invitation to set up the workspace." {...f("admin_email")}>
                  <Input type="email" value={adminEmail} onChange={(_, d) => setAdminEmail(d.value)} maxLength={254} />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose} disabled={create.isPending}>
                  Cancel
                </Button>
                <Button appearance="primary" type="submit" disabled={!valid || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined}>
                  Create company
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        )}
      </DialogSurface>
    </Dialog>
  );
}
