export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'delivered' || status === 'verified' || status === 'active'
      ? 'ok'
      : status === 'bounced' || status === 'failed'
        ? 'err'
        : 'warn';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}
