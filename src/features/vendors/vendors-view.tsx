"use client";

import {
  Button,
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
  Dropdown,
  Field,
  Input,
  Option,
  SearchBox,
  type TableColumnDefinition,
  TableCellLayout,
  Text,
  Toolbar,
  mergeClasses,
} from "@fluentui/react-components";
import { Add20Regular, DocumentBulletList20Regular, PeopleQueue20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { EMPTY_VENDOR_FILTERS, type VendorFilters } from "./api";
import { formatDate, VENDOR_STATUS_LABELS, VENDOR_STATUSES } from "./format";
import type { VendorOut, VendorStatus, VendorTier } from "./types";
import { TierBadge, VendorStatusBadge } from "./ui";
import { useVendorMutations, useVendors } from "./use-vendors";

const ALL = "__all__";
const TIERS: VendorTier[] = ["gold", "silver", "bronze", "custom"];

/** `/vendors`: vendor list with status / tier filters and the "New vendor" dialog. */
export function VendorsView() {
  const styles = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("vendor:read");
  const canWrite = usePermission("vendor:write");
  const canReview = usePermission("vendor_submission:review");
  const canStatements = usePermission("payroll:read");
  const [filters, setFilters] = useState<VendorFilters>(EMPTY_VENDOR_FILTERS);
  const [creating, setCreating] = useState(false);
  const list = useVendors(useDeferredValue(filters));

  const columns: TableColumnDefinition<VendorOut>[] = useMemo(
    () => [
      createTableColumn<VendorOut>({
        columnId: "id",
        renderHeaderCell: () => "Vendor",
        renderCell: (v) => <AppLink href={`/vendors/${v.id}`}>{v.human_id}</AppLink>,
      }),
      createTableColumn<VendorOut>({
        columnId: "name",
        renderHeaderCell: () => "Legal name",
        renderCell: (v) => (
          <TableCellLayout truncate>
            <Text weight="semibold">{v.legal_name}</Text>
          </TableCellLayout>
        ),
      }),
      createTableColumn<VendorOut>({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (v) => <VendorStatusBadge status={v.status} /> }),
      createTableColumn<VendorOut>({ columnId: "tier", renderHeaderCell: () => "Tier", renderCell: (v) => <TierBadge tier={v.tier} /> }),
      createTableColumn<VendorOut>({
        columnId: "contact",
        renderHeaderCell: () => "Primary contact",
        renderCell: (v) => <TableCellLayout truncate>{v.primary_contact?.name ?? "—"}</TableCellLayout>,
      }),
      createTableColumn<VendorOut>({ columnId: "created", renderHeaderCell: () => "Added", renderCell: (v) => formatDate(v.created_at) }),
    ],
    [],
  );

  if (!canRead) return <NoAccess what="vendors" />;
  const update = (patch: Partial<VendorFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const items = list.data;

  return (
    <>
      <PageHeader title="Vendors" subtitle="Empanelled staffing vendors, their documents, releases and performance." />
      <Toolbar aria-label="Vendor filters" className={styles.toolbar}>
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New vendor
          </Button>
        )}
        {canReview && (
          <Button icon={<PeopleQueue20Regular />} onClick={() => router.push("/vendors/review")}>
            Review queue
          </Button>
        )}
        {canStatements && (
          <Button icon={<DocumentBulletList20Regular />} onClick={() => router.push("/vendors/statements")}>
            Statements
          </Button>
        )}
        <SearchBox
          className={styles.search}
          placeholder="Search vendors"
          value={filters.q}
          onChange={(_, d) => update({ q: d.value })}
          aria-label="Search vendors"
        />
        <Field label="Status" className={styles.filter}>
          <Dropdown
            value={filters.status ? VENDOR_STATUS_LABELS[filters.status] : "All"}
            selectedOptions={[filters.status ?? ALL]}
            onOptionSelect={(_, d) => update({ status: d.optionValue === ALL ? null : (d.optionValue as VendorStatus) })}
          >
            <Option value={ALL}>All</Option>
            {VENDOR_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {VENDOR_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Tier" className={styles.filter}>
          <Dropdown
            value={filters.tier ?? "All"}
            selectedOptions={[filters.tier ?? ALL]}
            onOptionSelect={(_, d) => update({ tier: d.optionValue === ALL ? null : (d.optionValue as VendorTier) })}
          >
            <Option value={ALL}>All</Option>
            {TIERS.map((t) => (
              <Option key={t} value={t}>
                {t}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </Toolbar>
      <ErrorBar message={list.error ? errorMessage(list.error) : null} />
      <div className={styles.surface}>
        {list.isLoading ? (
          <GridSkeleton />
        ) : !items || items.length === 0 ? (
          <div className={styles.empty}>No vendors yet.</div>
        ) : (
          <DataGrid items={items} columns={columns} getRowId={(v) => v.id} className={mergeClasses(styles.grid)}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<VendorOut>>
              {({ item, rowId }) => (
                <DataGridRow<VendorOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>
      <NewVendorDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/vendors/${id}`)} />
    </>
  );
}

function NewVendorDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const { create } = useVendorMutations();
  const [name, setName] = useState("");
  const [pan, setPan] = useState("");
  const [tier, setTier] = useState<VendorTier | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const panInvalid = pan !== "" && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(pan);

  const submit = async () => {
    setError(null);
    try {
      const out = await create.mutateAsync({
        legal_name: name.trim(),
        pan: pan ? pan.toUpperCase() : null,
        tier,
        primary_contact: Object.fromEntries(Object.entries(contact).filter(([, v]) => v.trim())),
      });
      toast.success(`${out.legal_name} added`);
      onClose();
      onCreated(out.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New vendor</DialogTitle>
          <DialogContent className={styles.form}>
            <ErrorBar message={error} />
            <Field label="Legal name" required>
              <Input value={name} onChange={(_, d) => setName(d.value)} maxLength={300} />
            </Field>
            <Field label="PAN" validationMessage={panInvalid ? "Enter a valid PAN (e.g. ABCDE1234F)" : undefined}>
              <Input value={pan} onChange={(_, d) => setPan(d.value)} maxLength={10} />
            </Field>
            <Field label="Tier">
              <Dropdown
                value={tier ?? ""}
                selectedOptions={tier ? [tier] : []}
                onOptionSelect={(_, d) => setTier(d.optionValue as VendorTier)}
                placeholder="Choose a tier"
              >
                {TIERS.map((t) => (
                  <Option key={t} value={t}>
                    {t}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Primary contact name">
              <Input value={contact.name} onChange={(_, d) => setContact((c) => ({ ...c, name: d.value }))} />
            </Field>
            <Field label="Contact email">
              <Input type="email" value={contact.email} onChange={(_, d) => setContact((c) => ({ ...c, email: d.value }))} />
            </Field>
            <Field label="Contact phone">
              <Input type="tel" value={contact.phone} onChange={(_, d) => setContact((c) => ({ ...c, phone: d.value }))} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!name.trim() || panInvalid || create.isPending} onClick={submit}>
              Create
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
