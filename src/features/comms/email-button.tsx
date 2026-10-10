"use client";

import { Button, type ButtonProps } from "@fluentui/react-components";
import { Mail20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { usePermission } from "@/features/auth/use-permission";
import { ComposeDialog } from "./compose-dialog";
import type { ComposeContext } from "./compose-model";

/**
 * "Email" action for entity pages: opens the compose dialog for `context` (built lazily so callers can
 * pass data that loads later). Hidden without `email:send`.
 */
export function EmailButton({
  context,
  appearance,
  size,
  label = "Email",
  disabled,
}: {
  context: () => ComposeContext;
  appearance?: ButtonProps["appearance"];
  size?: ButtonProps["size"];
  label?: string;
  disabled?: boolean;
}) {
  const canSend = usePermission("email:send");
  const [open, setOpen] = useState<ComposeContext | null>(null);
  if (!canSend) return null;
  return (
    <>
      <Button
        appearance={appearance}
        size={size}
        icon={<Mail20Regular />}
        disabled={disabled}
        onClick={() => setOpen(context())}
      >
        {label}
      </Button>
      {open && <ComposeDialog context={open} onClose={() => setOpen(null)} />}
    </>
  );
}
