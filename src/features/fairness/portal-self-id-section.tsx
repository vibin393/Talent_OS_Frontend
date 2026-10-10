"use client";

import { Body1, Button, Card, Subtitle1 } from "@fluentui/react-components";
import { Delete20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { SelfIdQuestions } from "@/components/self-id/self-id-questions";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog } from "@/features/admin/ui";
import { ErrorBlock, LoadingBlock, usePortalStyles } from "@/features/portal/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { answersPayload, defaultAnswers, SELF_ID_STATEMENT, visibleDimensions } from "./logic";
import type { SelfIdAnswers } from "./types";
import { useDeletePortalSelfId, usePortalSelfId, useSavePortalSelfId } from "./use-fairness";

/** Candidate Portal privacy page: view, change or delete own self-identification answers (Epic 49). */
export function PortalSelfIdSection() {
  const styles = usePortalStyles();
  const toast = useAppToast();
  const q = usePortalSelfId();
  const save = useSavePortalSelfId();
  const del = useDeletePortalSelfId();
  const [edited, setEdited] = useState<SelfIdAnswers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (q.isError && isApiError(q.error) && (q.error.status === 403 || q.error.status === 404)) return null;
  if (q.data && (!q.data.enabled || visibleDimensions(q.data.dimensions).length === 0)) return null;

  const data = q.data;
  const value = edited ?? (data ? defaultAnswers(data.dimensions, data.answers) : {});
  const hasAnswers = !!data?.answers && Object.keys(data.answers).length > 0;

  const submit = async () => {
    if (!data?.notice) return;
    setError(null);
    try {
      await save.mutateAsync({ notice_id: data.notice.id, answers: answersPayload(data.dimensions, value) });
      setEdited(null);
      toast.success("Your answers were saved.");
    } catch (e) {
      if (isApiError(e) && e.code === "notice_outdated") {
        setError("The notice was updated. Please read the new version and save again.");
        void q.refetch();
      } else setError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.card} role="region" aria-labelledby="self-id-title" id="self-id">
      <Subtitle1 as="h2" id="self-id-title">
        Self-identification
      </Subtitle1>
      <Body1 className={styles.muted}>
        {SELF_ID_STATEMENT} {hasAnswers ? "You have answered these questions; you can change or delete your answers." : "You have not answered these questions."}
      </Body1>
      {q.isPending ? (
        <LoadingBlock label="Loading self-identification" rows={2} />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} />
      ) : (
        data && (
          <SelfIdQuestions
            dimensions={data.dimensions}
            notice={data.notice}
            value={value}
            onChange={setEdited}
            onSubmit={submit}
            submitLabel={hasAnswers ? "Update answers" : "Save answers"}
            busy={save.isPending || del.isPending}
            error={error}
            headingLevel="h3"
            title="Your answers"
            extraActions={
              hasAnswers ? (
                <Button className={styles.button} icon={<Delete20Regular />} onClick={() => setConfirmDelete(true)} disabled={del.isPending}>
                  Delete my answers
                </Button>
              ) : undefined
            }
          />
        )
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete your self-identification answers?"
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await del.mutateAsync();
            setEdited(null);
            toast.success("Your answers were deleted.");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Your answers are deleted and your consent is withdrawn. This does not affect your applications.
      </ConfirmDialog>
    </Card>
  );
}
