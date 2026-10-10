"use client";

import { Body1, Button, Card, CardHeader, Field, Input, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { telephonyApi, telephonyKeys } from "./api";
import { validOtp } from "./logic";
import type { CallPhone } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM, maxWidth: "560px" },
  row: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Calling phone" (spec B2): the recruiter's own phone that Talent OS rings first. Only the last 4 digits are shown. */
export function CallPhoneCard() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const q = useQuery({ queryKey: telephonyKeys.phone, queryFn: ({ signal }) => telephonyApi.phone(signal) });
  const update = (out: CallPhone) => {
    qc.setQueryData(telephonyKeys.phone, out);
    void qc.invalidateQueries({ queryKey: ["telephony", "options"] });
  };
  const send = useMutation({ mutationFn: () => telephonyApi.sendCode(phone), onSuccess: (out) => { update(out); toast.success("Code sent."); } });
  const verify = useMutation({ mutationFn: () => telephonyApi.verify(code), onSuccess: (out) => { update(out); setCode(""); toast.success("Phone verified."); } });
  const remove = useMutation({
    mutationFn: () => telephonyApi.removePhone(),
    onSuccess: () => update({ status: "none", last4: null, verified_at: null, verification_method: null, otp_expires_at: null }),
  });
  const err = send.error ?? verify.error ?? remove.error;
  return (
    <Card className={styles.root}>
      <CardHeader header={<Subtitle2>Calling phone</Subtitle2>} />
      <Body1 className={styles.muted}>Talent OS rings this phone when you start a call. Candidates never see it.</Body1>
      <ErrorBar message={err ? errorMessage(err) : null} />
      {q.isPending ? (
        <GridSkeleton rows={1} />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : q.data.status === "verified" ? (
        <div className={styles.row}>
          <Body1>Verified ••••{q.data.last4}</Body1>
          <Button size="small" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Remove
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.row}>
            <Field label="Mobile number">
              <Input value={phone} onChange={(_, d) => setPhone(d.value)} placeholder="+91 98765 43210" inputMode="tel" />
            </Field>
            <Button disabled={!phone.trim() || send.isPending} onClick={() => send.mutate()}>
              Send code
            </Button>
          </div>
          {q.data.status === "pending" && (
            <div className={styles.row}>
              <Field label="6-digit code">
                <Input value={code} onChange={(_, d) => setCode(d.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
              </Field>
              <Button appearance="primary" disabled={!validOtp(code) || verify.isPending} onClick={() => verify.mutate()}>
                Verify
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
