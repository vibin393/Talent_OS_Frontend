"use client";

import { useId, useState } from "react";

/** Report-this-job dialog (Epic 75, B1). Exact labels from the spec. Anonymous POST; always confirms. */
const REASONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "scam_fee", label: "Asks for money or a deposit" },
  { value: "fake_job", label: "Looks fake" },
  { value: "offensive", label: "Offensive" },
  { value: "discriminatory", label: "Discriminatory" },
  { value: "wrong_info", label: "Wrong information" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Something else" },
];

export function ReportDialog({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("scam_fee");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameId = useId();

  async function submit() {
    setBusy(true);
    try {
      await fetch(`/api/v1/public/network/jobs/${encodeURIComponent(listingId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || null }),
        credentials: "omit",
        cache: "no-store",
      });
    } catch {
      /* 202 is always returned; network errors are swallowed to avoid enumeration */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <>
      <button type="button" className="jobs-link-button" onClick={() => setOpen(true)}>
        Report this job
      </button>
      {open ? (
        <div className="jobs-dialog-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="jobs-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${nameId}-title`}
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <>
                <h2 id={`${nameId}-title`}>Report this job</h2>
                <p>Thanks. Our moderators will review this job.</p>
                <button type="button" className="jobs-button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h2 id={`${nameId}-title`}>Report this job</h2>
                <fieldset>
                  <legend className="jobs-visually-hidden">Reason</legend>
                  {REASONS.map((r) => (
                    <label key={r.value} className="jobs-radio">
                      <input
                        type="radio"
                        name={`${nameId}-reason`}
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <label className="jobs-field">
                  Details (optional) — do not include personal information
                  <textarea
                    value={details}
                    maxLength={1000}
                    rows={3}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </label>
                <div className="jobs-dialog-actions">
                  <button type="button" className="jobs-button-subtle" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="jobs-button" disabled={busy} onClick={submit}>
                    Send report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
