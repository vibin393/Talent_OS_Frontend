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
  Spinner,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import type { PipelineReasonCodeOut, PipelineReasonKind } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "../api";
import { pipelineError } from "../use-actions";
import { LabelDialog } from "./stages-admin";

const KINDS: { value: PipelineReasonKind; label: string }[] = [
  { value: "reject", label: "Rejection" },
  { value: "withdraw", label: "Withdrawal" },
  { value: "reopen", label: "Reopen" },
];

/** Reason codes per kind: add, relabel, archive. "other" always requires a note. */
export function ReasonCodesAdmin() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PipelineReasonKind>("reject");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<PipelineReasonCodeOut | null>(null);
  const [adding, setAdding] = useState(false);
  const reasons = useQuery({
    queryKey: pipelineKeys.reasons(kind, showArchived),
    queryFn: ({ signal }) => pipelineApi.reasonCodes(kind, showArchived, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: pipelineKeys.config });
  const archive = useMutation({
    mutationFn: (id: string) => pipelineApi.archiveReasonCode(id),
    onSuccess: () => toast.success("Reason archived."),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: refresh,
  });

  const columns: TableColumnDefinition<PipelineReasonCodeOut>[] = [
    createTableColumn({
      columnId: "label",
      renderHeaderCell: () => "Reason",
      renderCell: (r) => (
        <span className={admin.cellStack}>
          <Text weight="semibold">{r.label}</Text>
          <Text size={200} className={admin.muted}>
            {r.code}
          </Text>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) =>
        r.archived_at ? (
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
      renderHeaderCell: () => "",
      renderCell: (r) =>
        r.archived_at ? null : (
          <RowActions
            label={r.label}
            actions={[
              { label: "Rename", onClick: () => setEditing(r) },
              { label: "Archive", onClick: () => archive.mutate(r.id), disabled: archive.isPending },
            ]}
          />
        ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <TabList size="small" selectedValue={kind} onTabSelect={(_, d) => setKind(d.value as PipelineReasonKind)} aria-label="Reason kind">
          {KINDS.map((k) => (
            <Tab key={k.value} value={k.value}>
              {k.label}
            </Tab>
          ))}
        </TabList>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
        <span className={admin.grow} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add reason
        </Button>
      </div>
      <AdminGrid items={reasons.data} columns={columns} getRowId={(r) => r.id} loading={reasons.isPending} error={reasons.error} emptyText="No reasons of this kind." label="Reason codes" />
      {editing && (
        <LabelDialog
          title={`Rename ${editing.label}`}
          initial={editing.label}
          onClose={() => setEditing(null)}
          onSave={async (label) => {
            await pipelineApi.updateReasonCode(editing.id, label);
            toast.success("Reason renamed.");
            await refresh();
          }}
        />
      )}
      {adding && <AddReasonDialog kind={kind} onClose={() => setAdding(false)} onDone={refresh} />}
    </>
  );
}

function slug(label: string): string {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
  return /^[a-z]/.test(s) ? s : `r_${s}`.slice(0, 50);
}

function AddReasonDialog({ kind, onClose, onDone }: { kind: PipelineReasonKind; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useAppToast();
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const effectiveCode = code || slug(label);
  const valid = label.trim().length > 0 && /^[a-z][a-z0-9_]{1,49}$/.test(effectiveCode);
  const create = useMutation({
    mutationFn: () => pipelineApi.createReasonCode({ kind, code: effectiveCode, label: label.trim() }),
    onSuccess: async () => {
      toast.success("Reason added.");
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add {KINDS.find((k) => k.value === kind)?.label.toLowerCase()} reason</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Label" required>
              <Input value={label} maxLength={200} onChange={(_, d) => setLabel(d.value)} />
            </Field>
            <Field label="Code" hint="Lowercase letters, digits and underscores. Used in reports and the API." validationState={effectiveCode && !valid && label ? "error" : "none"}>
              <Input value={effectiveCode} maxLength={50} onChange={(_, d) => setCode(d.value)} />
            </Field>
            {create.isError && <ErrorBar message={pipelineError(create.error)} />}
          </DialogContent>
          <DialogActions>
            <Button disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!valid || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => create.mutate()}>
              Add
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
