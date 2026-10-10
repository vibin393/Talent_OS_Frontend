"use client";

import { Badge, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Tooltip } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { ErrorBar, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { tdsReconApi, tdsReconKeys } from "./api";
import { QUARTERS, STATUS_BADGE, statusMatrix } from "./logic";

/** Client x quarter reconciliation status for one FY (and optionally one Legal Entity). */
export function TdsStatusView({ fy, legalEntityId }: { fy: string; legalEntityId: string | null }) {
  const admin = useAdminStyles();
  const q = useQuery({
    queryKey: tdsReconKeys.status(fy, legalEntityId),
    queryFn: ({ signal }) => tdsReconApi.status(fy, legalEntityId, signal),
    enabled: !!fy,
  });
  const rows = statusMatrix(q.data ?? []);
  return (
    <>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <div className={admin.surface}>
        {!q.data ? (
          !q.error && <GridSkeleton />
        ) : rows.length === 0 ? (
          <div className={admin.empty}>No TDS recorded or reported for FY {fy}.</div>
        ) : (
          <Table aria-label={`TDS status FY ${fy}`} className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Client</TableHeaderCell>
                {QUARTERS.map((qq) => (
                  <TableHeaderCell key={qq}>{qq}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.client_id}>
                  <TableCell>{r.client_name}</TableCell>
                  {QUARTERS.map((qq) => {
                    const cell = r.cells[qq];
                    const b = STATUS_BADGE[cell?.status ?? "not_started"];
                    return (
                      <TableCell key={qq}>
                        {cell ? (
                          <Tooltip
                            relationship="description"
                            content={`Recorded ${cell.recorded_count} (₹${cell.recorded_amount}) · matched ${cell.matched_count} (₹${cell.matched_amount}) · statement ${cell.statement_count} (₹${cell.statement_amount})`}
                          >
                            <Badge appearance="tint" color={b.color}>
                              {b.label}
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Badge appearance="tint" color={b.color}>
                            {b.label}
                          </Badge>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
