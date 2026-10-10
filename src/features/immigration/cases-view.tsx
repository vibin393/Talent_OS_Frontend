"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  Option,
  Switch,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Search20Regular } from "@fluentui/react-icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { UserPicker } from "@/features/admin/user-picker";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { CandidatePicker } from "@/features/privacy/candidate-picker";
import { immigrationApi } from "./api";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  type CaseFilters,
  countryName,
  filtersFromParams,
  formatDate,
  STAGE_CATEGORY_LABELS,
} from "./logic";
import type { CaseStatus, CaseSummaryOut, StageCategory } from "./types";
import { DialogShell, useAction } from "./ui";
import { useCounsel, useImmigrationCases, useImmigrationPermissions, useVisaTypes } from "./use-immigration";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, paddingBlock: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  country: { width: "100px" },
});

const STATUSES = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];
const ALL = "__all__";

/** `/immigration/cases`: immigration cases with status / stage badges, next key date, overdue flag and filters. */
export function ImmigrationCasesView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const params = useSearchParams();
  const { canRead, canManage } = useImmigrationPermissions();
  const [base] = useState<CaseFilters>(() => filtersFromParams(params));
  const [status, setStatus] = useState(base.status ?? "");
  const [visaTypeId, setVisaTypeId] = useState(base.visa_type_id ?? "");
  const [country, setCountry] = useState(base.country ?? "");
  const [overdue, setOverdue] = useState(Boolean(base.overdue));
  const [search, setSearch] = useState(base.q ?? "");
  const [creating, setCreating] = useState(false);
  const q = useDeferredValue(search.trim());
  const filters: CaseFilters = {
    ...base,
    status: status || undefined,
    visa_type_id: visaTypeId || undefined,
    country: country.trim().length === 2 ? country.trim().toUpperCase() : undefined,
    overdue: overdue || undefined,
    q: q || undefined,
  };
  const list = useImmigrationCases(filters, canRead);
  const visaTypes = useVisaTypes(false, canRead);
  if (!canRead) return <NoAccess what="immigration cases" />;
  const open = (c: CaseSummaryOut) => router.push(`/immigration/cases/${c.id}`);
  const vtName = visaTypes.data?.find((v) => v.id === visaTypeId)?.name;
  const extra = [base.stage && `stage ${base.stage}`, base.owner_user_id && "one owner", base.candidate_id && "one person"].filter(Boolean);
  const columns: TableColumnDefinition<CaseSummaryOut>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Case",
      renderCell: (c) => (
        <Link as="button" onClick={() => open(c)}>
          {c.human_id}
        </Link>
      ),
      compare: (a, b) => a.human_id.localeCompare(b.human_id),
    }),
    createTableColumn({
      columnId: "person",
      renderHeaderCell: () => "Person",
      renderCell: (c) => c.candidate_name ?? "—",
      compare: (a, b) => (a.candidate_name ?? "").localeCompare(b.candidate_name ?? ""),
    }),
    createTableColumn({
      columnId: "visa",
      renderHeaderCell: () => "Visa type",
      renderCell: (c) => (
        <span className={styles.stack}>
          <Text>{c.visa_type_name}</Text>
          {c.visa_type_version_no != null && <Text size={200} className={styles.muted}>v{c.visa_type_version_no}</Text>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "country",
      renderHeaderCell: () => "Country",
      renderCell: (c) => `${countryName(c.country)} (${c.country})`,
      compare: (a, b) => a.country.localeCompare(b.country),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) => (
        <span className={styles.stack}>
          <Badge appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
            {CASE_STATUS_LABELS[c.status]}
          </Badge>
          {c.stage_label && (
            <Text size={200} className={styles.muted}>
              {c.stage_category ? `${STAGE_CATEGORY_LABELS[c.stage_category as StageCategory] ?? c.stage_category} · ` : ""}
              {c.stage_label}
            </Text>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (c) => c.owner_name ?? "—" }),
    createTableColumn({
      columnId: "next",
      renderHeaderCell: () => "Next key date",
      renderCell: (c) =>
        c.next_key_date ? (
          <span className={styles.stack}>
            <Text>{formatDate(c.next_key_date)}</Text>
            {c.next_key_date_label && <Text size={200} className={styles.muted}>{c.next_key_date_label}</Text>}
          </span>
        ) : (
          "—"
        ),
      compare: (a, b) => (a.next_key_date ?? "9999").localeCompare(b.next_key_date ?? "9999"),
    }),
    createTableColumn({
      columnId: "overdue",
      renderHeaderCell: () => "SLA",
      renderCell: (c) =>
        c.overdue ? (
          <Badge appearance="filled" color="danger">
            Overdue
          </Badge>
        ) : null,
    }),
  ];
  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Immigration cases" subtitle="Visa and work-permit cases, stages and key dates" />
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New case
          </Button>
        )}
      </div>
      <div className={admin.toolbar}>
        <Field label="Search" className={admin.search}>
          <Input contentBefore={<Search20Regular aria-hidden />} value={search} placeholder="Case ID or person" onChange={(_, d) => setSearch(d.value)} />
        </Field>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            value={status ? CASE_STATUS_LABELS[status as CaseStatus] : "All statuses"}
            selectedOptions={[status || ALL]}
            onOptionSelect={(_, d) => setStatus(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>All statuses</Option>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Visa type" className={admin.filter}>
          <Dropdown
            value={vtName ?? "All visa types"}
            selectedOptions={[visaTypeId || ALL]}
            onOptionSelect={(_, d) => setVisaTypeId(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>All visa types</Option>
            {(visaTypes.data ?? []).map((v) => (
              <Option key={v.id} value={v.id}>
                {v.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Country" hint="ISO code, e.g. GB">
          <Input className={styles.country} maxLength={2} value={country} onChange={(_, d) => setCountry(d.value.toUpperCase())} />
        </Field>
        <Switch label="Overdue only" checked={overdue} onChange={(_, d) => setOverdue(d.checked)} />
      </div>
      {extra.length > 0 && (
        <Text size={200} className={styles.muted}>
          Also filtered by {extra.join(", ")}.{" "}
          <Link as="button" onClick={() => router.push("/immigration/cases")}>
            Clear
          </Link>
        </Text>
      )}
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No immigration cases match these filters."
        label="Immigration cases"
        sortable
        onRowClick={open}
      />
      {creating && <NewCaseDialog onClose={() => setCreating(false)} onCreated={(id) => router.push(`/immigration/cases/${id}`)} />}
    </>
  );
}

function NewCaseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const admin = useAdminStyles();
  const canPickUser = usePermission("user:read");
  const visaTypes = useVisaTypes(false);
  const counsel = useCounsel(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [visaTypeId, setVisaTypeId] = useState("");
  const [counselId, setCounselId] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const { error, busy, run } = useAction(() => undefined, onClose);
  const active = (visaTypes.data ?? []).filter((v) => v.active && !v.archived_at);
  const submit = () =>
    void run(async () => {
      const c = await immigrationApi.createCase({
        candidate_id: candidateId ?? "",
        visa_type_id: visaTypeId,
        counsel_id: counselId || null,
        owner_user_id: ownerId,
      });
      onCreated(c.id);
    });
  return (
    <DialogShell
      title="New immigration case"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || !candidateId || !visaTypeId} onClick={submit}>
            Create case
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <CandidatePicker label="Person" required value={candidateId} onChange={(id) => setCandidateId(id)} />
        <Field label="Visa type" required hint={active.length === 0 ? "Adopt or create a visa type in Immigration settings first." : undefined}>
          <Dropdown
            value={active.find((v) => v.id === visaTypeId)?.name ?? ""}
            selectedOptions={visaTypeId ? [visaTypeId] : []}
            placeholder="Choose a visa type"
            onOptionSelect={(_, d) => setVisaTypeId(String(d.optionValue))}
          >
            {active.map((v) => (
              <Option key={v.id} value={v.id} text={v.name}>
                {v.name} ({v.country})
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Counsel">
          <Dropdown
            value={counsel.data?.find((x) => x.id === counselId)?.name ?? "None"}
            selectedOptions={[counselId || ALL]}
            onOptionSelect={(_, d) => setCounselId(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>None</Option>
            {(counsel.data ?? []).map((x) => (
              <Option key={x.id} value={x.id} text={x.name}>
                {x.name}
                {x.firm ? ` · ${x.firm}` : ""}
              </Option>
            ))}
          </Dropdown>
        </Field>
        {canPickUser && <UserPicker label="Owner" value={ownerId} onChange={(id) => setOwnerId(id)} clearLabel="Me (default)" />}
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}
