"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, Mail20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { EmailTemplateOut } from "@/lib/api/types";
import { languageLabel, templateKeyLabel } from "./template-keys";
import { useTemplates } from "./use-templates";

/** `/admin/email-templates`: the tenant's email templates (system templates are editable, not deletable). */
export function TemplatesAdmin() {
  const styles = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("email_template:read");
  const canManage = usePermission("email_template:manage");
  const [archived, setArchived] = useState(false);
  const templates = useTemplates(null, archived);

  if (!canRead) return <NoAccess what="email templates" />;

  const columns: TableColumnDefinition<EmailTemplateOut>[] = [
    createTableColumn<EmailTemplateOut>({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Name",
      renderCell: (t) => (
        <TableCellLayout media={<Mail20Regular aria-hidden />} description={t.description ?? undefined}>
          <Text weight="semibold">{t.name}</Text>
          {t.archived_at && (
            <Badge appearance="tint" color="subtle" style={{ marginInlineStart: 8 }}>
              Archived
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn<EmailTemplateOut>({
      columnId: "key",
      compare: (a, b) => templateKeyLabel(a.key).localeCompare(templateKeyLabel(b.key)),
      renderHeaderCell: () => "Type",
      renderCell: (t) => templateKeyLabel(t.key),
    }),
    createTableColumn<EmailTemplateOut>({
      columnId: "languages",
      renderHeaderCell: () => "Languages",
      renderCell: (t) => t.languages.map(languageLabel).join(", ") || "—",
    }),
    createTableColumn<EmailTemplateOut>({
      columnId: "system",
      compare: (a, b) => Number(b.is_system) - Number(a.is_system),
      renderHeaderCell: () => "System",
      renderCell: (t) =>
        t.is_system ? (
          <Badge appearance="tint" color="brand">
            System
          </Badge>
        ) : (
          <Badge appearance="outline" color="informative">
            Custom
          </Badge>
        ),
    }),
    createTableColumn<EmailTemplateOut>({
      columnId: "updated",
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
      renderHeaderCell: () => "Updated",
      renderCell: (t) => formatDateTime(t.updated_at),
    }),
  ];

  return (
    <>
      <PageHeader
        title="Email templates"
        subtitle="Reusable messages with merge fields, used when people email from Talent OS and by automated emails."
      />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/admin/email-templates/new")}>
            New template
          </Button>
        )}
        <div className={styles.grow} />
        <Switch checked={archived} onChange={(_, d) => setArchived(d.checked)} label="Show archived" />
      </div>
      <AdminGrid
        items={templates.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={templates.isPending}
        error={templates.error}
        emptyText="No templates yet."
        label="Email templates"
        sortable
        onRowClick={(t) => router.push(`/admin/email-templates/${t.id}`)}
      />
    </>
  );
}
