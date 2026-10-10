"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
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
  Subtitle2,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Copy20Regular, PersonAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { FileDrop } from "@/features/candidates/file-drop";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { isApiError } from "@/lib/api/errors";
import { meReferralsApi, type ReferrerApi, workReferralsApi } from "./api";
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPTY_REFER_FORM,
  formatDate,
  formatMoney,
  labelOf,
  REFERRER_STATUS_COLORS,
  RESUME_ACCEPT,
  REWARD_LABEL_COLORS,
  type ReferForm,
  referErrorMessage,
  referFormErrors,
  WORK_MODE_LABELS,
} from "./logic";
import type { ReferrerOpeningOut, ReferrerReferralOut, ReferrerShareLinkOut } from "./types";
import { referrerKeys, useMyReferrals, useReferralOpenings } from "./use-referrals";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  rowActions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  item: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  itemMain: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0, flex: "1 1 220px" },
  badges: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tall: { minHeight: "44px", minWidth: "44px" },
  linkBox: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

type Variant = "app" | "portal";

/** `/refer`: every internal User refers a friend. */
export function ReferAFriend() {
  const me = useMe();
  return <ReferrerPage variant="app" client={meReferralsApi} selfEmail={me.data?.user.email ?? null} />;
}

/** `/portal/work/referrals`: a Worker refers a friend (360 px friendly). */
export function WorkReferrals() {
  return <ReferrerPage variant="portal" client={workReferralsApi} selfEmail={null} />;
}

function ReferrerPage({ variant, client, selfEmail }: { variant: Variant; client: ReferrerApi; selfEmail: string | null }) {
  const styles = useStyles();
  const portal = usePortalStyles();
  const scope = variant === "app" ? "me" : "work";
  const openings = useReferralOpenings(scope, client);
  const mine = useMyReferrals(scope, client);
  const [referFor, setReferFor] = useState<ReferrerOpeningOut | "general" | null>(null);
  const [share, setShare] = useState<{ link: ReferrerShareLinkOut; copied: boolean; title: string } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareMut = useMutation({
    mutationFn: async ({ demandId }: { demandId: string | null; title: string }) => client.shareLink(demandId),
    onSuccess: async (link, vars) => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(link.url);
        copied = true;
      } catch {
        copied = false;
      }
      setShareError(null);
      setShare({ link, copied, title: vars.title });
    },
    onError: (e) => setShareError(referErrorMessage(isApiError(e) ? e : null)),
  });

  const notWorker = isApiError(openings.error) && openings.error.code === "not_a_worker";
  const title = "Refer a friend";
  const subtitle = "Know someone great? Refer them for an opening or share a link they can apply through.";

  if (notWorker) {
    return (
      <div className={portal.page}>
        <PortalPageHeader title={title} />
        <Card className={portal.card}>
          <Body1>{referErrorMessage({ code: "not_a_worker" })}</Body1>
        </Card>
      </div>
    );
  }

  const header = (
    <div className={styles.headerRow}>
      {variant === "app" ? <PageHeader title={title} subtitle={subtitle} /> : <PortalPageHeader title={title} subtitle={subtitle} />}
      <div className={styles.rowActions}>
        <Button appearance="primary" className={styles.tall} icon={<PersonAdd20Regular />} onClick={() => setReferFor("general")}>
          Refer for any opening
        </Button>
        <Button
          className={styles.tall}
          icon={<Copy20Regular />}
          disabled={shareMut.isPending}
          onClick={() => shareMut.mutate({ demandId: null, title: "General share link" })}
        >
          Copy general share link
        </Button>
      </div>
    </div>
  );

  return (
    <div className={variant === "portal" ? portal.page : styles.page}>
      {header}
      {shareError && (
        <MessageBar intent="error" role="alert" layout="multiline">
          <MessageBarBody>{shareError}</MessageBarBody>
        </MessageBar>
      )}
      {share && <ShareLinkNotice share={share} onDismiss={() => setShare(null)} />}

      <section className={styles.section} aria-labelledby="ref-openings">
        <Subtitle2 as="h2" id="ref-openings">
          Openings
        </Subtitle2>
        {variant === "app" ? (
          <OpeningsGrid
            openings={openings.data}
            loading={openings.isPending}
            error={openings.error}
            onRefer={setReferFor}
            onShare={(o) => shareMut.mutate({ demandId: o.demand_id, title: o.title })}
            sharing={shareMut.isPending}
          />
        ) : openings.isPending ? (
          <LoadingBlock label="Loading openings" />
        ) : openings.isError ? (
          <ErrorBlock error={openings.error} onRetry={() => openings.refetch()} />
        ) : (
          <OpeningsList
            openings={openings.data}
            onRefer={setReferFor}
            onShare={(o) => shareMut.mutate({ demandId: o.demand_id, title: o.title })}
            sharing={shareMut.isPending}
          />
        )}
      </section>

      <section className={styles.section} aria-labelledby="ref-mine">
        <Subtitle2 as="h2" id="ref-mine">
          My referrals
        </Subtitle2>
        {mine.isPending ? (
          <LoadingBlock label="Loading your referrals" />
        ) : mine.isError ? (
          <ErrorBlock error={mine.error} onRetry={() => mine.refetch()} />
        ) : (
          <MyReferralsList items={mine.data} client={client} scope={scope} />
        )}
      </section>

      {referFor && (
        <ReferDialog
          opening={referFor === "general" ? null : referFor}
          client={client}
          scope={scope}
          selfEmail={selfEmail}
          onClose={() => setReferFor(null)}
        />
      )}
    </div>
  );
}

