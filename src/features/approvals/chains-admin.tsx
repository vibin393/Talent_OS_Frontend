"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Spinner,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { demandErrorMessage } from "@/features/demands/errors";
import { ChainStepEscalationPicker, useChainStepEscalations } from "@/features/escalations/chain-step-escalations";
import type { ChainOut } from "@/lib/api/types";
import { approvalKeys, approvalsApi } from "./api";
import { ChainEditor, SUBJECT_LABELS } from "./chain-editor";
import { buildChainIn, type ChainDraft, chainDraft, type ChainErrors, describeCondition, hasChainErrors, validateChain } from "./conditions";

function ChainDrawer({ chain, onClose }: { chain: ChainOut | null; onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ChainDraft>(() => chainDraft(chain));
  const [errors, setErrors] = useState<ChainErrors>({ steps: {} });
  const [formError, setFormError] = useState<string | null>(null);
  // Epic 32: per-step escalation (owned copies of library policies), saved after the chain.
  const escalation = useChainStepEscalations(chain?.id ?? null, draft.steps.length);
  const save = useMutation({
    mutationFn: () => (chain ? approvalsApi.updateChain(chain.id, buildChainIn(draft)) : approvalsApi.createChain(buildChainIn(draft))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: approvalKeys.chains }),
  });

  const submit = async () => {
    setFormError(null);
    const v = validateChain(draft);
    setErrors(v);
    if (hasChainErrors(v)) return;
    try {
      const saved = await save.mutateAsync();
      await escalation.save(saved.id);
      toast.success(chain ? `Saved ${saved.name}` : `Created ${saved.name}`);
      onClose();
    } catch (e) {
      setFormError(demandErrorMessage(e));
    }
  };

  return (
    <DetailsDrawer
      open
      size="large"
      title={chain ? `Edit ${chain.name}` : "New approval chain"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            {chain ? "Save changes" : "Create chain"}
          </Button>
          <Button appearance="secondary" disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={formError} />
        <ChainEditor value={draft} onChange={setDraft} errors={errors} />
        <ChainStepEscalationPicker steps={draft.steps} state={escalation} />
      </div>
    </DetailsDrawer>
  );
}

/** `/admin/approval-chains`: approval chains for demands (and later offers and margin overrides). */
export function ChainsAdmin() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("settings:manage");
  const [editing, setEditing] = useState<ChainOut | null | "new">(null);
  const [deleting, setDeleting] = useState<ChainOut | null>(null);
  const chains = useQuery({
    queryKey: approvalKeys.chains,
    queryFn: ({ signal }) => approvalsApi.chains(signal),
    enabled: canManage,
  });

  if (!canManage) return <NoAccess what="approval chains" />;

  const columns: TableColumnDefinition<ChainOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <TableCellLayout truncate>
          <Button appearance="transparent" onClick={() => setEditing(c)} style={{ padding: 0, minWidth: 0 }}>
            {c.name}
          </Button>
        </TableCellLayout>
      ),
    }),
    createTableColumn({ columnId: "subject", renderHeaderCell: () => "Applies to", renderCell: (c) => SUBJECT_LABELS[c.subject_type] }),
    createTableColumn({
      columnId: "active",
      renderHeaderCell: () => "Status",
      renderCell: (c) => (
        <Badge appearance="tint" color={c.is_active ? "success" : "subtle"}>
          {c.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "steps",
      renderHeaderCell: () => "Steps",
      renderCell: (c) => (
        <div className={styles.cellStack}>
          {[...c.steps]
            .sort((a, b) => a.position - b.position)
            .map((s) => (
              <Text key={s.id} size={200} className={styles.truncate}>
                {s.position}. {s.name} · {s.approver_name ?? (s.approver_role_id ? "role" : "user")} ·{" "}
                <span className={styles.muted}>{describeCondition(s.condition)}</span>
              </Text>
            ))}
        </div>
      ),
    }),
    createTableColumn({ columnId: "updated", renderHeaderCell: () => "Last updated", renderCell: (c) => formatDateTime(c.updated_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (c) => (
        <RowActions
          label={c.name}
          actions={[
            { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(c) },
            { label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(c) },
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader
        title="Approval chains"
        subtitle="Who signs off before a demand opens. Steps run in order; a step whose condition does not match is skipped."
      />
      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New chain
        </Button>
      </div>
      <AdminGrid
        items={chains.data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={chains.isPending}
        error={chains.error}
        emptyText="No approval chains. Without an active chain, submitted demands open immediately."
        label="Approval chains"
        columnSizing={{
          name: { minWidth: 160, idealWidth: 200 },
          subject: { minWidth: 110, idealWidth: 120 },
          active: { minWidth: 90, idealWidth: 100 },
          steps: { minWidth: 280, idealWidth: 420 },
          updated: { minWidth: 150, idealWidth: 170 },
          actions: { minWidth: 56, idealWidth: 64 },
        }}
      />
      {editing && <ChainDrawer key={editing === "new" ? "new" : editing.id} chain={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete approval chain?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await approvalsApi.deleteChain(deleting!.id);
            await queryClient.invalidateQueries({ queryKey: approvalKeys.chains });
            toast.success(`Deleted ${deleting!.name}`);
          } catch (e) {
            toast.error(demandErrorMessage(e));
            throw e;
          }
        }}
      >
        {deleting && `${deleting.name} will be deleted. Requests already in progress keep their snapshot of the chain.`}
      </ConfirmDialog>
    </>
  );
}
