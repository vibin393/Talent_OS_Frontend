/** Epic 35 B6: go-live data import (`/api/v1/golive`). Hand-written API types. */

export type GoLiveKindOut = {
  kind: string;
  label: string;
  available: boolean;
  owner_epic: string | number | null;
  depends_on: string[] | string | null;
};

export type GoLiveImportStatus = "validating" | "previewed" | "applied" | "failed" | "discarded";

export type GoLiveRowError = { row: number; column: string | null; code: string; message: string };

export type GoLiveImport = {
  id: string;
  kind: string;
  status: GoLiveImportStatus;
  row_count: number;
  valid_count: number;
  error_count: number;
  applied_count: number;
  failed_count: number;
  skipped_count: number;
  errors: GoLiveRowError[];
  created_at: string;
  applied_at: string | null;
};

/** One row of `GET /imports/{id}/rows` (backend `GoLiveRowOut`). */
export type GoLiveRow = {
  row_no: number;
  status: "valid" | "invalid" | "applied" | "failed" | "skipped";
  errors: GoLiveRowError[];
  result_ref: string | null;
};

export type GoLiveApplyIn = { skip_invalid: boolean; confirm: "APPLY" };
