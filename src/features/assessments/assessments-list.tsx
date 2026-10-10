"use client";

import {
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  Link,
  mergeClasses,
  Option,
  Radio,
  RadioGroup,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, BookQuestionMark20Regular, ClipboardTask20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { assessmentsApi } from "./api";
import { ASSESSMENT_STATUS_LABELS, DELIVERY_LABELS, emptySettings, toSettingsBody } from "./logic";
import type { AssessmentOut, AssessmentStatus, Delivery } from "./types";
import { AssessmentStatusBadge, DialogShell, useAction, useAsmStyles } from "./ui";
import { useAssessmentPermissions, useAssessments } from "./use-assessments";

const ALL = "__all__";

/** `/assessments`: assessments with status, delivery and current version; links to the item bank and review queue. */
export function AssessmentsList() {
  const admin = useAdminStyles();
  const styles = useAsmStyles();
  const router = useRouter();
  const { canRead, canAuthor, canReview } = useAssessmentPermissions();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useAssessments(status || undefined, canRead || canAuthor);
  if (!canRead && !canAuthor) return <NoAccess what="assessments" />;
  const open = (a: AssessmentOut) => router.push(`/assessments/${a.id}`);
  const columns: TableColumnDefinition<AssessmentOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (a) => (
        <span className={admin.cellStack}>
          <Link as="button" onClick={() => open(a)}>
            {a.name}
          </Link>
          {a.description && (
            <Text size={200} className={mergeClasses(admin.muted, admin.truncate)}>
              {a.description}
            </Text>
          )}
        </span>
      ),
      compare: (a, b) => a.name.localeCompare(b.name),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (a) => <AssessmentStatusBadge status={a.status} /> }),
    createTableColumn({ columnId: "delivery", renderHeaderCell: () => "Delivery", renderCell: (a) => DELIVERY_LABELS[a.delivery] ?? a.delivery }),
    createTableColumn({
      columnId: "version",
      renderHeaderCell: () => "Current version",
      renderCell: (a) => (a.current_version_no != null ? `v${a.current_version_no}` : "—"),
      compare: (a, b) => (a.current_version_no ?? 0) - (b.current_version_no ?? 0),
    }),
    createTableColumn({
      columnId: "updated",
      renderHeaderCell: () => "Updated",
      renderCell: (a) => formatDateTime(a.updated_at),
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
    }),
  ];
  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Assessments" subtitle="Skill tests, item bank and reviews" />
        <div className={styles.rowCenter}>
          <AppLink href="/assessments/items">
            <span className={styles.rowCenter}>
              <BookQuestionMark20Regular aria-hidden /> Item bank
            </span>
          </AppLink>
          {canReview && (
            <AppLink href="/assessments/reviews">
              <span className={styles.rowCenter}>
                <ClipboardTask20Regular aria-hidden /> Review queue
              </span>
            </AppLink>
          )}
          {canAuthor && (
            <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
              New assessment
            </Button>
          )}
        </div>
      </div>
      <div className={admin.toolbar}>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            value={status ? ASSESSMENT_STATUS_LABELS[status as AssessmentStatus] : "All statuses"}
            selectedOptions={[status || ALL]}
            onOptionSelect={(_, d) => setStatus(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>All statuses</Option>
            {(Object.keys(ASSESSMENT_STATUS_LABELS) as AssessmentStatus[]).map((s) => (
              <Option key={s} value={s}>
                {ASSESSMENT_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(a) => a.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No assessments yet."
        label="Assessments"
        sortable
        onRowClick={open}
      />
      {creating && <NewAssessmentDialog onClose={() => setCreating(false)} onCreated={(id) => router.push(`/assessments/${id}`)} />}
    </>
  );
}

function NewAssessmentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const styles = useAsmStyles();
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("builtin");
  const { error, busy, run } = useAction(() => undefined, onClose);
  const submit = () =>
    void run(async () => {
      const body = toSettingsBody({ ...emptySettings(name), delivery });
      const a = await assessmentsApi.create(body);
      onCreated(a.id);
    });
  return (
    <DialogShell
      title="New assessment"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || !name.trim()} onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Delivery" hint="Provider tests are taken on the provider's site; results are imported.">
          <RadioGroup value={delivery} onChange={(_, d) => setDelivery(d.value as Delivery)}>
            <Radio value="builtin" label="Built-in (items from the item bank)" />
            <Radio value="provider" label="Provider" />
          </RadioGroup>
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}
