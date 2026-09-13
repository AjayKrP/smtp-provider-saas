export const MESSAGE_STATUSES = [
  'queued',
  'sending',
  'delivered',
  'deferred',
  'bounced',
  'failed',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_EVENT_TYPES = [
  'queued',
  'sending',
  'delivered',
  'deferred',
  'bounced',
  'failed',
] as const;
export type MessageEventType = (typeof MESSAGE_EVENT_TYPES)[number];

export const DOMAIN_STATUSES = ['pending', 'verified', 'failed'] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['active', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ['created', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SUPPRESSION_REASONS = ['hard_bounce', 'complaint', 'manual'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

/** BullMQ queue + job payload shared by producer (smtp-ingress) and consumer (worker). */
export const DELIVERY_QUEUE = 'delivery';

export interface DeliveryJobData {
  messageId: string;
  organizationId: string;
}
