/**
 * Hand-written types for the Epic 33 communication extensions (SMS / WhatsApp, reply capture, custom
 * career domains). They mirror the backend contract until `npm run gen:api` picks the schemas up.
 */
import type { EmailMessageOut } from "@/lib/api/types";

export type Channel = "sms" | "whatsapp";
export type RecipientKind = "candidate" | "contact";

// ---------------------------------------------------------------- reply capture (FR-171)
export type ReplyCaptureState = {
  enabled: boolean;
  provider: string | null;
  connection_id: string | null;
  scopes_granted: boolean;
  threads_tracked: number;
  last_synced_at: string | null;
  tenant_enabled: boolean;
};

export type EmailReply = {
  id: string;
  from_address: string;
  subject: string;
  body_text: string;
  received_at: string;
  attachment_names: string[];
};

export type EmailThread = { email: EmailMessageOut; replies: EmailReply[] };

/** `data` of an `email_reply` activity. */
export type EmailReplyActivityData = {
  inbound_email_id?: string;
  email_message_id?: string;
  from_address?: string;
  subject?: string;
};

// ---------------------------------------------------------------- channel settings
export type QuietHours = { start: string; end: string; tz: string };

export type ChannelSettings = {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  default_sms_sender_id: string | null;
  dlt_entity_id: string | null;
  quiet_hours: QuietHours;
  inbound_sync_enabled: boolean;
  thread_sync_days: number;
};

// ---------------------------------------------------------------- templates
export const TEMPLATE_PURPOSES = [
  "timesheet_reminder",
  "onboarding_task",
  "interview_reminder",
  "joining_touchpoint",
  "other_transactional",
] as const;
export type TemplatePurpose = (typeof TEMPLATE_PURPOSES)[number];
export type TemplateStatus = "draft" | "registered" | "archived";

export type ChannelTemplate = {
  id: string;
  channel: Channel;
  key: string;
  name: string;
  purpose: TemplatePurpose;
  body: string;
  variables: string[];
  provider_template_ref: string | null;
  language: string;
  sender_id: string | null;
  status: TemplateStatus;
  version: number;
  sendable: boolean;
  created_at: string;
  updated_at: string;
};

export type ChannelTemplateIn = {
  channel: Channel;
  key: string;
  name: string;
  purpose: TemplatePurpose;
  body: string;
  variables: string[];
  provider_template_ref: string | null;
  language: string;
  sender_id: string | null;
  status: TemplateStatus;
};

// ---------------------------------------------------------------- sending
export type Recipient = { entity_type: RecipientKind; entity_id: string };

export type IneligibleReason =
  | "no_phone"
  | "opted_out"
  | "no_whatsapp_consent"
  | "missing_variable"
  | "template_not_registered";

export type Eligibility = {
  entity_type: RecipientKind;
  entity_id: string;
  eligible: boolean;
  reason: IneligibleReason | null;
  preview: string | null;
};

export type SendRequest = {
  channel: Channel;
  template_id: string;
  recipients: Recipient[];
  context_refs?: Record<string, string>;
};

export type SendResult = {
  entity_type: RecipientKind;
  entity_id: string;
  status: "queued" | "refused";
  reason: string | null;
  message_id: string | null;
};

export type MessageStatus =
  | "queued"
  | "deferred_quiet_hours"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "refused"
  | "received"
  | "manual_pending";

export type ChannelMessage = {
  id: string;
  channel: Channel;
  direction: "outbound" | "inbound";
  template_id: string | null;
  template_name: string | null;
  status: MessageStatus;
  refusal_reason: string | null;
  error_code: string | null;
  recipient_kind: string | null;
  recipient_id: string | null;
  to_masked: string | null;
  body_rendered: string | null;
  origin: string | null;
  sent_at: string | null;
  created_at: string;
  age_seconds: number;
};

export type WhatsappNotice = { id: string; version: number | string; title: string; body_md: string };

export type MessagingState = {
  has_phone: boolean;
  phone_masked: string | null;
  sms_opted_out: boolean;
  whatsapp_consent: boolean;
  whatsapp_notice: WhatsappNotice | null;
};

// ---------------------------------------------------------------- opt-outs / manual queue
export type OptOut = {
  id: string;
  channel: Channel;
  phone_masked: string;
  source: string;
  recipient_kind: string | null;
  recipient_id: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type ManualQueueItem = {
  id: string;
  channel: Channel;
  to_e164: string;
  body_rendered: string;
  template_name: string | null;
  provider_template_ref: string | null;
  created_at: string;
  age_seconds: number;
};

// ---------------------------------------------------------------- connectors
export type ConnectorConfig = {
  id: string;
  category: Channel;
  provider_key: string;
  display_name: string;
  settings: Record<string, unknown>;
  status: string;
  has_credentials: boolean;
  has_webhook_secret: boolean;
  webhook_path: string | null;
  created_at: string;
};

export type ConnectorList = { category: Channel; providers: string[]; configs: ConnectorConfig[] };

export type ConnectorCreate = {
  category: Channel;
  provider_key: string;
  display_name: string;
  credentials?: Record<string, string>;
  webhook_secret?: string;
  settings?: Record<string, unknown>;
};

export type ConnectorUpdate = {
  display_name?: string;
  credentials?: Record<string, string>;
  webhook_secret?: string;
  settings?: Record<string, unknown>;
  status?: string;
};

// ---------------------------------------------------------------- custom domain (FR-174)
export type CustomDomainStatus = "pending" | "verified" | "failed" | "removed";

export type CustomDomain = {
  id: string;
  host: string;
  status: CustomDomainStatus;
  txt_name: string;
  txt_value: string;
  cname_target: string;
  verified_at: string | null;
  last_checked_at: string | null;
  certificate: string;
};

// ---------------------------------------------------------------- portal / public link
export type PortalMessaging = {
  has_phone: boolean;
  sms_opted_out: boolean;
  whatsapp_opted_in: boolean;
  whatsapp_notice: WhatsappNotice | null;
};
