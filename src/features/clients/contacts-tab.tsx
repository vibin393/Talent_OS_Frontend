"use client";

import {
  Avatar,
  Badge,
  Button,
  createTableColumn,
  Link,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text, mergeClasses } from "@fluentui/react-components";
import { Archive20Regular, ArchiveArrowBack20Regular, Edit20Regular, Mail20Regular, PersonAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import type { ContactOut } from "@/lib/api/types";
import { canActOnOwned } from "./access";
import { clientKeys, clientsApi } from "./api";
import { ContactDrawer } from "./contact-drawer";
import { clientErrorMessage } from "./errors";
import { CONTACT_TYPE_LABELS } from "./format";
import { ComposeDialog } from "@/features/comms/compose-dialog";
import { contactComposeContext } from "@/features/comms/compose-contexts";
import type { ComposeContext } from "@/features/comms/compose-model";

/** Contacts of a client: grid with archived toggle, add/edit drawer and archive/restore. */
export function ContactsTab({
  clientId,
  clientOwnerId,
  clientArchived,
}: {
  clientId: string;
  clientOwnerId: string;
  clientArchived: boolean;
}) {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const permissions = usePermissions();
  const canCreate = usePermission("contact:create");
  const canUpdate = canActOnOwned(permissions, "contact:update", clientOwnerId, me?.user.id);
  const canArchive = canActOnOwned(permissions, "contact:delete", clientOwnerId, me?.user.id);

  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<{ contact: ContactOut | null; readOnly: boolean } | null>(null);
  const [archiving, setArchiving] = useState<ContactOut | null>(null);
  const canEmail = usePermission("email:send");
  const [composing, setComposing] = useState<ComposeContext | null>(null);

  const list = useQuery({
    queryKey: clientKeys.contactList(clientId, includeArchived, page),
    queryFn: ({ signal }) => clientsApi.listContacts(clientId, includeArchived, page, DEFAULT_PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });

  const toggle = useMutation({
    mutationFn: (c: ContactOut) => (c.archived_at ? clientsApi.unarchiveContact(c.id) : clientsApi.archiveContact(c.id)),
    onSuccess: async (c) => {
      toast.success(c.archived_at ? `${c.name} archived` : `${c.name} restored`);
      await queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    },
  });

  const columns: TableColumnDefinition<ContactOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <TableCellLayout media={<Avatar name={c.name} size={32} color="colorful" aria-hidden />}>
          <div className={styles.cellStack}>
            <Link as="button" className={styles.truncate} onClick={() => setDrawer({ contact: c, readOnly: !canUpdate || !!c.archived_at })}>
              {c.name}
            </Link>
            {c.title && (
              <Text size={200} className={mergeClasses(styles.muted, styles.truncate)}>
                {c.title}
              </Text>
            )}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (c) => (
        <Badge appearance="tint" color="informative">
          {CONTACT_TYPE_LABELS[c.type]}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "email",
      renderHeaderCell: () => "Email",
      renderCell: (c) =>
        c.email ? (
          <TableCellLayout truncate>
            <Link href={`mailto:${c.email}`}>{c.email}</Link>
          </TableCellLayout>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "phone",
      renderHeaderCell: () => "Phone",
      renderCell: (c) => (c.phone ? <Link href={`tel:${c.phone}`}>{c.phone}</Link> : "—"),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) =>
        c.archived_at ? (
          <Badge appearance="tint" color="subtle">
            Archived
          </Badge>
        ) : (
          <Badge appearance="tint" color="success">
            Active
          </Badge>
        ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (c) => (
        <RowActions
          label={c.name}
          actions={[
            ...(canEmail && c.email && !c.archived_at
              ? [
                  {
                    label: "Email",
                    icon: <Mail20Regular />,
                    onClick: () => setComposing(contactComposeContext(c, clientId, list.data?.items ?? [])),
                  },
                ]
              : []),
            ...(canUpdate && !c.archived_at
              ? [{ label: "Edit", icon: <Edit20Regular />, onClick: () => setDrawer({ contact: c, readOnly: false }) }]
              : []),
            ...(canArchive
              ? [
                  c.archived_at
                    ? {
                        label: "Restore",
                        icon: <ArchiveArrowBack20Regular />,
                        onClick: () => toggle.mutateAsync(c).catch((e) => toast.error(clientErrorMessage(e))),
                      }
                    : { label: "Archive", icon: <Archive20Regular />, onClick: () => setArchiving(c) },
                ]
              : []),
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <div className={styles.toolbar}>
        {canCreate && !clientArchived && (
          <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={() => setDrawer({ contact: null, readOnly: false })}>
            Add contact
          </Button>
        )}
        <div className={styles.grow} />
        <Switch
          label="Show archived"
          checked={includeArchived}
          onChange={(_, d) => {
            setIncludeArchived(d.checked);
            setPage(1);
          }}
        />
      </div>
      <AdminGrid
        label="Contacts"
        items={list.data?.items}
        columns={columns}
        getRowId={(c) => c.id}
        loading={list.isPending}
        error={list.error}
        emptyText={includeArchived ? "No contacts." : "No contacts yet."}
        columnSizing={{
          name: { minWidth: 200, idealWidth: 240 },
          email: { minWidth: 180, idealWidth: 220 },
          actions: { minWidth: 56, idealWidth: 64 },
        }}
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
      {drawer && (
        <ContactDrawer
          key={drawer.contact?.id ?? "new"}
          clientId={clientId}
          contact={drawer.contact}
          readOnly={drawer.readOnly}
          onClose={() => setDrawer(null)}
        />
      )}
      {composing && <ComposeDialog context={composing} onClose={() => setComposing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title="Archive contact?"
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={() =>
          toggle.mutateAsync(archiving!).catch((e) => {
            toast.error(clientErrorMessage(e));
            throw e;
          })
        }
      >
        {archiving && `${archiving.name} will be hidden from this client's contacts. You can restore them later.`}
      </ConfirmDialog>
    </>
  );
}
