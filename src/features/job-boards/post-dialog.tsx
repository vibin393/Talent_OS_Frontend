"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Body1,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { jobBoardsApi } from "./api";
import { blockedMessage, salaryText } from "./logic";
import type { MultiPostPreviewOut } from "./types";

const useStyles = makeStyles({
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Step = "choose" | "fields" | "preview";
type FieldValues = Record<string, Record<string, string>>;

/** "Post to job boards": choose boards -> board fields -> preview + publish (Epic 70, spec B). */
export function PostDialog({
  demandId,
  open,
  onClose,
  onPublished,
}: {
  demandId: string;
  open: boolean;
  onClose: () => void;
  onPublished: (count: number) => void;
}) {
  const styles = useStyles();
  const [step, setStep] = useState<Step>("choose");
  const [preview, setPreview] = useState<MultiPostPreviewOut | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<FieldValues>({});
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idemKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
    setStep("choose");
    setError(null);
    setAck(false);
    setBusy(true);
    jobBoardsApi
      .preview(demandId, { board_fields: {} })
      .then((p) => {
        setPreview(p);
        setSelected(p.boards.map((b) => b.board_key));
        const v: FieldValues = {};
        for (const b of p.boards)
          v[b.board_key] = Object.fromEntries(Object.entries(b.values).map(([k, x]) => [k, String(x ?? "")]));
        setValues(v);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }, [open, demandId]);

  const body = useMemo(
    () => ({ board_keys: selected, board_fields: values as Record<string, Record<string, unknown>> }),
    [selected, values],
  );

  async function refreshPreview(next: Step) {
    setBusy(true);
    setError(null);
    try {
      setPreview(await jobBoardsApi.preview(demandId, body));
      setStep(next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const out = await jobBoardsApi.publish(demandId, { ...body, acknowledge_bias_flags: ack }, idemKey);
      onPublished(out.published.length);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const boards = (preview?.boards ?? []).filter((b) => selected.includes(b.board_key));
  const ready = boards.filter((b) => b.will_publish).length;
  const bias = preview?.bias_matches ?? [];

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Post to job boards</DialogTitle>
          <DialogContent className={styles.col}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {busy && !preview && <Spinner label="Loading boards" />}
            {step === "choose" && preview && (
              <div className={styles.col}>
                <Subtitle2>Choose boards</Subtitle2>
                {preview.boards.map((b) => (
                  <div key={b.board_key}>
                    <Checkbox
                      label={b.label}
                      checked={selected.includes(b.board_key)}
                      onChange={(_, d) =>
                        setSelected((s) => (d.checked ? [...s, b.board_key] : s.filter((k) => k !== b.board_key)))
                      }
                    />
                    {b.credits_left !== null && (
                      <Text size={200} className={styles.muted}>
                        {" "}
                        Credits left: {b.credits_left}
                      </Text>
                    )}
                  </div>
                ))}
                <a href="/settings/integrations">Manage boards</a>
              </div>
            )}
            {step === "fields" && (
              <Accordion multiple collapsible defaultOpenItems={boards.map((b) => b.board_key)}>
                {boards.map((b) => (
                  <AccordionItem key={b.board_key} value={b.board_key}>
                    <AccordionHeader>{b.label}</AccordionHeader>
                    <AccordionPanel className={styles.col}>
                      {blockedMessage(b.blocked_labels) && (
                        <MessageBar intent="warning">
                          <MessageBarBody>{blockedMessage(b.blocked_labels)}</MessageBarBody>
                        </MessageBar>
                      )}
                      {b.fields.map((f) => {
                        const value = values[b.board_key]?.[f.key] ?? "";
                        const set = (v: string) =>
                          setValues((all) => ({ ...all, [b.board_key]: { ...(all[b.board_key] ?? {}), [f.key]: v } }));
                        const missing = f.required && !value;
                        return (
                          <Field
                            key={f.key}
                            label={f.label}
                            required={f.required}
                            validationMessage={missing && b.blocked_fields.includes(f.key) ? `Required by ${b.label}` : undefined}
                          >
                            {f.options.length ? (
                              <Dropdown
                                value={f.options.find((o) => o.value === value)?.label ?? ""}
                                selectedOptions={value ? [value] : []}
                                onOptionSelect={(_, d) => set(d.optionValue ?? "")}
                              >
                                {f.options.map((o) => (
                                  <Option key={o.value} value={o.value}>
                                    {o.label}
                                  </Option>
                                ))}
                              </Dropdown>
                            ) : (
                              <Input value={value} onChange={(_, d) => set(d.value)} />
                            )}
                          </Field>
                        );
                      })}
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            {step === "preview" && (
              <div className={styles.col}>
                {bias.length > 0 && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      The job description contains flagged wording: {bias.map((m) => m.term).join(", ")}
                      <Checkbox
                        label="I've reviewed the flagged wording"
                        checked={ack}
                        onChange={(_, d) => setAck(Boolean(d.checked))}
                      />
                    </MessageBarBody>
                  </MessageBar>
                )}
                {boards.map((b) => (
                  <Card key={b.board_key} className={styles.card}>
                    <Subtitle2>
                      {b.label}: {b.title}
                    </Subtitle2>
                    <Body1>{b.company ?? ""}</Body1>
                    <Text>Location: {b.location ?? "Hidden"}</Text>
                    <Text>Experience: {b.experience ?? "—"}</Text>
                    <Text>Salary: {salaryText(b.salary)}</Text>
                    <Text size={200} className={styles.muted}>
                      Apply link: {b.apply_url}
                    </Text>
                    <Text size={200}>{b.description_excerpt}</Text>
                    {blockedMessage(b.blocked_labels) && (
                      <MessageBar intent="warning">
                        <MessageBarBody>{blockedMessage(b.blocked_labels)}</MessageBarBody>
                      </MessageBar>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {step !== "choose" && (
              <Button onClick={() => setStep(step === "preview" ? "fields" : "choose")} disabled={busy}>
                Back
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            {step === "choose" && (
              <Button appearance="primary" disabled={busy || !selected.length} onClick={() => refreshPreview("fields")}>
                Next
              </Button>
            )}
            {step === "fields" && (
              <Button appearance="primary" disabled={busy} onClick={() => refreshPreview("preview")}>
                Preview
              </Button>
            )}
            {step === "preview" && (
              <Button
                appearance="primary"
                disabled={busy || ready === 0 || (bias.length > 0 && !ack)}
                onClick={publish}
              >
                Publish to {ready} boards
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
