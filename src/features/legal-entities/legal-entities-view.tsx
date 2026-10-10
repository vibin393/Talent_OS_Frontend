"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Field,
  Input,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { legalEntitiesApi, legalEntityKeys } from "./api";
import type { LegalEntityOut } from "./types";

/** `/settings/legal-entities`: the tenant's companies with status and invoicing readiness (FR-76). */
export function LegalEntitiesView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("legal_entity:read");
  const canWrite = usePermission("legal_entity:write");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const list = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal), enabled: canRead });
  const ids = (list.data ?? []).map((e) => e.id);
  const readiness = useQueries({
    queries: ids.map((id) => ({
      queryKey: legalEntityKeys.readiness(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => legalEntitiesApi.readiness(id, signal),
    })),
  });
  const registrations = useQueries({
    queries: ids.map((id) => ({
      queryKey: legalEntityKeys.registrations(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => legalEntitiesApi.registrations(id, signal),
    })),
  });
  const readyOf = new Map(ids.map((id, i) => [id, readiness[i]?.data]));
  const gstCountOf = new Map(ids.map((id, i) => [id, registrations[i]?.data?.filter((r) => r.status === "active").length]));

  const create = useMutation({
    mutationFn: () => legalEntitiesApi.create({ name: name.trim(), legal_name: (legalName || name).trim() }),
    onSuccess: async (entity) => {
      setCreating(false);
      setName("");
      setLegalName("");
      await queryClient.invalidateQueries({ queryKey: legalEntityKeys.all });
      router.push(`/settings/legal-entities/${entity.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!canRead) return <NoAccess what="legal entities" />;

  const columns: TableColumnDefinition<LegalEntityOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (e) => (
        <span className={admin.cellStack}>
          <span>{e.name}</span>
          <span className={admin.muted}>{e.legal_name}</span>
        </span>
      ),
      compare: (a, b) => a.name.localeCompare(b.name),
    }),
    createTableColumn({ columnId: "pan", renderHeaderCell: () => "PAN", renderCell: (e) => e.pan ?? "—" }),
    createTableColumn({ columnId: "state", renderHeaderCell: () => "State", renderCell: (e) => e.state_code ?? "—" }),
    createTableColumn({ columnId: "currency", renderHeaderCell: () => "Currency", renderCell: (e) => e.default_currency }),
    createTableColumn({ columnId: "gst", renderHeaderCell: () => "GST registrations", renderCell: (e) => gstCountOf.get(e.id) ?? "…" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (e) => {
        const ready = readyOf.get(e.id);
        return (
          <span className={admin.badges}>
            <Badge appearance="tint" color={e.status === "active" ? "success" : "subtle"}>
              {e.status === "active" ? "Active" : "Inactive"}
            </Badge>
            {ready && (
              <Badge appearance="tint" color={ready.ready_for_invoicing ? "brand" : "warning"}>
                {ready.ready_for_invoicing ? "Ready for invoicing" : "Not ready for invoicing"}
              </Badge>
            )}
          </span>
        );
      },
    }),
  ];

  return (
    <>
      <PageHeader title="Legal entities" subtitle="The companies that contract, invoice and employ: PAN, GST registrations and bank accounts" />
      <div className={admin.toolbar}>
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            Add legal entity
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(e) => e.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No legal entities."
        label="Legal entities"
        sortable
        onRowClick={(e) => router.push(`/settings/legal-entities/${e.id}`)}
      />
      <DetailsDrawer
        open={creating}
        title="Add legal entity"
        onClose={() => setCreating(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          <Field label="Name" required hint="Short name used across Talent OS">
            <Input value={name} onChange={(_, d) => setName(d.value)} />
          </Field>
          <Field label="Registered legal name" hint="As on the certificate of incorporation">
            <Input value={legalName} onChange={(_, d) => setLegalName(d.value)} placeholder={name} />
          </Field>
        </div>
      </DetailsDrawer>
    </>
  );
}
