"use client";

import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OptionCombobox } from "@/features/campaigns/option-combobox";
import { useMarketingOptions } from "@/features/campaigns/use-marketing";
import { errorMessage } from "@/lib/api/errors";
import { sequenceKeys, sequencesApi } from "./api";
import { enrolSummary, refusalCounts } from "./enrol-logic";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
});

/**
 * "Enrol in Sequence" dialog. Pass `candidateIds` (pool page, rediscovery, bulk actions) or an `audienceId`.
 * `sequenceId` preselects the sequence (e.g. from the sequence page).
 */
export function EnrolDialog({
  candidateIds,
  audienceId,
  sequenceId,
  title,
  onClose,
  onEnrolled,
}: {
  candidateIds?: string[];
  audienceId?: string;
  sequenceId?: string;
  title?: string;
  onClose: () => void;
  onEnrolled?: (enrolled: number) => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const options = useMarketingOptions(!sequenceId);
  const [selected, setSelected] = useState<string | null>(sequenceId ?? null);
  const [touched, setTouched] = useState(false);
  const count = candidateIds?.length ?? 0;
  const enrol = useMutation({
    mutationFn: () =>
      sequencesApi.enrol(selected as string, audienceId ? { audience_id: audienceId } : { candidate_ids: candidateIds ?? [] }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: sequenceKeys.all });
      onEnrolled?.(r.enrolled);
    },
  });
  const result = enrol.data;
  const refusals = result ? refusalCounts(result.refused) : [];
  const nothing = !audienceId && count === 0;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !enrol.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title ?? "Enrol in sequence"}</DialogTitle>
          <DialogContent className={styles.form}>
            {result ? (
              <MessageBar intent={result.enrolled > 0 ? "success" : "warning"} layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>{enrolSummary(result)}</MessageBarTitle>
                  {refusals.length > 0 && (
                    <ul className={styles.list}>
                      {refusals.map((r) => (
                        <li key={r.reason}>
                          {r.label}: {r.count.toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  )}
                </MessageBarBody>
              </MessageBar>
            ) : (
              <>
                <Body1>
                  {audienceId
                    ? "Everyone in the audience is enrolled. Consent and frequency caps are checked before each message."
                    : nothing
                      ? "Select candidates first."
                      : `${count.toLocaleString()} ${count === 1 ? "candidate" : "candidates"} will be enrolled. Consent and frequency caps are checked before each message.`}
                </Body1>
                {!sequenceId && (
                  <OptionCombobox
                    label="Sequence"
                    required
                    placeholder="Search active sequences"
                    options={options.data?.sequences ?? []}
                    value={selected}
                    onChange={(o) => setSelected(o?.id ?? null)}
                    validationMessage={touched && !selected ? "Choose a sequence." : undefined}
                  />
                )}
                {enrol.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>{errorMessage(enrol.error, "Could not enrol.")}</MessageBarBody>
                  </MessageBar>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {result ? (
              <Button appearance="primary" onClick={onClose}>
                Done
              </Button>
            ) : (
              <>
                <Button appearance="secondary" onClick={onClose} disabled={enrol.isPending}>
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  disabled={enrol.isPending || nothing}
                  onClick={() => {
                    setTouched(true);
                    if (selected) enrol.mutate();
                  }}
                >
                  Enrol
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
