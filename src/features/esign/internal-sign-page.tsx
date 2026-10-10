"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { documentKeys } from "@/features/documents/api";
import { internalCeremonyApi } from "./internal-api";
import { SignCeremony } from "./sign-ceremony";

/** `/documents/sign/[signerId]`: an internal user signs a document (e.g. the company signatory). */
export function InternalSignPage({ signerId }: { signerId: string }) {
  const queryClient = useQueryClient();
  const api = useMemo(() => internalCeremonyApi(signerId), [signerId]);
  return <SignCeremony channel="internal" api={api} onFinished={() => void queryClient.invalidateQueries({ queryKey: documentKeys.all })} />;
}
