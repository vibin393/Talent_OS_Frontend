"use client";

import {
  Body1,
  Button,
  Checkbox,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, Copy20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useAppToast } from "@/components/toast";
import type { MfaEnrollOut } from "@/lib/api/types";
import { authApi } from "./api";
import { CodeInput } from "./code-input";
import { FormAlert } from "./form-alert";
import { formatSecret, isCompleteTotp, mfaErrorMessage, recoveryCodesFileName, recoveryCodesText } from "./mfa";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  steps: { margin: 0, paddingLeft: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  qrRow: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL, alignItems: "center" },
  qr: {
    width: "180px",
    height: "180px",
    padding: tokens.spacingHorizontalS,
    backgroundColor: "#ffffff",
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  secretBox: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minWidth: 0 },
  secret: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase400,
    overflowWrap: "anywhere",
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  codes: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: tokens.spacingHorizontalM,
    listStyle: "none",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground2 },
});

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * One-time display of recovery codes with Copy / Download .txt and an "I saved them" acknowledgement
 * that enables `doneLabel`.
 */
export function RecoveryCodes({
  codes,
  workspace,
  email,
  doneLabel = "Done",
  onDone,
}: {
  codes: readonly string[];
  workspace?: string;
  email?: string;
  doneLabel?: string;
  onDone: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const [saved, setSaved] = useState(false);
  const text = recoveryCodesText(codes, { workspace, email });
  return (
    <div className={styles.root}>
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>
          Save these recovery codes now. They are shown only once. Each code signs you in once if you lose access to
          your authenticator app.
        </MessageBarBody>
      </MessageBar>
      <ul className={styles.codes} aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button
          icon={<Copy20Regular />}
          onClick={async () => {
            if (await copyText(codes.join("\n"))) toast.success("Recovery codes copied");
            else toast.error("Could not copy. Select the codes and copy them manually.");
          }}
        >
          Copy
        </Button>
        <Button icon={<ArrowDownload20Regular />} onClick={() => downloadText(text, recoveryCodesFileName(workspace))}>
          Download .txt
        </Button>
      </div>
      <Checkbox checked={saved} onChange={(_, d) => setSaved(!!d.checked)} label="I have saved my recovery codes" />
      <div>
        <Button appearance="primary" disabled={!saved} onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

function QrImage({ uri }: { uri: string }) {
  const styles = useStyles();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(uri, { margin: 0, width: 360, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [uri]);
  if (!src) {
    return (
      <Skeleton aria-label="Generating QR code">
        <SkeletonItem shape="square" size={128} className={styles.qr} />
      </Skeleton>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- data: URL generated in the browser
  return <img src={src} alt="QR code for your authenticator app" className={styles.qr} />;
}

/**
 * TOTP enrolment: start (new pending secret) → scan the QR code or type the key → confirm with a code →
 * recovery codes shown once. `onDone` fires after the user acknowledged the codes.
 */
export function MfaSetup({
  workspace,
  email,
  onDone,
  onCancel,
}: {
  workspace?: string;
  email?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const [enrollment, setEnrollment] = useState<MfaEnrollOut | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({ mutationFn: () => authApi.mfaEnroll() });
  const confirm = useMutation({ mutationFn: (c: string) => authApi.mfaConfirm(c) });

  async function begin() {
    setError(null);
    setCode("");
    try {
      setEnrollment(await start.mutateAsync());
    } catch (e) {
      setError(mfaErrorMessage(e));
    }
  }

  async function finish(c: string = code) {
    if (confirm.isPending || !isCompleteTotp(c)) return;
    setError(null);
    try {
      const out = await confirm.mutateAsync(c);
      setCodes(out.recovery_codes);
    } catch (e) {
      setError(mfaErrorMessage(e));
      setCode("");
    }
  }

  if (codes) {
    return (
      <div className={styles.root}>
        <Subtitle2 as="h3">Multi-factor authentication is on</Subtitle2>
        <RecoveryCodes codes={codes} workspace={workspace} email={email} onDone={onDone} doneLabel="Done" />
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className={styles.root}>
        <FormAlert message={error} />
        <Body1 className={styles.muted}>
          You will need an authenticator app such as Microsoft Authenticator or Google Authenticator on your phone.
        </Body1>
        <div className={styles.actions}>
          <Button
            appearance="primary"
            onClick={begin}
            disabled={start.isPending}
            icon={start.isPending ? <Spinner size="tiny" /> : undefined}
          >
            Set up authenticator app
          </Button>
          {onCancel && (
            <Button appearance="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.root}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void finish();
      }}
    >
      <ol className={styles.steps}>
        <li>
          <Text>Open your authenticator app and add an account.</Text>
        </li>
        <li>
          <Text>Scan the QR code, or enter the setup key manually.</Text>
        </li>
        <li>
          <Text>Enter the 6-digit code the app shows.</Text>
        </li>
      </ol>
      <div className={styles.qrRow}>
        <QrImage uri={enrollment.otpauth_uri} />
        <div className={styles.secretBox}>
          <Text size={200} className={styles.muted}>
            Setup key
          </Text>
          <code className={styles.secret}>{formatSecret(enrollment.secret)}</code>
          <div>
            <Button
              size="small"
              icon={<Copy20Regular />}
              onClick={async () => {
                if (await copyText(enrollment.secret)) toast.success("Setup key copied");
                else toast.error("Could not copy the key.");
              }}
            >
              Copy key
            </Button>
          </div>
        </div>
      </div>
      <FormAlert message={error} />
      <CodeInput
        label="Code from your app"
        value={code}
        onChange={setCode}
        disabled={confirm.isPending}
        autoFocus
        onComplete={(c) => void finish(c)}
      />
      <div className={styles.actions}>
        <Button
          appearance="primary"
          type="submit"
          disabled={confirm.isPending || !isCompleteTotp(code)}
          icon={confirm.isPending ? <Spinner size="tiny" /> : undefined}
        >
          Verify and turn on
        </Button>
        <Button appearance="secondary" onClick={begin} disabled={start.isPending || confirm.isPending}>
          Get a new QR code
        </Button>
        {onCancel && (
          <Button appearance="subtle" onClick={onCancel} disabled={confirm.isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
