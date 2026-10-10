"use client";

import { Badge, Caption1 } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { hrmsApi, hrmsKeys } from "./api";

/**
 * The employee code shown in a Worker profile header. Reads the HRMS record through the Placement panel endpoint;
 * renders nothing until a code is known (no column was added to P2 tables).
 */
export function WorkerEmployeeCode({ placementId }: { placementId: string }) {
  const q = useQuery({ queryKey: hrmsKeys.placement(placementId), queryFn: ({ signal }) => hrmsApi.placement(placementId, signal) });
  const code = q.data?.record?.employee_code;
  if (!code) return null;
  return (
    <Caption1>
      Employee code <Badge appearance="tint">{code}</Badge>
    </Caption1>
  );
}
