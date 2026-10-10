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
  SpinButton,
  Spinner,
  type TableColumnDefinition,
  Text,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { fieldErrors } from "@/lib/api/errors";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { PlatformTenantOut, TenantLifecycleOut } from "@/lib/api/types";
import { platformErrorMessage, TENANT_STATUS_COLORS } from "./errors";

const PAGE_SIZE = 50;

export type TenantRow = PlatformTenantOut & Partial<Pick<TenantLifecycleOut, "ai_budget" | "ai_usage_percent" | "delete_after">>;

export function joinTenants(tenants: readonly PlatformTenantOut[], overview: readonly TenantLifecycleOut[] | undefined): TenantRow[] {
  const byId = new Map((overview ?? []).map((o) => [o.id, o]));
  return tenants.map((t) => {
    const o = byId.get(t.id);
    return o ? { ...t, status: o.status, ai_budget: o.ai_budget, ai_usage_percent: o.ai_usage_percent, delete_after: o.delete_after } : t;
  });
}

/** Tenant slug from a name: lowercase letters, digits and single hyphens. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/** `/platform/tenants`: all tenants with lifecycle status and AI usage, plus the Provision wizard. */
export function TenantsView() {
  const styles = useAdminStyles();
  const [page, setPage] = useState(1);
  const [provisioning, setProvisioning] = useState(false);
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
  const rows = tenants.data ? joinTenants(tenants.data.items, overview.data?.items) : undefined;

  const columns: TableColumnDefinition<TenantRow>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Name",
      renderCell: (t) => <AppLink href={`/platform/tenants/${t.id}`}>{t.name}</AppLink>,
    }),
    createTableColumn({ columnId: "slug", compare: (a, b) => a.slug.localeCompare(b.slug), renderHeaderCell: () => "Slug", renderCell: (t) => t.slug }),
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
    createTableColumn({ columnId: "seats", compare: (a, b) => a.seat_limit - b.seat_limit, renderHeaderCell: () => "Seats", renderCell: (t) => t.seat_limit.toLocaleString() }),
    createTableColumn({
      columnId: "ai",
      compare: (a, b) => (a.ai_usage_percent ?? -1) - (b.ai_usage_percent ?? -1),
      renderHeaderCell: () => "AI usage",
      renderCell: (t) =>
        t.ai_usage_percent === null || t.ai_usage_percent === undefined ? (
          <Text>{t.ai_budget === null || t.ai_budget === undefined ? "No limit" : "—"}</Text>
        ) : (
          <Badge appearance="ghost" color={t.ai_usage_percent >= 100 ? "danger" : t.ai_usage_percent >= 80 ? "warning" : "informative"}>
            {Math.round(t.ai_usage_percent)}%
          </Badge>
        ),
    }),
    createTableColumn({ columnId: "created", compare: (a, b) => a.created_at.localeCompare(b.created_at), renderHeaderCell: () => "Created", renderCell: (t) => formatDateTime(t.created_at) }),
  ];

  return (
    <>
      <PageHeader title="Tenants" subtitle="Every organization on this Talent OS installation." />
      <Toolbar aria-label="Tenant commands" className={styles.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setProvisioning(true)}>
          Provision tenant
        </ToolbarButton>
        <ToolbarButton
          icon={<ArrowClockwise20Regular />}
          onClick={() => {
            void tenants.refetch();
            void overview.refetch();
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
        emptyText="No tenants yet. Provision the first one."
        label="Tenants"
        sortable
        footer={tenants.data && <PagingBar page={page} pageSize={PAGE_SIZE} total={tenants.data.total} onPageChange={setPage} busy={tenants.isFetching} />}
      />
      {provisioning && <ProvisionWizard onClose={() => setProvisioning(false)} />}
    </>
  );
}

const STEPS = ["Organization", "Administrator", "Review"] as const;

const useWizardStyles = makeStyles({
  steps: { display: "flex", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalS, flexWrap: "wrap" },
  step: { color: tokens.colorNeutralForeground3 },
  current: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  review: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0 },
  },
});

