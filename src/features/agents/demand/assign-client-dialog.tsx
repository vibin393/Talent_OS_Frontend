"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Option,
  Spinner,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { clientsApi, clientKeys } from "@/features/clients/api";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi } from "./api";
import type { IntakeMessage } from "./types";

const NONE = "__none__";

/** "Assign client" for an unmatched / ambiguous intake message; the Demand Agent then drafts. */
export function AssignClientDialog({
  message,
  onClose,
  onAssigned,
}: {
  message: IntakeMessage;
  onClose: () => void;
  onAssigned: (m: IntakeMessage) => void;
}) {
  const toast = useAppToast();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const contacts = useQuery({
    queryKey: clientKeys.contactList(client?.id ?? "", false, 1),
    queryFn: ({ signal }) => clientsApi.listContacts(client!.id, false, 1, 50, signal),
    enabled: client !== null,
  });
  const assign = useMutation({
    mutationFn: () => demandAgentApi.assign(message.id, client!.id, contactId),
    onSuccess: (m) => {
      onAssigned(m);
      toast.success("Demand Agent is drafting. You'll be notified when it's done.");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const contactOptions = contacts.data?.items ?? [];
  const contactLabel = contactOptions.find((c) => c.id === contactId)?.name ?? "None";
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Assign client</DialogTitle>
          <DialogContent>
            <ClientPicker
              label="Client"
              required
              value={client?.id ?? null}
              valueLabel={client?.name}
              onChange={(c) => {
                setClient(c);
                setContactId(null);
              }}
            />
            <Field label="Contact">
              <Dropdown
                disabled={!client}
                value={contactLabel}
                selectedOptions={[contactId ?? NONE]}
                onOptionSelect={(_, d) => setContactId(!d.optionValue || d.optionValue === NONE ? null : d.optionValue)}
              >
                <Option value={NONE}>None</Option>
                {contactOptions.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!client || assign.isPending}
              icon={assign.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => assign.mutate()}
            >
              Assign and draft
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
