"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
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
  MessageBarTitle,
  SpinButton,
  Spinner,
  Subtitle2,
  Switch,
  Textarea,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowUndo20Regular,
  DoorArrowRight20Regular,
  Pause20Regular,
  Play20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { ReasonDialog } from "@/features/privacy/dialogs";
import { humanize } from "@/features/privacy/format";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { PlatformTenantOut, TenantLifecycleOut } from "@/lib/api/types";
import { daysUntil, platformErrorMessage, TENANT_STATUS_COLORS } from "./errors";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1000px" },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  dl: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-end", flexWrap: "wrap" },
});

type LifecycleDialog = null | "suspend" | "reactivate" | "offboard" | "cancel-offboard";

/** `/platform/tenants/[id]`: overview, lifecycle actions, offboarding export, AI budget and support request. */
export function TenantDetail({ id }: { id: string }) {
  const tenant = useQuery({ queryKey: platformKeys.tenant(id), queryFn: ({ signal }) => platformApi.tenant(id, signal) });
  const overview = useQuery({
    queryKey: [...platformKeys.tenant(id), "overview"],
    queryFn: ({ signal }) => platformApi.tenantOverview(id, signal),
    refetchInterval: (q) => (q.state.data?.exports?.some((e) => e.status === "queued" || e.status === "running") ? 5000 : false),
  });
  if (tenant.isPending || overview.isPending) return <GridSkeleton rows={8} />;
  if (tenant.isError) return <ErrorBar title="Could not load the tenant." message={platformErrorMessage(tenant.error)} />;
  if (overview.isError) return <ErrorBar title="Could not load the tenant." message={platformErrorMessage(overview.error)} />;
  return <TenantDetailView tenant={tenant.data} life={overview.data} />;
}