function RewardBadge({ amount, currency }: { amount: string | null; currency: string | null }) {
  if (!amount) return <Caption1>—</Caption1>;
  return (
    <Badge appearance="tint" color="success">
      {`Reward ${formatMoney(amount, currency)}`}
    </Badge>
  );
}

function OpeningsGrid({
  openings,
  loading,
  error,
  onRefer,
  onShare,
  sharing,
}: {
  openings: ReferrerOpeningOut[] | undefined;
  loading: boolean;
  error: unknown;
  onRefer: (o: ReferrerOpeningOut) => void;
  onShare: (o: ReferrerOpeningOut) => void;
  sharing: boolean;
}) {
  const styles = useStyles();
  const columns: TableColumnDefinition<ReferrerOpeningOut>[] = [
    createTableColumn({ columnId: "title", renderHeaderCell: () => "Opening", renderCell: (o) => <Text weight="semibold">{o.title}</Text> }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (o) => o.client_name ?? "—" }),
    createTableColumn({ columnId: "location", renderHeaderCell: () => "Location", renderCell: (o) => o.location ?? "—" }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Employment type", renderCell: (o) => labelOf(EMPLOYMENT_TYPE_LABELS, o.employment_type) }),
    createTableColumn({ columnId: "mode", renderHeaderCell: () => "Work mode", renderCell: (o) => labelOf(WORK_MODE_LABELS, o.work_mode) }),
    createTableColumn({
      columnId: "reward",
      renderHeaderCell: () => "Reward",
      renderCell: (o) => <RewardBadge amount={o.reward_amount} currency={o.reward_currency} />,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (o) => (
        <div className={styles.rowActions}>
          <Button size="small" appearance="primary" onClick={() => onRefer(o)} aria-label={`Refer someone for ${o.title}`}>
            Refer
          </Button>
          <Button size="small" icon={<Copy20Regular />} disabled={sharing} onClick={() => onShare(o)} aria-label={`Copy share link for ${o.title}`}>
            Copy share link
          </Button>
        </div>
      ),
    }),
  ];
  return (
    <AdminGrid
      items={openings}
      columns={columns}
      getRowId={(o) => o.demand_id}
      loading={loading}
      error={error}
      emptyText="There are no openings to refer for right now. You can still make a general referral."
      label="Openings to refer for"
    />
  );
}

