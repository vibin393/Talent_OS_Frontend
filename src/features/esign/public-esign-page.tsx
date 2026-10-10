"use client";

import { useMemo } from "react";
import type { PublicLinkView } from "@/lib/api/types";
import { publicCeremonyApi } from "./public-api";
import { SignCeremony } from "./sign-ceremony";

/** Secure-link signing page (`/l/[token]`, purpose `esign`), rendered inside the public link frame. */
export function PublicEsignPage({ token }: { token: string; view?: PublicLinkView }) {
  const api = useMemo(() => publicCeremonyApi(token), [token]);
  return <SignCeremony channel="public" api={api} />;
}
