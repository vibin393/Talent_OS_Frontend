"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { projectKeys, projectsApi } from "./api";
import type { ProjectFilters } from "./types";

export function useProjects(filters: ProjectFilters, enabled = true) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: ({ signal }) => projectsApi.list(filters, signal),
    enabled,
  });
}

export function useProject360(id: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.view360(id),
    queryFn: ({ signal }) => projectsApi.view360(id, signal),
    enabled,
  });
}

export function useProjectTimeline(id: string, from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.timeline(id, from, to),
    queryFn: ({ signal }) => projectsApi.timeline(id, from, to, signal),
    enabled,
  });
}

/** Refetch everything the projects UI shows (list, 360, timeline, deliverables). */
export function useRefreshProjects() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: projectKeys.all }), [queryClient]);
}
