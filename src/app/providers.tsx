"use client";

import { FluentProvider, Toaster, makeStyles, tokens, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { APP_TOASTER_ID } from "@/components/toast";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { isPublicPath, loginUrl } from "@/lib/navigation";
import { useMediaQuery } from "@/lib/use-media-query";
import { FluentSsrRegistry } from "./fluent-ssr";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry only transient failures (network / 5xx), never 4xx.
        retry: (failureCount, error) =>
          failureCount < 2 && (!isApiError(error) || error.status === 0 || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}

const useStyles = makeStyles({
  root: {
    minHeight: "100svh",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
});

// Set once a session-expiry redirect is under way; the page is then replaced by a full navigation.
let redirecting = false;

/** Fluent theme following the OS light/dark preference (light during SSR and hydration). */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const styles = useStyles();
  return (
    // applyStylesToPortals={false}: portal mount nodes are `position: absolute` at z-index 1000000, so the
    // root's full-height background would otherwise cover the whole page whenever a tooltip/menu is open.
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} className={styles.root} applyStylesToPortals={false}>
      {children}
      <Toaster toasterId={APP_TOASTER_ID} position="top-end" pauseOnHover pauseOnWindowBlur />
    </FluentProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    return setUnauthorizedHandler(() => {
      // Session expired or revoked mid-use. Mark the redirect BEFORE clearing: clearing while
      // observers are mounted can refetch, 401 again and re-enter this handler.
      const { pathname, search } = window.location;
      if (redirecting || isPublicPath(pathname)) return;
      redirecting = true;
      queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace(loginUrl(`${pathname}${search}`));
    });
  }, [queryClient]);

  return (
    <FluentSsrRegistry>
      <ThemedApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemedApp>
    </FluentSsrRegistry>
  );
}
