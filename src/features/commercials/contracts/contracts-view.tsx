"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Link,
  makeStyles,
  Option,
  Dropdown,
  type TableColumnDefinition,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { type ContractFilters, commercialsApi, commercialsKeys } from "../api";
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, formatDate } from "../format";
import type { ContractOut, ContractStatus } from "../types";
import { ContractDrawer } from "./contract-drawer";

const useStyles = makeStyles({ chip: { marginLeft: tokens.spacingHorizontalS } });

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge appearance="tint" color={CONTRACT_STATUS_COLORS[status]}>
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Contracts grid (CTR id, title, type, LE, dates, status) used by the workspace and the Client 360 tab. */
export function ContractsGrid({ filters, emptyText }: { filters: ContractFilters; emptyText: string }) {
  const router = useRouter();
  const list = useQuery({
    queryKey: commercialsKeys.contracts(filters),
    queryFn: ({ signal }) => commercialsApi.contracts(filters, signal),
  });
  const columns: TableColumnDefinition<ContractOut>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Contract",
      renderCell: (c) => (
        <Link as="button" onClick={() => router.push(`/contracts/${c.id}`)}>
          {c.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "title", renderHeaderCell: () => "Title", renderCell: (c) => c.title ?? "—" }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (c) => CONTRACT_TYPE_LABELS[c.contract_type] }),
    createTableColumn({ columnId: "start", renderHeaderCell: () => "Start", renderCell: (c) => formatDate(c.start_date) }),
    createTableColumn({ columnId: "end", renderHeaderCell: () => "End", renderCell: (c) => formatDate(c.end_date) }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (c) => <ContractStatusBadge status={c.status} /> }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(c) => c.id}
      loading={list.isPending}
      error={list.error}
      emptyText={emptyText}
      label="Contracts"
      onRowClick={(c) => router.push(`/contracts/${c.id}`)}
    />
  );
}

/** `/contracts`: the contracts workspace with type / status filters and the "expiring soon" chip. */
export function ContractsView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canRead = usePermission("contract:read");
  const canWrite = usePermission("contract:write");
  const [status, setStatus] = useState<string>("");
  const [expiring, setExpiring] = useState(false);
  const [creating, setCreating] = useState(false);
  if (!canRead) return <NoAccess what="contracts" />;
  const filters: ContractFilters = { status: status || undefined, expiring_within_days: expiring ? 60 : undefined };
  return (
    <>
      <PageHeader title="Contracts" subtitle="MSAs, SOWs and amendments with your clients" />
      <div className={admin.toolbar}>
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? CONTRACT_STATUS_LABELS[status as ContractStatus] : "All statuses"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
        >
          <Option value="">All statuses</Option>
          {(Object.keys(CONTRACT_STATUS_LABELS) as ContractStatus[]).map((s) => (
            <Option key={s} value={s}>
              {CONTRACT_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <ToggleButton className={styles.chip} shape="circular" checked={expiring} onClick={() => setExpiring((v) => !v)}>
          Expiring in 60 days
        </ToggleButton>
        <span className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New contract
          </Button>
        )}
      </div>
      <ContractsGrid filters={filters} emptyText="No contracts match these filters." />
      {creating && (
        <ContractDrawer
          onClose={() => setCreating(false)}
          onCreated={async (c) => {
            await queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
            router.push(`/contracts/${c.id}`);
          }}
        />
      )}
    </>
  );
}

/** Client 360 "Contracts" tab. */
export function ClientContractsTab({ clientId }: { clientId: string }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = usePermission("contract:write");
  const [creating, setCreating] = useState(false);
  return (
    <>
      {canWrite && (
        <div className={admin.toolbar}>
          <span className={admin.grow} />
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New contract
          </Button>
        </div>
      )}
      <ContractsGrid filters={{ client_id: clientId }} emptyText="No contracts with this client yet." />
      {creating && (
        <ContractDrawer
          clientId={clientId}
          onClose={() => setCreating(false)}
          onCreated={async (c) => {
            await queryClient.invalidateQueries({ queryKey: commercialsKeys.all });
            router.push(`/contracts/${c.id}`);
          }}
        />
      )}
    </>
  );
}
