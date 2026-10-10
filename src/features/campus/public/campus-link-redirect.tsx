"use client";

import { Card, Spinner } from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { campusLinkPath } from "../logic";

/** `/l/[token]` for Epic 43 purposes: hand over to `/campus/r/{token}` or `/campus/e/{token}`. */
export function CampusLinkRedirect({ purpose, token }: { purpose: string; token: string }) {
  const router = useRouter();
  const path = campusLinkPath(purpose, token);
  useEffect(() => {
    if (path) router.replace(path);
  }, [path, router]);
  return (
    <Card>
      <Spinner label="Opening your registration page…" />
    </Card>
  );
}
