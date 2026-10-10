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
  SearchBox,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Textarea,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, formatDateTime, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { humanize } from "@/features/privacy/format";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { useNow } from "@/features/privacy/use-now";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { IncidentNotificationOut, IncidentOut } from "@/lib/api/types";
import { incidentHoursLeft, platformErrorMessage, SEVERITIES, SEVERITY_COLORS } from "./errors";
import { incidentPreview } from "./incident-template";

const PAGE_SIZE = 20;

const useStyles = makeStyles({
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tenants: {
    maxHeight: "260px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalS,
  },
  preview: { padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium, maxHeight: "320px", overflowY: "auto" },
});

function WindowBadge({ incident, now }: { incident: IncidentOut; now: Date }) {
  const left = incidentHoursLeft(incident.confirmed_at, now);
  if (incident.status !== "draft") return null;
  return left > 0 ? (
    <Badge appearance="filled" color={left < 6 ? "danger" : "warning"}>
      {Math.floor(left)}h {Math.floor((left % 1) * 60)}m left to notify
    </Badge>
  ) : (
    <Badge appearance="filled" color="danger">
      Notification window passed
    </Badge>
  );
}

/** `/platform/incidents`: create incidents, notify tenants within 24 h, track sends and acknowledgements. */
export function IncidentsView() {
  const styles = useAdminStyles();
  const now = useNow(60_000);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<IncidentOut | null>(null);
  const list = useQuery({
    queryKey: [...platformKeys.incidents, page],
    queryFn: ({ signal }) => platformApi.incidents(page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const columns: TableColumnDefinition<IncidentOut>[] = [
    createTableColumn({ columnId: "title", compare: (a, b) => a.title.localeCompare(b.title), renderHeaderCell: () => "Incident", renderCell: (i) => i.title }),
    createTableColumn({
      columnId: "severity",
      renderHeaderCell: () => "Severity",
      renderCell: (i) => (
        <Badge appearance="tint" color={SEVERITY_COLORS[i.severity] ?? "informative"}>
          {humanize(i.severity)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "confirmed", compare: (a, b) => a.confirmed_at.localeCompare(b.confirmed_at), renderHeaderCell: () => "Confirmed", renderCell: (i) => formatDateTime(i.confirmed_at) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          <Badge appearance="tint" color={i.status === "draft" ? "warning" : i.status === "notified" ? "success" : "subtle"}>
            {humanize(i.status)}
          </Badge>
          <WindowBadge incident={i} now={now} />
        </span>
      ),
    }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (i) => (
        <Button size="small" appearance="subtle" onClick={() => setSelected(i)}>
          Open
        </Button>
      ),
    }),
  ];
  return (
    <>
      <PageHeader title="Incidents" subtitle="Personal data breaches. Affected tenants must be notified within 24 hours of confirmation." />
      <Toolbar aria-label="Incident commands" className={styles.toolbar}>
        <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          New incident
        </ToolbarButton>
      </Toolbar>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(i) => i.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No incidents recorded."
        label="Incidents"
        sortable
        footer={list.data && <PagingBar page={page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
      {creating && <CreateIncidentDialog onClose={() => setCreating(false)} onCreated={(i) => (setCreating(false), setSelected(i))} />}
      {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateIncidentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (i: IncidentOut) => void }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("high");
  const [confirmedAt, setConfirmedAt] = useState(() => toLocalInput(new Date()));
  const [categories, setCategories] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      platformApi.createIncident({
        title: title.trim(),
        description: description.trim(),
        severity,
        confirmed_at: new Date(confirmedAt).toISOString(),
        details: {
          ...(categories.trim() ? { data_categories: categories.split(",").map((c) => c.trim()).filter(Boolean) } : {}),
          ...(mitigation.trim() ? { mitigation: mitigation.trim() } : {}),
          ...(contact.trim() ? { contact: contact.trim() } : {}),
        },
      }),
    onSuccess: async (i) => {
      await queryClient.invalidateQueries({ queryKey: platformKeys.incidents });
      onCreated(i);
    },
    onError: (e) => setError(platformErrorMessage(e)),
  });
  const valid = title.trim() && description.trim() && confirmedAt;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>New incident</DialogTitle>
            <DialogContent className={styles.col}>
              <ErrorBar message={error} />
              <Field label="Title" required>
                <Input value={title} onChange={(_, d) => setTitle(d.value)} maxLength={200} />
              </Field>
              <Field label="What happened" required>
                <Textarea value={description} onChange={(_, d) => setDescription(d.value)} rows={4} resize="vertical" maxLength={20000} />
              </Field>
              <Field label="Severity">
                <Dropdown value={humanize(severity)} selectedOptions={[severity]} onOptionSelect={(_, d) => d.optionValue && setSeverity(d.optionValue as typeof severity)}>
                  {SEVERITIES.map((s) => (
                    <Option key={s} value={s}>
                      {humanize(s)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Confirmed at" required hint="Tenants must be notified within 24 hours of this time.">
                <Input type="datetime-local" value={confirmedAt} onChange={(_, d) => setConfirmedAt(d.value)} />
              </Field>
              <Field label="Data categories" hint="Comma-separated, e.g. contact details, resumes">
                <Input value={categories} onChange={(_, d) => setCategories(d.value)} />
              </Field>
              <Field label="Mitigation">
                <Textarea value={mitigation} onChange={(_, d) => setMitigation(d.value)} rows={2} resize="vertical" />
              </Field>
              <Field label="Contact">
                <Input value={contact} onChange={(_, d) => setContact(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={create.isPending}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={!valid || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined}>
                Create incident
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

function IncidentDrawer({ incident, onClose }: { incident: IncidentOut; onClose: () => void }) {
  const styles = useStyles();
  const now = useNow(30_000);
  const [notifying, setNotifying] = useState(false);
  const sent = useQuery({
    queryKey: platformKeys.incidentNotifications(incident.id),
    queryFn: ({ signal }) => platformApi.incidentNotifications(incident.id, signal),
  });
  const tenants = useQuery({ queryKey: [...platformKeys.tenants, "all"], queryFn: ({ signal }) => platformApi.tenants(1, 100, signal) });
  const nameOf = (id: string) => tenants.data?.items.find((t) => t.id === id)?.name ?? id.slice(0, 8);
  const columns: TableColumnDefinition<IncidentNotificationOut>[] = [
    createTableColumn({ columnId: "tenant", renderHeaderCell: () => "Tenant", renderCell: (n) => nameOf(n.tenant_id) }),
    createTableColumn({ columnId: "sent", renderHeaderCell: () => "Sent", renderCell: (n) => formatDateTime(n.sent_at) }),
    createTableColumn({ columnId: "recipients", renderHeaderCell: () => "Recipients", renderCell: (n) => n.recipient_count }),
    createTableColumn({ columnId: "acked", renderHeaderCell: () => "Acknowledged", renderCell: (n) => n.acknowledged_count ?? 0 }),
    createTableColumn({
      columnId: "late",
      renderHeaderCell: () => "On time",
      renderCell: (n) =>
        n.late ? (
          <Badge appearance="filled" color="danger">
            Late
          </Badge>
        ) : (
          <Badge appearance="tint" color="success">
            Within 24 h
          </Badge>
        ),
    }),
  ];
  return (
    <DetailsDrawer
      open
      size="large"
      title={incident.title}
      onClose={onClose}
      footer={
        <Button appearance="primary" icon={<Send20Regular />} onClick={() => setNotifying(true)}>
          Notify tenants
        </Button>
      }
    >
      <div className={styles.col}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge appearance="tint" color={SEVERITY_COLORS[incident.severity] ?? "informative"}>
            {humanize(incident.severity)}
          </Badge>
          <Caption1>Confirmed {formatDateTime(incident.confirmed_at)}</Caption1>
          <WindowBadge incident={incident} now={now} />
        </div>
        <Body1>{incident.description}</Body1>
        <Subtitle2 as="h3">Notifications</Subtitle2>
        <AdminGrid
          items={sent.data}
          columns={columns}
          getRowId={(n) => n.id}
          loading={sent.isPending}
          error={sent.error}
          emptyText="No tenant has been notified yet."
          label="Incident notifications"
        />
      </div>
      {notifying && (
        <NotifyWizard
          incident={incident}
          tenants={(tenants.data?.items ?? []).filter((t) => t.status !== "deleted").map((t) => ({ id: t.id, name: t.name }))}
          onClose={() => setNotifying(false)}
        />
      )}
    </DetailsDrawer>
  );
}

function NotifyWizard({ incident, tenants, onClose }: { incident: IncidentOut; tenants: { id: string; name: string }[]; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const now = useNow(30_000);
  const [step, setStep] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const notify = useMutation({
    mutationFn: () => platformApi.notifyIncident(incident.id, [...selected]),
    onSuccess: async (out) => {
      const late = out.filter((n) => n.late).length;
      toast.success(`Notified ${out.length} tenant(s)${late ? `; ${late} flagged late` : ""}`);
      await queryClient.invalidateQueries({ queryKey: platformKeys.incidents });
      onClose();
    },
    onError: (e) => setError(platformErrorMessage(e)),
  });
  const hoursLeft = incidentHoursLeft(incident.confirmed_at, now);
  const shown = tenants.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const first = tenants.find((t) => selected.has(t.id));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !notify.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>Notify tenants · step {step + 1} of 2</DialogTitle>
          <DialogContent className={styles.col}>
            <ErrorBar message={error} />
            <MessageBar intent={hoursLeft > 0 ? "warning" : "error"}>
              <MessageBarBody>
                {hoursLeft > 0
                  ? `${Math.floor(hoursLeft)} h ${Math.floor((hoursLeft % 1) * 60)} min left in the 24-hour window.`
                  : "The 24-hour window has passed; these notifications will be flagged late."}
              </MessageBarBody>
            </MessageBar>
            {step === 0 ? (
              <>
                <SearchBox placeholder="Filter tenants" value={q} onChange={(_, d) => setQ(d.value)} />
                <Checkbox
                  label={`All tenants (${tenants.length})`}
                  checked={selected.size === 0 ? false : selected.size === tenants.length ? true : "mixed"}
                  onChange={(_, d) => setSelected(d.checked === true ? new Set(tenants.map((t) => t.id)) : new Set())}
                />
                <div className={styles.tenants} role="group" aria-label="Tenants">
                  {shown.map((t) => (
                    <Checkbox
                      key={t.id}
                      label={t.name}
                      checked={selected.has(t.id)}
                      onChange={(_, d) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (d.checked === true) next.add(t.id);
                          else next.delete(t.id);
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <Body1>
                  {selected.size} tenant(s) receive an admin notice in the app and by email. Preview for {first?.name ?? "a tenant"}:
                </Body1>
                <div className={styles.preview}>
                  <MarkdownView source={incidentPreview(incident, first?.name)} />
                </div>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={notify.isPending}>
              Cancel
            </Button>
            {step === 1 && (
              <Button onClick={() => setStep(0)} disabled={notify.isPending}>
                Back
              </Button>
            )}
            {step === 0 ? (
              <Button appearance="primary" disabled={selected.size === 0} onClick={() => setStep(1)}>
                Preview
              </Button>
            ) : (
              <Button appearance="primary" disabled={notify.isPending} icon={notify.isPending ? <Spinner size="tiny" /> : <Send20Regular />} onClick={() => notify.mutate()}>
                Send notifications
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
