"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  RadioGroup,
} from "@fluentui/react-components";
import { FolderAdd20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { commercialsApi } from "../api";
import { missingSowTerms, PRICING_MODEL_LABELS, PRICING_MODELS, SOW_TERM_LABELS, type SowTermField } from "../sow";
import type { ContractOut, PricingModel } from "../types";

/**
 * Epic 45: SOW terms notice on the contract detail. Shows what is missing before submit / activate (or what a
 * `422 sow_terms_required` named in `required`) and lets a writer set pricing model + total value.
 */
export function SowTermsBar({
  contract,
  canWrite,
  required,
  onSaved,
}: {
  contract: ContractOut;
  canWrite: boolean;
  required: SowTermField[] | null;
  onSaved: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  if (contract.contract_type !== "sow") return null;
  const missing = required ?? (contract.status === "draft" ? missingSowTerms(contract) : []);
  if (!missing.length && !editing) return null;
  return (
    <>
      {missing.length > 0 && (
        <MessageBar intent={required ? "error" : "warning"} layout="multiline" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            <MessageBarTitle>SOW terms required</MessageBarTitle>
            Set {missing.map((f) => SOW_TERM_LABELS[f]).join(" and ")} before submitting or activating this SOW.
          </MessageBarBody>
          {canWrite && contract.status === "draft" && (
            <MessageBarActions>
              <Button onClick={() => setEditing(true)}>Set SOW terms</Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
      {editing && <SowTermsDialog contract={contract} missing={missing} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </>
  );
}

function SowTermsDialog({
  contract,
  missing,
  onClose,
  onSaved,
}: {
  contract: ContractOut;
  missing: SowTermField[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const [model, setModel] = useState<PricingModel | "">(contract.pricing_model ?? "");
  const [total, setTotal] = useState(contract.value_cap ?? "");
  const save = useMutation({
    mutationFn: () => commercialsApi.updateContract(contract.id, { pricing_model: model || null, value_cap: total.trim() || null }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const stillMissing = missingSowTerms({ contract_type: "sow", pricing_model: model || null, value_cap: total });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>SOW terms</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={save.error && !Object.keys(errors).length ? errorMessage(save.error) : null} />
              <Field
                label="Pricing model"
                required
                validationState={missing.includes("pricing_model") && !model ? "error" : "none"}
                validationMessage={errors.pricing_model ?? (missing.includes("pricing_model") && !model ? "Choose a pricing model" : undefined)}
              >
                <RadioGroup value={model} onChange={(_, d) => setModel(d.value as PricingModel)}>
                  {PRICING_MODELS.map((m) => (
                    <Radio key={m} value={m} label={PRICING_MODEL_LABELS[m]} />
                  ))}
                </RadioGroup>
              </Field>
              <Field
                label="Total value"
                required
                validationState={stillMissing.includes("value_cap") && missing.includes("value_cap") ? "error" : "none"}
                validationMessage={errors.value_cap ?? (stillMissing.includes("value_cap") && missing.includes("value_cap") ? "Enter the SOW total value" : undefined)}
              >
                <Input value={total} inputMode="decimal" contentAfter={contract.currency} onChange={(_, d) => setTotal(d.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={stillMissing.length > 0 || save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Epic 45: "Create project" from a SOW (opens the projects create dialog pre-filled). */
export function CreateProjectFromSowButton({ contract }: { contract: ContractOut }) {
  const router = useRouter();
  const canCreate = usePermission("project:write");
  if (contract.contract_type !== "sow" || !canCreate || contract.status === "terminated") return null;
  return (
    <Button icon={<FolderAdd20Regular />} onClick={() => router.push(`/projects?new=1&contract_id=${encodeURIComponent(contract.id)}`)}>
      Create project
    </Button>
  );
}
