"use client";

import {
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
  type TableColumnDefinition,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { type AuthorizationRow, consoleApi, consoleKeys } from "./api";
import { REVOKE_REASON_PROMPT, revokeReasonError } from "./logic";

function authInstallation(r: AuthorizationRow): string {
  return r.installation ?? r.installation_id ?? "—";
}
function authUser(r: AuthorizationRow): string {
  return r.user ?? r.user_id ?? "—";
}
function authScopes(r: AuthorizationRow): string {
  const s = r.scopes ?? r.granted_scopes ?? [];
  return s.length ? s.join(", ") : "—";
}
function authAuthorized(r: AuthorizationRow): string | null {
  return r.authorized_at ?? r.granted_at ?? null;
}

/** "Authorisations" tab: delegated app authorisations with a human-only Revoke (reason required, FR-406). */
export function AuthorizationsTab({ canManage }: { canManage: boolean }) {
  const [revoking, setRevoking] = useState<AuthorizationRow | null>(null);
  const rows = useQuery({
    queryKey: consoleKeys.authorizations(""),
    queryFn: ({ signal }) => consoleApi.authorizations({}, signal),
    refetchInterval: 60_000,
  });

  const columns: TableColumnDefinition<AuthorizationRow>[] = [
    createTableColumn({ columnId: "app", renderHeaderCell: () => "App", renderCell: (r) => <Text weight="semibold">{authInstallation(r)}</Text> }),
    createTableColumn({ columnId: "user", renderHeaderCell: () => "User", renderCell: authUser }),
    createTableColumn({ columnId: "access", renderHeaderCell: () => "Access", renderCell: authScopes }),
    createTableColumn({ columnId: "authorized", renderHeaderCell: () => "Authorised", renderCell: (r) => formatDateTime(authAuthorized(r)) }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last used", renderCell: (r) => formatDateTime(r.last_used_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canManage ? <RowActions label={authInstallation(r)} actions={[{ label: "Revoke", onClick: () => setRevoking(r) }]} /> : null,
    }),
  ];

  return (
    <>
      <AdminGrid
        items={rows.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={rows.isPending}
        error={rows.error}
        emptyText="No one has connected an app to their account."
        label="Authorisations"
      />
      {revoking ? <RevokeDialog row={revoking} onClose={() => setRevoking(null)} /> : null}
    </>
  );
}

function RevokeDialog({ row, onClose }: { row: AuthorizationRow; onClose: () => void }) {
  const toast = useAppToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const error = revokeReasonError(reason);
  const m = useMutation({
    mutationFn: () => consoleApi.revokeAuthorization(row.id, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: consoleKeys.all });
      toast.success("Access revoked. The user has been notified.");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !m.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{REVOKE_REASON_PROMPT}</DialogTitle>
          <DialogContent>
            <Field label="Reason" required validationState={touched && error ? "error" : "none"} validationMessage={touched ? (error ?? undefined) : undefined}>
              <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} onBlur={() => setTouched(true)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={m.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={m.isPending || !!error}
              icon={m.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                setTouched(true);
                if (!error) m.mutate();
              }}
            >
              Revoke access
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