function ProvisionWizard({ onClose }: { onClose: () => void }) {
  const styles = useWizardStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [locale, setLocale] = useState("en-IN");
  const [adminEmail, setAdminEmail] = useState("");
  const [seats, setSeats] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const effectiveSlug = slugTouched ? slug : slugify(name);
  const create = useMutation({
    mutationFn: () =>
      platformApi.createTenant({
        name: name.trim(),
        slug: effectiveSlug,
        timezone: timezone.trim(),
        currency: currency.trim().toUpperCase(),
        locale: locale.trim(),
        seat_limit: seats,
        admin_email: adminEmail.trim(),
      }),
    onSuccess: async (t) => {
      toast.success(`${t.name} provisioned; an invitation was sent to ${adminEmail.trim()}`);
      await queryClient.invalidateQueries({ queryKey: platformKeys.tenants });
      onClose();
      router.push(`/platform/tenants/${t.id}`);
    },
    onError: (e) => {
      const f = fieldErrors(e);
      setFields(f);
      setError(platformErrorMessage(e));
      if (f.name || f.slug || f.timezone || f.currency || f.locale) setStep(0);
      else if (f.admin_email || f.seat_limit) setStep(1);
    },
  });
  const stepValid = [
    name.trim().length > 0 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(effectiveSlug) && timezone.trim() && currency.trim(),
    /^\S+@\S+\.\S+$/.test(adminEmail.trim()) && seats >= 1,
    true,
  ][step];
  const f = (k: string) => ({ validationMessage: fields[k], validationState: fields[k] ? ("error" as const) : ("none" as const) });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!stepValid) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else create.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>Provision tenant</DialogTitle>
            <DialogContent className={styles.content}>
              <ol className={styles.steps} aria-label="Steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {STEPS.map((s, i) => (
                  <li key={s} className={i === step ? styles.current : styles.step} aria-current={i === step ? "step" : undefined}>
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
              <ErrorBar message={error} />
              {step === 0 && (
                <>
                  <Field label="Organization name" required {...f("name")}>
                    <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={200} autoFocus />
                  </Field>
                  <Field label="Workspace slug" required hint="Used to sign in. Lowercase letters, digits and hyphens." {...f("slug")}>
                    <Input
                      value={effectiveSlug}
                      onChange={(_, d) => {
                        setSlugTouched(true);
                        setSlug(d.value.toLowerCase());
                      }}
                      maxLength={63}
                    />
                  </Field>
                  <Field label="Time zone" required hint="IANA name" {...f("timezone")}>
                    <Input value={timezone} onChange={(_, d) => setTimezone(d.value)} />
                  </Field>
                  <Field label="Currency" required {...f("currency")}>
                    <Input value={currency} onChange={(_, d) => setCurrency(d.value)} maxLength={3} />
                  </Field>
                  <Field label="Locale" {...f("locale")}>
                    <Input value={locale} onChange={(_, d) => setLocale(d.value)} />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <Field label="First tenant admin's email" required hint="They receive an invitation to set up the workspace." {...f("admin_email")}>
                    <Input type="email" value={adminEmail} onChange={(_, d) => setAdminEmail(d.value)} maxLength={254} autoFocus />
                  </Field>
                  <Field label="Seat limit" required {...f("seat_limit")}>
                    <SpinButton
                      value={seats}
                      min={1}
                      max={1_000_000}
                      onChange={(_, d) => {
                        const v = d.value ?? Number(d.displayValue);
                        if (Number.isFinite(v) && v >= 1) setSeats(Math.round(v));
                      }}
                    />
                  </Field>
                </>
              )}
              {step === 2 && (
                <>
                  <Body1>Check the details, then provision the tenant.</Body1>
                  <dl className={styles.review}>
                    <dt>Name</dt>
                    <dd>{name}</dd>
                    <dt>Slug</dt>
                    <dd>{effectiveSlug}</dd>
                    <dt>Region</dt>
                    <dd>
                      {timezone} · {currency.toUpperCase()} · {locale}
                    </dd>
                    <dt>Administrator</dt>
                    <dd>{adminEmail}</dd>
                    <dt>Seats</dt>
                    <dd>{seats.toLocaleString()}</dd>
                  </dl>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={create.isPending}>
                Cancel
              </Button>
              {step > 0 && (
                <Button onClick={() => setStep(step - 1)} disabled={create.isPending}>
                  Back
                </Button>
              )}
              <Button
                appearance="primary"
                type="submit"
                disabled={!stepValid || create.isPending}
                icon={create.isPending ? <Spinner size="tiny" /> : undefined}
              >
                {step < STEPS.length - 1 ? "Next" : "Provision"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
