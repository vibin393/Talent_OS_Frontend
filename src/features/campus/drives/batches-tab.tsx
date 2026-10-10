"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Checkbox,
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
  Spinner,
  SpinButton,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowSwap20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { campusApi, campusKeys } from "../api";
import { buildSlotGrid, formatDate, moveTargets, panelsBody, previewAssignment, timeLabel, validateBatch } from "../logic";
import { type PersonRef, PeoplePicker } from "../pickers";
import type { BatchOut, DriveOut, SlotOut } from "../types";
import { useCampusStyles } from "../ui";
import { useBatches, useCampusPermissions, useInvalidateDrive } from "../use-campus";

const useStyles = makeStyles({
  grid: { borderCollapse: "collapse", minWidth: "100%", fontSize: tokens.fontSizeBase200 },
  th: {
    position: "sticky",
    top: 0,
    textAlign: "start",
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    whiteSpace: "nowrap",
  },
  time: { padding: tokens.spacingHorizontalS, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: tokens.colorNeutralForeground2 },
  cell: { padding: "2px", minWidth: "140px", verticalAlign: "top" },
  slot: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    minHeight: "36px",
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} dashed ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
  filled: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
  },
  name: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** Interview batches: create a day with panels, Auto-slot shortlisted students, move slots. */
export function BatchesTab({ drive }: { drive: DriveOut }) {
  const c = useCampusStyles();
  const { canManage } = useCampusPermissions();
  const batches = useBatches(drive.id);
  const [creating, setCreating] = useState(false);
  if (batches.isPending) return <GridSkeleton />;
  if (batches.isError) return <ErrorBar title="Could not load batches." message={errorMessage(batches.error)} />;
  return (
    <div className={c.stack}>
      <div className={c.row}>
        <Body1 className={c.grow}>Each slot becomes a P1 interview for the student placed in it.</Body1>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} disabled={drive.demands.length === 0} onClick={() => setCreating(true)}>
            New batch
          </Button>
        )}
      </div>
      {batches.data.length === 0 && <span className={c.muted}>No interview batches yet.</span>}
      {batches.data.map((b) => (
        <BatchCard key={b.id} drive={drive} batch={b} canManage={canManage} />
      ))}
      {creating && <CreateBatchDialog drive={drive} onClose={() => setCreating(false)} />}
    </div>
  );
}

