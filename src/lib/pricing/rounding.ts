export type CharmMode = 'none' | 'nearest-99' | 'nearest-95' | 'nearest-x9' | 'nearest-x5' | 'whole' | 'round-up';

export function currencyDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Nearest positive ending; exact ties choose the higher price. */
export function charmPrice(price: number, mode: CharmMode, currency: string): number {
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a finite, nonnegative number.');
  if (price === 0) return 0;
  const digits = currencyDigits(currency);
  const unit = 10 ** -digits;
  const precision = (n: number) => Number(n.toFixed(digits));
  if (mode === 'none') return Math.max(unit, precision(price));
  if (digits === 0) {
    const step = price >= 1000 ? 100 : price >= 100 ? 10 : 1;
    const offset = mode === 'nearest-99' || mode === 'nearest-x9' || mode === 'round-up' ? (step >= 100 ? 10 : step >= 10 ? 1 : 0) : 0;
    const rounded = (mode === 'round-up' ? Math.ceil((price + offset) / step) : Math.round((price + offset) / step)) * step - offset;
    return Math.max(1, rounded);
  }
  if (mode === 'whole') return Math.max(1, Math.round(price));
  const step = mode === 'nearest-x9' || mode === 'nearest-x5' ? 0.1 : 1;
  const offset = mode === 'nearest-95' || mode === 'nearest-x5' ? 0.05 : 0.01;
  const position = (price + offset) / step;
  const bucket = mode === 'round-up' ? Math.ceil(position - 1e-9) : Math.floor(position + 0.5 + 1e-9);
  return precision(Math.max(step - offset, bucket * step - offset));
}
