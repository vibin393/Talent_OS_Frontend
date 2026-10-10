"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  TableCellLayout,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { applyServerFieldErrors } from "@/features/auth/server-errors";
import { TextField } from "@/features/auth/text-field";
import { usePermission } from "@/features/auth/use-permission";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import type { BusinessUnitOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { AdminGrid, RowActions } from "./admin-grid";
import { adminErrorMessage } from "./errors";
import { TextAreaField } from "./text-area-field";
import { DEFAULT_PAGE_SIZE } from "./query";
import { optionalText, type OrgUnitValues, orgUnitSchema } from "./schemas";
import { ConfirmDialog, ErrorBar, formatDateTime, IdSelect, NoAccess, PagingBar, useAdminStyles } from "./ui";
import { useAdminMutation } from "./use-admin-data";

export function BusinessUnitsView() {
  const styles = useAdminStyles();
  const canRead = usePermission("business_unit:read");
  const canManage = usePermission("business_unit:manage");
  const toast = useAppToast();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BusinessUnitOut | "new" | null>(null);
  const [deleting, setDeleting] = useState<BusinessUnitOut | null>(null);

  const list = useQuery({
    queryKey: adminKeys.businessUnitList(page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listBusinessUnits(page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const remove = useAdminMutation({
    mutationFn: (bu: BusinessUnitOut) => adminApi.deleteBusinessUnit(bu.id),
    invalidate: [adminKeys.businessUnits, adminKeys.users],
    success: (_, bu) => `Deleted ${bu.name}`,
  });

  if (!canRead) return <NoAccess what="business units" />;

  const columns: TableColumnDefinition<BusinessUnitOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (bu) => <TableCellLayout>{bu.name}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "description",
      renderHeaderCell: () => "Description",
      renderCell: (bu) => (
        <TableCellLayout truncate className={styles.muted}>
          {bu.description || "—"}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "created",
      renderHeaderCell: () => "Created",
      renderCell: (bu) => formatDateTime(bu.created_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (bu) => (
        <RowActions
          label={bu.name}
          actions={
            canManage
              ? [
                  { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(bu) },
                  { label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(bu) },
                ]
              : []
          }
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Business units" subtitle="Organize teams and users into business units." />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add business unit
          </Button>
        )}
      </div>
      <AdminGrid
        label="Business units"
        items={list.data?.items}
        columns={columns}
        getRowId={(bu) => bu.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No business units yet."
        footer={
          list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )
        }
      />
      {editing && (
        <BusinessUnitDialog
          key={editing === "new" ? "new" : editing.id}
          unit={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete business unit?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutateAsync(deleting!).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {deleting && `"${deleting.name}" will be deleted. Business units that still have users or teams cannot be deleted.`}
      </ConfirmDialog>
    </>
  );
}

function BusinessUnitDialog({ unit, onClose }: { unit: BusinessUnitOut | null; onClose: () => void }) {
  const styles = useAdminStyles();
  const [formError, setFormError] = useState<string | null>(null);
  // Epic 14 (FR-76): the business unit's default Legal Entity (active entities only).
  const canReadEntities = usePermission("legal_entity:read");
  const [defaultEntity, setDefaultEntity] = useState<string | null>(unit?.default_legal_entity_id ?? null);
  const entities = useQuery({
    queryKey: legalEntityKeys.list,
    queryFn: ({ signal }) => legalEntitiesApi.list(signal),
    enabled: canReadEntities,
  });
  const entityOptions = (entities.data ?? [])
    .filter((e) => e.status === "active" || e.id === defaultEntity)
    .map((e) => ({ id: e.id, label: e.name }));
  const form = useForm<OrgUnitValues>({
    resolver: zodResolver(orgUnitSchema),
    defaultValues: { name: unit?.name ?? "", description: unit?.description ?? "" },
  });
  const save = useAdminMutation({
    mutationFn: (values: OrgUnitValues) => {
      const body = {
        name: values.name,
        description: optionalText(values.description),
        ...(canReadEntities ? { default_legal_entity_id: defaultEntity } : {}),
      };
      return unit ? adminApi.updateBusinessUnit(unit.id, body) : adminApi.createBusinessUnit(body);
    },
    invalidate: [adminKeys.businessUnits, adminKeys.users, adminKeys.teams],
    success: (bu) => (unit ? `Saved ${bu.name}` : `Created ${bu.name}`),
  });

  async function onSubmit(values: OrgUnitValues) {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      onClose();
    } catch (e) {
      if (!applyServerFieldErrors(e, form.setError, ["name", "description"])) setFormError(adminErrorMessage(e));
    }
  }

  const busy = form.formState.isSubmitting;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogBody>
            <DialogTitle>{unit ? "Edit business unit" : "Add business unit"}</DialogTitle>
            <DialogContent className={styles.form}>
              <ErrorBar message={formError} />
              <TextField control={form.control} name="name" label="Name" required />
              <TextAreaField control={form.control} name="description" label="Description" />
              {canReadEntities && (
                <IdSelect
                  label="Default Legal Entity"
                  options={entityOptions}
                  value={defaultEntity}
                  onChange={setDefaultEntity}
                  noneLabel="None"
                  hint="Used for new contracts, placements and invoices of this business unit"
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                {unit ? "Save" : "Add"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
