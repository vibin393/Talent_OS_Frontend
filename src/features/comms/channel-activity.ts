/** Activity kinds added by Epic 33 (email replies, SMS, WhatsApp) — labels for the shared timeline. */
export const CHANNEL_ACTIVITY_LABELS: Record<string, string> = {
  email_reply: "Email reply",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/** True for the system-generated communication kinds rendered without an author avatar. */
export function isChannelActivity(kind: string): boolean {
  return kind in CHANNEL_ACTIVITY_LABELS;
}

export function channelActivityLabel(kind: string): string {
  return CHANNEL_ACTIVITY_LABELS[kind] ?? kind;
}
