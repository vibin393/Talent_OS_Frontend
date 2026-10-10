"use client";

import {
  Button,
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
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { placementKeys, placementsApi } from "./api";
import { DROP_REASON_LABELS, formatMoney, formatPct, GATE_LABELS, isRate, todayIso, unmetGatesFrom } from "./format";
import type { DropReason, MarginOut, PlacementOut, StartGateOut, UnmetGate } from "./types";

function useInvalidate(id: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: placementKeys.all });
    void qc.invalidateQueries({ queryKey: placementKeys.detail(id) });
  };
}

/** The unmet gates of a refused Mark Joined, rendered inline (409 `start_gates_unmet`). */
export function UnmetGatesBar({ gates }: { gates: UnmetGate[] }) {
  return (
    <MessageBar intent="error" layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>Start gates are not met</MessageBarTitle>
        <ul>
          {gates.map((g) => (
            <li key={g.id}>
              {g.label} — {GATE_LABELS[g.status] ?? g.status}
            </li>
          ))}
        </ul>
      </MessageBarBody>
    </MessageBar>
  );
}

/** Mark Joined: actual start date + gate summary; a 409 shows the unmet gates inline. */
export function MarkJoinedDialog({ placement, gates, onClose }: { placement: PlacementOut; gates: StartGateOut[]; onClose: () => void }) {
  const [date, setDate] = useState(todayIso());
  const invalidate = useInvalidate(placement.id);
  const join = useMutation({
    mutationFn: () => placementsApi.join(placement.id, date),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const unmet = unmetGatesFrom(join.error);
  const open = gates.filter((g) => g.required && !["met", "waived", "not_required"].includes(g.status));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Mark {placement.candidate_name ?? "worker"} as joined</DialogTitle>
          <DialogContent>
            <Field label="Actual start date" required>
              <Input type="date" value={date} max={todayIso()} onChange={(_, d) => setDate(d.value)} />
            </Field>
            <Text block>
              {open.length === 0 ? "All required start gates are clear." : `${open.length} start gate(s) still open.`}
            </Text>
            {unmet && <UnmetGatesBar gates={unmet} />}
            {join.isError && !unmet && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(join.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!date || join.isPending} onClick={() => join.mutate()}>
              Mark joined
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function DropDialog({ placement, onClose }: { placement: PlacementOut; onClose: () => void }) {
  const [reason, setReason] = useState<DropReason>("declined");
  const [note, setNote] = useState("");
  const invalidate = useInvalidate(placement.id);
  const drop = useMutation({
    mutationFn: () => placementsApi.drop(placement.id, reason, note || null),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Drop {placement.human_id}</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Dropdown value={DROP_REASON_LABELS[reason]} selectedOptions={[reason]} onOptionSelect={(_, d) => setReason(d.optionValue as DropReason)}>
                {(Object.keys(DROP_REASON_LABELS) as DropReason[]).map((r) => (
                  <Option key={r} value={r}>
                    {DROP_REASON_LABELS[r]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Note">
              <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
            </Field>
            {drop.isError && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(drop.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={drop.isPending} onClick={() => drop.mutate()}>
              Drop placement
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function OverrideDialog({ placement, gates, onClose }: { placement: PlacementOut; gates: StartGateOut[]; onClose: () => void }) {
  const candidates = gates.filter((g) => g.required && !["met", "waived", "not_required"].includes(g.status));
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const invalidate = useInvalidate(placement.id);
  const qc = useQueryClient();
  const req = useMutation({
    mutationFn: () => placementsApi.requestOverride(placement.id, selected, reason.trim()),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: placementKeys.gates(placement.id) });
      void qc.invalidateQueries({ queryKey: placementKeys.overrides(placement.id) });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Request a start-gate override</DialogTitle>
          <DialogContent>
            {candidates.length === 0 && <Text>No open gates to override.</Text>}
            {candidates.map((g) => (
              <Checkbox
                key={g.id}
                disabled={g.status === "failed" && !g.overridable}
                label={`${g.label ?? g.kind} (${GATE_LABELS[g.status]})${g.status === "failed" && !g.overridable ? " — not overridable" : ""}`}
                checked={selected.includes(g.id)}
                onChange={(_, d) => setSelected((s) => (d.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))}
              />
            ))}
            <Field label="Reason" required validationMessage={reason && reason.trim().length < 10 ? "At least 10 characters" : undefined}>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {req.isError && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(req.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!selected.length || reason.trim().length < 10 || req.isPending} onClick={() => req.mutate()}>
              Request override
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Add rate segment with a debounced live margin preview. */
export function AddSegmentDialog({ placement, onClose }: { placement: PlacementOut; onClose: () => void }) {
  const [from, setFrom] = useState(todayIso());
  const [pay, setPay] = useState("");
  const [bill, setBill] = useState("");
  const [burden, setBurden] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<MarginOut | null>(null);
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () =>
      placementsApi.addSegment(placement.id, {
        effective_from: from,
        pay_rate: pay || null,
        bill_rate: bill || null,
        burden_pct: burden || null,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: placementKeys.segments(placement.id) });
      onClose();
    },
  });
  useEffect(() => {
    if ((pay && !isRate(pay)) || (bill && !isRate(bill)) || !bill) {
      return;
    }
    const t = setTimeout(() => {
      placementsApi
        .marginPreview({ pay_rate: pay || null, bill_rate: bill, burden_pct: burden || null, currency: placement.currency })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [pay, bill, burden, placement.currency]);
  const ok = from && reason.trim() && (pay || bill) && (!pay || isRate(pay)) && (!bill || isRate(bill));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add rate segment</DialogTitle>
          <DialogContent>
            <Field label="Effective from" required>
              <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
            </Field>
            <Field label="Pay rate">
              <Input inputMode="decimal" value={pay} onChange={(_, d) => setPay(d.value)} />
            </Field>
            <Field label="Bill rate">
              <Input inputMode="decimal" value={bill} onChange={(_, d) => setBill(d.value)} />
            </Field>
            <Field label="Burden %">
              <Input inputMode="decimal" value={burden} onChange={(_, d) => setBurden(d.value)} />
            </Field>
            <Field label="Reason" required>
              <Input value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {preview && bill && (
              <MessageBar intent={preview.below_minimum ? "warning" : "info"}>
                <MessageBarBody>
                  Margin {formatMoney(preview.margin_amount, placement.currency)} ({formatPct(preview.margin_pct)})
                  {preview.below_minimum ? " — below the minimum; needs approval" : ""}
                </MessageBarBody>
              </MessageBar>
            )}
            {add.isError && (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(add.error)}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!ok || add.isPending} onClick={() => add.mutate()}>
              Add segment
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Small helper used by the detail page: segments loaded once per placement. */
export function useSegments(id: string) {
  return useQuery({ queryKey: placementKeys.segments(id), queryFn: ({ signal }) => placementsApi.segments(id, signal) });
}
