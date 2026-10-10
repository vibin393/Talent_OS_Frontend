"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Field,
  Input,
  Link,
  makeStyles,
  ProgressBar,
  type TableColumnDefinition,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { DEFAULT_CLIENT_SORT, EMPTY_CLIENT_FILTERS } from "@/features/clients/query";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { type PoFilters, commercialsApi, commercialsKeys } from "../api";
import { formatDate, formatHours, formatMoney, PO_VALIDITY, poProgressColor, poProgressValue } from "../format";
import type { PurchaseOrderIn, PurchaseOrderOut } from "../types";

const useStyles = makeStyles({ bar: { minWidth: "140px" }, small: { color: tokens.colorNeutralForeground3 } });

export function PoConsumptionBar({ po }: { po: PurchaseOrderOut }) {
  const styles = useStyles();
  const amount = po.value_cap ? `${formatMoney(po.consumed_amount, po.currency)} of ${formatMoney(po.value_cap, po.currency)}` : null;
  const hours = po.hours_cap ? `${formatHours(po.consumed_hours)} of ${formatHours(po.hours_cap)}` : null;
  return (
    <div className={styles.bar}>
      <ProgressBar
        value={poProgressValue(po.pct_used)}
        color={poProgressColor(po.pct_used)}
        thickness="large"
        aria-label={`${po.pct_used ?? 0}% consumed`}
      />
      <span className={styles.small}>{[amount, hours].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

export function PoValidityBadge({ po }: { po: PurchaseOrderOut }) {
  if (po.status === "closed" || po.status === "cancelled") {
    return <Badge appearance="tint" color="subtle">{po.status === "closed" ? "Closed" : "Cancelled"}</Badge>;
  }
  const v = PO_VALIDITY[po.validity];
  return (
    <Badge appearance="tint" color={v.color}>
      {v.label}
    </Badge>
  );
}

export function PurchaseOrdersGrid({ filters, emptyText }: { filters: PoFilters; emptyText: string }) {
  const router = useRouter();
  const list = useQuery({ queryKey: commercialsKeys.purchaseOrders(filters), queryFn: ({ signal }) => commercialsApi.purchaseOrders(filters, signal) });
  const columns: TableColumnDefinition<PurchaseOrderOut>[] = [
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "PO number",
      renderCell: (p) => (
        <Link as="button" onClick={() => router.push(`/purchase-orders/${p.id}`)}>
          {p.po_number}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "validity", renderHeaderCell: () => "Validity", renderCell: (p) => <PoValidityBadge po={p} /> }),
    createTableColumn({ columnId: "range", renderHeaderCell: () => "Valid", renderCell: (p) => `${formatDate(p.valid_from)} – ${formatDate(p.valid_to)}` }),
    createTableColumn({ columnId: "consumption", renderHeaderCell: () => "Consumption", renderCell: (p) => <PoConsumptionBar po={p} /> }),
    createTableColumn({
      columnId: "remaining",
      renderHeaderCell: () => "Remaining",
      renderCell: (p) => (p.remaining_amount !== null ? formatMoney(p.remaining_amount, p.currency) : formatHours(p.remaining_hours)),
    }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(p) => p.id}
      loading={list.isPending}
      error={list.error}
      emptyText={emptyText}
      label="Purchase orders"
      onRowClick={(p) => router.push(`/purchase-orders/${p.id}`)}
    />
  );
}

/** `/purchase-orders`: consumption bars, derived validity and the expiring / over-80 % filters. */
export function PurchaseOrdersView() {
  const admin = useAdminStyles();
  const canRead = usePermission("po:read");
  const canWrite = usePermission("po:write");
  const [expiring, setExpiring] = useState(false);
  const [over, setOver] = useState(false);
  const [creating, setCreating] = useState(false);
  if (!canRead) return <NoAccess what="purchase orders" />;
  const filters: PoFilters = { expiring_within_days: expiring ? 30 : undefined, over_pct: over ? 80 : undefined };
  return (
    <>
      <PageHeader title="Purchase orders" subtitle="Client POs and how much of each has been invoiced" />
      <div className={admin.toolbar}>
        <ToggleButton shape="circular" checked={expiring} onClick={() => setExpiring((v) => !v)}>
          Expiring in 30 days
        </ToggleButton>
        <ToggleButton shape="circular" checked={over} onClick={() => setOver((v) => !v)}>
          Over 80 % used
        </ToggleButton>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New PO
          </Button>
        )}
      </div>
      <PurchaseOrdersGrid filters={filters} emptyText="No purchase orders match these filters." />
      {creating && <PoDrawer onClose={() => setCreating(false)} />}
    </>
  );
}

