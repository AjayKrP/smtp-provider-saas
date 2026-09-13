import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';
import { openCheckout, type CheckoutOrder } from './razorpay.js';

export interface Me {
  id: string;
  email: string;
  name: string;
  organization: { id: string; name: string; planKey: string } | null;
}

export interface Plan {
  key: string;
  name: string;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxCredentials: number;
  maxRecipientsPerMessage: number;
  requiresCheckout: boolean;
  /** From the plan's Razorpay Item; null for the free plan or a paid plan with no price. */
  price: { unitAmount: number; currency: string; interval: string } | null;
}

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
  purpose: string;
  required: boolean;
}

export interface Domain {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  dkimSelector: string;
  dkimVerified: boolean;
  spfVerified: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  dnsRecords: DnsRecord[];
}

export interface Credential {
  id: string;
  username: string;
  label: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface Usage {
  period: string;
  planKey: string;
  planName: string;
  /** The organization's prepaid paid plan has run out; free limits apply. */
  planExpired: boolean;
  monthlyEmailQuota: number;
  accepted: number;
  remaining: number;
  delivered: number;
  bounced: number;
  failed: number;
}

export interface MessageSummary {
  id: string;
  messageId: string;
  from: string;
  to: { address: string; status: string }[];
  subject: string;
  status: string;
  attempts: number;
  sizeBytes: number;
  createdAt: string;
  completedAt: string | null;
}

const get = <T>(url: string) => api.get<T>(url).then((r) => r.data);

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/auth/me') });
export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: () => get<Plan[]>('/plans') });
export const useUsage = () =>
  useQuery({ queryKey: ['usage'], queryFn: () => get<Usage>('/usage/current') });
export const useDomains = () =>
  useQuery({ queryKey: ['domains'], queryFn: () => get<Domain[]>('/domains') });
export const useCredentials = () =>
  useQuery({ queryKey: ['credentials'], queryFn: () => get<Credential[]>('/smtp-credentials') });
export const useMessages = (status?: string) =>
  useQuery({
    queryKey: ['messages', status ?? 'all'],
    queryFn: () =>
      get<{ items: MessageSummary[]; nextCursor: string | null }>(
        `/messages${status ? `?status=${status}` : ''}`,
      ),
  });

export function useAddDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => api.post<Domain>('/domains', { domain }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useVerifyDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Domain & { verification: Record<string, string> }>(`/domains/${id}/verify`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/domains/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export interface CreatedCredential {
  id: string;
  label: string;
  smtp: { host: string; ports: { starttls: number; tls: number }; username: string; password: string };
}

export function useCreateCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      api.post<CreatedCredential>('/smtp-credentials', { label }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  });
}

export function useDeleteCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/smtp-credentials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  });
}

export interface SubscriptionInfo {
  planKey: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** The prepaid period is still running (always true for a lifetime plan). */
  current: boolean;
  /** Complimentary access with no end date; nothing to pay or renew. */
  lifetime: boolean;
}

export interface PaymentRecord {
  id: string;
  planKey: string;
  amount: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string;
  razorpayPaymentId: string | null;
}

export const useSubscription = () =>
  useQuery({ queryKey: ['subscription'], queryFn: () => get<SubscriptionInfo>('/billing/subscription') });
export const usePayments = () =>
  useQuery({ queryKey: ['payments'], queryFn: () => get<PaymentRecord[]>('/billing/payments') });

/** Create an order, take payment in Razorpay Checkout, then have the API verify it. */
export function usePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planKey: string) => {
      const { data: order } = await api.post<CheckoutOrder>('/billing/checkout', { planKey });
      const result = await openCheckout(order);
      return api.post<SubscriptionInfo>('/billing/verify', result).then((r) => r.data);
    },
    onSettled: () =>
      Promise.all(
        ['usage', 'subscription', 'payments', 'me', 'plans'].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}
