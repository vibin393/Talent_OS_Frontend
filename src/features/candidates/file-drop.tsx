"use client";

import { Body1, Button, Caption1, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { ArrowUpload20Regular } from "@fluentui/react-icons";
import { useRef, useState } from "react";

const useStyles = makeStyles({
  zone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    border: `${tokens.strokeWidthThick} dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    textAlign: "center",
  },
  active: {
    border: `${tokens.strokeWidthThick} dashed ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  hint: { color: tokens.colorNeutralForeground3 },
  input: { display: "none" },
});

/** Drag-and-drop zone with a "Browse" button (keyboard accessible through the button). */
export function FileDrop({
  accept,
  multiple = false,
  disabled,
  title,
  hint,
  buttonLabel = "Browse files",
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  title: string;
  hint?: string;
  buttonLabel?: string;
  onFiles: (files: File[]) => void;
}) {
  const styles = useStyles();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={mergeClasses(styles.zone, over && styles.active)}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <ArrowUpload20Regular aria-hidden />
      <Body1>{title}</Body1>
      {hint && <Caption1 className={styles.hint}>{hint}</Caption1>}
      <Button appearance="primary" disabled={disabled} onClick={() => input.current?.click()}>
        {buttonLabel}
      </Button>
      <input
        ref={input}
        className={styles.input}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
