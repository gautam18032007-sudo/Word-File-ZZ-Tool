/**
 * Formatting Utilities — faithful TypeScript port of engines/utils.py
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below1000(n % 100) : '');
}

/** Indian numbering system: e.g. 1234567 → "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees Only" */
export function numberToWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  if (n >= 10_000_000) {
    parts.push(below1000(Math.floor(n / 10_000_000)) + ' Crore');
    n %= 10_000_000;
  }
  if (n >= 100_000) {
    parts.push(below1000(Math.floor(n / 100_000)) + ' Lakh');
    n %= 100_000;
  }
  if (n >= 1_000) {
    parts.push(below1000(Math.floor(n / 1_000)) + ' Thousand');
    n %= 1_000;
  }
  if (n > 0) {
    parts.push(below1000(n));
  }
  return parts.join(' ') + ' Rupees Only';
}

/** Indian digit grouping: e.g. 1234567 → "₹12,34,567" */
export function formatINR(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  let s = String(Math.abs(rounded));
  if (s.length <= 3) return `₹${sign}${s}`;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `₹${sign}${parts.join(',')},${last3}`;
}

/** "2026-07-08" → "8th July 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  const day = d.getDate();
  let suffix = 'th';
  if ([1, 21, 31].includes(day)) suffix = 'st';
  else if ([2, 22].includes(day)) suffix = 'nd';
  else if ([3, 23].includes(day)) suffix = 'rd';
  const month = d.toLocaleString('en-GB', { month: 'long' });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}
