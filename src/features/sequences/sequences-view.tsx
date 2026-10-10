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
import { sequenceKeys, sequencesApi } from "./api";
import { SEQUENCE_STATUS_COLORS, SEQUENCE_STATUS_LABELS } from "./logic";
import type { SequenceOut, SequenceStatus } from "./types";

export function SequenceStatusBadge({ status }: { status: SequenceStatus }) {
  return (
    <Badge appearance="tint" color={SEQUENCE_STATUS_COLORS[status] ?? "subtle"}>
      {SEQUENCE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** `/marketing/sequences`: nurture sequences and "New sequence". */
export function SequencesView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("campaign:read");
  const canWrite = usePermission("campaign:write");
  const [creating, setCreating] = useState(false);
  const sequences = useQuery({ queryKey: sequenceKeys.list, queryFn: ({ signal }) => sequencesApi.list(signal), enabled: canRead });
  if (!canRead) return <NoAccess what="sequences" />;

  const open = (s: SequenceOut) => router.push(`/marketing/sequences/${s.id}`);
  const columns: TableColumnDefinition<SequenceOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (s) => (
        <Link
          as="button"
          onClick={(e) => {
            e.stopPropagation();
            open(s);
          }}
        >
          {s.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (s) => <SequenceStatusBadge status={s.status} /> }),
    createTableColumn({
      columnId: "version",
      renderHeaderCell: () => "Version",
      renderCell: (s) => (s.current_version ? `v${s.current_version}` : "Not published"),
    }),
    createTableColumn({ columnId: "steps", renderHeaderCell: () => "Steps", renderCell: (s) => (s.published_steps.length || s.steps.length).toString() }),
    createTableColumn({ columnId: "active", renderHeaderCell: () => "Active enrolments", renderCell: (s) => s.active_enrollments.toLocaleString() }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Updated", renderCell: (s) => formatDateTime(s.updated_at) }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Text style={{ color: tokens.colorNeutralForeground2 }}>Timed steps that nurture candidates until they reply or apply.</Text>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New sequence
          </Button>
        )}
      </div>
      <AdminGrid
        items={sequences.data}
        columns={columns}
        getRowId={(s) => s.id}
        loading={sequences.isPending}
        error={sequences.error}
        emptyText="No sequences yet."
        label="Sequences"
        onRowClick={open}
      />
      {creating && <NewSequenceDialog onClose={() => setCreating(false)} onCreated={open} />}
    </>
  );
}

function NewSequenceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (s: SequenceOut) => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useMutation({
    mutationFn: () => sequencesApi.create({ name: name.trim(), description: description.trim() || null, steps: [] }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: sequenceKeys.all });
      onCreated(s);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not create the sequence.")),
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
            <DialogTitle>New sequence</DialogTitle>
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