function TenantDetailView({ tenant, life }: { tenant: PlatformTenantOut; life: TenantLifecycleOut }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<LifecycleDialog>(null);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [contact, setContact] = useState("");
  const status = life.status;
  const remaining = daysUntil(life.delete_after);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: platformKeys.tenants });
  };
  const lifecycle = async (action: Exclude<LifecycleDialog, null | "offboard">, reason: string) => {
    await platformApi.lifecycle(tenant.id, action, reason);
    toast.success(
      action === "suspend" ? `${tenant.name} suspended` : action === "reactivate" ? `${tenant.name} reactivated` : "Offboarding cancelled",
    );
    await refresh();
  };

  return (
    <div className={styles.root}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => router.push("/platform/tenants")}>
          Tenants
        </Button>
      </div>
      <PageHeader
        title={tenant.name}
        subtitle={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge appearance="tint" color={TENANT_STATUS_COLORS[status] ?? "informative"}>
              {humanize(status)}
            </Badge>
            <span>{tenant.slug}</span>
          </span>
        }
      />
      <Toolbar aria-label="Tenant lifecycle">
        {status === "active" && (
          <ToolbarButton icon={<Pause20Regular />} onClick={() => setDialog("suspend")}>
            Suspend
          </ToolbarButton>
        )}
        {status === "suspended" && (
          <ToolbarButton icon={<Play20Regular />} onClick={() => setDialog("reactivate")}>
            Reactivate
          </ToolbarButton>
        )}
        {(status === "active" || status === "suspended") && (
          <ToolbarButton icon={<DoorArrowRight20Regular />} onClick={() => setDialog("offboard")}>
            Offboard
          </ToolbarButton>
        )}
        {status === "offboarding" && (remaining ?? 0) > 0 && (
          <ToolbarButton icon={<ArrowUndo20Regular />} onClick={() => setDialog("cancel-offboard")}>
            Cancel offboarding
          </ToolbarButton>
        )}
      </Toolbar>

      {status === "suspended" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Suspended</MessageBarTitle>
            Sign-ins, API keys, career applications and secure links are blocked; data is kept.{life.status_reason ? ` Reason: ${life.status_reason}` : ""}
          </MessageBarBody>
        </MessageBar>
      )}
      {status === "offboarding" && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>
              Offboarding{remaining !== null ? ` — data is deleted in ${remaining} day${remaining === 1 ? "" : "s"}` : ""}
            </MessageBarTitle>
            Deletion after {formatDateTime(life.delete_after)}, once the export is ready. Tenant admins can sign in read-only
            until then. Contact: {life.offboard_contact_email ?? "—"}.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.grid}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Overview</Subtitle2>} />
          <dl className={styles.dl}>
            <dt>Slug</dt>
            <dd>{tenant.slug}</dd>
            <dt>Region</dt>
            <dd>
              {tenant.timezone} · {tenant.currency} · {tenant.locale}
            </dd>
            <dt>Seats</dt>
            <dd>{tenant.seat_limit.toLocaleString()}</dd>
            <dt>MFA required</dt>
            <dd>{tenant.mfa_required ? "Yes" : "No"}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(tenant.created_at)}</dd>
            {life.suspended_at && (
              <>
                <dt>Suspended</dt>
                <dd>{formatDateTime(life.suspended_at)}</dd>
              </>
            )}
            {life.offboard_requested_at && (
              <>
                <dt>Offboarding since</dt>
                <dd>{formatDateTime(life.offboard_requested_at)}</dd>
              </>
            )}
          </dl>
          {(life.exports ?? []).length > 0 && (
            <>
              <Subtitle2 as="h3">Exports</Subtitle2>
              {(life.exports ?? []).map((e) => (
                <Body1 key={e.id}>
                  {humanize(e.kind)} export ·{" "}
                  <Badge appearance="tint" color={e.status === "ready" ? "success" : e.status === "failed" ? "danger" : "informative"}>
                    {humanize(e.status)}
                  </Badge>
                  {e.size_bytes ? ` · ${(e.size_bytes / 1_048_576).toFixed(1)} MB` : ""}
                  {e.expires_at ? ` · link expires ${formatDateTime(e.expires_at)}` : ""}
                </Body1>
              ))}
            </>
          )}
        </Card>
        <AdminInviteCard tenantId={tenant.id} disabled={status === "deleted"} />
        <AiBudgetCard tenantId={tenant.id} life={life} />
        <SupportRequestCard tenantId={tenant.id} disabled={status === "deleted"} />
      </div>

      <ReasonDialog
        open={dialog === "suspend" || dialog === "reactivate" || dialog === "cancel-offboard"}
        title={dialog === "suspend" ? `Suspend ${tenant.name}?` : dialog === "reactivate" ? `Reactivate ${tenant.name}?` : "Cancel offboarding?"}
        description={
          dialog === "suspend"
            ? "Everyone is signed out; sign-ins, API keys, career applications and secure links are blocked until reactivation. No data is deleted."
            : dialog === "reactivate"
              ? "Users can sign in again and API keys work again."
              : "The tenant returns to active and the scheduled deletion is cancelled."
        }
        minLength={10}
        confirmLabel={dialog === "suspend" ? "Suspend" : dialog === "reactivate" ? "Reactivate" : "Cancel offboarding"}
        errorMessage={platformErrorMessage}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => lifecycle(dialog as "suspend" | "reactivate" | "cancel-offboard", reason)}
      />
      <ReasonDialog
        open={dialog === "offboard"}
        title={`Offboard ${tenant.name}?`}
        description={`A full export is prepared and emailed to the contact and the tenant admins. After a 30-day grace period every row and file of this tenant is permanently deleted and a deletion certificate is emailed.`}
        minLength={10}
        confirmLabel="Start offboarding"
        errorMessage={platformErrorMessage}
        canConfirm={/* NOSONAR */ confirmSlug.trim() === tenant.slug && /^\S+@\S+\.\S+$/.test(contact.trim())}
        onClose={() => {
          setDialog(null);
          setConfirmSlug("");
          setContact("");
        }}
        onConfirm={async (reason) => {
          await platformApi.offboard(tenant.id, { reason, contact_email: contact.trim(), confirm_slug: confirmSlug.trim() });
          toast.success(`${tenant.name} is offboarding`);
          setConfirmSlug("");
          setContact("");
          await refresh();
        }}
        extra={
          <>
            <Field label="Export contact email" required hint="Receives the export link (30 days, 5 downloads) and the deletion certificate.">
              <Input type="email" value={contact} onChange={(_, d) => setContact(d.value)} />
            </Field>
            <Field label={`Type the tenant slug "${tenant.slug}" to confirm`} required>
              <Input value={confirmSlug} onChange={(_, d) => setConfirmSlug(d.value)} autoComplete="off" spellCheck={false} />
            </Field>
          </>
        }
      />
    </div>
  );
}

