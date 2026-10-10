/**
 * Hand-written DTOs of the Epic 39 recruitment marketing endpoints (`app/schemas/campaigns.py`).
 * Do not regenerate from the OpenAPI schema. Datetimes are ISO strings.
 */

export type Channel = "email" | "sms" | "whatsapp";
export const CHANNELS: readonly Channel[] = ["email", "sms", "whatsapp"];

// Settings ---------------------------------------------------------------------------------------------

export type SendWindow = { start: string; end: string };
export type ChannelNumbers = Partial<Record<Channel, number | null>>;

export type MarketingSettingsOut = {
  frequency_cap_count: number;
  frequency_cap_days: number;
  send_windows: Record<string, SendWindow>;
  approval_threshold: number;
  ab_window_hours: number;
  rate_per_minute: Record<string, number>;
  daily_cap: Record<string, number>;
  platform_max_rate: Record<string, number>;
  platform_max_daily: Record<string, number>;
  attribution_window_days: number;
  default_timezone: string | null;
  footer_contact: string | null;
  paused_at: string | null;
  paused_reason: string | null;
};

export type MarketingSettingsUpdate = {
  frequency_cap_count?: number | null;
  send_windows?: Partial<Record<Channel, SendWindow>> | null;
  approval_threshold?: number | null;
  ab_window_hours?: number | null;
  rate_per_minute?: ChannelNumbers | null;
  daily_cap?: ChannelNumbers | null;
  default_timezone?: string | null;
  footer_contact?: string | null;
};

// Pickers ----------------------------------------------------------------------------------------------

export type PickerOption = { id: string; name: string; detail: string | null };

export type MarketingOptionsOut = {
  pools: PickerOption[];
  segments: PickerOption[];
  sms_templates: PickerOption[];
  whatsapp_templates: PickerOption[];
  postings: PickerOption[];
  sequences: PickerOption[];
};

// Campaigns --------------------------------------------------------------------------------------------

export type CampaignStatus = "draft" | "pending_approval" | "scheduled" | "sending" | "paused" | "completed" | "cancelled";

export type JobLinkIn = { posting_id: string; label?: string | null };
export type JobLinkOut = { index: number; posting_id: string; demand_id: string | null; label: string; url: string };

export type AbVariant = { key: "A" | "B"; subject: string };
export type AbMetric = "open" | "click";
export type AbTestIn = { variants: AbVariant[]; sample_pct: number; metric: AbMetric; window_hours?: number | null };
export type AbTestOut = {
  variants: AbVariant[];
  sample_pct: number;
  metric: string;
  window_hours: number;
  winner_key: string | null;
  decided_at: string | null;
};

export type CampaignCreate = {
  name: string;
  channel: Channel;
  audience_id: string;
  email_subject?: string | null;
  email_body_html?: string | null;
  email_template_id?: string | null;
  channel_template_id?: string | null;
  job_links?: JobLinkIn[];
  ab_test?: AbTestIn | null;
};

export type CampaignUpdate = Partial<Omit<CampaignCreate, "channel">> & { clear_ab_test?: boolean };

export type CampaignOut = {
  id: string;
  name: string;
  channel: Channel;
  audience_id: string;
  audience_name: string | null;
  snapshot_id: string | null;
  owner_id: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  approval_request_id: string | null;
  email_subject: string | null;
  email_body_html: string | null;
  email_template_id: string | null;
  channel_template_id: string | null;
  job_links: JobLinkOut[];
  ab_test: AbTestOut | null;
  counts: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TestSendOut = { channel: string; queued: boolean; message: string };

export type MessageStatus = string;

export type CampaignMessageOut = {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  channel: string;
  status: MessageStatus;
  suppression_reason: string | null;
  variant_key: string | null;
  sent_at: string | null;
  defer_until: string | null;
};

export type CampaignMessagesPage = { items: CampaignMessageOut[]; total: number; page: number; page_size: number };

// Analytics --------------------------------------------------------------------------------------------

export type FunnelCounts = {
  audience: number;
  suppressed: number;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  applied: number;
  hired: number;
};

export type FunnelRates = {
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  unsubscribe_rate: number;
  apply_rate: number;
  hire_rate: number;
};

export type FunnelSlice = { key: string; label: string; counts: FunnelCounts; rates: FunnelRates };

export type FunnelOut = {
  counts: FunnelCounts;
  rates: FunnelRates;
  suppressed_by_reason: Record<string, number>;
  variants: FunnelSlice[];
  steps: FunnelSlice[];
  opens_approximate: boolean;
};

// Public unsubscribe -----------------------------------------------------------------------------------

export type UnsubscribeView = { tenant_name: string; channel: string; already_unsubscribed: boolean };
export type UnsubscribeOut = { status: string; channel: string; all: boolean };
