"use client";

import {
  Body1,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Copy20Regular } from "@fluentui/react-icons";
import { useState } from "react";

const useStyles = makeStyles({
  box: {
    fontFamily: tokens.fontFamilyMonospace,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    wordBreak: "break-all",
  },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** The show-once signing secret (Epic 68, B3): "Done" is enabled once the user confirms they stored it. */
export function SecretOnceDialog({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  const styles = useStyles();
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={secret !== null} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Copy your signing secret</DialogTitle>
          <DialogContent className={styles.body}>
            <Body1>Use this secret to verify the TalentOS-Signature header. It&apos;s shown only once.</Body1>
            <div className={styles.box} aria-label="Signing secret">
              {secret}
            </div>
            <div>
              <Button
                icon={<Copy20Regular />}
                onClick={() => {
                  void navigator.clipboard?.writeText(secret ?? "");
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Checkbox label="I've stored the secret" checked={stored} onChange={(_, d) => setStored(Boolean(d.checked))} />
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={!stored}
              onClick={() => {
                setStored(false);
                setCopied(false);
                onDone();
              }}
            >
              Done
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
