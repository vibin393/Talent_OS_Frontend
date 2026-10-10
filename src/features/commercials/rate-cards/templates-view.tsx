"use client";

import { Button, createTableColumn, Field, Input, Link, type TableColumnDefinition } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import type { RateCardOut } from "../types";
import { RateCardEditor } from "./rate-card-editor";

/** `/settings/rate-card-templates`: tenant rate card templates (copied as drafts onto clients). */
export function RateCardTemplatesView() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canRead = usePermission("rate_card:read");
  const canWrite = usePermission("rate_card:write");
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery({ queryKey: commercialsKeys.templates, queryFn: ({ signal }) => commercialsApi.templates(signal), enabled: canRead });
  const create = useMutation({
    mutationFn: () => commercialsApi.createTemplate(name.trim()),
    onSuccess: async (t) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: commercialsKeys.templates });
      setOpenId(t.id);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canRead) return <NoAccess what="rate card templates" />;
  if (openId) {
    return (
      <>
        <Button appearance="transparent" onClick={() => setOpenId(null)}>
          ← All templates
        </Button>
        <RateCardEditor cardId={openId} />
      </>
    );
  }
  const columns: TableColumnDefinition<RateCardOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Template",
      renderCell: (t) => (
        <Link as="button" onClick={() => setOpenId(t.id)}>
          {t.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "lines", renderHeaderCell: () => "Lines", renderCell: (t) => t.line_count }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (t) => t.status }),
  ];
  return (
    <>
      <PageHeader title="Rate card templates" subtitle="Standard rate lines to copy onto client rate cards" />
      {canWrite && (
        <div className={admin.toolbar}>
          <Field label="New template">
            <Input value={name} onChange={(_, d) => setName(d.value)} placeholder="IT staffing standard" />
          </Field>
          <Button appearance="primary" icon={<Add20Regular />} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </div>
      )}
      <AdminGrid items={list.data} columns={columns} getRowId={(t) => t.id} loading={list.isPending} error={list.error} emptyText="No templates yet." label="Rate card templates" onRowClick={(t) => setOpenId(t.id)} />
    </>
  );
}
