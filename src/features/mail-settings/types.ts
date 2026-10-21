/**
 * Outbound email (SMTP) settings for a tenant: whether the organization sends through the shared
 * platform mailbox or its own SMTP server. The password is write-only — the server returns only
 * `password_set`, never the password itself. (Backend API in parallel; typed to the agreed shape.)
 */

export type MailBackend = "platform" | "smtp";

export interface MailSettings {
  backend: MailBackend;
  smtp_address: string;
  smtp_port: number;
  smtp_username: string;
  smtp_use_ssl: boolean;
  sender_email: string;
  sender_name: string;
  enabled: boolean;
  /** Whether an SMTP password is stored. The password itself is never returned. */
  password_set: boolean;
}

/** PUT body. Omit `smtp_password` to keep the stored one; send it only to set a new password. */
export interface MailSettingsIn {
  backend: MailBackend;
  smtp_address: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_use_ssl: boolean;
  sender_email: string;
  sender_name: string;
  enabled: boolean;
}

/** Result of sending a test email. */
export interface MailTestResult {
  ok: boolean;
  channel?: string;
  error?: string;
}