function AdminInviteCard({ tenantId, disabled }: { tenantId: string; disabled: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const resend = useMutation({
    mutationFn: () => platformApi.resendAdminInvite(tenantId),
    onSuccess: () => toast.success("Admin invitation re-sent with a fresh link."),
    onError: (e) => toast.error(platformErrorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: () => platformApi.revokeAdminInvite(tenantId),
    onSuccess: () => {
      setConfirmRevoke(false);
      toast.success("Admin invitation revoked.");
    },
    onError: (e) => toast.error(platformErrorMessage(e)),
  });
  const busy = resend.isPending || revoke.isPending;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Admin invitation</Subtitle2>}
        description={<Caption1>Re-send a fresh link to the first tenant admin, or revoke a pending invitation.</Caption1>}
      />
      <div className={styles.row}>
        <Button appearance="primary" disabled={disabled || busy} icon={resend.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => resend.mutate()}>
          Resend invite
        </Button>
        <Button disabled={disabled || busy} icon={revoke.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => setConfirmRevoke(true)}>
          Revoke invite
        </Button>
      </div>
      <Dialog open={confirmRevoke} onOpenChange={(_, d) => !d.open && !revoke.isPending && setConfirmRevoke(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Revoke admin invitation?</DialogTitle>
            <DialogContent>
              <Body1>The pending invitation link stops working. You can resend a new one at any time.</Body1>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmRevoke(false)} disabled={revoke.isPending}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={() => revoke.mutate()} disabled={revoke.isPending} icon={revoke.isPending ? <Spinner size="tiny" /> : undefined}>
                Revoke invite
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}

function AiBudgetCard({ tenantId, life }: { tenantId: string; life: TenantLifecycleOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const current = life.ai_budget ?? null;
  const [limited, setLimited] = useState(current !== null);
  const [budget, setBudget] = useState<number>(current ?? 1_000_000);
  const save = useMutation({
    mutationFn: () => platformApi.setAiBudget(tenantId, limited ? budget : null),
    onSuccess: async () => {
      toast.success("AI budget saved");
      await queryClient.invalidateQueries({ queryKey: platformKeys.tenants });
    },
    onError: (e) => toast.error(platformErrorMessage(e)),
  });
  const dirty = (limited ? budget : null) !== current;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">AI budget</Subtitle2>}
        description={
          <Caption1>
            Usage this month: {life.ai_usage_percent === null || life.ai_usage_percent === undefined ? "—" : `${Math.round(life.ai_usage_percent)}%`}.
            Bulk AI pauses at 100%; everything stops at 120%.
          </Caption1>
        }
      />
      <div className={styles.form}>
        <Switch label="Limit monthly tokens" checked={limited} onChange={(_, d) => setLimited(d.checked)} />
        <Field label="Tokens per month">
          <SpinButton
            value={budget}
            min={0}
            step={100_000}
            disabled={!limited}
            onChange={(_, d) => {
              const v = d.value ?? Number(String(d.displayValue).replace(/[^\d]/g, ""));
              if (Number.isFinite(v) && v >= 0) setBudget(Math.round(v));
            }}
          />
        </Field>
        <div>
          <Button appearance="primary" disabled={!dirty || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate()}>
            Save budget
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SupportRequestCard({ tenantId, disabled }: { tenantId: string; disabled: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [hours, setHours] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => platformApi.requestSupport(tenantId, { reason: reason.trim(), ticket_ref: ticket.trim() || null, requested_hours: hours }),
    onSuccess: async () => {
      toast.success("Support access requested. The tenant's admins must approve it.");
      setReason("");
      setTicket("");
      await queryClient.invalidateQueries({ queryKey: platformKeys.support });
    },
    onError: (e) => setError(platformErrorMessage(e)),
  });
  const valid = reason.trim().length >= 20 && hours >= 1 && hours <= 24;
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Request support access</Subtitle2>}
        description={<Caption1>Read-only access for at most 24 hours, after a tenant admin approves. Every request you make is audited.</Caption1>}
      />
      <form
        className={styles.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (valid) send.mutate();
        }}
      >
        <ErrorBar message={error} />
        <Field label="Reason" required hint="At least 20 characters; the tenant's admins see it.">
          <Textarea value={reason} onChange={(_, d) => setReason(d.value)} rows={3} maxLength={2000} resize="vertical" disabled={disabled} />
        </Field>
        <div className={styles.row}>
          <Field label="Ticket reference">
            <Input value={ticket} onChange={(_, d) => setTicket(d.value)} maxLength={100} disabled={disabled} />
          </Field>
          <Field label="Hours" hint="1–24">
            <SpinButton
              value={hours}
              min={1}
              max={24}
              disabled={disabled}
              onChange={(_, d) => {
                const v = d.value ?? Number(d.displayValue);
                if (Number.isFinite(v)) setHours(Math.min(24, Math.max(1, Math.round(v))));
              }}
            />
          </Field>
        </div>
        <div>
          <Button type="submit" appearance="primary" disabled={disabled || !valid || send.isPending} icon={send.isPending ? <Spinner size="tiny" /> : undefined}>
            Request access
          </Button>
        </div>
      </form>
    </Card>
  );
}
