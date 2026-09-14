const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatPrice(value: number, currency: string): string {
  const key = currency || 'EUR';
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: key });
    currencyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
