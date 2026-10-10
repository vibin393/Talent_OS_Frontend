"use client";

import {
  Badge,
  Body1,
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
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, IdSelect, useAdminStyles } from "@/features/admin/ui";
import type { PipelineStageOut } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "../api";
import { pipelineError } from "../use-actions";

/** Stage admin: relabel any stage; add, reorder and archive custom stages (always between Applied and Shortlisted). */
export function StagesAdmin() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const stages = useQuery({ queryKey: pipelineKeys.stages(false), queryFn: ({ signal }) => pipelineApi.stages(false, signal) });
  const [renaming, setRenaming] = useState<PipelineStageOut | null>(null);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState<PipelineStageOut | null>(null);
  const items = [...(stages.data?.items ?? [])].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || a.position - b.position);
  const custom = items.filter((s) => s.kind === "custom" && !s.archived_at);
  const refresh = () => queryClient.invalidateQueries({ queryKey: pipelineKeys.config });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => pipelineApi.reorderStages(ids),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: refresh,
  });
  const shift = (stage: PipelineStageOut, by: -1 | 1) => {
    const ids = custom.map((s) => s.id);
    const i = ids.indexOf(stage.id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  };

  const columns: TableColumnDefinition<PipelineStageOut>[] = [
    createTableColumn({
      columnId: "label",
      renderHeaderCell: () => "Stage",
      renderCell: (s) => (
        <span className={admin.cellStack}>
          <Text weight="semibold">{s.label}</Text>
          <Text size={200} className={admin.muted}>
            {s.key}
          </Text>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Type",
      renderCell: (s) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={s.kind === "custom" ? "informative" : "brand"}>
            {s.kind === "custom" ? "Custom" : "Built-in"}
          </Badge>
          {s.terminal && (
            <Badge appearance="outline" color="subtle">
              Final
            </Badge>
          )}
          {s.archived_at && <Badge appearance="tint" color="subtle">Archived {formatDateTime(s.archived_at)}</Badge>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "order",
      renderHeaderCell: () => "Order",
      renderCell: (s) => {
        if (s.kind !== "custom" || s.archived_at) return null;
        const i = custom.findIndex((c) => c.id === s.id);
        return (
          <span>
            <Button appearance="subtle" icon={<ArrowUp20Regular />} aria-label={`Move ${s.label} up`} disabled={i <= 0 || reorder.isPending} onClick={() => shift(s, -1)} />
            <Button appearance="subtle" icon={<ArrowDown20Regular />} aria-label={`Move ${s.label} down`} disabled={i >= custom.length - 1 || reorder.isPending} onClick={() => shift(s, 1)} />
          </span>
        );
      },
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (s) => (
        <RowActions
          label={s.label}
          actions={[
            ...(s.archived_at ? [] : [{ label: "Rename", onClick: () => setRenaming(s) }]),
            ...(s.kind === "custom" && !s.archived_at ? [{ label: "Archive", onClick: () => setArchiving(s) }] : []),
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Body1 className={admin.grow}>Built-in stages can be renamed. Custom stages always sit between Applied and Shortlisted.</Body1>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add custom stage
        </Button>
      </div>
      <AdminGrid items={stages.data ? items : undefined} columns={columns} getRowId={(s) => s.id} loading={stages.isPending} error={stages.error} emptyText="No stages." label="Pipeline stages" />
      {(adding || renaming) && (
        <LabelDialog
          title={renaming ? `Rename ${renaming.label}` : "Add custom stage"}
          initial={renaming?.label ?? ""}
          onClose={() => {
            setAdding(false);
            setRenaming(null);
          }}
          onSave={async (label) => {
            if (renaming) await pipelineApi.updateStage(renaming.id, label);
            else await pipelineApi.createStage({ label });
            toast.success(renaming ? "Stage renamed." : "Stage added.");
            await refresh();
          }}
        />
      )}
      {archiving && (
        <ArchiveStageDialog
          stage={archiving}
          targets={items.filter((s) => !s.archived_at && s.id !== archiving.id && (s.kind === "custom" || s.key === "applied"))}
          onClose={() => setArchiving(null)}
          onDone={refresh}
        />
      )}
    </>
  );
}

export function LabelDialog({
  title,
  initial,
  label = "Label",
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  label?: string;
  onSave: (value: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!trimmed) return;
            setBusy(true);
            setError(null);
            try {
              await onSave(trimmed);
              onClose();
            } catch (err) {
              setError(pipelineError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label={label} required>
                <Input value={value} maxLength={100} onChange={(_, d) => setValue(d.value)} autoFocus />
              </Field>
              <ErrorBar message={error} />
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" appearance="primary" disabled={busy || !trimmed} icon={busy ? <Spinner size="tiny" /> : undefined}>
                Save
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

function ArchiveStageDialog({
  stage,
  targets,
  onClose,
  onDone,
}: {
  stage: PipelineStageOut;
  targets: PipelineStageOut[];
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const toast = useAppToast();
  const [moveTo, setMoveTo] = useState<string | null>(targets.find((t) => t.key === "applied")?.id ?? null);
  const archive = useMutation({
    mutationFn: () => pipelineApi.archiveStage(stage.id, moveTo),
    onSuccess: async () => {
      toast.success(`${stage.label} archived.`);
      await onDone();
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !archive.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Archive {stage.label}?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Body1>Candidates still in this stage are moved to the stage you choose. The move is recorded in their history.</Body1>
            <IdSelect label="Move candidates to" options={targets.map((t) => ({ id: t.id, label: t.label }))} value={moveTo} onChange={setMoveTo} />
            {archive.isError && <ErrorBar message={pipelineError(archive.error)} />}
          </DialogContent>
          <DialogActions>
            <Button disabled={archive.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={archive.isPending} onClick={() => archive.mutate()}>
              Archive
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
