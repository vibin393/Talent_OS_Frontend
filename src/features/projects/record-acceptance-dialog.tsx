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
  Text,
  Textarea,
} from "@fluentui/react-components";
import { ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ErrorBar, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { errorMessage } from "@/lib/api/errors";
import { projectsApi } from "./api";
import { acceptanceError, rejectionError } from "./logic";
import type { DeliverableOut } from "./types";

/**
 * Record a client's offline decision on a submitted deliverable. Acceptance needs evidence (file upload) and
 * optionally the accepting client contact; rejection needs a reason.
 */
export function RecordAcceptanceDialog({
  deliverable,
  clientId,
  mode,
  onClose,
  onDone,
}: {
  deliverable: DeliverableOut;
  clientId: string;
  mode: "accept" | "reject";
  onClose: () => void;
  onDone: (d: DeliverableOut) => void;
}) {
  const admin = useAdminStyles();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const contacts = useQuery({
    queryKey: [...clientKeys.contacts(clientId), "acceptance-picker"],
    queryFn: ({ signal }) => clientsApi.listContacts(clientId, false, 1, 100, signal),
    enabled: mode === "accept" && !!clientId,
  });
  const submit = useMutation({
    mutationFn: () =>
      mode === "accept" ? projectsApi.recordAcceptance(deliverable.id, file!, contactId) : projectsApi.recordRejection(deliverable.id, reason.trim()),
    onSuccess: (d) => {
      onDone(d);
      onClose();
    },
  });
  const validation = mode === "accept" ? acceptanceError(file) : rejectionError(reason);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !submit.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{mode === "accept" ? `Record acceptance of "${deliverable.name}"` : `Record rejection of "${deliverable.name}"`}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={submit.error ? errorMessage(submit.error) : null} />
              {deliverable.acceptance_criteria && (
                <Field label="Acceptance criteria">
                  <Body1 style={{ whiteSpace: "pre-wrap" }}>{deliverable.acceptance_criteria}</Body1>
                </Field>
              )}
              {mode === "accept" ? (
                <>
                  <Field
                    label="Evidence"
                    required
                    hint="The client's written acceptance (email export, signed note, PDF)"
                    validationState={touched && validation ? "error" : "none"}
                    validationMessage={touched ? (validation ?? undefined) : undefined}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Button icon={<ArrowUpload20Regular />} onClick={() => fileRef.current?.click()}>
                        {file ? "Replace file" : "Choose file"}
                      </Button>
                      <Text>{file ? file.name : "No file chosen"}</Text>
                    </div>
                  </Field>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    aria-label="Evidence file"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setTouched(true);
                      e.target.value = "";
                    }}
                  />
                  <IdSelect
                    label="Accepted by (client contact)"
                    options={(contacts.data?.items ?? []).map((c) => ({ id: c.id, label: c.email ? `${c.name} <${c.email}>` : c.name }))}
                    value={contactId}
                    noneLabel="Not specified"
                    onChange={setContactId}
                  />
                </>
              ) : (
                <Field
                  label="Reason"
                  required
                  validationState={touched && validation ? "error" : "none"}
                  validationMessage={touched ? (validation ?? undefined) : undefined}
                >
                  <Textarea
                    value={reason}
                    onChange={(_, d) => {
                      setReason(d.value);
                      setTouched(true);
                    }}
                  />
                </Field>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={submit.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!!validation || submit.isPending}
              onClick={() => {
                setTouched(true);
                if (!validation) submit.mutate();
              }}
            >
              {mode === "accept" ? "Record acceptance" : "Record rejection"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
