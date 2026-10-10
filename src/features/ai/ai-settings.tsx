"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { DocumentBulletList20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { AI_FEATURE_COST_NOTES, AI_FEATURE_INFO, aiFeatureLabel, withDefaultAiFeatures } from "@/features/ai-admin/ai-features";
import { BudgetCard } from "@/features/ai-admin/budget-card";
import { AI_FEATURES_KEY } from "@/features/ai-admin/use-ai-features";
import { usePermission } from "@/features/auth/use-permission";
import { candidateErrorMessage } from "@/features/candidates/errors";
import { api } from "@/lib/api/client";
import type { AISettingsOut } from "@/lib/api/types";

const aiApi = {
  get: (signal?: AbortSignal) => api.get<AISettingsOut>("/api/v1/ai/settings", { signal }),
  putFeatures: (features: Record<string, boolean>) => api.put<Record<string, boolean>>("/api/v1/ai/features", features),
};
const AI_SETTINGS_KEY = ["ai", "settings"] as const;

const BASIS_LABELS: Record<AISettingsOut["ai_processing_basis"], string> = {
  consent_required: "Consent required",
  notice_based: "Notice based",
};

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "860px" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}` },
  feature: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  hint: { color: tokens.colorNeutralForeground3, marginLeft: "44px" },
  footer: { display: "flex", gap: tokens.spacingHorizontalS },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** `/admin/ai` (`ai:admin`): feature toggles, processing basis link, matching weights and the budget. */
export function AiSettings() {
  const router = useRouter();
  const canAdmin = usePermission("ai:admin");
  const canLog = usePermission("ai_log:read");
  const settings = useQuery({ queryKey: AI_SETTINGS_KEY, queryFn: ({ signal }) => aiApi.get(signal), enabled: canAdmin });
  if (!canAdmin && !canLog) return <NoAccess what="AI settings" />;
  return (
    <>
      <PageHeader title="AI settings" subtitle="Control which AI features your organization uses and review what they consume." />
      {canLog && (
        <div style={{ marginBottom: 16 }}>
          <Button icon={<DocumentBulletList20Regular />} onClick={() => router.push("/admin/ai/log")}>
            View AI action log
          </Button>
        </div>
      )}
      {!canAdmin ? (
        <Body1>You can review the AI action log. Changing AI settings needs the ai:admin permission.</Body1>
      ) : settings.isPending ? (
        <GridSkeleton rows={6} />
      ) : settings.isError ? (
        <ErrorBar title="Could not load AI settings." message={candidateErrorMessage(settings.error)} />
      ) : (
        <AiSettingsForm key={JSON.stringify(settings.data.features)} settings={settings.data} />
      )}
    </>
  );
}

function AiSettingsForm({ settings }: { settings: AISettingsOut }) {
  const canConfigureMatching = usePermission("matching:configure");
  const canConfigureMcp = usePermission("ai:agent_configure");
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const baseline = withDefaultAiFeatures(settings.features);
  const [features, setFeatures] = useState<Record<string, boolean>>(baseline);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => aiApi.putFeatures(features),
    onSuccess: async (data) => {
      queryClient.setQueryData(AI_SETTINGS_KEY, { ...settings, features: data });
      queryClient.setQueryData(AI_FEATURES_KEY, data);
      toast.success("AI features saved");
    },
  });

  const dirty = Object.keys(features).some((k) => features[k] !== baseline[k]);
  const keys = Object.keys(features).sort((a, b) => aiFeatureLabel(a).localeCompare(aiFeatureLabel(b)));

  return (
    <div className={styles.root}>
      {!settings.configured && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            No AI provider key is configured for this installation, so AI features are skipped and users fill details
            manually. Ask your platform operator to configure it.
          </MessageBarBody>
        </MessageBar>
      )}
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await save.mutateAsync();
          } catch (err) {
            setError(candidateErrorMessage(err));
          }
        }}
      >
        <Card>
          <CardHeader
            header={<Subtitle2 as="h2">Features</Subtitle2>}
            description={<Caption1>Model: {settings.model}. Turning a feature off hides it everywhere; manual paths stay available.</Caption1>}
          />
          <div className={styles.body}>
            <ErrorBar message={error} />
            {keys.map((key) => (
              <div key={key} className={styles.feature}>
                <Switch
                  label={aiFeatureLabel(key)}
                  checked={features[key]}
                  onChange={(_, d) => setFeatures((f) => ({ ...f, [key]: d.checked }))}
                />
                {key in AI_FEATURE_INFO && (
                  <Caption1 className={styles.hint}>{AI_FEATURE_INFO[key as keyof typeof AI_FEATURE_INFO].description}</Caption1>
                )}
                {AI_FEATURE_COST_NOTES[key as keyof typeof AI_FEATURE_COST_NOTES] && (
                  <Caption1 className={styles.hint}>{AI_FEATURE_COST_NOTES[key as keyof typeof AI_FEATURE_COST_NOTES]}</Caption1>
                )}
              </div>
            ))}
            <div className={styles.footer}>
              <Button
                appearance="primary"
                type="submit"
                disabled={!dirty || save.isPending}
                icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              >
                Save
              </Button>
            </div>
          </div>
        </Card>
      </form>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Processing basis</Subtitle2>} />
        <div className={styles.body}>
          <div className={styles.row}>
            <Body1>Current basis:</Body1>
            <Badge appearance="tint" color="brand">
              {BASIS_LABELS[settings.ai_processing_basis]}
            </Badge>
          </div>
          <Body1>
            The legal basis for AI processing of candidate data is managed with the consent notices in the{" "}
            <AppLink href="/admin/privacy?tab=consent">privacy center</AppLink>.
          </Body1>
        </div>
      </Card>
      <Card>
        <CardHeader
          header={<Subtitle2 as="h2">Matching weights</Subtitle2>}
          action={
            canConfigureMatching ? <AppLink href="/admin/settings/matching">Configure weights</AppLink> : undefined
          }
        />
        <div className={styles.body}>
          <Body1>Tune how skills, experience, location and compensation contribute to the match score.</Body1>
        </div>
      </Card>
      {/* Epic 73: AI assistant access (MCP). */}
      {canConfigureMcp ? (
        <Card>
          <CardHeader
            header={<Subtitle2 as="h2">AI assistant access (MCP)</Subtitle2>}
            action={<AppLink href="/admin/ai/mcp">Open settings</AppLink>}
          />
          <div className={styles.body}>
            <Body1>Let people use their own AI assistants, such as Claude, with Talent OS tools.</Body1>
          </div>
        </Card>
      ) : null}
      <BudgetCard />
    </div>
  );
}
