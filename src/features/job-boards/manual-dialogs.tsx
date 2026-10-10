"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { jobBoardsApi } from "./api";
import { boardLabel, packText } from "./logic";
import type { PackOut } from "./types";

const useStyles = makeStyles({
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  grow: { flexGrow: 1 },
});

function copy(text: string) {
  void navigator.clipboard?.writeText(text);
}

/** "Posting pack for {board}": read-only fields with "Copy" per field and "Copy all". */
export function PackDialog({ id, boardKey, onClose }: { id: string; boardKey: string; onClose: () => void }) {
  const styles = useStyles();
  const [pack, setPack] = useState<PackOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    jobBoardsApi.pack(id).then(setPack, (e) => setError(errorMessage(e)));
  }, [id]);
  const fields = pack
    ? [
        { label: "Title", value: pack.title },
        { label: "Description", value: pack.description_text },
        ...pack.fields,
        { label: "Apply link", value: pack.apply_url },
      ]
    : [];
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Posting pack for {boardLabel(boardKey)}</DialogTitle>
          <DialogContent className={styles.col}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {!pack && !error && <Spinner />}
            {fields.map((f) => (
              <div key={f.label} className={styles.row}>
                <Field label={f.label} className={styles.grow}>
                  <Input readOnly value={f.value} />
                </Field>
                <Button onClick={() => copy(f.value)}>Copy</Button>
              </div>
            ))}
          </DialogContent>
          <DialogActions>
            <Button disabled={!pack} onClick={() => pack && copy(packText(pack))}>
              Copy all
            </Button>
            <Button appearance="primary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** "Record manually": the recruiter posted the job by hand. */
export function RecordDialog({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles();
  const [ref, setRef] = useState("");
  const [url, setUrl] = useState("");
  const [postedOn, setPostedOn] = useState(new Date().toISOString().slice(0, 10));
  const [expiresOn, setExpiresOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await jobBoardsApi.record(id, {
        board_ref: ref,
        board_url: url || null,
        posted_on: postedOn,
        expires_on: expiresOn || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Record manually</DialogTitle>
          <DialogContent className={styles.col}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Board reference" required>
              <Input value={ref} onChange={(_, d) => setRef(d.value)} />
            </Field>
            <Field label="Link on the board">
              <Input value={url} onChange={(_, d) => setUrl(d.value)} />
            </Field>
            <Field label="Posted on" required>
              <Input type="date" value={postedOn} onChange={(_, d) => setPostedOn(d.value)} />
            </Field>
            <Field label="Expires on (optional)">
              <Input type="date" value={expiresOn} onChange={(_, d) => setExpiresOn(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={busy || !ref || !postedOn} onClick={save}>
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
