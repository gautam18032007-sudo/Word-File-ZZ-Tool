"""Salary Engine — verified line-by-line against templates/PF.xlsx (YES/NO sheets)."""
import math
from dataclasses import dataclass


def _round(x: float) -> int:
    """Round-half-up (matches JS Math.round), not Python's round-half-to-even."""
    return int(math.floor(x + 0.5))


@dataclass
class SalaryBreakup:
    monthly_ctc: int
    annual_ctc: int
    basic: int
    hra: int
    conveyance: int
    pf_employer: int
    pf_employee: int
    special_allowance: int
    salary_in_hand: int
    pf_enabled: bool


def calc_salary(annual_ctc: float, pf_enabled: bool) -> SalaryBreakup:
    monthly_ctc = _round(annual_ctc / 12)
    g3 = annual_ctc / 12  # unrounded monthly CTC

    # 1. BASIC
    basic = min(21500, g3) if g3 < 42000 else g3 / 2

    # 2. PF EMPLOYER
    pf_employer = 0.0
    if pf_enabled:
        pf_employer = _round(1800 if basic > 15000 else basic * 0.12)

    # 3. CONVEYANCE
    conveyance = 0 if g3 < 42000 else _round(g3 * 0.1)

    # 4. HRA
    hra = (g3 - basic - pf_employer) if g3 < 42000 else (basic / 2)

    r_basic = _round(basic)
    r_hra = _round(hra)
    r_conveyance = _round(conveyance)
    r_pf_employer = _round(pf_employer)

    # Special allowance is the balancing figure
    r_special_allowance = monthly_ctc - (r_basic + r_hra + r_conveyance + r_pf_employer)

    pf_employee = r_pf_employer if pf_enabled else 0
    salary_in_hand = monthly_ctc - r_pf_employer - pf_employee

    return SalaryBreakup(
        monthly_ctc=monthly_ctc,
        annual_ctc=_round(annual_ctc),
        basic=r_basic,
        hra=r_hra,
        conveyance=r_conveyance,
        pf_employer=r_pf_employer,
        pf_employee=pf_employee,
        special_allowance=r_special_allowance,
        salary_in_hand=salary_in_hand,
        pf_enabled=pf_enabled,
    )
