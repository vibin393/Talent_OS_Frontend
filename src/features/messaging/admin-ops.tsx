"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
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
  Option,
  SearchBox,
  Spinner,
  Subtitle2,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Checkmark20Regular, Copy20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import { CHANNEL_LABELS, formatAge, messageStatusBadge, quietHoursErrors, SENDER_ID, toE164 } from "./logic";
import type { Channel, ChannelMessage, ChannelSettings, ManualQueueItem, OptOut } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "720px" },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: tokens.spacingHorizontalM },
  body: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  actions: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
});

const ALL = "all";
const channelLabel = (c: string) => CHANNEL_LABELS[c as Channel] ?? c;

// ---------------------------------------------------------------- channel settings
export function ChannelSettingsTab() {
  const q = useQuery({ queryKey: messagingKeys.settings, queryFn: ({ signal }) => messagingApi.settings(signal) });
  if (q.isPending) return <GridSkeleton rows={4} />;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  return <SettingsForm key={JSON.stringify(q.data)} initial={q.data} />;
}

function SettingsForm({ initial }: { initial: ChannelSettings }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: ChannelSettings) => messagingApi.updateSettings(body),
    onSuccess: (s) => {
      queryClient.setQueryData(messagingKeys.settings, s);
      toast.success("Messaging settings saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = () => {
    const e: Record<string, string> = quietHoursErrors(d.quiet_hours);
    const sender = d.default_sms_sender_id?.trim() ?? "";
    if (sender && !SENDER_ID.test(sender)) e.sender = "The sender ID is exactly 6 letters or digits";
    if (!(d.thread_sync_days >= 1 && d.thread_sync_days <= 365)) e.days = "Enter 1–365 days";
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate({ ...d, default_sms_sender_id: sender ? sender.toUpperCase() : null, dlt_entity_id: d.dlt_entity_id?.trim() || null });
  };
  const setQ = (k: "start" | "end" | "tz", v: string) => setD((x) => ({ ...x, quiet_hours: { ...x.quiet_hours, [k]: v } }));
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Channels</Subtitle2>} description="Turn SMS and WhatsApp on for your organisation." />
      <Switch label="SMS enabled" checked={d.sms_enabled} onChange={(_, x) => setD({ ...d, sms_enabled: x.checked })} />
      <Switch label="WhatsApp enabled" checked={d.whatsapp_enabled} onChange={(_, x) => setD({ ...d, whatsapp_enabled: x.checked })} />
      <div className={styles.grid3}>
        <Field label="Default SMS sender ID" hint="6 characters" validationMessage={errors.sender}>
          <Input value={d.default_sms_sender_id ?? ""} maxLength={6} onChange={(_, x) => setD({ ...d, default_sms_sender_id: x.value })} />
        </Field>
        <Field label="DLT entity ID" hint="Principal entity ID from your DLT registration">
          <Input value={d.dlt_entity_id ?? ""} onChange={(_, x) => setD({ ...d, dlt_entity_id: x.value })} />
        </Field>
      </div>
      <Subtitle2 as="h3">Quiet hours (SMS)</Subtitle2>
      <Text>SMS messages created during quiet hours wait until they end.</Text>
      <div className={styles.grid3}>
        <Field label="Start" validationMessage={errors.start}>
          <Input type="time" value={d.quiet_hours.start} onChange={(_, x) => setQ("start", x.value)} />
        </Field>
        <Field label="End" validationMessage={errors.end}>
          <Input type="time" value={d.quiet_hours.end} onChange={(_, x) => setQ("end", x.value)} />
        </Field>
        <Field label="Time zone" validationMessage={errors.tz}>
          <Input value={d.quiet_hours.tz} onChange={(_, x) => setQ("tz", x.value)} />
        </Field>
      </div>
      <Subtitle2 as="h3">Email reply capture</Subtitle2>
      <Switch
        label="Allow users to capture replies to emails sent from Talent OS"
        checked={d.inbound_sync_enabled}
        onChange={(_, x) => setD({ ...d, inbound_sync_enabled: x.checked })}
      />
      <Field label="Follow threads for (days)" validationMessage={errors.days} style={{ maxWidth: 220 }}>
        <Input type="number" min={1} max={365} value={String(d.thread_sync_days)} onChange={(_, x) => setD({ ...d, thread_sync_days: Number(x.value) })} />
      </Field>
      <div>
        <Button appearance="primary" onClick={submit} disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- opt-outs