/** Client 360 "POs" tab. */
export function ClientPurchaseOrdersTab({ clientId }: { clientId: string }) {
  const admin = useAdminStyles();
  const canWrite = usePermission("po:write");
  const [creating, setCreating] = useState(false);
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <span className={admin.grow} />
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New PO
          </Button>
        </div>
      )}
      <PurchaseOrdersGrid filters={{ client_id: clientId }} emptyText="No purchase orders for this client." />
      {creating && <PoDrawer clientId={clientId} onClose={() => setCreating(false)} />}
    </>
  );
}

const nullable = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function PoDrawer({ clientId, onClose }: { clientId?: string; onClose: () => void }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PurchaseOrderIn>({
    client_id: clientId ?? "",
    legal_entity_id: "",
    po_number: "",
    currency: "INR",
    value_cap: null,
    hours_cap: null,
    valid_from: "",
    valid_to: "",
  });
  const set = <K extends keyof PurchaseOrderIn>(key: K, value: PurchaseOrderIn[K]) => setForm((f) => ({ ...f, [key]: value }));
  const clients = useQuery({
    queryKey: [...clientKeys.lists, "commercials-picker"],
    queryFn: ({ signal }) => clientsApi.list(EMPTY_CLIENT_FILTERS, DEFAULT_CLIENT_SORT, 1, 100, signal),
    enabled: !clientId,
  });
  const entities = useQuery({ queryKey: commercialsKeys.legalEntities, queryFn: ({ signal }) => commercialsApi.legalEntities(signal) });
  const contracts = useQuery({
    queryKey: commercialsKeys.clientContracts(form.client_id),
    queryFn: ({ signal }) => commercialsApi.clientContracts(form.client_id, signal),
    enabled: !!form.client_id,
  });
  const create = useMutation({
    mutationFn: () => commercialsApi.createPurchaseOrder({ ...form, value_cap: nullable(form.value_cap), hours_cap: nullable(form.hours_cap) }),
    onSuccess: async (po) => {
      await queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
      router.push(`/purchase-orders/${po.id}`);
    },
  });
  const errors = fieldErrors(create.error);
  const valid = !!form.client_id && !!form.legal_entity_id && !!form.po_number.trim() && !!form.valid_from && !!form.valid_to && (!!nullable(form.value_cap) || !!nullable(form.hours_cap));
  return (
    <DetailsDrawer
      open
      title="New purchase order"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={create.error && !Object.keys(errors).length ? errorMessage(create.error) : null} />
        {!clientId && (
          <IdSelect
            label="Client"
            options={(clients.data?.items ?? []).map((c) => ({ id: c.id, label: c.name }))}
            value={form.client_id || null}
            onChange={(v) => set("client_id", v ?? "")}
          />
        )}
        <IdSelect label="Legal entity" options={(entities.data ?? []).map((e) => ({ id: e.id, label: e.name }))} value={form.legal_entity_id || null} onChange={(v) => set("legal_entity_id", v ?? "")} />
        <IdSelect
          label="Contract"
          options={(contracts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: `${c.human_id} · ${c.title ?? ""}` }))}
          value={form.contract_id ?? null}
          noneLabel="No contract"
          onChange={(v) => set("contract_id", v)}
        />
        <Field label="PO number" required validationMessage={errors.po_number}>
          <Input value={form.po_number} onChange={(_, d) => set("po_number", d.value)} />
        </Field>
        <Field label="Value cap" hint="A value cap, an hours cap or both" validationMessage={errors.value_cap}>
          <Input value={form.value_cap ?? ""} inputMode="decimal" contentAfter={form.currency} onChange={(_, d) => set("value_cap", d.value)} />
        </Field>
        <Field label="Hours cap" validationMessage={errors.hours_cap}>
          <Input value={form.hours_cap ?? ""} inputMode="decimal" onChange={(_, d) => set("hours_cap", d.value)} />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} maxLength={3} onChange={(_, d) => set("currency", d.value.toUpperCase())} />
        </Field>
        <Field label="Valid from" required>
          <Input type="date" value={form.valid_from} onChange={(_, d) => set("valid_from", d.value)} />
        </Field>
        <Field label="Valid to" required>
          <Input type="date" value={form.valid_to} onChange={(_, d) => set("valid_to", d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