function BatchCard({ drive, batch, canManage }: { drive: DriveOut; batch: BatchOut; canManage: boolean }) {
  const styles = useStyles();
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const [autoSlot, setAutoSlot] = useState(false);
  const [moving, setMoving] = useState<SlotOut | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const grid = buildSlotGrid(batch);
  const editable = canManage && (batch.status === "draft" || batch.status === "scheduled");

  return (
    <section className={c.card} aria-label={`Batch ${formatDate(batch.date)}`}>
      <div className={styles.head}>
        <Subtitle2 as="h3" className={c.grow}>
          {formatDate(batch.date)} · {batch.start_time.slice(0, 5)}–{batch.end_time.slice(0, 5)} · {batch.demand_title ?? "Demand"}
        </Subtitle2>
        <Badge appearance="tint" color={batch.status === "cancelled" ? "danger" : batch.status === "completed" ? "success" : "brand"}>
          {batch.status}
        </Badge>
        <Text className={c.num}>
          {batch.filled_count}/{batch.slot_count} slots filled
        </Text>
        {editable && (
          <>
            <Button appearance="primary" onClick={() => setAutoSlot(true)}>
              Auto-slot
            </Button>
            <Button onClick={() => setCancelling(true)}>Cancel batch</Button>
          </>
        )}
      </div>
      <Caption1 className={c.muted}>
        {batch.slot_minutes}-minute slots · {batch.timezone} · {batch.panels.length} panel{batch.panels.length === 1 ? "" : "s"}
        {batch.send_sms ? " · SMS reminders" : ""}
      </Caption1>
      <div className={c.tableWrap} style={{ maxHeight: 480, overflowY: "auto" }}>
        <table className={styles.grid} aria-label="Slot grid">
          <thead>
            <tr>
              <th className={styles.th} scope="col">
                Time
              </th>
              {grid.panels.map((p) => (
                <th key={p.index} className={styles.th} scope="col">
                  {p.label}
                  {batch.panels[p.index]?.room ? ` · ${batch.panels[p.index].room}` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.times.map((t, ti) => (
              <tr key={t}>
                <th scope="row" className={styles.time}>
                  {timeLabel(t, batch.timezone)}
                </th>
                {grid.panels.map((p) => {
                  const s = p.cells[ti];
                  return (
                    <td key={p.index} className={styles.cell}>
                      {s ? (
                        <div className={`${styles.slot} ${s.registration_id ? styles.filled : ""}`}>
                          <span className={styles.name}>{s.registration_id ? (s.candidate_name ?? "Student") : "Free"}</span>
                          {s.registration_id && editable && (
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<ArrowSwap20Regular />}
                              aria-label={`Move ${s.candidate_name ?? "student"} at ${timeLabel(t, batch.timezone)}`}
                              onClick={() => setMoving(s)}
                            />
                          )}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {autoSlot && <AutoSlotDialog drive={drive} batch={batch} onClose={() => setAutoSlot(false)} />}
      {moving && <MoveSlotDialog drive={drive} batch={batch} slot={moving} onClose={() => setMoving(null)} />}
      <ConfirmDialog
        open={cancelling}
        title="Cancel this batch?"
        confirmLabel="Cancel batch"
        onClose={() => setCancelling(false)}
        onConfirm={async () => {
          try {
            await campusApi.cancelBatch(batch.id);
            await invalidate();
            toast.success("Batch cancelled");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Scheduled interviews in this batch are cancelled and students are notified.
      </ConfirmDialog>
    </section>
  );
}

function AutoSlotDialog({ drive, batch, onClose }: { drive: DriveOut; batch: BatchOut; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shortlisted = useQuery({
    queryKey: [...campusKeys.registrationsRoot(drive.id), "shortlisted-for-slots"],
    queryFn: ({ signal }) => campusApi.registrations(drive.id, { status: ["shortlisted"] }, 500, 0, signal),
  });
  const slotted = new Set(batch.slots.map((s) => s.registration_id).filter(Boolean));
  const names = (shortlisted.data?.items ?? []).filter((r) => !slotted.has(r.id)).map((r) => r.candidate_name ?? "Student");
  const preview = previewAssignment(batch, names);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await campusApi.autoSlot(batch.id);
      await invalidate();
      toast.success(`${out.slotted} slotted, ${out.unslotted} not slotted`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Auto-slot shortlisted students</DialogTitle>
          <DialogContent className={c.stack}>
            {shortlisted.isPending ? (
              <Spinner size="small" label="Checking shortlisted students…" />
            ) : (
              <Body1 aria-live="polite">
                {preview.free} free slot{preview.free === 1 ? "" : "s"} · {names.length} shortlisted student{names.length === 1 ? "" : "s"} not yet
                slotted. About {preview.assigned.length} would be placed
                {preview.unassigned.length ? `; ${preview.unassigned.length} would wait for another batch` : ""}. Each placed student
                is notified and gets an interview.
              </Body1>
            )}
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void run()}>
              Auto-slot
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function MoveSlotDialog({ drive, batch, slot, onClose }: { drive: DriveOut; batch: BatchOut; slot: SlotOut; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const targets = moveTargets(batch, slot.id);
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = (s: SlotOut) => `${batch.panels[s.panel_index]?.label ?? `Panel ${s.panel_index + 1}`} · ${timeLabel(s.starts_at, batch.timezone)}`;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await campusApi.moveSlot(batch.id, slot.id, to);
      await invalidate();
      toast.success("Slot moved; the interview was rescheduled");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Move {slot.candidate_name ?? "student"}</DialogTitle>
          <DialogContent className={c.stack}>
            {targets.length === 0 ? (
              <Body1>There are no free slots in this batch.</Body1>
            ) : (
              <Field label="Move to">
                <Dropdown value={targets.find((t) => t.id === to) ? label(targets.find((t) => t.id === to) as SlotOut) : ""} selectedOptions={[to]} onOptionSelect={(_, d) => setTo(d.optionValue ?? "")}>
                  {targets.map((t) => (
                    <Option key={t.id} value={t.id}>
                      {label(t)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy || !to} onClick={() => void run()}>
              Move
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

type PanelDraft = { label: string; people: PersonRef[]; room: string; video_link: string };

function CreateBatchDialog({ drive, onClose }: { drive: DriveOut; onClose: () => void }) {
  const c = useCampusStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDrive(drive.id);
  const [demandId, setDemandId] = useState(drive.demands[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("17:30");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [minutes, setMinutes] = useState(30);
  const [sms, setSms] = useState(false);
  const [panels, setPanels] = useState<PanelDraft[]>([{ label: "Panel 1", people: [], room: "", video_link: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPanel = (i: number, patch: Partial<PanelDraft>) => setPanels((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async () => {
    const body = {
      demand_id: demandId,
      date,
      start_time: start,
      end_time: end,
      timezone: tz.trim() || "Asia/Kolkata",
      slot_minutes: minutes,
      send_sms: sms,
      panels: panelsBody(panels.map((p) => ({ ...p, interviewer_user_ids: p.people.map((x) => x.id) }))),
    };
    const problem = validateBatch(body);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await campusApi.createBatch(drive.id, body);
      await invalidate();
      toast.success("Batch created");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>New interview batch</DialogTitle>
          <DialogContent className={c.stack}>
            <div className={c.grid2}>
              <Field label="Demand" required>
                <Dropdown value={drive.demands.find((d) => d.id === demandId)?.title ?? ""} selectedOptions={[demandId]} onOptionSelect={(_, d) => setDemandId(d.optionValue ?? "")}>
                  {drive.demands.map((d) => (
                    <Option key={d.id} value={d.id}>
                      {d.title}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Date" required>
                <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
              </Field>
              <Field label="Starts" required>
                <Input type="time" value={start} onChange={(_, d) => setStart(d.value)} />
              </Field>
              <Field label="Ends" required>
                <Input type="time" value={end} onChange={(_, d) => setEnd(d.value)} />
              </Field>
              <Field label="Time zone">
                <Input value={tz} maxLength={64} onChange={(_, d) => setTz(d.value)} />
              </Field>
              <Field label="Slot length (minutes)">
                <SpinButton value={minutes} min={15} max={180} step={5} onChange={(_, d) => setMinutes(Number(d.value ?? d.displayValue ?? minutes))} />
              </Field>
            </div>
            <Checkbox label="Send SMS reminders (to students who opted in)" checked={sms} onChange={(_, d) => setSms(Boolean(d.checked))} />
            {panels.map((p, i) => (
              <fieldset key={i} className={c.stack} style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 4, padding: 12 }}>
                <legend>Panel {i + 1}</legend>
                <div className={c.grid2}>
                  <Field label="Label" required>
                    <Input value={p.label} maxLength={100} onChange={(_, d) => setPanel(i, { label: d.value })} />
                  </Field>
                  <Field label="Room">
                    <Input value={p.room} maxLength={300} onChange={(_, d) => setPanel(i, { room: d.value })} />
                  </Field>
                  <Field label="Video link">
                    <Input type="url" value={p.video_link} maxLength={2000} onChange={(_, d) => setPanel(i, { video_link: d.value })} />
                  </Field>
                </div>
                <PeoplePicker label="Interviewers" value={p.people} onChange={(people) => setPanel(i, { people })} />
                {panels.length > 1 && (
                  <div>
                    <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => setPanels((ps) => ps.filter((_, j) => j !== i))}>
                      Remove panel
                    </Button>
                  </div>
                )}
              </fieldset>
            ))}
            <div>
              <Button
                icon={<Add20Regular />}
                disabled={panels.length >= 30}
                onClick={() => setPanels((ps) => [...ps, { label: `Panel ${ps.length + 1}`, people: [], room: "", video_link: "" }])}
              >
                Add panel
              </Button>
            </div>
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void submit()}>
              Create batch
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
