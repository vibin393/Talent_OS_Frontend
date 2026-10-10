"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Spinner,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { ArrowSync20Regular, Dismiss20Regular, ShieldKeyhole24Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { authApi, authKeys } from "./api";
import { CodeInput } from "./code-input";
import { FormAlert } from "./form-alert";
import { isCompleteTotp, mfaErrorMessage } from "./mfa";
import { MfaSetup, RecoveryCodes } from "./mfa-setup";
import { useMe } from "./use-me";

const useStyles = makeStyles({
  card: { maxWidth: "720px", padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground2 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** Dialog asking for a current authenticator code before a sensitive MFA change. */
function CodeDialog({
  title,
  description,
  confirmLabel,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onSubmit: (code: string) => Promise<void>;
  onClose: () => void;
  /** Replaces the form once the action succeeded (e.g. the new recovery codes). */
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(c: string = code) {
    if (busy || !isCompleteTotp(c)) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(c);
    } catch (e) {
      setError(mfaErrorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open modalType={children ? "alert" : "modal"} onOpenChange={(_, d) => !d.open && !busy && !children && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            {children ?? (
              <form
                id="mfa-code-dialog"
                className={styles.form}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <Body1>{description}</Body1>
                <FormAlert message={error} />
                <CodeInput label="Code from your authenticator app" value={code} onChange={setCode} disabled={busy} autoFocus />
              </form>
            )}
          </DialogContent>
          {!children && (
            <DialogActions>
              <Button appearance="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                form="mfa-code-dialog"
                disabled={busy || !isCompleteTotp(code)}
                icon={busy ? <Spinner size="tiny" /> : undefined}
              >
                {confirmLabel}
              </Button>
            </DialogActions>
          )}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** `/settings/security`: the signed-in user's multi-factor authentication (enrol, recovery codes, turn off). */
export function SecuritySettings() {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [enrolling, setEnrolling] = useState(false);
  const [dialog, setDialog] = useState<"regenerate" | "disable" | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  if (!me) return null;
  const enabled = me.user.mfa_enabled;
  const refreshMe = () => queryClient.invalidateQueries({ queryKey: authKeys.me });

  return (
    <>
      <PageHeader title="Security" subtitle="Protect your account with a second sign-in step." />
      <Card className={styles.card}>
        <CardHeader
          image={<ShieldKeyhole24Regular aria-hidden />}
          header={<Subtitle2 as="h2">Multi-factor authentication</Subtitle2>}
          description={
            enabled ? (
              <Badge appearance="tint" color="success">
                On
              </Badge>
            ) : (
              <Badge appearance="tint" color="warning">
                Off
              </Badge>
            )
          }
        />
        {enabled ? (
          <>
            <Body1 className={styles.muted}>
              When you sign in, you enter a code from your authenticator app after your password. If you lose your
              phone, use one of your recovery codes.
            </Body1>
            <div className={styles.actions}>
              <Button icon={<ArrowSync20Regular />} onClick={() => setDialog("regenerate")}>
                Get new recovery codes
              </Button>
              <Button icon={<Dismiss20Regular />} onClick={() => setDialog("disable")}>
                Turn off
              </Button>
            </div>
          </>
        ) : enrolling ? (
          <MfaSetup
            workspace={me.tenant.slug}
            email={me.user.email}
            onCancel={() => setEnrolling(false)}
            onDone={() => {
              setEnrolling(false);
              toast.success("Multi-factor authentication is on");
              void refreshMe();
            }}
          />
        ) : (
          <>
            <Body1 className={styles.muted}>
              Add a second step to sign-in: after your password you enter a 6-digit code from an authenticator app.
            </Body1>
            <div>
              <Button appearance="primary" onClick={() => setEnrolling(true)}>
                Set up
              </Button>
            </div>
          </>
        )}
      </Card>

      {dialog === "regenerate" && (
        <CodeDialog
          title="Get new recovery codes"
          description="Your current recovery codes stop working. Enter a code from your authenticator app to continue."
          confirmLabel="Get new codes"
          onSubmit={async (code) => {
            const out = await authApi.mfaRegenerateCodes(code);
            setNewCodes(out.recovery_codes);
          }}
          onClose={() => setDialog(null)}
        >
          {newCodes && (
            <RecoveryCodes
              codes={newCodes}
              workspace={me.tenant.slug}
              email={me.user.email}
              onDone={() => {
                setNewCodes(null);
                setDialog(null);
                toast.success("New recovery codes saved");
              }}
            />
          )}
        </CodeDialog>
      )}
      {dialog === "disable" && (
        <CodeDialog
          title="Turn off multi-factor authentication?"
          description="Your account will be protected by your password only. Enter a code from your authenticator app to confirm."
          confirmLabel="Turn off"
          onSubmit={async (code) => {
            await authApi.mfaDisable(code);
            setDialog(null);
            toast.success("Multi-factor authentication is off");
            await refreshMe();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
