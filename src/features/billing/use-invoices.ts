"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi, billingKeys, type InvoiceFilters } from "./api";
import type {
  CreditNoteIn,
  DebitNoteIn,
  DocDetailOut,
  DocKind,
  IrnIn,
  ManualLineIn,
} from "./types";

export function useInvoices(filters: InvoiceFilters, enabled = true) {
  return useQuery({
    queryKey: billingKeys.list(filters),
    queryFn: ({ signal }) => billingApi.invoices(filters, signal),
    enabled,
  });
}

/** One invoice / note with every action of the detail page. */
export function useBillingDoc(kind: DocKind, id: string) {
  const qc = useQueryClient();
  const key = billingKeys.doc(kind, id);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => billingApi.doc(kind, id, signal),
  });
  const put = (data: DocDetailOut) => {
    qc.setQueryData(key, data);
    void qc.invalidateQueries({ queryKey: billingKeys.lists });
    void qc.invalidateQueries({ queryKey: billingKeys.pendingIrn });
  };
  const submit = useDocMutation(() => billingApi.submit(id), put);
  const recompute = useDocMutation(() => billingApi.recompute(id), put);
  const discard = useDocMutation(() => billingApi.discard(kind, id), put);
  const issue = useDocMutation(
    (v: { docDate?: string; key: string }) =>
      billingApi.issue(kind, id, v.docDate, v.key),
    put,
  );
  const send = useDocMutation(
    (to: string[]) => billingApi.send(kind, id, to),
    put,
  );
  const addLine = useDocMutation(
    (body: ManualLineIn) => billingApi.addLine(id, body),
    put,
  );
  const removeLine = useDocMutation(
    (lineId: string) => billingApi.removeLine(id, lineId),
    put,
  );
  const recordIrn = useDocMutation(
    (v: { body: IrnIn; key: string }) =>
      billingApi.recordIrn(kind, id, v.body, v.key),
    put,
  );
  const cancelIrn = useDocMutation(
    (v: { reason: string; key: string }) =>
      billingApi.cancelIrn(id, v.reason, v.key),
    put,
  );
  return {
    query,
    submit,
    recompute,
    discard,
    issue,
    send,
    addLine,
    removeLine,
    recordIrn,
    cancelIrn,
  };
}

function useDocMutation<V>(
  fn: (v: V) => Promise<DocDetailOut>,
  onSuccess: (d: DocDetailOut) => void,
) {
  return useMutation({ mutationFn: fn, onSuccess });
}

export function useNoteCaps(invoiceId: string, enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.caps(invoiceId),
    queryFn: ({ signal }) => billingApi.noteCaps(invoiceId, signal),
    enabled,
  });
}

export function useCreateNote(invoiceId: string) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: billingKeys.caps(invoiceId) });
    void qc.invalidateQueries({ queryKey: ["billing", "notes"] });
  };
  const credit = useMutation({
    mutationFn: (body: CreditNoteIn) =>
      billingApi.createCreditNote(invoiceId, body),
    onSuccess: done,
  });
  const debit = useMutation({
    mutationFn: (body: DebitNoteIn) =>
      billingApi.createDebitNote(invoiceId, body),
    onSuccess: done,
  });
  return { credit, debit };
}

export function useInvoiceNotes(invoiceId: string) {
  const credit = useQuery({
    queryKey: billingKeys.notes("credit_note", invoiceId),
    queryFn: ({ signal }) => billingApi.notes("credit_note", invoiceId, signal),
  });
  const debit = useQuery({
    queryKey: billingKeys.notes("debit_note", invoiceId),
    queryFn: ({ signal }) => billingApi.notes("debit_note", invoiceId, signal),
  });
  return { credit, debit };
}
