"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type VendorFilters, vendorKeys, vendorsApi } from "./api";
import type {
  AcceptIn,
  MarkDuplicateIn,
  RejectIn,
  ReleaseCreate,
  StatementBuildIn,
  VendorCreate,
  VendorSettingsUpdate,
  VendorStatus,
  VendorUpdate,
} from "./types";

export function useVendors(filters: VendorFilters) {
  const canRead = usePermission("vendor:read");
  return useQuery({
    queryKey: vendorKeys.list(filters),
    queryFn: ({ signal }) => vendorsApi.list(filters, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
}

export function useVendor(id: string) {
  return useQuery({ queryKey: vendorKeys.detail(id), queryFn: ({ signal }) => vendorsApi.get(id, signal) });
}

export function useVendorDocuments(id: string) {
  return useQuery({ queryKey: vendorKeys.documents(id), queryFn: ({ signal }) => vendorsApi.documents(id, signal) });
}

export function useVendorReleases(id: string) {
  return useQuery({ queryKey: vendorKeys.releases(id), queryFn: ({ signal }) => vendorsApi.vendorReleases(id, signal) });
}

export function useVendorPerformance(id: string, enabled = true) {
  return useQuery({
    queryKey: vendorKeys.performance(id),
    queryFn: ({ signal }) => vendorsApi.performance(id, signal),
    enabled,
  });
}

export function useVendorSettings() {
  return useQuery({ queryKey: vendorKeys.settings, queryFn: ({ signal }) => vendorsApi.settings(signal), staleTime: 60_000 });
}

export function useDemandReleases(demandId: string) {
  const canRead = usePermission("vendor:read");
  return useQuery({
    queryKey: vendorKeys.demandReleases(demandId),
    queryFn: ({ signal }) => vendorsApi.demandReleases(demandId, signal),
    enabled: canRead,
  });
}

export function useReviewQueue(status: string | null, vendorId?: string | null) {
  const canReview = usePermission("vendor_submission:review");
  return useQuery({
    queryKey: vendorKeys.queue(status, vendorId),
    queryFn: ({ signal }) => vendorsApi.queue(status, vendorId, signal),
    enabled: canReview,
  });
}

export function useVendorSubmission(id: string | null) {
  return useQuery({
    queryKey: vendorKeys.submission(id ?? ""),
    queryFn: ({ signal }) => vendorsApi.submission(id as string, signal),
    enabled: !!id,
  });
}

export function useStatements(vendorId?: string | null) {
  const canRead = usePermission("payroll:read");
  return useQuery({
    queryKey: vendorKeys.statements(vendorId),
    queryFn: ({ signal }) => vendorsApi.statements(vendorId, signal),
    enabled: canRead,
  });
}

export function useStatement(id: string | null) {
  return useQuery({
    queryKey: vendorKeys.statement(id ?? ""),
    queryFn: ({ signal }) => vendorsApi.statement(id as string, signal),
    enabled: !!id,
  });
}

/** Every vendors mutation; each invalidates the whole ``vendors`` cache family (cheap, small lists). */
export function useVendorMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: vendorKeys.all });
  const useM = <A, R>(fn: (a: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: done });
  return {
    create: useM((b: VendorCreate) => vendorsApi.create(b)),
    update: useM(({ id, body }: { id: string; body: VendorUpdate }) => vendorsApi.update(id, body)),
    transition: useM(({ id, to, reason }: { id: string; to: VendorStatus; reason?: string | null }) =>
      vendorsApi.transition(id, to, reason),
    ),
    uploadDocument: useM(({ id, form }: { id: string; form: FormData }) => vendorsApi.uploadDocument(id, form)),
    markReviewed: useM(({ id, documentId }: { id: string; documentId: string }) => vendorsApi.markReviewed(id, documentId)),
    addGstin: useM(({ id, gstin, stateCode }: { id: string; gstin: string; stateCode: string }) =>
      vendorsApi.addGstin(id, gstin, stateCode),
    ),
    requestBank: useM(
      ({ id, body }: { id: string; body: { account_name: string; account_no: string; ifsc: string; is_primary: boolean } }) =>
        vendorsApi.requestBank(id, body),
    ),
    release: useM(({ demandId, body }: { demandId: string; body: ReleaseCreate }) => vendorsApi.release(demandId, body)),
    releaseAction: useM(({ id, action }: { id: string; action: "pause" | "resume" | "withdraw" }) =>
      vendorsApi.releaseAction(id, action),
    ),
    accept: useM(({ id, body }: { id: string; body: AcceptIn }) => vendorsApi.accept(id, body)),
    reject: useM(({ id, body }: { id: string; body: RejectIn }) => vendorsApi.reject(id, body)),
    markDuplicate: useM(({ id, body }: { id: string; body: MarkDuplicateIn }) => vendorsApi.markDuplicate(id, body)),
    reopen: useM(({ id, reason }: { id: string; reason: string }) => vendorsApi.reopen(id, reason)),
    build: useM((b: StatementBuildIn) => vendorsApi.build(b)),
    finalize: useM((id: string) => vendorsApi.finalize(id)),
    deleteDraft: useM((id: string) => vendorsApi.deleteDraft(id)),
    updateSettings: useM((b: VendorSettingsUpdate) => vendorsApi.updateSettings(b)),
  };
}
