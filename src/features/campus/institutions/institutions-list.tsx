"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dropdown,
  Link,
  Option,
  SearchBox,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useDebounced } from "@/lib/use-debounced";
import { TIER_LABELS, TIERS } from "../logic";
import type { InstitutionOut, InstitutionStatus, Tier } from "../types";
import { useCampusPermissions, useInstitutions } from "../use-campus";
import { useCampusStyles } from "../ui";

/** `/campus/institutions`: colleges and universities with their programs and placement officers. */
export function InstitutionsList() {
  const admin = useAdminStyles();
  const styles = useCampusStyles();
  const router = useRouter();
  const { canRead, canManage } = useCampusPermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InstitutionStatus>("active");
  const [tier, setTier] = useState<Tier | "">("");
  const dq = useDebounced(q, 300);
  const list = useInstitutions({ q: dq.trim() || undefined, status, tier: tier || undefined }, canRead);
  if (!canRead) return <NoAccess what="campus institutions" />;

  const open = (i: InstitutionOut) => router.push(`/campus/institutions/${i.id}`);
  const columns: TableColumnDefinition<InstitutionOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Institution",
      renderCell: (i) => (
        <Link
          as="button"
          onClick={(e) => {
            e.stopPropagation();
            open(i);
          }}
        >
          {i.name}
        </Link>
      ),
    }),
    createTableColumn({
      columnId: "place",
      renderHeaderCell: () => "Location",
      renderCell: (i) => [i.city, i.state, i.country].filter(Boolean).join(", ") || "—",
    }),
    createTableColumn({
      columnId: "tier",
      compare: (a, b) => a.tier.localeCompare(b.tier),
      renderHeaderCell: () => "Tier",
      renderCell: (i) => <Badge appearance="outline">{TIER_LABELS[i.tier]}</Badge>,
    }),
    createTableColumn({
      columnId: "programs",
      renderHeaderCell: () => "Programs",
      renderCell: (i) => <Text className={styles.num}>{i.programs.length}</Text>,
    }),
    createTableColumn({
      columnId: "contact",
      renderHeaderCell: () => "Placement officer",
      renderCell: (i) => (i.primary_contact_name ? `${i.primary_contact_name}${i.contact_count > 1 ? ` +${i.contact_count - 1}` : ""}` : "—"),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <Badge appearance="tint" color={i.status === "active" ? "success" : "subtle"}>
          {i.status === "active" ? "Active" : "Archived"}
        </Badge>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Institutions" subtitle="Colleges and universities you hire from, with their programs and placement officers" />
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search institutions" aria-label="Search institutions" value={q} onChange={(_, d) => setQ(d.value)} />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status === "active" ? "Active" : "Archived"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus((d.optionValue ?? "active") as InstitutionStatus)}
        >
          <Option value="active">Active</Option>
          <Option value="archived">Archived</Option>
        </Dropdown>
        <Dropdown
          className={admin.filter}
          aria-label="Tier"
          value={tier ? TIER_LABELS[tier] : "All tiers"}
          selectedOptions={[tier]}
          onOptionSelect={(_, d) => setTier((d.optionValue ?? "") as Tier | "")}
        >
          <Option value="">All tiers</Option>
          {TIERS.map((t) => (
            <Option key={t} value={t}>
              {TIER_LABELS[t]}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/campus/institutions/new")}>
            New institution
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No institutions match these filters."
        label="Institutions"
        sortable
        onRowClick={open}
      />
    </>
  );
}
