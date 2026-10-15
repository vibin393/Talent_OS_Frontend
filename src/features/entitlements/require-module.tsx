"use client";

import { Body1, Button, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { LockClosed24Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { MARKETPLACE_ENTRY } from "./catalog";
import { type ModuleKey } from "./modules";
import { useEntitlements } from "./use-entitlements";

const useStyles = makeStyles({
  card: { maxWidth: "560px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalM, marginTop: tokens.spacingVerticalM, flexWrap: "wrap" },
  icon: { color: tokens.colorNeutralForeground3 },
});

/**
 * Whether the tenant's plan includes `module`.
 * - `true` / `false` once entitlements have loaded.
 * - `null` while loading, or on error -> callers should fail OPEN (the module API still enforces via
 *   `require_module`, so showing the page is safe).
 */
export function useModuleEntitled(module: ModuleKey): boolean | null {
  const { data, isPending, isError } = useEntitlements();
  if (isPending || isError || !data) return null;
  return data.modules.includes(module);
}

/** Fluent "Not in your plan" empty state shown when a route's module is not entitled. */
function NotInPlan({ module }: { module: ModuleKey }) {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Card className={styles.card}>
      <CardHeader
        image={<LockClosed24Regular className={styles.icon} aria-hidden />}
        header={<Subtitle2 as="h1">Not in your plan</Subtitle2>}
        description={
          <Body1>
            The <strong>{module}</strong> module is not included in your current plan. Ask a tenant admin to add it,
            or browse add-ons in the Marketplace.
          </Body1>
        }
      />
      <div className={styles.actions}>
        <Button appearance="primary" onClick={() => router.push(MARKETPLACE_ENTRY.href)}>
          Browse Marketplace
        </Button>
        <Button appearance="secondary" onClick={() => router.push("/admin")}>
          Contact admin
        </Button>
      </div>
    </Card>
  );
}

/**
 * Route guard: renders `children` when the module is entitled OR entitlements are still loading
 * (fail-open); renders the "Not in your plan" empty state only once entitlements have loaded and the
 * tenant lacks the module. Wrap a module's page with this as a client-side gate on top of RBAC.
 */
export function RequireModule({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const entitled = useModuleEntitled(module);
  if (entitled === false) return <NotInPlan module={module} />;
  return <>{children}</>;
}
