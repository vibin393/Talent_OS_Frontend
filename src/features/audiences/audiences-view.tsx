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
  Field,
  Input,
  Link,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { audienceKeys, audiencesApi } from "./api";
import { AUDIENCE_STATUS_COLORS, AUDIENCE_STATUS_LABELS } from "./logic";
import type { AudienceOut } from "./types";

export function AudienceStatusBadge({ status }: { status: AudienceOut["status"] }) {
  return (
    <Badge appearance="tint" color={AUDIENCE_STATUS_COLORS[status] ?? "subtle"}>
      {AUDIENCE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function useAudiences(enabled = true) {
  return useQuery({ queryKey: audienceKeys.list, queryFn: ({ signal }) => audiencesApi.list(signal), enabled });
}

/** `/marketing/audiences`: audiences list and "New audience". */
export function AudiencesView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("campaign:read");
  const canWrite = usePermission("campaign:write");
  const [creating, setCreating] = useState(false);
  const audiences = useAudiences(canRead);
  if (!canRead) return <NoAccess what="audiences" />;

  const open = (a: AudienceOut) => router.push(`/marketing/audiences/${a.id}`);
  const columns: TableColumnDefinition<AudienceOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (a) => (
        <Link
          as="button"
          onClick={(e) => {
            e.stopPropagation();
            open(a);
          }}
        >
          {a.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (a) => <AudienceStatusBadge status={a.status} /> }),
    createTableColumn({
      columnId: "sources",
      renderHeaderCell: () => "Sources",
      renderCell: (a) => {
        const inc = a.sources.filter((s) => s.mode === "include").length;
        const exc = a.sources.filter((s) => s.mode === "exclude").length;
        return (
          <Text size={200}>
            {inc} included, {exc} excluded
          </Text>
        );
      },
    }),
    createTableColumn({
      columnId: "lists",
      renderHeaderCell: () => "Lists",
      renderCell: (a) => (
        <Text size={200} style={{ fontVariantNumeric: "tabular-nums" }}>
          +{a.include_list_count.toLocaleString()} / −{a.exclude_list_count.toLocaleString()}
        </Text>
      ),
    }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Updated", renderCell: (a) => formatDateTime(a.updated_at) }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Text style={{ color: tokens.colorNeutralForeground2 }}>Groups of candidates built from pools, segments and imported lists.</Text>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New audience
          </Button>
        )}
      </div>
      <AdminGrid
        items={audiences.data}
        columns={columns}
        getRowId={(a) => a.id}
        loading={audiences.isPending}
        error={audiences.error}
        emptyText="No audiences yet."
        label="Audiences"
        onRowClick={open}
      />
      {creating && <NewAudienceDialog onClose={() => setCreating(false)} onCreated={open} />}
    </>
  );
}

function NewAudienceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (a: AudienceOut) => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useMutation({
    mutationFn: () => audiencesApi.create({ name: name.trim(), description: description.trim() || null, sources: [] }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: audienceKeys.all });
      onCreated(a);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not create the audience.")),
  });
  const nameError = touched && !name.trim() ? "Enter a name." : undefined;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (name.trim()) create.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>New audience</DialogTitle>
            <DialogContent className={admin.form}>
              <Field label="Name" required validationState={nameError ? "error" : "none"} validationMessage={nameError}>
                <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Description">
                <Textarea value={description} maxLength={2000} onChange={(_, d) => setDescription(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={create.isPending}>
                Cancel
              </Button>
              <Button appearance="primary" type="submit" disabled={create.isPending}>
                Create
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
