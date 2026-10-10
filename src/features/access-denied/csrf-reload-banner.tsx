"use client";

import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { isCsrfExhausted } from "@/lib/api/csrf-retry";

/**
 * Shown by a form whose submit failed CSRF twice (the automatic retry already ran): reloading fetches a
 * fresh token; `onReload` should save the form values first (`useFormDraft().saveAndReload`).
 */
export function CsrfReloadBanner({ error, onReload }: { error: unknown; onReload: () => void }) {
  if (!isCsrfExhausted(error)) return null;
  return (
    <MessageBar intent="warning" layout="multiline" role="alert">
      <MessageBarBody>
        <MessageBarTitle>Session token expired</MessageBarTitle>
        Your session security token expired — reload to continue. Your entries are kept.
      </MessageBarBody>
      <MessageBarActions>
        <Button appearance="primary" onClick={onReload}>
          Reload
        </Button>
      </MessageBarActions>
    </MessageBar>
  );
}
