"use client";

import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Switch,
  Text,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog, ErrorBar, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { dscApi, dscKeys } from "./api";
import { ClientName, useAllRegistrations, type RegistrationOption } from "./components";
import { DSC_ERROR_MESSAGES, EMPTY_POLICY_FORM, policyBody, type PolicyForm } from "./logic";
import type { DscPolicy } from "./types";

const regLabel = (r: RegistrationOption | undefined, id: string) => (r ? `${r.gstin} · ${r.legal_entity_name}` : id.slice(0, 8));

/** DSC policies: which GST Registration (+ optional Client) requires a DSC-signed invoice. */
export function DscPoliciesView() {
  const admin = useAdminStyles();
  const perms = usePermissions();
  const canEdit = hasAnyPermission(perms, ["dsc:configure"]);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: dscKeys.policies, queryFn: ({ signal }) => dscApi.policies(signal) });
  const regs = useAllRegistrations();
  const [editing, setEditing] = useState<DscPolicy | "new" | null>(null);
  const [deleting, setDeleting] = useState<DscPolicy | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const columns: TableColumnDefinition<DscPolicy>[] = [
    createTableColumn({
      columnId: "registration",
      renderHeaderCell: () => "GST registration",
      renderCell: (p) => regLabel(regs.data.find((r) => r.id === p.gst_registration_id), p.gst_registration_id),
    }),
    createTableColumn({
      columnId: "client",
      renderHeaderCell: () => "Client",
      renderCell: (p) => (p.client_id ? <ClientName id={p.client_id} /> : "All clients"),
    }),
    createTableColumn({
      columnId: "required",
      renderHeaderCell: () => "DSC",
      renderCell: (p) => (
        <Badge appearance="tint" color={p.required ? "brand" : "subtle"}>
          {p.required ? "Required" : "Not required"}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "signer", renderHeaderCell: () => "Signer", renderCell: (p) => p.signer_ref ?? "—" }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (p) => p.reason || "—" }),
    createTableColumn({ columnId: "location", renderHeaderCell: () => "Location", renderCell: (p) => p.location ?? "—" }),
    createTableColumn({
      columnId: "active",
      renderHeaderCell: () => "Status",
      renderCell: (p) => (
        <Badge appearance="tint" color={p.active ? "success" : "subtle"}>
          {p.active ? "Active" : "Inactive"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (p) =>
        canEdit ? (
          <span className={admin.badges}>
            <Button size="small" appearance="subtle" icon={<Edit20Regular />} aria-label="Edit policy" onClick={() => setEditing(p)} />
            <Button size="small" appearance="subtle" icon={<Delete20Regular />} aria-label="Delete policy" onClick={() => setDeleting(p)} />
          </span>
        ) : null,
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <div className={admin.grow} />
        {canEdit && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            New policy
          </Button>
        )}
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : deleteError} />
      <div className={admin.surface}>
        {!q.data ? (
          <GridSkeleton />
        ) : q.data.length === 0 ? (
          <div className={admin.empty}>No DSC policies. Invoices are issued without a digital signature.</div>
        ) : (
          <DataGrid items={q.data} columns={columns} getRowId={(p) => p.id} aria-label="DSC policies" className={admin.grid}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<DscPolicy>>
              {({ item, rowId }) => (
                <DataGridRow<DscPolicy> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>
      {editing && (
        <PolicyDialog policy={editing === "new" ? null : editing} registrations={regs.data} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete DSC policy?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setDeleteError(null);
          try {
            await dscApi.deletePolicy(deleting.id);
            await qc.invalidateQueries({ queryKey: dscKeys.policies });
          } catch (e) {
            setDeleteError(errorMessage(e));
            throw e;
          }
        }}
      >
        New invoices for this registration will no longer require a digital signature. Pending signatures are kept.
      </ConfirmDialog>
    </>
  );
}

function PolicyDialog({
  policy,
  registrations,
  onClose,
}: {
  policy: DscPolicy | null;
  registrations: RegistrationOption[];
  onClose: () => void;
}) {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [f, setF] = useState<PolicyForm>(
    policy
      ? {
          gst_registration_id: policy.gst_registration_id,
          client_id: policy.client_id,
          required: policy.required,
          signer_ref: policy.signer_ref ?? "",
          reason: policy.reason ?? "",
          location: policy.location ?? "",
          active: policy.active,
        }
      : EMPTY_POLICY_FORM,
  );
  const [clientLabel, setClientLabel] = useState<string | undefined>(undefined);
  const set = <K extends keyof PolicyForm>(k: K, v: PolicyForm[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const m = useMutation({
    mutationFn: () => {
      const body = policyBody(f);
      if (policy) {
        const { gst_registration_id: _g, client_id: _c, ...patch } = body;
        void _g;
        void _c;
        return dscApi.updatePolicy(policy.id, patch);
      }
      return dscApi.createPolicy(body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dscKeys.policies });
      onClose();
    },
  });
  const selectedReg = registrations.find((r) => r.id === f.gst_registration_id);
  const err = m.error
    ? isApiError(m.error) && DSC_ERROR_MESSAGES[m.error.code]
      ? DSC_ERROR_MESSAGES[m.error.code]
      : errorMessage(m.error)
    : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{policy ? "Edit DSC policy" : "New DSC policy"}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <Field label="GST registration" required>
                <Dropdown
                  disabled={!!policy}
                  placeholder="Select a GST registration"
                  value={selectedReg ? regLabel(selectedReg, selectedReg.id) : ""}
                  selectedOptions={f.gst_registration_id ? [f.gst_registration_id] : []}
                  onOptionSelect={(_, d) => d.optionValue && set("gst_registration_id", d.optionValue)}
                >
                  {registrations.map((r) => (
                    <Option key={r.id} value={r.id} text={regLabel(r, r.id)}>
                      {regLabel(r, r.id)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {policy ? (
                <Field label="Client">
                  <Text>{policy.client_id ? <ClientName id={policy.client_id} /> : "All clients"}</Text>
                </Field>
              ) : (
                <ClientPicker
                  label="Client"
                  value={f.client_id}
                  valueLabel={f.client_id ? clientLabel : "All clients"}
                  clearLabel="All clients"
                  hint="Leave as All clients to apply to every client of this registration."
                  onChange={(c) => {
                    set("client_id", c?.id ?? null);
                    setClientLabel(c?.name);
                  }}
                />
              )}
              <Switch label="Digital signature required" checked={f.required} onChange={(_, d) => set("required", d.checked)} />
              <Field label="Signer reference" hint="Token / certificate alias used by the signing adapter.">
                <Input value={f.signer_ref} onChange={(_, d) => set("signer_ref", d.value)} />
              </Field>
              <Field label="Reason" hint="Shown in the PDF signature, e.g. &quot;Invoice authentication&quot;.">
                <Input value={f.reason} onChange={(_, d) => set("reason", d.value)} />
              </Field>
              <Field label="Location">
                <Input value={f.location} onChange={(_, d) => set("location", d.value)} />
              </Field>
              <Switch label="Active" checked={f.active} onChange={(_, d) => set("active", d.checked)} />
              <ErrorBar message={err} />
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!f.gst_registration_id || m.isPending} onClick={() => m.mutate()}>
              {policy ? "Save" : "Create"}
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
