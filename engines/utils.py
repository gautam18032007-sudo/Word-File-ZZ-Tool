"""Number to Words — Indian Numbering System, plus INR/date formatting."""

ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
]
TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']


def _below_1000(n: int) -> str:
    if n == 0:
        return ''
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + (' ' + ONES[n % 10] if n % 10 else '')
    return ONES[n // 100] + ' Hundred' + (' ' + _below_1000(n % 100) if n % 100 else '')


def number_to_words(amount: float) -> str:
    n = round(amount)
    if n == 0:
        return 'Zero Rupees Only'
    parts = []
    if n >= 10_000_000:
        parts.append(_below_1000(n // 10_000_000) + ' Crore')
        n %= 10_000_000
    if n >= 100_000:
        parts.append(_below_1000(n // 100_000) + ' Lakh')
        n %= 100_000
    if n >= 1_000:
        parts.append(_below_1000(n // 1_000) + ' Thousand')
        n %= 1_000
    if n > 0:
        parts.append(_below_1000(n))
    return ' '.join(parts) + ' Rupees Only'


def format_inr(n: float) -> str:
    """Format as ₹ with Indian digit grouping (e.g. 1234567 -> ₹12,34,567)."""
    n = round(n)
    sign = '-' if n < 0 else ''
    s = str(abs(n))
    if len(s) <= 3:
        grouped = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        grouped = ','.join(parts) + ',' + last3
    return f'₹{sign}{grouped}'


def format_date(iso: str) -> str:
    """'2026-07-08' -> '8th July 2026'."""
    from datetime import datetime
    d = datetime.strptime(iso[:10], '%Y-%m-%d')
    day = d.day
    if day in (1, 21, 31):
        suffix = 'st'
    elif day in (2, 22):
        suffix = 'nd'
    elif day in (3, 23):
        suffix = 'rd'
    else:
        suffix = 'th'
    return f'{day}{suffix} {d.strftime("%B")} {d.year}'
