"use client";

import { Button, Spinner } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { isApiError } from "@/lib/api/errors";
import type { Candidate360Out, CandidateCreatedOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { CandidateFormFields } from "./candidate-form";
import { candidateErrorMessage } from "./errors";
import { isCompensationMasked } from "./format";
import {
  type CandidateFormValues,
  candidateToForm,
  emptyCandidateForm,
  type FormErrors,
  formToCreate,
  formToUpdate,
  serverFieldErrors,
  validateCandidateForm,
} from "./form";
import { useCandidateMutation } from "./use-candidates";

/** Toast text after a create: mentions possible duplicates. */
export function createdMessage(c: CandidateCreatedOut): string {
  const dupes = c.warnings?.possible_duplicates?.length ?? 0;
  return dupes
    ? `Created ${c.human_id}. ${dupes} possible duplicate${dupes === 1 ? "" : "s"} flagged for review.`
    : `Created ${c.human_id} ${c.full_name}`;
}

/** Right-side drawer: "New candidate" (no `candidate`) or edit profile. */
export function CandidateFormDrawer({
  candidate,
  onClose,
}: {
  candidate?: Candidate360Out | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const [values, setValues] = useState<CandidateFormValues>(() => (candidate ? candidateToForm(candidate) : emptyCandidateForm()));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const masked = !!candidate && (isCompensationMasked(candidate, "current") || isCompensationMasked(candidate, "expected"));

  const save = useCandidateMutation({
    mutationFn: (v: CandidateFormValues) =>
      candidate ? candidatesApi.update(candidate.id, formToUpdate(v, candidate)) : candidatesApi.create(formToCreate(v)),
    invalidate: candidate ? [candidateKeys.detail(candidate.id), candidateKeys.lists] : [candidateKeys.lists, candidateKeys.duplicates],
  });

  async function submit() {
    const errs = validateCandidateForm(values);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) {
      setFormError("Fix the highlighted fields.");
      return;
    }
    try {
      const result = await save.mutateAsync(values);
      if (candidate) {
        toast.success(`Saved ${result.full_name}`);
        onClose();
      } else {
        const created = result as CandidateCreatedOut;
        toast.success(createdMessage(created));
        onClose();
        router.push(`/candidates/${created.id}`);
      }
    } catch (e) {
      const fields = isApiError(e) ? serverFieldErrors(e.details.fields) : {};
      setErrors(fields);
      setFormError(candidateErrorMessage(e));
    }
  }

  const busy = save.isPending;
  return (
    <DetailsDrawer
      open
      size="large"
      title={candidate ? `Edit ${candidate.full_name}` : "New candidate"}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            {candidate ? "Save changes" : "Create candidate"}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ErrorBar message={formError} />
        <CandidateFormFields
          values={values}
          errors={errors}
          compensationHidden={masked}
          showSkills={!candidate}
          showTags={!candidate}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        />
      </form>
    </DetailsDrawer>
  );
}
