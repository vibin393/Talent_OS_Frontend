"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Subtitle2,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type Subscription, webhookKeys, webhooksApi } from "./api";
import { DeliveriesGrid } from "./deliveries-grid";
import { disabledMessage, endpointLabel, streakLabel } from "./logic";
import { SecretOnceDialog } from "./secret-once-dialog";
import { StatusBadge } from "./status-badge";
import { SubscriptionForm } from "./subscription-form";
import { TestEventDialog } from "./test-event-dialog";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1100px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  card: { padding: tokens.spacingHorizontalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  form: { maxWidth: "640px" },
});

type TabValue = "overview" | "deliveries" | "settings";

/** Subscription detail (Epic 68, B4): Overview, Deliveries and Settings. */
export function SubscriptionDetail({ id }: { id: string }) {
  const styles = useStyles();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canManage = usePermission("webhook:manage");
  const canView = usePermission("integration:view") || canManage;
  const [tab, setTab] = useState<TabValue>("overview");
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const q = useQuery({ queryKey: webhookKeys.detail(id), queryFn: ({ signal }) => webhooksApi.get(id, signal), enabled: canView });
  const set = (s: Subscription) => {
    qc.setQueryData(webhookKeys.detail(id), s);
    void qc.invalidateQueries({ queryKey: webhookKeys.list });
  };
  const act = useMutation({
    mutationFn: (kind: "enable" | "disable" | "verify") => webhooksApi[kind](id),
    onSuccess: (s, kind) => {
      set(s);
      if (kind === "verify") {
        if (s.status === "active") toast.success("Endpoint verified.");
        else toast.error("The endpoint didn't answer the challenge.");
      } else toast.success(kind === "enable" ? "Webhook turned on." : "Webhook turned off.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canView)
    return (
      <>
        <PageHeader title="Webhook" />
        <NoAccess what="webhooks" />
      </>
    );
  if (q.isLoading) return <GridSkeleton />;
  if (q.error || !q.data) return <ErrorBar message={errorMessage(q.error)} />;
  const s = q.data;
  const off = disabledMessage(s.disabled_reason);
  return (
    <div className={styles.root}>
      <PageHeader title={s.description || endpointLabel(s.url)} subtitle={endpointLabel(s.url)} />
      <div className={styles.actions}>
        <StatusBadge sub={s} />
        {canManage && (
          <>
            <Button onClick={() => setTesting(true)}>Send test event</Button>
            <Button onClick={() => setRotating(true)}>Rotate secret</Button>
            <Button onClick={() => act.mutate(s.status === "disabled" ? "enable" : "disable")}>
              {s.status === "disabled" ? "Turn on" : "Turn off"}
            </Button>
            <Button appearance="primary" style={{ backgroundColor: tokens.colorPaletteRedBackground3 }} onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
      {s.status === "pending_verification" && (
        <MessageBar intent={s.verification_error ? "warning" : "info"}>
          <MessageBarBody>
            {params.get("created") && !s.verification_error
              ? "We sent a verification request to your endpoint. It must reply with the challenge within 10 seconds."
              : s.verification_error
                ? `The endpoint couldn't be verified (${s.verification_error}).`
                : "Waiting for the endpoint to be verified."}
          </MessageBarBody>
          {canManage && (
            <MessageBarActions>
              <Button onClick={() => act.mutate("verify")}>Verify again</Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
      {s.status === "disabled" && off && (
        <MessageBar intent="error">
          <MessageBarBody>{off}</MessageBarBody>
        </MessageBar>
      )}
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabValue)}>
        <Tab value="overview">Overview</Tab>
        <Tab value="deliveries">Deliveries</Tab>
        {canManage && <Tab value="settings">Settings</Tab>}
      </TabList>
      {tab === "overview" && (
        <div className={styles.section}>
          <div className={styles.cards}>
            <Card className={styles.card}>
              <CardHeader header={<Caption1>Last delivered</Caption1>} />
              <Subtitle2>{formatDateTime(s.last_success_at)}</Subtitle2>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Caption1>Consecutive failures</Caption1>} />
              <Subtitle2>{s.consecutive_failures}</Subtitle2>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Caption1>Failure streak</Caption1>} />
              <Subtitle2>{streakLabel(s.failure_streak_started_at)}</Subtitle2>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Caption1>Parallel deliveries</Caption1>} />
              <Subtitle2>{s.max_in_flight}</Subtitle2>
            </Card>
          </div>
          <Body1>
            Signing secret: ••••{s.signing_secret.fingerprint ?? ""}
            {s.signing_secret.rotated_at ? `, rotated ${formatDateTime(s.signing_secret.rotated_at)}` : ""}
            {s.signing_secret.previous_expires_at ? ` (old secret valid until ${formatDateTime(s.signing_secret.previous_expires_at)})` : ""}
          </Body1>
          <Body1>{s.verified_at ? `Verified ${formatDateTime(s.verified_at)}` : "Not verified yet"}</Body1>
          <Body1>Events: {s.all_events ? "All events" : s.event_types.join(", ")}</Body1>
          {Object.keys(s.filters).length > 0 && (
            <Body1>
              Filters:{" "}
              {Object.entries(s.filters)
                .map(([k, v]) => `${k} = ${v.join(" or ")}`)
                .join("; ")}
            </Body1>
          )}
        </div>
      )}
      {tab === "deliveries" && <DeliveriesGrid sub={s} canManage={canManage} />}
      {tab === "settings" && canManage && (
        <div className={styles.form}>
          <SubscriptionForm
            initial={s}
            submitLabel="Save"
            onSubmit={async (body) => {
              set(await webhooksApi.update(id, { ...body, installation_id: undefined }));
              toast.success("Webhook saved.");
            }}
          />
        </div>
      )}
      <ConfirmDialog
        open={rotating}
        title="Rotate the signing secret?"
        confirmLabel="Rotate secret"
        onClose={() => setRotating(false)}
        onConfirm={async () => {
          try {
            const r = await webhooksApi.rotate(id);
            set(r.subscription);
            setSecret(r.signing_secret);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Both the old and new secrets sign deliveries for 24 hours so you can switch over.
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        title="Delete this webhook?"
        confirmLabel="Delete"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await webhooksApi.remove(id);
            void qc.invalidateQueries({ queryKey: webhookKeys.all });
            toast.success("Webhook deleted.");
            router.push("/settings/integrations/webhooks");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Queued and paused deliveries are cancelled. The delivery log stays available for 30 days.
      </ConfirmDialog>
      <SecretOnceDialog secret={secret} onDone={() => setSecret(null)} />
      <TestEventDialog sub={testing ? s : null} onClose={() => setTesting(false)} />
    </div>
  );
}
