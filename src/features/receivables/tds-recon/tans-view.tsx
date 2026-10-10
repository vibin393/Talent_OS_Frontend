"use client";

import {
  Button,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { tdsReconApi, tdsReconKeys } from "./api";
import { isValidTan } from "./logic";
import type { DeductorTan } from "./types";

/** Deductor TAN -> Client mappings used to attribute 26AS lines to Clients. */
export function TdsTansView() {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canWrite = hasAnyPermission(perms, ["tds_recon:write"]);
  const q = useQuery({ queryKey: tdsReconKeys.tans, queryFn: ({ signal }) => tdsReconApi.tans(signal) });
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [tan, setTan] = useState("");
  const [deleting, setDeleting] = useState<DeductorTan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tanNorm = tan.trim().toUpperCase();
  const tanOk = isValidTan(tanNorm);
  const add = useMutation({
    mutationFn: () => tdsReconApi.addTan(client!.id, tanNorm),
    onSuccess: async () => {
      setTan("");
      setClient(null);
      setError(null);
      await qc.invalidateQueries({ queryKey: tdsReconKeys.tans });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <ClientPicker value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} className={admin.search} />
          <Field
            label="Deductor TAN"
            validationState={tan && !tanOk ? "error" : "none"}
            validationMessage={tan && !tanOk ? "Format: 4 letters, 5 digits, 1 letter (e.g. ABCD12345E)." : undefined}
          >
            <Input value={tan} maxLength={10} placeholder="ABCD12345E" onChange={(_, d) => setTan(d.value.toUpperCase())} />
          </Field>
          <Button appearance="primary" icon={<Add20Regular />} disabled={!client || !tanOk || add.isPending} onClick={() => add.mutate()}>
            Add mapping
          </Button>
        </div>
      )}
      <ErrorBar message={q.error ? errorMessage(q.error) : error} />
      <div className={admin.surface}>
        {!q.data ? (
          !q.error && <GridSkeleton />
        ) : q.data.length === 0 ? (
          <div className={admin.empty}>No TAN mappings yet. Pairing a statement line manually can record one.</div>
        ) : (
          <Table aria-label="TAN mappings" className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>TAN</TableHeaderCell>
                <TableHeaderCell>Added</TableHeaderCell>
                <TableHeaderCell aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.client_name ?? "—"}</TableCell>
                  <TableCell>{t.tan}</TableCell>
                  <TableCell>{formatDateTime(t.created_at)}</TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button size="small" appearance="subtle" icon={<Delete20Regular />} aria-label={`Delete TAN ${t.tan}`} onClick={() => setDeleting(t)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        title="Delete TAN mapping?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await tdsReconApi.deleteTan(deleting.id);
            await qc.invalidateQueries({ queryKey: tdsReconKeys.tans });
          } catch (e) {
            setError(errorMessage(e));
            throw e;
          }
        }}
      >
        Statement lines from TAN {deleting?.tan} will no longer be attributed to {deleting?.client_name ?? "this client"} in new runs.
      </ConfirmDialog>
    </>
  );
}
