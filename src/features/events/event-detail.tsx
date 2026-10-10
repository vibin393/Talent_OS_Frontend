"use client";

import {
  Badge,
  Button,
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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDownload20Regular, ArrowLeft20Regular, Copy20Regular, Edit20Regular, PeopleQueue20Regular, Person20Regular, QrCode20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { ReasonDialog } from "@/features/campus/ui";
import { PeoplePicker, type PersonRef } from "@/features/campus/pickers";
import { useDebounced } from "@/lib/use-debounced";
import { errorMessage } from "@/lib/api/errors";
import { eventKeys, eventPaths, eventsApi } from "./api";
import { EventEditorDialog } from "./event-editor";
import { EventStatusBadge } from "./events-list";
import { CHANNEL_LABELS, eventActions, formatEta, KIND_LABELS, QUEUE_STATUS_LABELS } from "./logic";
import type { CheckinOut, CheckinStatus, EventCheckinsOut, EventDashboardOut, EventOut, StationOut, StationStatus } from "./types";
import { useEtagPoll } from "./use-poll";
import { useEvent, useEventMutation, useEventPermissions, useStationMutation, useStations } from "./use-events";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  tabs: { marginBlock: tokens.spacingVerticalM, overflowX: "auto" },
  tiles: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" },
  tile: { display: "flex", flexDirection: "column", padding: tokens.spacingHorizontalM, borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground1, boxShadow: tokens.shadow2 },
  value: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  card: { padding: tokens.spacingHorizontalL, backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusMedium, boxShadow: tokens.shadow4, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

type TabKey = "dashboard" | "stations" | "checkins";

/** `/campus/events/[id]`: event header + lifecycle, dashboard tiles, stations and check-ins. */
export function EventDetail({ eventId }: { eventId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { canRead, canManage } = useEventPermissions();
  const ev = useEvent(eventId);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"open" | "go_live" | "close" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const transition = useEventMutation((a: "open" | "go_live" | "close") =>
    a === "open" ? eventsApi.open(eventId) : a === "go_live" ? eventsApi.goLive(eventId) : eventsApi.close(eventId),
  );
  const cancel = useEventMutation((reason: string) => eventsApi.cancel(eventId, reason));
  if (!canRead) return <NoAccess what="recruitment events" />;
  if (ev.isPending) return <GridSkeleton rows={8} />;
  if (ev.isError) return <ErrorBar title="Could not load the event." message={errorMessage(ev.error)} />;
  const e = ev.data;
  const actions = canManage ? eventActions(e.status) : [];
  const COPY = {
    open: { label: "Open registration", body: "The public registration page starts accepting candidates." },
    go_live: { label: "Go live", body: "Check-in and the queue open. Stations can start calling candidates." },
    close: { label: "Close event", body: "Check-in stops. Candidates still waiting are marked as not seen." },
  } as const;

  const copyUrl = async () => {
    if (!e.registration_url) return;
    try {
      await navigator.clipboard.writeText(e.registration_url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <>
      <AppLink href="/campus/events">
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Recruitment events
      </AppLink>
      <PageHeader
        title={e.name}
        subtitle={
          <>
            {KIND_LABELS[e.kind]} · <EventStatusBadge status={e.status} /> · {formatDateTime(e.starts_at)} – {formatDateTime(e.ends_at)}
            {e.venue ? ` · ${e.venue}` : ""}
          </>
        }
      />
      {e.status === "cancelled" && (
        <MessageBar intent="warning">
          <MessageBarBody>This event was cancelled{e.cancel_reason ? `: ${e.cancel_reason}` : "."}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.row}>
        {actions
          .filter((a) => a !== "cancel")
          .map((a) => (
            <Button key={a} appearance="primary" onClick={() => setConfirm(a as "open" | "go_live" | "close")}>
              {COPY[a as keyof typeof COPY].label}
            </Button>
          ))}
        {canManage && (
          <>
            <Button icon={<PeopleQueue20Regular />} onClick={() => router.push(`/campus/events/${e.id}/kiosk`)}>
              Check-in kiosk
            </Button>
            <Button icon={<PeopleQueue20Regular />} onClick={() => router.push(`/campus/events/${e.id}/queue`)}>
              Queue board
            </Button>
          </>
        )}
        {canManage && e.status !== "closed" && e.status !== "cancelled" && (
          <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {e.registration_url && (
          <Button icon={<Copy20Regular />} onClick={() => void copyUrl()}>
            Copy registration link
          </Button>
        )}
        {canManage && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<QrCode20Regular />}>QR poster</Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(["png", "svg", "pdf"] as const).map((f) => (
                  <MenuItem
                    key={f}
                    icon={<ArrowDownload20Regular />}
                    onClick={() => void eventsApi.downloadQr(e.id, f).catch((err) => toast.error(errorMessage(err)))}
                  >
                    {f.toUpperCase()}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        {actions.includes("cancel") && <Button onClick={() => setCancelling(true)}>Cancel event</Button>}
      </div>
      <Text size={200} className={styles.muted}>
        Turn notices: {CHANNEL_LABELS[e.notify_channel]} · Average interview {e.avg_interview_minutes} min
        {e.demands.length ? ` · Hiring for ${e.demands.map((d) => d.title).join(", ")}` : ""}
      </Text>
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} aria-label="Event sections">
        <Tab value="dashboard">Dashboard</Tab>
        <Tab value="stations">Stations</Tab>
        <Tab value="checkins">Check-ins</Tab>
      </TabList>
      <div role="tabpanel" aria-label={tab}>
        {tab === "dashboard" && (canManage ? <Dashboard event={e} /> : <Text>Live figures need event management permission.</Text>)}
        {tab === "stations" && <StationsEditor event={e} />}
        {tab === "checkins" && (canManage ? <CheckinsGrid event={e} /> : <Text>Check-ins need event management permission.</Text>)}
      </div>
      {editing && <EventEditorDialog event={e} onClose={() => setEditing(false)} />}
      {confirm && (
        <ConfirmDialog
          open
          title={`${COPY[confirm].label}?`}
          confirmLabel={COPY[confirm].label}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              await transition.mutateAsync(confirm);
              toast.success("Event updated");
            } catch (err) {
              toast.error(errorMessage(err));
              throw err;
            }
          }}
        >
          {COPY[confirm].body}
        </ConfirmDialog>
      )}
      {cancelling && (
        <ReasonDialog
          title="Cancel this event?"
          intro={<Text>Registered candidates are told the event is cancelled.</Text>}
          confirmLabel="Cancel event"
          onClose={() => setCancelling(false)}
          onSubmit={async (reason) => {
            await cancel.mutateAsync(reason);
            toast.success("Event cancelled");
          }}
        />
      )}
    </>
  );
}

function Dashboard({ event }: { event: EventOut }) {
  const styles = useStyles();
  const live = useEtagPoll<EventDashboardOut>(eventKeys.live(event.id, "dashboard"), eventPaths.dashboard(event.id));
  if (live.isPending) return <GridSkeleton />;
  if (live.isError && !live.data) return <ErrorBar title="Could not load the dashboard." message={errorMessage(live.error)} />;
  const d = live.data;
  const tiles: [string, string | number][] = [
    ["Registered", d.registered],
    ["Checked in", d.checked_in],
    ["Waiting", d.waiting],
    ["Called", d.called],
    ["In interview", d.in_interview],
    ["Interviewed", d.interviewed],
    ["Skipped", d.skipped],
    ["Left", d.left],
    ["Average wait", formatEta(d.average_wait_minutes).replace("About ", "")],
  ];
  return (
    <div className={styles.stack}>
      <section className={styles.tiles} aria-label="Live figures" aria-live="polite">
        {tiles.map(([k, v]) => (
          <div key={k} className={styles.tile}>
            <Text size={200} className={styles.muted}>
              {k}
            </Text>
            <span className={styles.value}>{typeof v === "number" ? v.toLocaleString() : v}</span>
          </div>
        ))}
      </section>
      {Object.keys(d.outcomes).length > 0 && (
        <section className={styles.card} aria-label="Outcomes">
          <Text weight="semibold">Interview outcomes</Text>
          <div className={styles.row}>
            {Object.entries(d.outcomes).map(([k, v]) => (
              <Badge key={k} appearance="outline">
                {k.replace(/_/g, " ")}: {v}
              </Badge>
            ))}
          </div>
        </section>
      )}
      <Text size={200} className={styles.muted}>
        Updates every 5 seconds.
      </Text>
    </div>
  );
}

const STATION_STATUS: Record<StationStatus, string> = { open: "Open", paused: "Paused", closed: "Closed" };

function StationsEditor({ event }: { event: EventOut }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { canManage } = useEventPermissions();
  const stations = useStations(event.id, canManage);
  const [adding, setAdding] = useState(false);
  const setStatus = useStationMutation(event.id, ({ s, status }: { s: StationOut; status: StationStatus }) => eventsApi.updateStation(event.id, s.id, { status }));
  if (!canManage) return <Text>Stations need event management permission.</Text>;
  if (stations.isPending) return <GridSkeleton />;
  if (stations.isError) return <ErrorBar title="Could not load stations." message={errorMessage(stations.error)} />;
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add station
        </Button>
      </div>
      {stations.data.length === 0 && <Text className={styles.muted}>No stations yet. Each interview table or room is a station.</Text>}
      {stations.data.map((s) => (
        <section key={s.id} className={styles.card} aria-label={s.label}>
          <div className={styles.row}>
            <Text weight="semibold" style={{ flex: 1 }}>
              {s.label}
            </Text>
            <Badge appearance="tint" color={s.status === "open" ? "success" : s.status === "paused" ? "warning" : "subtle"}>
              {STATION_STATUS[s.status]}
            </Badge>
            <Text size={200} className={styles.muted}>
              {s.interviewer_user_ids.length} interviewer{s.interviewer_user_ids.length === 1 ? "" : "s"}
              {s.demand_id ? ` · ${event.demands.find((d) => d.id === s.demand_id)?.title ?? "Demand"}` : " · Any Demand"}
            </Text>
          </div>
          <div className={styles.row}>
            <Button icon={<Person20Regular />} onClick={() => router.push(`/campus/events/${event.id}/station/${s.id}`)}>
              Open station view
            </Button>
            {(["open", "paused", "closed"] as const)
              .filter((st) => st !== s.status)
              .map((st) => (
                <Button
                  key={st}
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ s, status: st }, { onError: (err) => toast.error(errorMessage(err)) })}
                >
                  {st === "open" ? "Open" : st === "paused" ? "Pause" : "Close"}
                </Button>
              ))}
          </div>
        </section>
      ))}
      {adding && <AddStationDialog event={event} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStationDialog({ event, onClose }: { event: EventOut; onClose: () => void }) {
  const toast = useAppToast();
  const [label, setLabel] = useState("");
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [demandId, setDemandId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useStationMutation(event.id, () =>
    eventsApi.addStation(event.id, { label: label.trim(), interviewer_user_ids: people.map((p) => p.id), demand_id: demandId || null }),
  );
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !add.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add station</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Label" required hint="For example Table 3 or Room 204">
              <Input value={label} maxLength={100} onChange={(_, d) => setLabel(d.value)} />
            </Field>
            <PeoplePicker label="Interviewers" value={people} onChange={setPeople} />
            <Field label="Demand">
              <Dropdown
                value={event.demands.find((d) => d.id === demandId)?.title ?? "Any Demand"}
                selectedOptions={[demandId]}
                onOptionSelect={(_, d) => setDemandId(d.optionValue ?? "")}
              >
                <Option value="">Any Demand</Option>
                {event.demands.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.title}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={add.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={add.isPending}
              icon={add.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                if (!label.trim()) return setError("Give the station a label.");
                add.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Station added");
                    onClose();
                  },
                  onError: (err) => setError(errorMessage(err)),
                });
              }}
            >
              Add
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

const CHECKIN_LABELS: Record<CheckinStatus, string> = { registered: "Registered", checked_in: "Checked in", no_show: "No show", left: "Left" };

function CheckinsGrid({ event }: { event: EventOut }) {
  const admin = useAdminStyles();
  const [status, setStatus] = useState<CheckinStatus | "">("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const live = useEtagPoll<EventCheckinsOut>(eventKeys.live(event.id, "checkins"), eventPaths.checkins(event.id, status, dq));
  const columns: TableColumnDefinition<CheckinOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Candidate", renderCell: (c) => c.candidate_name ?? "—" }),
    createTableColumn({ columnId: "demand", renderHeaderCell: () => "Demand", renderCell: (c) => c.demand_title ?? "—" }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (c) => CHECKIN_LABELS[c.status] }),
    createTableColumn({ columnId: "method", renderHeaderCell: () => "How", renderCell: (c) => c.method.replace(/_/g, " ") }),
    createTableColumn({ columnId: "at", renderHeaderCell: () => "Checked in", renderCell: (c) => formatDateTime(c.checked_in_at) }),
    createTableColumn({
      columnId: "queue",
      renderHeaderCell: () => "Queue",
      renderCell: (c) => (c.queue_status ? `${QUEUE_STATUS_LABELS[c.queue_status]}${c.queue_position ? ` · #${c.queue_position}` : ""}` : "—"),
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search name or email" aria-label="Search check-ins" value={q} onChange={(_, d) => setQ(d.value)} />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? CHECKIN_LABELS[status] : "All"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus((d.optionValue ?? "") as CheckinStatus | "")}
        >
          <Option value="">All</Option>
          {(Object.keys(CHECKIN_LABELS) as CheckinStatus[]).map((s) => (
            <Option key={s} value={s}>
              {CHECKIN_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
      </div>
      <AdminGrid
        items={live.data?.items}
        columns={columns}
        getRowId={(c) => c.id}
        loading={live.isPending}
        error={live.error}
        emptyText="Nobody has registered yet."
        label="Check-ins"
      />
    </>
  );
}
