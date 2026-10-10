"use client";

import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tab,
  TabList,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Document20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { FileDrop } from "@/features/candidates/file-drop";
import { isApiError } from "@/lib/api/errors";
import type { DemandOut } from "@/lib/api/types";
import { ClientPicker } from "./client-picker";
import { demandErrorMessage } from "./errors";
import { formatBytes, INTAKE_ACCEPT, MAX_INTAKE_CHARS, validateIntakeFile, validateIntakeText } from "./intake";
import { useIntake } from "./use-demands";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  file: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  busy: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, paddingBlock: tokens.spacingVerticalM },
});

/**
 * "New demand from document": choose the client, paste text or drop one PDF/DOCX (10 MB), and the AI
 * drafts the demand. On success `onCreated` receives the Draft; when AI is unavailable the dialog
 * explains it and offers the manual form (`onManual`).
 */
export function IntakeDialog({
  onClose,
  onCreated,
  onManual,
}: {
  onClose: () => void;
  onCreated: (demand: DemandOut) => void;
  onManual: (client: { id: string; name: string } | null) => void;
}) {
  const styles = useStyles();
  const intake = useIntake();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiDown, setAiDown] = useState(false);
  const busy = intake.isPending;

  const run = async () => {
    setError(null);
    if (!client) return setError("Choose the client first.");
    const problem = mode === "text" ? validateIntakeText(text) : file ? validateIntakeFile(file) : "Choose a PDF or DOCX file.";
    if (problem) return setError(problem);
    try {
      const demand = await intake.mutateAsync(
        mode === "text" ? { clientId: client.id, text } : { clientId: client.id, file: file! },
      );
      onCreated(demand);
    } catch (e) {
      if (isApiError(e) && e.code === "ai_unavailable") {
        setAiDown(true);
        return;
      }
      setError(demandErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New demand from a document</DialogTitle>
          <DialogContent className={styles.content}>
            {aiDown ? (
              <MessageBar intent="warning" layout="multiline">
                <MessageBarBody>
                  <MessageBarTitle>AI extraction is unavailable</MessageBarTitle>
                  The AI assistant is turned off, over budget or not responding. You can create the demand manually.
                </MessageBarBody>
              </MessageBar>
            ) : (
              <>
                <Body1>The AI reads the requirement and drafts the demand. You review every extracted field before submitting.</Body1>
                <ClientPicker required value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} disabled={busy} />
                <TabList selectedValue={mode} onTabSelect={(_, d) => setMode(d.value as "text" | "file")} disabled={busy}>
                  <Tab value="text">Paste text</Tab>
                  <Tab value="file">Upload file</Tab>
                </TabList>
                {mode === "text" ? (
                  <Field label="Requirement text" hint={`${text.length.toLocaleString()} / ${MAX_INTAKE_CHARS.toLocaleString()} characters`}>
                    <Textarea
                      value={text}
                      rows={10}
                      resize="vertical"
                      disabled={busy}
                      placeholder="Paste the email, SOW or job description"
                      onChange={(_, d) => setText(d.value)}
                    />
                  </Field>
                ) : (
                  <>
                    <FileDrop
                      accept={INTAKE_ACCEPT}
                      disabled={busy}
                      title="Drop a PDF or DOCX here"
                      hint="Up to 10 MB, 10 pages"
                      onFiles={(files) => {
                        const f = files[0];
                        const problem = validateIntakeFile(f);
                        setError(problem);
                        setFile(problem ? null : f);
                      }}
                    />
                    {file && (
                      <div className={styles.file}>
                        <Document20Regular aria-hidden />
                        <Body1>{file.name}</Body1>
                        <Caption1 className={styles.muted}>{formatBytes(file.size)}</Caption1>
                      </div>
                    )}
                  </>
                )}
                {busy && (
                  <div className={styles.busy} role="status">
                    <Spinner size="tiny" /> Extracting…
                  </div>
                )}
                {error && (
                  <MessageBar intent="error" role="alert">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {aiDown ? (
              <Button appearance="primary" onClick={() => onManual(client)}>
                Create manually
              </Button>
            ) : (
              <Button appearance="primary" icon={<Sparkle20Regular />} disabled={busy} onClick={run}>
                Extract
              </Button>
            )}
            <Button appearance="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
