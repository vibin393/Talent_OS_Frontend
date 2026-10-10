"use client";

import {
  Badge,
  Button,
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
  MessageBar,
  MessageBarBody,
  Option,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { ArrowRight20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate } from "@/features/commercials/format";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { workforceApi } from "./api";
import { canCancelSlot, canConvertSlot, formatMonth, PERM_DEMAND_CREATE, PERM_WRITE, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS } from "./logic";
import type { ConvertOverrides, PlanOut, SlotOut, SlotStatus } from "./types";
import { usePlanSlots } from "./use-workforce";

/** Slots board: status tabs, multi-select open slots -> "Convert to Demands", cancel a slot. */
export function SlotsTab({ plan, onChanged }: { plan: PlanOut; onChanged: () => Promise<unknown> }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const canWrite = usePermission(PERM_WRITE);
  const canCreateDemand = usePermission(PERM_DEMAND_CREATE);
  const [status, setStatus] = useState<SlotStatus | "">("open");
  const slots = usePlanSlots(plan.id, status);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);
  const [cancelling, setCancelling] = useState<SlotOut | null>(null);
  const convertible = (slots.data ?? []).filter(canConvertSlot);
  const chosen = convertible.filter((s) => selected.has(s.id));
  const canConvert = canWrite && canCreateDemand;
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOn = convertible.length > 0 && chosen.length === convertible.length;

  const columns: TableColumnDefinition<SlotOut>[] = [
    ...(canConvert
      ? [
          createTableColumn<SlotOut>({
            columnId: "select",
            renderHeaderCell: () => (
              <Checkbox
                aria-label="Select all open slots"
                disabled={convertible.length === 0}
                checked={allOn ? true : chosen.length > 0 ? "mixed" : false}
                onChange={(_, d) => setSelected(d.checked ? new Set(convertible.map((s) => s.id)) : new Set())}
              />
            ),
            renderCell: (s) =>
              canConvertSlot(s) ? (
                <Checkbox
                  aria-label={`Select slot ${s.seq} of ${s.role_title ?? "line"}`}
                  checked={selected.has(s.id)}
                  onChange={(_, d) => toggle(s.id, !!d.checked)}
                />
              ) : null,
          }),
        ]
      : []),
    createTableColumn({
      columnId: "role",
      renderHeaderCell: () => "Role",
      renderCell: (s) => (
        <span className={admin.cellStack}>
          <Text weight="semibold">{s.role_title ?? "—"}</Text>
          <Text size={200} className={admin.muted}>{`Slot ${s.seq} · ${formatMonth(s.start_month)}`}</Text>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (s) => (
        <Badge appearance="tint" color={SLOT_STATUS_COLORS[s.status]}>
          {SLOT_STATUS_LABELS[s.status]}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "demand",
      renderHeaderCell: () => "Demand",
      renderCell: (s) =>
        s.demand_id ? (
          <span className={admin.cellStack}>
            <AppLink href={`/demands/${s.demand_id}`}>{s.demand_human_id ?? "Open demand"}</AppLink>
            {s.demand_status && (
              <Text size={200} className={admin.muted}>
                {s.demand_status.replace(/_/g, " ")}
              </Text>
            )}
          </span>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "dates",
      renderHeaderCell: () => "Updated",
      renderCell: (s) =>
        s.cancelled_at
          ? `Cancelled ${formatDate(s.cancelled_at)}${s.cancel_reason ? ` · ${s.cancel_reason}` : ""}`
          : s.filled_at
            ? `Filled ${formatDate(s.filled_at)}`
            : s.requisitioned_at
              ? `Requisitioned ${formatDate(s.requisitioned_at)}`
              : s.converted_at
                ? `Converted ${formatDate(s.converted_at)}`
                : "—",
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (s) => (
        <RowActions
          label={`slot ${s.seq}`}
          actions={canWrite && canCancelSlot(s) ? [{ label: "Cancel slot", icon: <Dismiss20Regular />, onClick: () => setCancelling(s) }] : []}
        />
      ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <TabList
          selectedValue={status}
          onTabSelect={(_, d) => {
            setStatus(d.value as SlotStatus | "");
            setSelected(new Set());
          }}
          aria-label="Slot status"
        >
          <Tab value="open">{`Open (${plan.slots.open})`}</Tab>
          <Tab value="requisitioned">{`Requisitioned (${plan.slots.requisitioned})`}</Tab>
          <Tab value="filled">{`Filled (${plan.slots.filled})`}</Tab>
          <Tab value="cancelled">{`Cancelled (${plan.slots.cancelled})`}</Tab>
          <Tab value="">All</Tab>
        </TabList>
        <span className={admin.grow} />
        {canConvert && (
          <Button appearance="primary" icon={<ArrowRight20Regular />} disabled={chosen.length === 0} onClick={() => setConverting(true)}>
            {chosen.length ? `Convert ${chosen.length} to Demands` : "Convert to Demands"}
          </Button>
        )}
      </div>
      {plan.status !== "approved" && plan.status !== "revision_draft" && (plan.slots.open + plan.slots.requisitioned + plan.slots.filled === 0) && (
        <Text as="p" size={200} className={admin.muted}>
          Slots are created when the plan is approved: one per approved headcount.
        </Text>
      )}
      <AdminGrid
        items={slots.data}
        columns={columns}
        getRowId={(s) => s.id}
        loading={slots.isPending}
        error={slots.error}
        emptyText="No slots in this status."
        label="Headcount slots"
      />
      {converting && (
        <ConvertDialog
          plan={plan}
          slots={chosen}
          onClose={() => setConverting(false)}
          onDone={async (n) => {
            toast.success(`${n} draft demand${n === 1 ? "" : "s"} created`);
            setSelected(new Set());
            await onChanged();
          }}
        />
      )}
      {cancelling && (
        <CancelSlotDialog
          slot={cancelling}
          onClose={() => setCancelling(null)}
          onDone={async () => {
            toast.success("Slot cancelled");
            await onChanged();
          }}
        />
      )}
    </>
  );
}

const PRIORITIES: NonNullable<ConvertOverrides["priority"]>[] = ["low", "medium", "high", "critical"];

function ConvertDialog({
  plan,
  slots,
  onClose,
  onDone,
}: {
  plan: PlanOut;
  slots: SlotOut[];
  onClose: () => void;
  onDone: (count: number) => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [needClient, setNeedClient] = useState(!plan.client_id);
  const [priority, setPriority] = useState<ConvertOverrides["priority"]>(null);
  const [target, setTarget] = useState("");
  const [start, setStart] = useState("");
  const convert = useMutation({
    mutationFn: () => {
      const overrides: ConvertOverrides = {};
      if (priority) overrides.priority = priority;
      if (target) overrides.target_closure_date = target;
      if (start) overrides.start_date = start;
      return workforceApi.convert({
        slot_ids: slots.map((s) => s.id),
        client_id: client?.id ?? null,
        overrides: Object.keys(overrides).length ? overrides : null,
      });
    },
    onSuccess: async (r) => {
      await onDone(r.converted.length);
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "client_required") setNeedClient(true);
    },
  });
  const clientMissing = needClient && !client;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !convert.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Convert ${slots.length} slot${slots.length === 1 ? "" : "s"} to Demands`}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <MessageBar intent="info">
                <MessageBarBody>One draft Demand is created per slot, linked to its plan line. Demand approval chains apply.</MessageBarBody>
              </MessageBar>
              <ErrorBar message={convert.error && !(isApiError(convert.error) && convert.error.code === "client_required") ? errorMessage(convert.error) : null} />
              {needClient && (
                <ClientPicker
                  label="Client for the Demands"
                  required
                  value={client?.id ?? null}
                  valueLabel={client?.name}
                  hint="This plan has no client; Demands need one."
                  validationMessage={convert.error && isApiError(convert.error) && convert.error.code === "client_required" && !client ? "Pick a client" : undefined}
                  onChange={setClient}
                />
              )}
              <Field label="Priority">
                <Dropdown
                  value={priority ? priority[0].toUpperCase() + priority.slice(1) : "Default"}
                  selectedOptions={[priority ?? ""]}
                  onOptionSelect={(_, d) => setPriority((d.optionValue || null) as ConvertOverrides["priority"])}
                >
                  <Option value="">Default</Option>
                  {PRIORITIES.map((p) => (
                    <Option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Target closure date">
                <Input type="date" value={target} onChange={(_, d) => setTarget(d.value)} />
              </Field>
              <Field label="Start date" hint="Defaults to the line's start month">
                <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={convert.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={clientMissing || convert.isPending} onClick={() => convert.mutate()}>
              Create draft Demands
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function CancelSlotDialog({ slot, onClose, onDone }: { slot: SlotOut; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => workforceApi.cancelSlot(slot.id, reason.trim()),
    onSuccess: async () => {
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !cancel.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Cancel slot ${slot.seq} of "${slot.role_title ?? "line"}"`}</DialogTitle>
          <DialogContent>
            <ErrorBar message={cancel.error ? errorMessage(cancel.error) : null} />
            <Field label="Reason" required>
              <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={cancel.isPending}>
              Keep slot
            </Button>
            <Button appearance="primary" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel slot
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
