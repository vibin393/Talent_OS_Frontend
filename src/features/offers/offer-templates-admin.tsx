"use client";

import {
  Badge,
  Button,
  Card,
  createTableColumn,
  Field,
  Input,
  makeStyles,
  Spinner,
  SpinButton,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  TableCellLayout,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { employmentLabel } from "./format";
import { TemplateEditor } from "./template-editor";
import type { OfferSettingsOut, OfferTemplateOut } from "./types";
import { useArchiveOfferTemplate, useOfferSettings, useOfferTemplates, useSaveOfferSettings } from "./use-offer-templates";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalM },
  toolbar: { display: "flex", justifyContent: "flex-end", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "560px", padding: tokens.spacingHorizontalL },
});

/** `/admin/offer-templates`: offer letter templates and offer settings (default expiry, signatory, release email). */
export function OfferTemplatesAdmin() {
  const styles = useStyles();
  const allowed = usePermission("offer_template:manage");
  const [tab, setTab] = useState<"templates" | "settings">("templates");
  if (!allowed) return <NoAccess what="offer templates" />;
  return (
    <>
      <PageHeader title="Offer letters" subtitle="Letter templates with merge fields, and defaults for new offers." />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as "templates" | "settings")} aria-label="Offer settings">
        <Tab value="templates">Templates</Tab>
        <Tab value="settings">Offer settings</Tab>
      </TabList>
      {tab === "templates" ? <TemplatesTab /> : <SettingsTab />}
    </>
  );
}

function TemplatesTab() {
  const styles = useStyles();
  const toast = useAppToast();
  const [showArchived, setShowArchived] = useState(false);
  const templates = useOfferTemplates(showArchived);
  const archive = useArchiveOfferTemplate();
  const [editing, setEditing] = useState<OfferTemplateOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<OfferTemplateOut | null>(null);
  const columns: TableColumnDefinition<OfferTemplateOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Template",
      renderCell: (t) => (
        <TableCellLayout truncate>
          {t.name}{" "}
          {t.is_default && (
            <Badge appearance="tint" color="brand">
              Default
            </Badge>
          )}{" "}
          {t.archived_at && (
            <Badge appearance="outline" color="subtle">
              Archived
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "types",
      renderHeaderCell: () => "Employment types",
      renderCell: (t) => (t.employment_types.length ? t.employment_types.map(employmentLabel).join(", ") : "All"),
    }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (t) => `v${t.version} · ${formatDateTime(t.updated_at)}` }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (t) =>
        t.archived_at ? null : (
          <Button
            size="small"
            appearance="subtle"
            onClick={(e) => {
              e.stopPropagation();
              setArchiving(t);
            }}
          >
            Archive
          </Button>
        ),
    }),
  ];
  return (
    <>
      <div className={styles.toolbar}>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New template
        </Button>
      </div>
      <AdminGrid
        items={templates.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={templates.isPending}
        error={templates.error}
        emptyText="No offer templates yet."
        label="Offer templates"
        onRowClick={(t) => !t.archived_at && setEditing(t)}
      />
      {editing && <TemplateEditor template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title={`Archive “${archiving?.name ?? ""}”?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await archive.mutateAsync(archiving.id);
            toast.success(`Archived “${archiving.name}”`);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Offers already using it keep their rendered letters. It can no longer be picked for new offers.
      </ConfirmDialog>
    </>
  );
}

function SettingsTab() {
  const q = useOfferSettings();
  if (q.isPending) return <GridSkeleton rows={4} />;
  if (q.isError) return <ErrorBar title="Could not load offer settings." message={errorMessage(q.error)} />;
  return <SettingsForm key={JSON.stringify(q.data)} settings={q.data} />;
}

function SettingsForm({ settings }: { settings: OfferSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const save = useSaveOfferSettings();
  const [v, setV] = useState(settings);
  const errs = fieldErrors(save.error);
  const num = (key: "default_expiry_days" | "response_link_grace_hours", min: number, max: number) => (
    <SpinButton
      value={v[key]}
      min={min}
      max={max}
      onChange={(_, d) => {
        const n = d.value ?? Number(d.displayValue);
        if (Number.isFinite(n)) setV((x) => ({ ...x, [key]: Number(n) }));
      }}
    />
  );
  return (
    <Card className={styles.form}>
      <ErrorBar message={save.error && !Object.keys(errs).length ? errorMessage(save.error) : null} />
      <Field label="Offers expire after (days)" hint="Default expiry for new offers." validationMessage={errs.default_expiry_days}>
        {num("default_expiry_days", 1, 90)}
      </Field>
      <Field label="Signatory name" validationMessage={errs.signatory_name}>
        <Input value={v.signatory_name ?? ""} maxLength={200} onChange={(_, d) => setV((x) => ({ ...x, signatory_name: d.value }))} />
      </Field>
      <Field label="Signatory title" validationMessage={errs.signatory_title}>
        <Input value={v.signatory_title ?? ""} maxLength={200} onChange={(_, d) => setV((x) => ({ ...x, signatory_title: d.value }))} />
      </Field>
      <Field label="Grace period for response links (hours)" hint="Extra time the candidate's link stays usable after expiry." validationMessage={errs.response_link_grace_hours}>
        {num("response_link_grace_hours", 0, 168)}
      </Field>
      <Switch
        label="Attach the letter PDF to the release email"
        checked={v.attach_letter_to_release_email}
        onChange={(_, d) => setV((x) => ({ ...x, attach_letter_to_release_email: d.checked }))}
      />
      <div>
        <Button
          appearance="primary"
          disabled={save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={() =>
            save.mutate(
              {
                default_expiry_days: v.default_expiry_days,
                signatory_name: v.signatory_name?.trim() || null,
                signatory_title: v.signatory_title?.trim() || null,
                response_link_grace_hours: v.response_link_grace_hours,
                attach_letter_to_release_email: v.attach_letter_to_release_email,
              },
              { onSuccess: () => toast.success("Offer settings saved") },
            )
          }
        >
          Save settings
        </Button>
      </div>
    </Card>
  );
}
