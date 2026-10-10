"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { LockClosed16Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { NotificationChannel, NotificationPreferencesOut } from "@/lib/api/types";
import { notificationKeys, notificationsApi } from "./api";
import { CHANNEL_LABELS, CHANNELS } from "./format";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "880px" },
  surface: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    overflowX: "auto",
  },
  table: { minWidth: "560px" },
  groupRow: { backgroundColor: tokens.colorNeutralBackground2 },
  channel: { minWidth: "200px" },
  digest: { display: "flex", gap: tokens.spacingHorizontalXL, alignItems: "flex-end", flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", gap: tokens.spacingHorizontalS },
  lock: { color: tokens.colorNeutralForeground3, marginInlineStart: tokens.spacingHorizontalXS, verticalAlign: "middle" },
});

function hourLabel(h: number): string {
  const d = new Date(2000, 0, 1, h, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** `/settings/notifications`: channel per notification type and the daily digest. */
export function NotificationPreferences() {
  const query = useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: ({ signal }) => notificationsApi.preferences(signal),
  });
  return (
    <>
      <PageHeader
        title="Notification settings"
        subtitle="Choose how you hear about things that need you. Some notifications always appear in the app."
      />
      {query.isPending ? (
        <GridSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorBar title="Could not load your settings." message={errorMessage(query.error)} />
      ) : (
        <PreferencesForm key={query.dataUpdatedAt} data={query.data} />
      )}
    </>
  );
}

function PreferencesForm({ data }: { data: NotificationPreferencesOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<Record<string, NotificationChannel>>(() =>
    Object.fromEntries(data.items.map((i) => [i.type, i.channel])),
  );
  const [digest, setDigest] = useState({ enabled: data.digest.enabled, hour: data.digest.hour_local });
  const [error, setError] = useState<string | null>(null);

  const dirty =
    data.items.some((i) => channels[i.type] !== i.channel) ||
    digest.enabled !== data.digest.enabled ||
    digest.hour !== data.digest.hour_local;

  const save = useMutation({
    mutationFn: () =>
      notificationsApi.savePreferences({
        items: data.items.filter((i) => channels[i.type] !== i.channel).map((i) => ({ type: i.type, channel: channels[i.type] })),
        digest: { enabled: digest.enabled, hour_local: digest.hour },
      }),
    onSuccess: (out) => {
      queryClient.setQueryData(notificationKeys.preferences, out);
      setError(null);
      toast.success("Notification settings saved");
    },
    onError: (e) =>
      setError(
        isApiError(e) && e.code === "notification_mandatory"
          ? "One of these notifications cannot be turned off; only its email can."
          : errorMessage(e),
      ),
  });

  const groups: { group: string; items: typeof data.items }[] = [];
  for (const item of data.items) {
    const g = groups.find((x) => x.group === item.group);
    if (g) g.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }

  return (
    <div className={styles.stack}>
      <ErrorBar message={error} />
      <div className={styles.surface}>
        <Table aria-label="Notification channels" className={styles.table}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Notification</TableHeaderCell>
              <TableHeaderCell>Deliver</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => [
              <TableRow key={`g:${g.group}`} className={styles.groupRow}>
                <TableCell colSpan={2}>
                  <Text weight="semibold">{g.group}</Text>
                </TableCell>
              </TableRow>,
              ...g.items.map((item) => (
                <TableRow key={item.type}>
                  <TableCell>
                    {item.label}
                    {item.mandatory && (
                      <Tooltip content="Always shown in the app" relationship="label">
                        <LockClosed16Regular className={styles.lock} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Dropdown
                      className={styles.channel}
                      aria-label={`Delivery for ${item.label}`}
                      value={CHANNEL_LABELS[channels[item.type]]}
                      selectedOptions={[channels[item.type]]}
                      onOptionSelect={(_, d) =>
                        d.optionValue && setChannels((c) => ({ ...c, [item.type]: d.optionValue as NotificationChannel }))
                      }
                    >
                      {CHANNELS.map((ch) =>
                        ch === "off" && item.mandatory ? (
                          <Tooltip
                            key={ch}
                            content="This notification is required and always appears in the app"
                            relationship="description"
                          >
                            <Option value={ch} disabled>
                              {CHANNEL_LABELS[ch]}
                            </Option>
                          </Tooltip>
                        ) : (
                          <Option key={ch} value={ch}>
                            {CHANNEL_LABELS[ch]}
                          </Option>
                        ),
                      )}
                    </Dropdown>
                  </TableCell>
                </TableRow>
              )),
            ])}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">Daily digest</Subtitle2>}
          description={
            <Body1 className={styles.muted}>
              One email a day with unread notifications, overdue tasks and tasks due today. Times are in {data.digest.timezone}.
            </Body1>
          }
        />
        <div className={styles.digest}>
          <Switch
            label="Send me a daily digest"
            checked={digest.enabled}
            onChange={(_, d) => setDigest((x) => ({ ...x, enabled: d.checked }))}
          />
          <Field label="Send at">
            <Dropdown
              disabled={!digest.enabled}
              value={hourLabel(digest.hour)}
              selectedOptions={[String(digest.hour)]}
              onOptionSelect={(_, d) => d.optionValue && setDigest((x) => ({ ...x, hour: Number(d.optionValue) }))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <Option key={h} value={String(h)}>
                  {hourLabel(h)}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
      </Card>

      <div className={styles.footer}>
        <Button
          appearance="primary"
          icon={save.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
