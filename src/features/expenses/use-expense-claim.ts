"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, expensesApi, workerExpenseKeys, workerExpensesApi } from "./api";
import type { ClaimDetailOut, DecideIn, LineIn, WorkerClaimOut } from "./types";

/** One Worker claim plus its mutations (lines CRUD, preview, submit, recall, receipt upload / read). */
export function useMyExpenseClaim(id: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: workerExpenseKeys.detail(id),
    queryFn: ({ signal }) => workerExpensesApi.get(id, signal),
    retry: false,
  });
  const put = (data: WorkerClaimOut) => {
    qc.setQueryData(workerExpenseKeys.detail(id), data);
    void qc.invalidateQueries({ queryKey: workerExpenseKeys.list, exact: true });
  };
  const rename = useMutation({ mutationFn: (title: string) => workerExpensesApi.rename(id, title), onSuccess: put });
  const saveLine = useMutation({
    mutationFn: ({ lineId, body }: { lineId: string | null; body: LineIn }) =>
      lineId ? workerExpensesApi.updateLine(id, lineId, body) : workerExpensesApi.addLine(id, body),
    onSuccess: put,
  });
  const deleteLine = useMutation({ mutationFn: (lineId: string) => workerExpensesApi.deleteLine(id, lineId), onSuccess: put });
  const preview = useMutation({ mutationFn: (body: LineIn) => workerExpensesApi.previewLine(id, body) });
  const submit = useMutation({ mutationFn: () => workerExpensesApi.submit(id), onSuccess: put });
  const recall = useMutation({ mutationFn: () => workerExpensesApi.recall(id), onSuccess: put });
  const upload = useMutation({ mutationFn: (file: File) => workerExpensesApi.uploadReceipt(file) });
  const readReceipt = useMutation({ mutationFn: (fileId: string) => workerExpensesApi.readReceipt(fileId) });
  return { query, rename, saveLine, deleteLine, preview, submit, recall, upload, readReceipt };
}

/** One internal claim with its admin / approver mutations. */
export function useExpenseClaim(id: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: expenseKeys.claim(id), queryFn: ({ signal }) => expensesApi.claim(id, signal) });
  const put = (data: ClaimDetailOut) => {
    qc.setQueryData(expenseKeys.claim(id), data);
    void qc.invalidateQueries({ queryKey: expenseKeys.claims });
  };
  const saveLine = useMutation({
    mutationFn: ({ lineId, body }: { lineId: string | null; body: LineIn }) =>
      lineId ? expensesApi.updateLine(id, lineId, body) : expensesApi.addLine(id, body),
    onSuccess: put,
  });
  const deleteLine = useMutation({ mutationFn: (lineId: string) => expensesApi.deleteLine(id, lineId), onSuccess: put });
  const preview = useMutation({ mutationFn: (body: LineIn) => expensesApi.previewLine(id, body) });
  const submit = useMutation({ mutationFn: (reason: string) => expensesApi.submit(id, reason), onSuccess: put });
  const decide = useMutation({ mutationFn: (body: DecideIn) => expensesApi.decide(id, body), onSuccess: put });
  const reopen = useMutation({ mutationFn: (reason: string) => expensesApi.reopen(id, reason), onSuccess: put });
  return { query, saveLine, deleteLine, preview, submit, decide, reopen };
}
