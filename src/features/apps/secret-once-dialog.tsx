"use client";

import {
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
import { useAppToast } from "@/components/toast";

const useStyles = makeStyles({
  secret: {
    fontFamily: tokens.fontFamilyMonospace,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    wordBreak: "break-all",
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
  },
});

/** Shows a client secret exactly once; cannot be dismissed until the user confirms they stored it. */
export function SecretOnceDialog({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [stored, setStored] = useState(false);
  return (
    <Dialog open={secret !== null} modalType="alert">
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Copy your client secret</DialogTitle>
          <DialogContent>
            <p>This is the only time the secret is shown. Store it in your secret manager.</p>
            <div className={styles.secret}>
              <span>{secret}</span>
              <Button
                icon={<Copy20Regular />}
                onClick={() => {
                  void navigator.clipboard?.writeText(secret ?? "");
                  toast.success("Copied");
                }}
              >
                Copy
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
