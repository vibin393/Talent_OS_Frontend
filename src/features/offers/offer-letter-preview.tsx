"use client";

import { Button, Caption1, Dropdown, Field, makeStyles, MessageBar, MessageBarBody, Option, Spinner, tokens } from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { useDebounced } from "@/lib/use-debounced";
import { offersApi } from "./api";
import type { OfferDetailOut } from "./types";
import { useLetterPreview } from "./use-letter-preview";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  bar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  frame: {
    width: "100%",
    height: "70vh",
    minHeight: "420px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  center: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalXXL },
  muted: { color: tokens.colorNeutralForeground3 },
});

const CURRENT = "current";

/** Letter tab: live PDF preview of the current version (re-rendered after each save) or a stored past version. */
export function OfferLetterPreview({ offer }: { offer: OfferDetailOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [selected, setSelected] = useState<string>(CURRENT);
  const versionNo = selected === CURRENT ? null : Number(selected);
  // Debounce the stamp so a burst of saves renders the preview once.
  const stamp = useDebounced(`${offer.updated_at}-${offer.lock_version}`, 600);
  const preview = useLetterPreview(offer.id, stamp, versionNo);
  const past = offer.versions.filter((v) => v.version_no !== offer.current_version.version_no).sort((a, b) => b.version_no - a.version_no);
  const downloadVersion = versionNo ?? offer.current_version.version_no;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <Field label="Version" size="small">
          <Dropdown
            size="small"
            value={versionNo ? `Version ${versionNo}` : `Version ${offer.current_version.version_no} (current)`}
            selectedOptions={[selected]}
            onOptionSelect={(_, d) => d.optionValue && setSelected(d.optionValue)}
          >
            <Option value={CURRENT}>{`Version ${offer.current_version.version_no} (current)`}</Option>
            {past.map((v) => (
              <Option key={v.version_no} value={String(v.version_no)}>
                {`Version ${v.version_no}${v.released ? " (released)" : ""}`}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Button icon={<ArrowClockwise20Regular />} disabled={preview.isFetching} onClick={() => preview.refetch()}>
          Refresh
        </Button>
        <Button
          icon={<ArrowDownload20Regular />}
          disabled={versionNo === null && !offer.current_version.letter_ready}
          title={versionNo === null && !offer.current_version.letter_ready ? "The stored letter is still being prepared" : undefined}
          onClick={() =>
            downloadApiFile(offersApi.letterUrl(offer.id, downloadVersion), `${offer.human_id}-v${downloadVersion}.pdf`).catch((e) => toast.error(errorMessage(e)))
          }
        >
          Download
        </Button>
        {offer.accepted_letter_url && (
          <Button
            icon={<ArrowDownload20Regular />}
            onClick={() => downloadApiFile(offersApi.acceptedLetterUrl(offer.id), `${offer.human_id}-accepted.pdf`).catch((e) => toast.error(errorMessage(e)))}
          >
            Signed copy
          </Button>
        )}
      </div>
      {versionNo === null && <Caption1 className={styles.muted}>Preview of the current terms. Bill rate and margin never appear in the letter.</Caption1>}
      {preview.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>Could not render the letter. {errorMessage(preview.error)}</MessageBarBody>
        </MessageBar>
      ) : preview.url ? (
        <iframe className={styles.frame} src={preview.url} title={`Offer letter ${offer.human_id} version ${downloadVersion}`} />
      ) : (
        <div className={styles.center}>
          <Spinner label="Rendering letter…" />
        </div>
      )}
    </div>
  );
}