function OpeningsList({
  openings,
  onRefer,
  onShare,
  sharing,
}: {
  openings: ReferrerOpeningOut[];
  onRefer: (o: ReferrerOpeningOut) => void;
  onShare: (o: ReferrerOpeningOut) => void;
  sharing: boolean;
}) {
  const portal = usePortalStyles();
  if (openings.length === 0) {
    return (
      <Card className={portal.card}>
        <Body1 className={portal.empty}>There are no openings to refer for right now. You can still make a general referral.</Body1>
      </Card>
    );
  }
  return (
    <Card className={portal.card}>
      <ul className={portal.list}>
        {openings.map((o) => (
          <li key={o.demand_id} className={portal.row}>
            <div className={portal.rowMain}>
              <Text weight="semibold">{o.title}</Text>
              <Caption1 className={portal.muted}>
                {[o.client_name, o.location, labelOf(EMPLOYMENT_TYPE_LABELS, o.employment_type), o.work_mode ? labelOf(WORK_MODE_LABELS, o.work_mode) : null]
                  .filter((x) => x && x !== "—")
                  .join(" · ")}
              </Caption1>
              {o.reward_amount && (
                <div>
                  <RewardBadge amount={o.reward_amount} currency={o.reward_currency} />
                </div>
              )}
            </div>
            <div className={portal.actions}>
              <Button appearance="primary" className={portal.button} onClick={() => onRefer(o)} aria-label={`Refer someone for ${o.title}`}>
                Refer
              </Button>
              <Button className={portal.button} icon={<Copy20Regular />} disabled={sharing} onClick={() => onShare(o)} aria-label={`Copy share link for ${o.title}`}>
                Share link
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ShareLinkNotice({ share, onDismiss }: { share: { link: ReferrerShareLinkOut; copied: boolean; title: string }; onDismiss: () => void }) {
  const styles = useStyles();
  return (
    <MessageBar intent="success" layout="multiline" role="status">
      <MessageBarBody>
        <div className={styles.linkBox}>
          <Text weight="semibold">
            {share.copied ? `${share.title}: link copied to the clipboard.` : `${share.title}: copy the link below.`}
          </Text>
          <Field label="Share link" hint={`Valid until ${formatDate(share.link.expires_at)}.`}>
            <Input readOnly value={share.link.url} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div>
            <Button size="small" onClick={onDismiss}>
              Done
            </Button>
          </div>
        </div>
      </MessageBarBody>
    </MessageBar>
  );
}

function MyReferralsList({ items, client, scope }: { items: ReferrerReferralOut[]; client: ReferrerApi; scope: "me" | "work" }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [withdrawing, setWithdrawing] = useState<ReferrerReferralOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return <Body1 className={styles.muted}>You have not referred anyone yet.</Body1>;
  return (
    <>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <ul className={styles.list} aria-label="My referrals">
        {items.map((r) => (
          <li key={r.id} className={styles.item}>
            <div className={styles.itemMain}>
              <Text weight="semibold">{r.referee_name ?? "Referee"}</Text>
              <Caption1 className={styles.muted}>
                {r.demand_title ?? "General referral"} · {r.human_id} · referred {formatDate(r.submitted_at)}
              </Caption1>
              <div className={styles.badges}>
                <Badge appearance="tint" color={REFERRER_STATUS_COLORS[r.status_label] ?? "informative"}>
                  {r.status_label}
                </Badge>
                {r.reward && (
                  <Badge appearance="outline" color={REWARD_LABEL_COLORS[r.reward.status_label] ?? "informative"}>
                    {`Reward: ${r.reward.status_label}${r.reward.amount ? ` · ${formatMoney(r.reward.amount, r.reward.currency)}` : ""}`}
                  </Badge>
                )}
              </div>
            </div>
            {r.can_withdraw && (
              <Button className={styles.tall} onClick={() => setWithdrawing(r)} aria-label={`Withdraw referral of ${r.referee_name ?? r.human_id}`}>
                Withdraw
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw this referral?"
        confirmLabel="Withdraw"
        onClose={() => setWithdrawing(null)}
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            await client.withdraw(withdrawing.id);
            setError(null);
            await qc.invalidateQueries({ queryKey: referrerKeys(scope).root });
          } catch (e) {
            setError(referErrorMessage(isApiError(e) ? e : null));
          } finally {
            setWithdrawing(null);
          }
        }}
      >
        <Body1>
          {withdrawing?.referee_name ?? "Your friend"} will not be contacted about this referral. This cannot be undone.
        </Body1>
      </ConfirmDialog>
    </>
  );
}

function ReferDialog({
  opening,
  client,
  scope,
  selfEmail,
  onClose,
}: {
  opening: ReferrerOpeningOut | null;
  client: ReferrerApi;
  scope: "me" | "work";
  selfEmail: string | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [form, setForm] = useState<ReferForm>(EMPTY_REFER_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ReferForm, string>>>({});
  const [done, setDone] = useState(false);
  const refer = useMutation({
    mutationFn: () =>
      client.refer({
        referee_name: form.name,
        referee_email: form.email,
        demand_id: opening?.demand_id ?? null,
        referee_phone: form.phone,
        relationship: form.relationship,
        note: form.note,
        resume: file as File,
      }),
    onSuccess: () => {
      setDone(true);
      void qc.invalidateQueries({ queryKey: referrerKeys(scope).list });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "self_referral") setErrors((prev) => ({ ...prev, email: referErrorMessage(e) }));
    },
  });
  const set = <K extends keyof ReferForm>(k: K, v: ReferForm[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = referFormErrors(form, selfEmail);
    setErrors(found);
    if (Object.keys(found).length === 0) refer.mutate();
  };
  const title = opening ? `Refer someone for ${opening.title}` : "Refer someone for any opening";
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !refer.isPending && onClose()}>
      <DialogSurface aria-describedby={undefined}>
        <form onSubmit={submit} noValidate>
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.form}>
              {done ? (
                <MessageBar intent="success" role="status" layout="multiline">
                  <MessageBarBody>
                    Thank you! We have emailed {form.name.trim() || "your friend"} to ask for their agreement before we look at
                    their profile.
                  </MessageBarBody>
                </MessageBar>
              ) : (
                <>
                  <Body1 className={styles.muted}>
                    We email your friend first. Nothing is processed until they agree to the privacy notice.
                  </Body1>
                  <Field label="Full name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
                    <Input value={form.name} maxLength={200} onChange={(_, d) => set("name", d.value)} autoComplete="off" />
                  </Field>
                  <Field label="Email" required validationState={errors.email ? "error" : "none"} validationMessage={errors.email}>
                    <Input type="email" value={form.email} maxLength={320} onChange={(_, d) => set("email", d.value)} autoComplete="off" />
                  </Field>
                  <Field label="Phone (optional)">
                    <Input type="tel" value={form.phone} maxLength={40} onChange={(_, d) => set("phone", d.value)} autoComplete="off" />
                  </Field>
                  <Field label="How do you know them? (optional)" hint="For example: former colleague, classmate.">
                    <Input value={form.relationship} maxLength={100} onChange={(_, d) => set("relationship", d.value)} />
                  </Field>
                  <Field label="Resume" required validationState={errors.resume ? "error" : "none"} validationMessage={errors.resume}>
                    <FileDrop
                      accept={RESUME_ACCEPT}
                      title={file ? `Selected: ${file.name}` : "Drop the resume here"}
                      hint="PDF or Word (.docx), up to 10 MB."
                      buttonLabel={file ? "Choose another file" : "Choose file"}
                      disabled={refer.isPending}
                      onFiles={([f]) => {
                        if (!f) return;
                        setFile(f);
                        set("resume", { name: f.name, size: f.size });
                      }}
                    />
                  </Field>
                  <Field label="Note for the recruiter (optional)">
                    <Textarea value={form.note} maxLength={2000} resize="vertical" onChange={(_, d) => set("note", d.value)} />
                  </Field>
                  {refer.isError && !(isApiError(refer.error) && refer.error.code === "self_referral") && (
                    <MessageBar intent="error" role="alert" layout="multiline">
                      <MessageBarBody>{referErrorMessage(isApiError(refer.error) ? refer.error : null)}</MessageBarBody>
                    </MessageBar>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              {done ? (
                <Button appearance="primary" className={styles.tall} onClick={onClose}>
                  Close
                </Button>
              ) : (
                <>
                  <Button className={styles.tall} disabled={refer.isPending} onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    appearance="primary"
                    type="submit"
                    className={styles.tall}
                    disabled={refer.isPending}
                    icon={refer.isPending ? <Spinner size="tiny" /> : undefined}
                  >
                    Send referral
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
