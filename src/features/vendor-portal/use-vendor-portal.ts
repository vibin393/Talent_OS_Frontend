"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";
import { vendorPortalApi, vendorPortalKeys } from "./client";

/** No retries on 403 / 404 (permission / isolation answers are final). */
const retry = (count: number, e: unknown) => !(isApiError(e) && [401, 403, 404].includes(e.status)) && count < 2;

export function useVendorDashboard() {
  return useQuery({ queryKey: vendorPortalKeys.dashboard, queryFn: ({ signal }) => vendorPortalApi.dashboard(signal), retry });
}

export function useVendorReleases() {
  return useQuery({ queryKey: vendorPortalKeys.releases, queryFn: ({ signal }) => vendorPortalApi.releases(signal), retry });
}

export function useVendorRelease(id: string) {
  return useQuery({ queryKey: vendorPortalKeys.release(id), queryFn: ({ signal }) => vendorPortalApi.release(id, signal), retry });
}

export function useVendorSubmissions(releaseId?: string | null) {
  return useQuery({
    queryKey: vendorPortalKeys.submissions(releaseId),
    queryFn: ({ signal }) => vendorPortalApi.submissions(releaseId, signal),
    retry,
  });
}

export function useVendorSubmission(id: string) {
  return useQuery({ queryKey: vendorPortalKeys.submission(id), queryFn: ({ signal }) => vendorPortalApi.submission(id, signal), retry });
}

export function useVendorPlacements() {
  return useQuery({ queryKey: vendorPortalKeys.placements, queryFn: ({ signal }) => vendorPortalApi.placements(signal), retry });
}

export function useVendorDocuments() {
  return useQuery({ queryKey: vendorPortalKeys.documents, queryFn: ({ signal }) => vendorPortalApi.documents(signal), retry });
}

export function useVendorStatements() {
  return useQuery({ queryKey: vendorPortalKeys.statements, queryFn: ({ signal }) => vendorPortalApi.statements(signal), retry });
}

export function useVendorScorecard() {
  return useQuery({ queryKey: vendorPortalKeys.scorecard, queryFn: ({ signal }) => vendorPortalApi.scorecard(signal), retry });
}

export function useVendorPortalMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: vendorPortalKeys.all });
  return {
    submit: useMutation({
      mutationFn: ({ releaseId, form }: { releaseId: string; form: FormData }) => vendorPortalApi.submit(releaseId, form),
      onSuccess,
    }),
    withdraw: useMutation({ mutationFn: (id: string) => vendorPortalApi.withdraw(id), onSuccess }),
    reviseResume: useMutation({
      mutationFn: ({ id, form }: { id: string; form: FormData }) => vendorPortalApi.reviseResume(id, form),
      onSuccess,
    }),
    uploadDocument: useMutation({ mutationFn: (form: FormData) => vendorPortalApi.uploadDocument(form), onSuccess }),
  };
}
