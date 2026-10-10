"use client";

import { Badge, Button, createTableColumn, Field, Input, Switch, type TableColumnDefinition } from "@fluentui/react-components";
import { Add20Regular, Archive20Regular, Star20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import type { PaymentTermOut } from "../types";

/** `/settings/payment-terms`: tenant payment terms (one default). */
export function PaymentTermsView() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canWrite = usePermission("billing:write");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const list = useQuery({ queryKey: commercialsKeys.paymentTerms(includeArchived), queryFn: ({ signal }) => commercialsApi.paymentTerms(includeArchived, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["commercials", "payment-terms"] });
  const create = useMutation({
    mutationFn: () => commercialsApi.createPaymentTerm({ name: name.trim(), days: Number(days) }),
    onSuccess: async () => {
      setName("");
      setDays("");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const action = useMutation({
    mutationFn: (v: { t: PaymentTermOut; kind: "default" | "archive" }) =>
      v.kind === "default" ? commercialsApi.updatePaymentTerm(v.t.id, { is_default: true }) : commercialsApi.archivePaymentTerm(v.t.id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<PaymentTermOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (t) => (
        <span className={admin.badges}>
          {t.name} {t.is_default && <Badge appearance="tint" color="brand">Default</Badge>} {t.archived_at && <Badge appearance="tint" color="subtle">Archived</Badge>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "days", renderHeaderCell: () => "Days", renderCell: (t) => t.days }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (t) =>
        canWrite && !t.archived_at ? (
          <RowActions
            label={t.name}
            actions={[
              ...(!t.is_default ? [{ label: "Make default", icon: <Star20Regular />, onClick: () => action.mutate({ t, kind: "default" }) }] : []),
              ...(!t.is_default ? [{ label: "Archive", icon: <Archive20Regular />, onClick: () => action.mutate({ t, kind: "archive" }) }] : []),
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      <PageHeader title="Payment terms" subtitle="Due dates on invoices: contract terms, then the client's billing profile, then the default" />
      <div className={admin.toolbar}>
        {canWrite && (
          <>
            <Field label="Name">
              <Input value={name} onChange={(_, d) => setName(d.value)} placeholder="Net 15" />
            </Field>
            <Field label="Days">
              <Input type="number" value={days} onChange={(_, d) => setDays(d.value)} />
            </Field>
            <Button icon={<Add20Regular />} disabled={!name.trim() || days === "" || create.isPending} onClick={() => create.mutate()}>
              Add
            </Button>
          </>
        )}
        <span className={admin.grow} />
        <Switch label="Show archived" checked={includeArchived} onChange={(_, d) => setIncludeArchived(d.checked)} />
      </div>
      <AdminGrid items={list.data} columns={columns} getRowId={(t) => t.id} loading={list.isPending} error={list.error} emptyText="No payment terms." label="Payment terms" />
    </>
  );
}
