"use client";

import { Checkbox, Field } from "@fluentui/react-components";

/** The two required upload statements (stored as the uploader's attestation). */
export function AttestationFields({
  consentObtained,
  policyFollowed,
  onChange,
  showErrors,
}: {
  consentObtained: boolean;
  policyFollowed: boolean;
  onChange: (next: { consentObtained: boolean; policyFollowed: boolean }) => void;
  showErrors?: boolean;
}) {
  return (
    <>
      <Field required validationMessage={showErrors && !consentObtained ? "Required" : undefined}>
        <Checkbox
          checked={consentObtained}
          label="The candidate agreed to this call and its recording"
          onChange={(_, d) => onChange({ consentObtained: !!d.checked, policyFollowed })}
        />
      </Field>
      <Field required validationMessage={showErrors && !policyFollowed ? "Required" : undefined}>
        <Checkbox
          checked={policyFollowed}
          label="I followed our recording policy"
          onChange={(_, d) => onChange({ consentObtained, policyFollowed: !!d.checked })}
        />
      </Field>
    </>
  );
}
