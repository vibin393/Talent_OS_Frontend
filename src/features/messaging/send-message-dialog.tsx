"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import { CHANNEL_LABELS, eligibilityBadge, eligibleCount, newIdempotencyKey, PURPOSE_LABELS, reasonLabel, sendableTemplates } from "./logic";
import type { Channel, Recipient, SendResult } from "./types";

const useStyles = makeStyles({
  surface: { width: "640px", maxWidth: "calc(100vw - 32px)" },
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxHeight: "360px", overflowY: "auto" },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  rowHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, justifyContent: "space-between" },
  preview: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: tokens.colorNeutralForeground2, backgroundColor: tokens.colorNeutralBackground2, padding: tokens.spacingHorizontalS, borderRadius: tokens.borderRadiusSmall },
  muted: { color: tokens.colorNeutralForeground3 },
});

export type MessageRecipient = Recipient & { label: string };

const SEND_ERRORS: Record<string, string> = {
  template_not_registered: "This template is not registered with the provider yet. Ask an admin to add its DLT ID / approved template name.",
  channel_disabled: "This channel is turned off for your organisation.",
};

/**
 * Compose an SMS or WhatsApp message from a registered template (Epic 33). Used from Candidate 360 and
 * list bulk actions: per-recipient eligibility badges with a merge preview, then a result per recipient.
 */
export function SendMessageDialog({
  recipients,
  contextRefs,
  defaultChannel = "sms",
  onClose,
}: {
  recipients: MessageRecipient[];
  contextRefs?: Record<string, string>;
  defaultChannel?: Channel;
  onClose: () => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef(newIdempotencyKey());

  const plain = useMemo(() => recipients.map(({ entity_type, entity_id }) => ({ entity_type, entity_id })), [recipients]);
  const templates = useQuery({
    queryKey: messagingKeys.templates(channel, "registered"),
    queryFn: ({ signal }) => messagingApi.templates(channel, "registered", signal),
  });
  const options = sendableTemplates(templates.data, channel);
  const template = options.find((t) => t.id === templateId) ?? null;

  const eligibility = useQuery({
    queryKey: ["messaging", "eligibility", channel, templateId, plain, contextRefs ?? null],
    queryFn: ({ signal }) =>
      messagingApi.eligibility({ channel, template_id: templateId as string, recipients: plain, context_refs: contextRefs }, signal),
    enabled: !!templateId,
  });
  const rows = eligibility.data;
  const ready = eligibleCount(rows);

  const send = useMutation({
    mutationFn: () =>
      messagingApi.send({ channel, template_id: templateId as string, recipients: plain, context_refs: contextRefs }, idemKey.current),
    onSuccess: (out) => {
      setResults(out.results);
      for (const r of plain) {
        void queryClient.invalidateQueries({ queryKey: messagingKeys.messages(r) });
      }
    },
    onError: (e) => setError(isApiError(e) ? (SEND_ERRORS[e.code] ?? errorMessage(e)) : errorMessage(e)),
  });

  const reset = () => {
    idemKey.current = newIdempotencyKey();
    setResults(null);
    setError(null);
  };
  const labelOf = (r: Recipient) => recipients.find((x) => x.entity_id === r.entity_id && x.entity_type === r.entity_type)?.label ?? r.entity_id;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !send.isPending && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{recipients.length === 1 ? `Message ${recipients[0].label}` : `Message ${recipients.length} people`}</DialogTitle>
          <DialogContent className={styles.content}>
            <TabList
              selectedValue={channel}
              onTabSelect={(_, d) => {
                setChannel(d.value as Channel);
                setTemplateId(null);
                reset();
              }}
              aria-label="Channel"
              disabled={send.isPending || !!results}
            >
              <Tab value="sms">SMS</Tab>
              <Tab value="whatsapp">WhatsApp</Tab>
            </TabList>
            <Field
              label="Template"
              hint={`Only registered ${CHANNEL_LABELS[channel]} templates can be sent (transactional messages only).`}
              validationMessage={templates.isError ? errorMessage(templates.error) : undefined}
            >
              <Dropdown
                placeholder={templates.isPending ? "Loading templates…" : options.length ? "Choose a template" : "No registered templates"}
                disabled={templates.isPending || !options.length || send.isPending || !!results}
                selectedOptions={templateId ? [templateId] : []}
                value={template?.name ?? ""}
                onOptionSelect={(_, d) => {
                  setTemplateId(d.optionValue ?? null);
                  reset();
                }}
              >
                {options.map((t) => (
                  <Option key={t.id} value={t.id} text={t.name}>
                    {t.name} · {PURPOSE_LABELS[t.purpose] ?? t.purpose}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {error && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}

            {templateId && (
              <>
                <Text weight="semibold">Recipients</Text>
                {eligibility.isPending ? (
                  <Spinner size="tiny" label="Checking recipients…" />
                ) : eligibility.isError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{errorMessage(eligibility.error)}</MessageBarBody>
                  </MessageBar>
                ) : (
                  <ul className={styles.list} aria-label="Recipients">
                    {plain.map((r) => {
                      const row = rows?.find((x) => x.entity_id === r.entity_id && x.entity_type === r.entity_type);
                      const badge = eligibilityBadge(row);
                      const result = results?.find((x) => x.entity_id === r.entity_id && x.entity_type === r.entity_type);
                      return (
                        <li key={`${r.entity_type}:${r.entity_id}`} className={styles.row}>
                          <div className={styles.rowHead}>
                            <Text weight="semibold">{labelOf(r)}</Text>
                            <Badge appearance="tint" color={badge.color}>
                              {badge.label}
                            </Badge>
                          </div>
                          {row?.preview && !result && (
                            <Body1 as="p" className={styles.preview}>
                              {row.preview}
                            </Body1>
                          )}
                          {result && (
                            <MessageBar intent={result.status === "queued" ? "success" : "warning"} layout="multiline">
                              <MessageBarBody>
                                <MessageBarTitle>{result.status === "queued" ? "Queued" : "Not sent"}</MessageBarTitle>
                                {result.status === "queued"
                                  ? `The ${CHANNEL_LABELS[channel]} message is on its way.`
                                  : reasonLabel(result.reason) || "The message was refused."}
                              </MessageBarBody>
                            </MessageBar>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {rows && !results && (
                  <Caption1 className={styles.muted}>
                    {ready} of {plain.length} can receive this message. Others are skipped.
                  </Caption1>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={send.isPending}>
              {results ? "Close" : "Cancel"}
            </Button>
            {!results && (
              <Button
                appearance="primary"
                icon={send.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
                disabled={!templateId || !rows || ready === 0 || send.isPending}
                onClick={() => {
                  setError(null);
                  send.mutate();
                }}
              >
                {ready > 1 ? `Send to ${ready}` : "Send"}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
