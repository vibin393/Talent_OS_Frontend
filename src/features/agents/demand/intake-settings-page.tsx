"use client";

import {
  Badge,
  Button,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { Copy20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { UserPicker } from "@/features/admin/user-picker";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { SenderDomainsTable } from "./sender-domains-table";
import type { IntakeMode, IntakeSettings } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "640px" },
  inline: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  nested: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, paddingInlineStart: tokens.spacingHorizontalXXL },
});

export const WARNING_TEXT: Record<string, string> = {
  mailbox_not_connected: "The mailbox owner has no connected mailbox.",
  mailbox_needs_reconnect: "The mailbox connection needs reconnecting with mail reading enabled.",
  fallback_owner_missing: "Choose a fallback owner.",
};

/** `/settings/demands/intake` -- "Demand intake" (`settings:manage`). */
export function IntakeSettingsPage() {
  const canManage = usePermission("settings:manage");
  const query = useQuery({ queryKey: demandAgentKeys.intakeSettings, queryFn: ({ signal }) => demandAgentApi.intakeSettings(signal), enabled: canManage });
  return (
    <>
      <PageHeader title="Demand intake" subtitle="Intake mailbox, verified sender domains and fallback owner." />
      {!canManage ? (
        <NoAccess what="demand intake settings" />
      ) : query.isPending ? (
        <GridSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(query.error)} />
      ) : (
        <>
          <IntakeForm key={query.dataUpdatedAt} data={query.data} />
          <SenderDomainsTable />
        </>
      )}
    </>
  );
}

function IntakeForm({ data }: { data: IntakeSettings }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<IntakeMode>(data.intake_mode);
  const [mailboxUser, setMailboxUser] = useState<string | null>(data.mailbox_user_id);
  const [folder, setFolder] = useState(data.mailbox_folder || "Talent OS Intake");
  const [fallback, setFallback] = useState<string | null>(data.fallback_owner_id);
  const [forwarded, setForwarded] = useState(data.accept_forwarded);
  const [auth, setAuth] = useState(data.require_sender_auth);
  const [rotating, setRotating] = useState(false);
  const onSaved = (out: IntakeSettings) => qc.setQueryData(demandAgentKeys.intakeSettings, out);
  const save = useMutation({
    mutationFn: () =>
      demandAgentApi.updateIntakeSettings({
        intake_mode: mode,
        mailbox_user_id: mailboxUser,
        mailbox_folder: folder.trim() || "Talent OS Intake",
        fallback_owner_id: fallback,
        accept_forwarded: forwarded,
        require_sender_auth: auth,
      }),
    onSuccess: (out) => {
      onSaved(out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {data.warnings.map((w) => (
        <MessageBar key={w} intent="warning">
          <MessageBarBody>{WARNING_TEXT[w] ?? w}</MessageBarBody>
        </MessageBar>
      ))}
      <Field label="Intake method">
        <RadioGroup value={mode} onChange={(_, d) => setMode(d.value as IntakeMode)}>
          <Radio value="off" label="Off" />
          <Radio value="connected_mailbox" label="Connected mailbox" />
          <Radio value="platform_address" label="Talent OS address" />
        </RadioGroup>
      </Field>
      {mode === "connected_mailbox" && (
        <div className={styles.nested}>
          <UserPicker label="Mailbox owner" value={mailboxUser} onChange={(id) => setMailboxUser(id)} />
          <Field label="Folder or label">
            <Input value={folder} maxLength={100} onChange={(_, d) => setFolder(d.value)} />
          </Field>
          {data.mailbox_status && (
            <Badge appearance="tint" color={data.mailbox_status === "connected" ? "success" : "warning"}>
              {data.mailbox_status === "connected" ? "Connected" : "Needs reconnecting"}
            </Badge>
          )}
        </div>
      )}
      {mode === "platform_address" && (
        <div className={styles.nested}>
          <div className={styles.inline}>
            <Field label="Talent OS address" hint="Forward client requirement emails here.">
              <Input readOnly value={data.platform_address ?? "Save to generate the address"} />
            </Field>
            <Button
              icon={<Copy20Regular />}
              disabled={!data.platform_address}
              onClick={() => {
                if (data.platform_address) void navigator.clipboard?.writeText(data.platform_address);
                toast.success("Address copied.");
              }}
            >
              Copy
            </Button>
          </div>
          {data.platform_address && (
            <Button appearance="secondary" onClick={() => setRotating(true)}>
              Generate a new address
            </Button>
          )}
        </div>
      )}
      <UserPicker label="Fallback owner" value={fallback} onChange={(id) => setFallback(id)} />
      <Switch label="Accept emails forwarded by colleagues" checked={forwarded} onChange={(_, d) => setForwarded(d.checked)} />
      <Switch label="Require authenticated senders (SPF/DKIM)" checked={auth} onChange={(_, d) => setAuth(d.checked)} />
      <div>
        <Button appearance="primary" type="submit" disabled={save.isPending}>
          Save
        </Button>
      </div>
      <ConfirmDialog
        open={rotating}
        title="Generate a new address"
        confirmLabel="Generate a new address"
        onClose={() => setRotating(false)}
        onConfirm={() =>
          demandAgentApi
            .rotateAddress()
            .then(onSaved)
            .catch((e) => {
              toast.error(errorMessage(e));
              throw e;
            })
        }
      >
        The old address will stop working immediately.
      </ConfirmDialog>
    </form>
  );
}
