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
  Spinner,
  Switch,
  type TableColumnDefinition,
  Textarea,
  Toolbar,
  ToolbarButton,
} from "@fluentui/react-components";
import { Add20Regular, LockOpen20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { LegalHoldOut } from "@/lib/api/types";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { CandidatePicker } from "./candidate-picker";
import { useUserNames } from "./use-user-names";

/** Legal holds tab: place and release holds that block erasure and retention. */
export function LegalHoldsTab() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("privacy:manage");
  const userName = useUserNames();
  const [activeOnly, setActiveOnly] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<LegalHoldOut | null>(null);
  const holds = useQuery({
    queryKey: privacyKeys.holds(activeOnly),
    queryFn: ({ signal }) => privacyApi.legalHolds(activeOnly, signal),
  });

  const columns: TableColumnDefinition<LegalHoldOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Candidate",
      renderCell: (h) => <AppLink href={`/candidates/${h.candidate_id}`}>Open candidate</AppLink>,
    }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (h) => h.reason }),
    createTableColumn({
      columnId: "placed",
      compare: (a, b) => a.placed_at.localeCompare(b.placed_at),
      renderHeaderCell: () => "Placed",
      renderCell: (h) => `${formatDateTime(h.placed_at)}${h.placed_by ? ` · ${userName(h.placed_by) ?? ""}` : ""}`,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (h) =>
        h.released_at ? (
          <Badge appearance="tint" color="subtle">
            Released {formatDateTime(h.released_at)}
          </Badge>
        ) : (
          <Badge appearance="tint" color="warning">
            Active
          </Badge>
        ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (h) =>
        canManage && !h.released_at ? (
          <Button size="small" icon={<LockOpen20Regular />} onClick={() => setReleasing(h)}>
            Release
          </Button>
        ) : null,
    }),
  ];

  return (
    <>
      <Toolbar aria-label="Legal hold commands" className={styles.toolbar}>
        {canManage && (
          <ToolbarButton appearance="primary" icon={<Add20Regular />} onClick={() => setPlacing(true)}>
            Place hold
          </ToolbarButton>
        )}
        <Switch label="Active holds only" checked={activeOnly} onChange={(_, d) => setActiveOnly(d.checked)} />
      </Toolbar>
      <AdminGrid
        items={holds.data}
        columns={columns}
        getRowId={(h) => h.id}
        loading={holds.isPending}
        error={holds.error}
        emptyText={activeOnly ? "No active legal holds." : "No legal holds."}
        label="Legal holds"
        sortable
      />
      <PlaceHoldDialog open={placing} onClose={() => setPlacing(false)} />
      <ConfirmDialog
        open={releasing !== null}
        title="Release this legal hold?"
        confirmLabel="Release"
        onClose={() => setReleasing(null)}
        onConfirm={() =>
          privacyApi
            .releaseHold(releasing!.id)
            .then(async () => {
              toast.success("Legal hold released");
              await queryClient.invalidateQueries({ queryKey: ["privacy", "legal-holds"] });
            })
            .catch((e) => {
              toast.error(privacyErrorMessage(e));
              throw e;
            })
        }
      >
        The candidate can then be erased by a DSR or by the retention policy.
      </ConfirmDialog>
    </>
  );
}

function PlaceHoldDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [candidate, setCandidate] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const place = useMutation({
    mutationFn: () => privacyApi.placeHold({ candidate_id: candidate!.id, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success("Legal hold placed");
      await queryClient.invalidateQueries({ queryKey: ["privacy", "legal-holds"] });
      close(true);
    },
    onError: (e) => setError(privacyErrorMessage(e)),
  });
  const close = (force = false) => {
    if (place.isPending && !force) return;
    setCandidate(null);
    setReason("");
    setError(null);
    onClose();
  };
  const valid = !!candidate && reason.trim().length >= 3;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) place.mutate();
          }}
        >
          <DialogBody>
            <DialogTitle>Place legal hold</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ErrorBar message={error} />
              <CandidatePicker
                label="Candidate"
                required
                value={candidate?.id ?? null}
                valueLabel={candidate?.label}
                onChange={(id, c) => setCandidate(id && c ? { id, label: `${c.full_name} (${c.human_id})` } : null)}
              />
              <Field label="Reason" required hint="For example the litigation or regulator reference.">
                <Textarea value={reason} onChange={(_, d) => setReason(d.value)} rows={3} maxLength={2000} resize="vertical" />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => close()} disabled={place.isPending}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={!valid || place.isPending}
                icon={place.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Place hold
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
