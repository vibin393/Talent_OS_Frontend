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
  Field,
  makeStyles,
  Spinner,
  Tab,
  TabList,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi } from "./api";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** "Draft with Demand Agent" (Demands list "New demand" menu): paste a client email or upload .eml / PDF / DOCX. */
export function DraftWithAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const start = useMutation({
    mutationFn: () =>
      mode === "paste" ? demandAgentApi.createFromText(client!.id, text.trim()) : demandAgentApi.createFromFile(client!.id, file!),
    onSuccess: () => {
      toast.success("Demand Agent is drafting. You'll be notified when it's done.");
      setText("");
      setFile(null);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ready = client !== null && (mode === "paste" ? text.trim().length > 0 : file !== null);
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Draft demands with the Demand Agent</DialogTitle>
          <DialogContent className={styles.content}>
            <Body1>
              Paste a client email or upload a file (.eml, PDF, DOCX). The agent drafts one demand per role. You review everything
              before submitting.
            </Body1>
            <ClientPicker label="Client" required value={client?.id ?? null} valueLabel={client?.name} onChange={setClient} />
            <TabList selectedValue={mode} onTabSelect={(_, d) => setMode(d.value as "paste" | "upload")}>
              <Tab value="paste">Paste text</Tab>
              <Tab value="upload">Upload file</Tab>
            </TabList>
            {mode === "paste" ? (
              <Field label="Client email or requirement">
                <Textarea rows={8} value={text} maxLength={60_000} onChange={(_, d) => setText(d.value)} />
              </Field>
            ) : (
              <Field label="File" hint=".eml, PDF or DOCX">
                <input
                  type="file"
                  accept=".eml,.pdf,.docx,message/rfc822,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!ready || start.isPending}
              icon={start.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => start.mutate()}
            >
              Start
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
