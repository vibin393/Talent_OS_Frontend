"use client";

import { Badge, Button, createTableColumn, Field, Input, Link, type TableColumnDefinition } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { formatDate } from "../format";
import type { RateCardOut, RateCardStatus } from "../types";

export const RATE_CARD_STATUS: Record<RateCardStatus, { label: string; color: "success" | "subtle" | "informative" | "warning" }> = {
  draft: { label: "Draft", color: "informative" },
  published: { label: "Published", color: "success" },
  superseded: { label: "Superseded", color: "subtle" },
  archived: { label: "Archived", color: "subtle" },
};

/** Client 360 "Rate cards" tab: versions with status and effective range; new card / copy from template. */
export function ClientRateCardsTab({ clientId }: { clientId: string }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const canWrite = usePermission("rate_card:write");
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: commercialsKeys.clientRateCards(clientId), queryFn: ({ signal }) => commercialsApi.clientRateCards(clientId, signal) });
  const open = (c: RateCardOut) => router.push(`/clients/${clientId}/rate-cards/${c.id}`);
  const columns: TableColumnDefinition<RateCardOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Rate card",
      renderCell: (c) => (
        <Link as="button" onClick={() => open(c)}>
          {c.human_id} · {c.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (c) => `v${c.version}` }),
    createTableColumn({ columnId: "scope", renderHeaderCell: () => "Scope", renderCell: (c) => (c.contract_id ? "Contract" : "Client-wide") }),
    createTableColumn({
      columnId: "range",
      renderHeaderCell: () => "Effective",
      renderCell: (c) => (c.effective_from ? `${formatDate(c.effective_from)} – ${c.effective_to ? formatDate(c.effective_to) : "open"}` : "—"),
    }),
    createTableColumn({ columnId: "lines", renderHeaderCell: () => "Lines", renderCell: (c) => c.line_count }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) => (
        <Badge appearance="tint" color={RATE_CARD_STATUS[c.status].color}>
          {RATE_CARD_STATUS[c.status].label}
        </Badge>
      ),
    }),
  ];
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <span className={admin.grow} />
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New rate card
          </Button>
        </div>
      )}
      <AdminGrid items={list.data} columns={columns} getRowId={(c) => c.id} loading={list.isPending} error={list.error} emptyText="No rate cards yet." label="Rate cards" onRowClick={open} />
      {creating && <NewRateCardDrawer clientId={clientId} onClose={() => setCreating(false)} onCreated={open} />}
    </>
  );
}

function NewRateCardDrawer({ clientId, onClose, onCreated }: { clientId: string; onClose: () => void; onCreated: (c: RateCardOut) => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Standard rates");
  const [from, setFrom] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const templates = useQuery({ queryKey: commercialsKeys.templates, queryFn: ({ signal }) => commercialsApi.templates(signal) });
  const contracts = useQuery({ queryKey: commercialsKeys.clientContracts(clientId), queryFn: ({ signal }) => commercialsApi.clientContracts(clientId, signal) });
  const create = useMutation({
    mutationFn: () =>
      templateId
        ? commercialsApi.copyTemplate(templateId, clientId, from)
        : commercialsApi.createRateCard({ client_id: clientId, contract_id: contractId, name, effective_from: from }),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: commercialsKeys.clientRateCards(clientId) });
      onCreated(c);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <DetailsDrawer
      open
      title="New rate card"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={!from || (!templateId && !name.trim()) || create.isPending} onClick={() => create.mutate()}>
            Create draft
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={create.error ? errorMessage(create.error) : null} />
        <IdSelect
          label="Start from template"
          options={(templates.data ?? []).map((t) => ({ id: t.id, label: t.name }))}
          value={templateId}
          noneLabel="Blank rate card"
          onChange={setTemplateId}
        />
        {!templateId && (
          <>
            <Field label="Name" required>
              <Input value={name} onChange={(_, d) => setName(d.value)} />
            </Field>
            <IdSelect
              label="Contract scope"
              options={(contracts.data ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.id, label: `${c.human_id} · ${c.title ?? ""}` }))}
              value={contractId}
              noneLabel="Client-wide"
              onChange={setContractId}
            />
          </>
        )}
        <Field label="Effective from" required>
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
