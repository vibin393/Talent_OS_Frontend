"use client";

import {
  Button,
  Card,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { isApiError } from "@/lib/api/errors";
import type { ResumeDraftOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { CandidateFormFields } from "./candidate-form";
import { createdMessage } from "./candidate-form-drawer";
import { candidateErrorMessage } from "./errors";
import { FileDrop } from "./file-drop";
import { formatRole, PARSE_STATUS } from "./format";
import {
  type CandidateFormValues,
  emptyCandidateForm,
  type FormErrors,
  formToCreate,
  prefillToForm,
  serverFieldErrors,
  validateCandidateForm,
} from "./form";
import { RESUME_EXTENSIONS, validateSingleUpload } from "./import-validation";
import { useCandidateMutation } from "./use-candidates";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "1040px" },
  card: { padding: tokens.spacingHorizontalXL },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalL },
  dupes: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

/**
 * `/candidates/new`: with `fromResume` upload -> "Parsing…" -> confirmation form pre-filled from the parsed
 * resume (AI badges, unresolved skills, parse status, duplicates); otherwise a blank form.
 */
export function NewCandidatePage({ fromResume }: { fromResume: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canCreate = usePermission("candidate:create");
  const [draft, setDraft] = useState<ResumeDraftOut | null>(null);
  const [values, setValues] = useState<CandidateFormValues | null>(fromResume ? null : emptyCandidateForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const parse = useCandidateMutation({ mutationFn: (file: File) => candidatesApi.resumeDraft(file) });
  const create = useCandidateMutation({
    mutationFn: (v: CandidateFormValues) => candidatesApi.create(formToCreate(v, draft?.resume.id)),
    invalidate: [candidateKeys.lists, candidateKeys.duplicates],
  });

  if (!canCreate) return <NoAccess what="candidate creation" />;

  async function onFiles(files: File[]) {
    const file = files[0];
    setUploadError(null);
    const problem = validateSingleUpload(file, RESUME_EXTENSIONS);
    if (problem) {
      setUploadError(problem);
      return;
    }
    try {
      const d = await parse.mutateAsync(file);
      setDraft(d);
      setValues(prefillToForm(d.prefill, (d.unresolved_skills ?? []).map((u) => u.name)));
    } catch (e) {
      setUploadError(candidateErrorMessage(e));
    }
  }

  async function save() {
    if (!values) return;
    const errs = validateCandidateForm(values);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) {
      setFormError("Fix the highlighted fields.");
      return;
    }
    try {
      const created = await create.mutateAsync(values);
      toast.success(createdMessage(created));
      router.push(`/candidates/${created.id}`);
    } catch (e) {
      setErrors(isApiError(e) ? serverFieldErrors(e.details.fields) : {});
      setFormError(candidateErrorMessage(e));
    }
  }

  const status = draft ? PARSE_STATUS[draft.parse_status] : null;
  return (
    <div className={styles.root}>
      <PageHeader
        title={fromResume ? "New candidate from resume" : "New candidate"}
        subtitle={
          fromResume
            ? "Upload a resume. Parsed details are pre-filled for you to check before saving."
            : "Enter the candidate's details."
        }
      />
      {fromResume && !values && (
        <>
          <ErrorBar message={uploadError} />
          {parse.isPending ? (
            <Card className={styles.card}>
              <Spinner label="Parsing…" labelPosition="below" size="large" />
            </Card>
          ) : (
            <FileDrop
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              title="Drop a resume here"
              hint="PDF or DOCX, up to 10 MB."
              buttonLabel="Upload resume"
              onFiles={onFiles}
            />
          )}
        </>
      )}

      {draft && status && (
        <MessageBar intent={status.intent} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{status.label}</MessageBarTitle>
            {draft.parse_status === "parsed"
              ? " Fields marked AI were filled from the resume. Check them before saving."
              : " The resume is attached; fill in the details manually."}
            {draft.warnings?.length ? (
              <ul className={styles.dupes}>
                {draft.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </MessageBarBody>
        </MessageBar>
      )}
      {draft?.unresolved_skills?.length ? (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Unresolved skills</MessageBarTitle>
            {draft.unresolved_skills.map((u) => u.name).join(", ")} are not in the skill catalog. They will be added as
            pending skills for review.
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {draft?.possible_duplicates?.length ? (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Possible duplicates</MessageBarTitle>
            This person may already exist:
            <ul className={styles.dupes}>
              {draft.possible_duplicates.map((d) => (
                <li key={d.id}>
                  {d.full_name} ({d.human_id}) · {formatRole(d.current_title, d.current_employer)} ·{" "}
                  <Link href={`/candidates/${d.id}`} target="_blank" rel="noopener noreferrer">
                    Open existing
                  </Link>
                </li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      ) : null}

      {values && (
        <Card className={styles.card}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <ErrorBar message={formError} />
            <CandidateFormFields
              values={values}
              errors={errors}
              aiFields={draft?.parse_status === "parsed" ? (draft.ai_fields ?? []) : []}
              onChange={(patch) => setValues((v) => (v ? { ...v, ...patch } : v))}
            />
            <div className={styles.footer}>
              <Button
                appearance="primary"
                type="submit"
                disabled={create.isPending}
                icon={create.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Save candidate
              </Button>
              {fromResume && (
                <Button
                  disabled={create.isPending}
                  onClick={() => {
                    setDraft(null);
                    setValues(null);
                    setErrors({});
                    setFormError(null);
                  }}
                >
                  Use another resume
                </Button>
              )}
              <AppLink href="/candidates">Cancel</AppLink>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
