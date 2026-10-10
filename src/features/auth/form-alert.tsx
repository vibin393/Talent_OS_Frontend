"use client";

import { MessageBar, MessageBarBody, MessageBarTitle, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useEffect, useRef } from "react";

const useStyles = makeStyles({
  root: {
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    },
  },
  details: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
    "& p": { margin: 0 },
  },
});

/**
 * Form-level message as a Fluent `MessageBar`. Receives focus when it appears so screen-reader and
 * keyboard users notice it.
 */
export function FormAlert({
  message,
  variant = "error",
  children,
  className,
}: {
  message: string | null | undefined;
  variant?: "error" | "success";
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <MessageBar
      ref={ref}
      tabIndex={-1}
      intent={variant}
      layout="multiline"
      role={variant === "error" ? "alert" : "status"}
      className={mergeClasses(styles.root, className)}
    >
      <MessageBarBody>
        <MessageBarTitle>{message}</MessageBarTitle>
        {children && <div className={styles.details}>{children}</div>}
      </MessageBarBody>
    </MessageBar>
  );
}
