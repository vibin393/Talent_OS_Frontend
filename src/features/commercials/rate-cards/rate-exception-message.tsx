"use client";

import { Link, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { AppLink } from "@/components/app-link";
import { rateExceptionInfo, rateExceptionMessage } from "../format";

/** Actionable `MessageBar` for a 409 `rate_exception_required|pending|rejected` from a gated action; renders
 * nothing for any other error (callers show their own message then). */
export function RateExceptionMessage({ error }: { error: unknown }) {
  const info = rateExceptionInfo(error);
  if (!info) return null;
  const intent = info.code === "rate_exception_rejected" ? "error" : "warning";
  return (
    <MessageBar intent={intent} layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>{info.code === "rate_exception_rejected" ? "Rate exception rejected" : "Rate card approval needed"}</MessageBarTitle>
        {rateExceptionMessage(info)}
      </MessageBarBody>
      {info.approvalRequestId && (
        <MessageBarActions>
          <AppLink href={`/approvals?request=${info.approvalRequestId}`}>
            <Link as="span">View approval</Link>
          </AppLink>
        </MessageBarActions>
      )}
    </MessageBar>
  );
}

export { rateExceptionInfo };