export function OptOutsTab() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<OptOut | null>(null);
  const list = useQuery({ queryKey: messagingKeys.optOuts(channel, search), queryFn: ({ signal }) => messagingApi.optOuts(channel, search, signal) });
  const columns: TableColumnDefinition<OptOut>[] = [
    createTableColumn<OptOut>({ columnId: "phone", renderHeaderCell: () => "Phone", renderCell: (o) => o.phone_masked }),
    createTableColumn<OptOut>({ columnId: "channel", renderHeaderCell: () => "Channel", renderCell: (o) => channelLabel(o.channel) }),
    createTableColumn<OptOut>({ columnId: "source", renderHeaderCell: () => "Source", renderCell: (o) => o.source.replace(/_/g, " ") }),
    createTableColumn<OptOut>({ columnId: "created", renderHeaderCell: () => "Since", renderCell: (o) => formatDateTime(o.created_at) }),
    createTableColumn<OptOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (o) =>
        o.revoked_at ? (
          <Badge appearance="tint" color="subtle">
            Revoked {formatDateTime(o.revoked_at)}
          </Badge>
        ) : (
          <Button size="small" onClick={() => setRevoking(o)}>
            Revoke
          </Button>
        ),
    }),
  ];
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["messaging", "opt-outs"] });
  return (
    <>
      <div className={styles.toolbar}>
        <SearchBox className={styles.search} placeholder="Search by phone" value={search} onChange={(_, d) => setSearch(d.value)} aria-label="Search opt-outs" />
        <Field label="Channel" className={styles.filter}>
          <Dropdown
            value={channel ? CHANNEL_LABELS[channel] : "All"}
            selectedOptions={[channel ?? ALL]}
            onOptionSelect={(_, d) => setChannel(d.optionValue === ALL ? null : (d.optionValue as Channel))}
          >
            <Option value={ALL}>All</Option>
            <Option value="sms">SMS</Option>
            <Option value="whatsapp">WhatsApp</Option>
          </Dropdown>
        </Field>
        <div className={styles.grow} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add opt-out
        </Button>
      </div>
      <AdminGrid items={list.data} columns={columns} getRowId={(o) => o.id} loading={list.isPending} error={list.error} emptyText="No opt-outs." label="Opt-outs" />
      {adding && (
        <ReasonDialog
          title="Add opt-out"
          confirmLabel="Add"
          withPhone
          onClose={() => setAdding(false)}
          onSubmit={async ({ phone, channel: ch, reason }) => {
            await messagingApi.addOptOut({ channel: ch, phone_e164: phone, reason: reason || undefined });
            toast.success("Opt-out added");
            invalidate();
          }}
        />
      )}
      {revoking && (
        <ReasonDialog
          title={`Revoke opt-out for ${revoking.phone_masked}?`}
          confirmLabel="Revoke"
          reasonRequired
          onClose={() => setRevoking(null)}
          onSubmit={async ({ reason }) => {
            await messagingApi.revokeOptOut(revoking.id, reason);
            toast.success("Opt-out revoked");
            invalidate();
          }}
        />
      )}
    </>
  );
}

