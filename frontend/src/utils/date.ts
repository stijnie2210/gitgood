export function formatDate(ts: number, format: string, nowMs: number): string {
  if (format === 'absolute') {
    return new Date(ts * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const secs = Math.floor(nowMs / 1000) - ts;
  if (secs < 0) {
    return new Date(ts * 1000).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (secs < 60) {
    return 'just now';
  }
  if (secs < 3600) {
    return `${Math.floor(secs / 60)}m ago`;
  }
  if (secs < 86400) {
    return `${Math.floor(secs / 3600)}h ago`;
  }
  if (secs < 86400 * 30) {
    return `${Math.floor(secs / 86400)}d ago`;
  }
  if (secs < 86400 * 365) {
    return `${Math.floor(secs / (86400 * 30))}mo ago`;
  }
  return `${Math.floor(secs / (86400 * 365))}y ago`;
}
