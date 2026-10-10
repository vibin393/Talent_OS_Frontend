"use client";

import {
  Button,
  Checkbox,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { domainError } from "./logic";
import type { SenderDomain } from "./types";

const useStyles = makeStyles({
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBlock: tokens.spacingVerticalM },
  dialog: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** "Verified sender domains" (admin-verified domain -> Client; public webmail domains are refused). */
export function SenderDomainsTable() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const query = useQuery({ queryKey: demandAgentKeys.senderDomains, queryFn: ({ signal }) => demandAgentApi.senderDomains(signal) });
  const remove = useMutation({
    mutationFn: (id: string) => demandAgentApi.removeSenderDomain(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: demandAgentKeys.senderDomains }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<SenderDomain>[] = [
    createTableColumn({ columnId: "domain", renderHeaderCell: () => "Domain", renderCell: (d) => d.domain }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (d) => d.client_name ?? "—" }),
    createTableColumn({ columnId: "by", renderHeaderCell: () => "Verified by", renderCell: (d) => d.verified_by_name ?? "—" }),
    createTableColumn({ columnId: "added", renderHeaderCell: () => "Added", renderCell: (d) => formatDateTime(d.verified_at) }),
    createTableColumn({
      columnId: "remove",
      renderHeaderCell: () => "Remove",
      renderCell: (d) => (
        <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove ${d.domain}`} onClick={() => remove.mutate(d.id)} />
      ),
    }),
  ];
  return (
    <section>
      <div className={styles.header}>
        <Subtitle2>Verified sender domains</Subtitle2>
        <Button icon={<Add20Regular />} onClick={() => setAdding(true)}>
          Add domain
        </Button>
      </div>
      {query.isPending ? (
        <GridSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the sender domains." message={errorMessage(query.error)} />
      ) : (
        <DataGrid items={query.data} columns={columns} getRowId={(d) => d.id} aria-label="Verified sender domains">
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<SenderDomain>>
            {({ item, rowId }) => (
              <DataGridRow<SenderDomain> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
      {adding && <AddDomainDialog onClose={() => setAdding(false)} />}
    </section>
  );
}

export function AddDomainDialog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [domain, setDomain] = useState("");
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const localError = domain ? domainError(domain) : null;
  const add = useMutation({
    mutationFn: () => demandAgentApi.addSenderDomain({ domain: domain.trim(), client_id: client!.id, confirmed, note: note.trim() || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: demandAgentKeys.senderDomains });
      toast.success("Domain added.");
      onClose();
    },
    onError: (e) => setServerError(errorMessage(e)),
  });
  const ready = domain.trim() !== "" && localError === null && client !== null && confirmed;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add domain</DialogTitle>
          <DialogContent className={styles.dialog}>
            <Field
              label="Domain"
              required
              hint="e.g. acme.com"
              validationState={localError || serverError ? "error" : "none"}
              validationMessage={localError ?? serverError ?? undefined}
            >
              <Input
                value={domain}
                placeholder="acme.com"
                onChange={(_, d) => {
                  setDomain(d.value);
                  setServerError(null);
                }}
              />
            </Field>
            <ClientPicker label="Client" required value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} />
            <Checkbox
              required
              checked={confirmed}
              onChange={(_, d) => setConfirmed(d.checked === true)}
              label="I confirm this domain belongs to this client"
            />
            <Field label="Note">
              <Textarea value={note} maxLength={300} onChange={(_, d) => setNote(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!ready || add.isPending}
              icon={add.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => add.mutate()}
            >
              Add domain
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