function ReasonDialog({
  title,
  confirmLabel,
  withPhone,
  reasonRequired,
  onClose,
  onSubmit,
}: {
  title: string;
  confirmLabel: string;
  withPhone?: boolean;
  reasonRequired?: boolean;
  onClose: () => void;
  onSubmit: (v: { phone: string; channel: Channel; reason: string }) => Promise<void>;
}) {
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const e164 = toE164(phone);
  const valid = (!withPhone || !!e164) && (!reasonRequired || reason.trim().length > 0);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <ErrorBar message={error} />
            {withPhone && (
              <>
                <Field label="Mobile number" required validationMessage={phone && !e164 ? "Enter a valid mobile number" : undefined}>
                  <Input type="tel" value={phone} onChange={(_, d) => setPhone(d.value)} placeholder="+91 98765 43210" />
                </Field>
                <Field label="Channel">
                  <Dropdown value={CHANNEL_LABELS[channel]} selectedOptions={[channel]} onOptionSelect={(_, d) => setChannel(d.optionValue as Channel)}>
                    <Option value="sms">SMS</Option>
                    <Option value="whatsapp">WhatsApp</Option>
                  </Dropdown>
                </Field>
              </>
            )}
            <Field label="Reason" required={reasonRequired}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} maxLength={500} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!valid || busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onSubmit({ phone: e164 ?? "", channel, reason: reason.trim() });
                  onClose();
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---------------------------------------------------------------- manual queue
export function ManualQueueTab() {
  const toast = useAppToast();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: messagingKeys.manualQueue, queryFn: ({ signal }) => messagingApi.manualQueue(signal), refetchInterval: 60_000 });
  const done = () => void queryClient.invalidateQueries({ queryKey: messagingKeys.manualQueue });
  const mark = useMutation({
    mutationFn: ({ id, sent }: { id: string; sent: boolean }) => (sent ? messagingApi.markSent(id) : messagingApi.markFailed(id, "manual_failed")),
    onSuccess: (_, v) => {
      toast.success(v.sent ? "Marked as sent" : "Marked as failed");
      done();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };
  const columns: TableColumnDefinition<ManualQueueItem>[] = [
    createTableColumn<ManualQueueItem>({
      columnId: "to",
      renderHeaderCell: () => "To",
      renderCell: (m) => (
        <TableCellLayout description={channelLabel(m.channel)}>
          {m.to_e164}{" "}
          <Button size="small" appearance="subtle" icon={<Copy20Regular />} aria-label="Copy number" onClick={() => copy(m.to_e164, "Number")} />
        </TableCellLayout>
      ),
    }),
    createTableColumn<ManualQueueItem>({
      columnId: "body",
      renderHeaderCell: () => "Message",
      renderCell: (m) => (
        <TableCellLayout description={[m.template_name, m.provider_template_ref].filter(Boolean).join(" · ") || undefined}>
          <span className={styles.body}>{m.body_rendered}</span>{" "}
          <Button size="small" appearance="subtle" icon={<Copy20Regular />} aria-label="Copy message" onClick={() => copy(m.body_rendered, "Message")} />
        </TableCellLayout>
      ),
    }),
    createTableColumn<ManualQueueItem>({ columnId: "age", renderHeaderCell: () => "Waiting", renderCell: (m) => formatAge(m.age_seconds) }),
    createTableColumn<ManualQueueItem>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (m) => (
        <div className={styles.actions}>
          <Button size="small" icon={<Checkmark20Regular />} disabled={mark.isPending} onClick={() => mark.mutate({ id: m.id, sent: true })}>
            Sent
          </Button>
          <Button size="small" icon={<Dismiss20Regular />} disabled={mark.isPending} onClick={() => mark.mutate({ id: m.id, sent: false })}>
            Failed
          </Button>
        </div>
      ),
    }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(m) => m.id}
      loading={list.isPending}
      error={list.error}
      emptyText="Nothing waiting. Messages for the Manual provider appear here."
      label="Manual send queue"
    />
  );
}

// ---------------------------------------------------------------- unmatched inbound
export function UnmatchedTab() {
  const styles = useStyles();
  const list = useQuery({ queryKey: messagingKeys.unmatched, queryFn: ({ signal }) => messagingApi.unmatched(signal) });
  const columns: TableColumnDefinition<ChannelMessage>[] = [
    createTableColumn<ChannelMessage>({
      columnId: "from",
      renderHeaderCell: () => "From",
      renderCell: (m) => <TableCellLayout description={channelLabel(m.channel)}>{m.to_masked ?? "—"}</TableCellLayout>,
    }),
    createTableColumn<ChannelMessage>({
      columnId: "body",
      renderHeaderCell: () => "Message",
      renderCell: (m) => <span className={styles.body}>{m.body_rendered ?? ""}</span>,
    }),
    createTableColumn<ChannelMessage>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (m) => {
        const b = messageStatusBadge(m.status);
        return (
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        );
      },
    }),
    createTableColumn<ChannelMessage>({ columnId: "at", renderHeaderCell: () => "Received", renderCell: (m) => formatDateTime(m.created_at) }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(m) => m.id}
      loading={list.isPending}
      error={list.error}
      emptyText="No unmatched messages. Replies that arrive outside a conversation window are listed here."
      label="Unmatched inbound messages"
    />
  );
}
