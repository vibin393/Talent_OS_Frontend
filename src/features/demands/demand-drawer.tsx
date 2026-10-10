"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Spinner } from "@fluentui/react-components";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import type { DemandOut } from "@/lib/api/types";
import { DemandForm } from "./demand-form";
import { demandErrorMessage } from "./errors";
import {
  API_TO_FORM,
  buildDemandCreate,
  buildDemandUpdate,
  demandFormDefaults,
  demandFormSchema,
  type DemandFormValues,
} from "./form";
import { useUpdateDemand } from "./use-demand";
import { useCreateDemand } from "./use-demands";

/**
 * New / edit demand in a large right-side `OverlayDrawer`. Edits send only the changed fields, so
 * saving a field clears its "AI-extracted" badge (server-side) without touching the others.
 */
export function DemandDrawer({
  demand,
  initialClient,
  onClose,
  onSaved,
}: {
  demand?: DemandOut | null;
  initialClient?: { id: string; name: string } | null;
  onClose: () => void;
  onSaved?: (demand: DemandOut) => void;
}) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const canComp = usePermission("compensation:view");
  const canUpdate = usePermission("demand:update");
  const editing = !!demand;
  const create = useCreateDemand();
  const update = useUpdateDemand(demand?.id ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const showComp = canComp && !(demand?.masked_fields ?? []).includes("bill_rate");

  const form = useForm<DemandFormValues>({
    resolver: zodResolver(demandFormSchema),
    defaultValues: demandFormDefaults(demand, initialClient),
  });
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      let saved: DemandOut;
      if (demand) {
        const body = buildDemandUpdate(demand, values, showComp);
        if (Object.keys(body).length === 0) {
          onClose();
          return;
        }
        saved = await update.mutateAsync(body);
      } else {
        saved = await create.mutateAsync(buildDemandCreate(values, showComp));
      }
      toast.success(editing ? `Saved ${saved.req_id}` : `Created ${saved.req_id} as a draft`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const fields = fieldErrors(err);
        let mapped = false;
        for (const [name, message] of Object.entries(fields)) {
          const target = API_TO_FORM[name];
          if (target) {
            form.setError(target, { message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      setFormError(demandErrorMessage(err));
    }
  });

  return (
    <DetailsDrawer
      open
      size="large"
      title={editing ? `Edit ${demand.req_id}` : "New demand"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button
            appearance="primary"
            type="submit"
            form="demand-form"
            disabled={pending || (editing && !canUpdate)}
            icon={pending ? <Spinner size="tiny" /> : undefined}
          >
            {editing ? "Save changes" : "Create draft"}
          </Button>
          <Button appearance="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="demand-form" className={admin.form} onSubmit={onSubmit} noValidate>
        <ErrorBar message={formError} />
        <DemandForm
          form={form}
          showCompensation={showComp}
          clientLocked={editing && demand.status !== "draft"}
          ai={
            demand && demand.ai_extracted_fields.length
              ? { demandId: demand.id, extracted: demand.ai_extracted_fields, canConfirm: canUpdate }
              : undefined
          }
        />
      </form>
    </DetailsDrawer>
  );
}
