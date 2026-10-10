/** Tabs of `/admin/pipeline` (plain module: also used by the server page). */
export const PIPELINE_ADMIN_TABS = [
  { value: "stages", label: "Stages" },
  { value: "reasons", label: "Reason codes" },
  { value: "questionnaires", label: "Screening questionnaires" },
  { value: "settings", label: "Submission settings" },
] as const;
export type PipelineAdminTab = (typeof PIPELINE_ADMIN_TABS)[number]["value"];

export function parsePipelineAdminTab(raw: string | string[] | undefined): PipelineAdminTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return PIPELINE_ADMIN_TABS.some((t) => t.value === v) ? (v as PipelineAdminTab) : "stages";
}
