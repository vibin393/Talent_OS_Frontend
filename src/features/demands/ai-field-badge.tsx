"use client";

import {
  Badge,
  Button,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Checkmark16Regular, Sparkle16Regular } from "@fluentui/react-icons";
import { useAppToast } from "@/components/toast";
import { aiFieldLabel, aiFieldTooltip, pendingAiFields } from "./ai-fields";
import { demandErrorMessage } from "./errors";
import { useConfirmAiFields } from "./use-demand";

const useStyles = makeStyles({
  inline: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXXS, verticalAlign: "middle" },
});

/**
 * "AI-extracted" badge for one or more API fields that are still awaiting confirmation, with a
 * per-field confirm button. Renders nothing once the fields are confirmed or edited.
 */
export function AiFieldBadge({
  demandId,
  extracted,
  fields,
  canConfirm,
  sourceQuote,
}: {
  demandId: string;
  extracted: readonly string[];
  fields: readonly string[];
  canConfirm: boolean;
  /** Epic 55: the verbatim source quote of the Demand Agent extraction (tooltip). */
  sourceQuote?: string | null;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const confirm = useConfirmAiFields(demandId);
  const pending = pendingAiFields(extracted, fields);
  if (pending.length === 0) return null;
  const label = pending.map(aiFieldLabel).join(", ");
  return (
    <span className={styles.inline}>
      <Tooltip content={aiFieldTooltip(label, sourceQuote)} relationship="description">
        <Badge appearance="tint" color="brand" size="small" icon={<Sparkle16Regular />}>
          AI-extracted
        </Badge>
      </Tooltip>
      {canConfirm && (
        <Button
          size="small"
          appearance="subtle"
          icon={confirm.isPending ? <Spinner size="extra-tiny" /> : <Checkmark16Regular />}
          aria-label={`Confirm ${label}`}
          disabled={confirm.isPending}
          onClick={() => confirm.mutateAsync(pending).catch((e) => toast.error(demandErrorMessage(e)))}
        />
      )}
    </span>
  );
}

/** Summary bar listing all AI-extracted fields with "Confirm all". */
export function AiFieldsBar({
  demandId,
  extracted,
  canConfirm,
}: {
  demandId: string;
  extracted: readonly string[];
  canConfirm: boolean;
}) {
  const toast = useAppToast();
  const confirm = useConfirmAiFields(demandId);
  if (extracted.length === 0) return null;
  return (
    <MessageBar intent="info" layout="multiline" icon={<Sparkle16Regular />}>
      <MessageBarBody>
        <MessageBarTitle>Review the AI-extracted fields</MessageBarTitle>
        {extracted.map(aiFieldLabel).join(", ")}. Confirm or edit each one before submitting.
      </MessageBarBody>
      {canConfirm && (
        <MessageBarActions>
          <Button
            appearance="primary"
            size="small"
            disabled={confirm.isPending}
            icon={confirm.isPending ? <Spinner size="extra-tiny" /> : undefined}
            onClick={() =>
              confirm
                .mutateAsync(undefined)
                .then(() => toast.success("AI-extracted fields confirmed"))
                .catch((e) => toast.error(demandErrorMessage(e)))
            }
          >
            Confirm all
          </Button>
        </MessageBarActions>
      )}
    </MessageBar>
  );
}
