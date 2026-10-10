"use client";

import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { isSandboxSeen, onSandboxChange } from "./client";

/** Epic 66 (FR-339): persistent banner while the workspace is a Sandbox Tenant (`X-TalentOS-Sandbox: true`). */
export function SandboxBanner() {
  const [sandbox, setSandbox] = useState<boolean>(() => isSandboxSeen());
  useEffect(() => onSandboxChange(setSandbox), []);
  if (!sandbox) return null;
  return (
    <MessageBar intent="info" layout="singleline" shape="square" role="status">
      <MessageBarBody>
        <MessageBarTitle>Sandbox</MessageBarTitle>
        Sandbox workspace: synthetic data only. Real emails, messages and calls are never sent.
      </MessageBarBody>
    </MessageBar>
  );
}
