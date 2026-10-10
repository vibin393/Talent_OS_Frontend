import type { UnsubscribeView } from "./types";

const CHANNEL_NOUN: Record<string, string> = { email: "emails", sms: "text messages", whatsapp: "WhatsApp messages" };

/** Copy for the public unsubscribe page. */
export function unsubscribeCopy(view: Pick<UnsubscribeView, "tenant_name" | "channel">, all: boolean) {
  const org = view.tenant_name?.trim() || "this organization";
  const noun = CHANNEL_NOUN[view.channel] ?? "messages";
  return {
    title: `Unsubscribe from ${org}`,
    body: `Stop marketing ${noun} about jobs from ${org}. Messages about applications you made still arrive.`,
    doneTitle: "You are unsubscribed",
    doneBody: all
      ? `${org} will not send you any more marketing messages on any channel.`
      : `${org} will not send you any more marketing ${noun}.`,
  };
}

export function unsubscribeErrorCopy(status: number): { title: string; body: string } {
  if (status === 404 || status === 410) return { title: "This link is not valid", body: "It may have expired. Use the link in a more recent message." };
  if (status === 0) return { title: "You are offline", body: "Check your connection and try again." };
  if (status === 429) return { title: "Too many attempts", body: "Wait a minute and try again." };
  return { title: "Something went wrong", body: "Please try again in a few minutes." };
}
