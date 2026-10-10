"use client";

import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { supportBannerText, type SupportSessionInfo } from "@/features/notices/support";
import { useNow } from "@/features/privacy/use-now";
import type { AuthOut } from "@/lib/api/types";

/** Persistent warning while a Talent OS operator browses the tenant under a support-access grant. */
export function SupportBanner({ me }: { me: AuthOut & SupportSessionInfo }) {
  const now = useNow(15_000);
  const text = supportBannerText(me, now);
  if (!text) return null;
  return (
    <MessageBar intent="warning" layout="singleline" shape="square" role="status">
      <MessageBarBody>
        <MessageBarTitle>{text}</MessageBarTitle>
      </MessageBarBody>
    </MessageBar>
  );
}
