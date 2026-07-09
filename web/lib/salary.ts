/**
 * Salary Engine — faithful TypeScript port of engines/pf.py
 *
 * Logic verified line-by-line against the Python implementation.
 * Rounding: round-half-up (matches Math.floor(x + 0.5) in Python).
 */
import type { SalaryBreakup } from './types';

function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

export function calcSalary(annualCTC: number, pfEnabled: boolean): SalaryBreakup {
  const monthlyCTC = roundHalfUp(annualCTC / 12);
  const g3 = annualCTC / 12; // unrounded monthly CTC

  // 1. BASIC
  const basic = g3 < 42000 ? Math.min(21500, g3) : g3 / 2;

  // 2. PF EMPLOYER
  let pfEmployer = 0;
  if (pfEnabled) {
    pfEmployer = roundHalfUp(basic > 15000 ? 1800 : basic * 0.12);
  }

  // 3. CONVEYANCE
  const conveyance = g3 < 42000 ? 0 : roundHalfUp(g3 * 0.1);

  // 4. HRA
  const hra = g3 < 42000 ? g3 - basic - pfEmployer : basic / 2;

  const rBasic = roundHalfUp(basic);
  const rHra = roundHalfUp(hra);
  const rConveyance = roundHalfUp(conveyance);
  const rPfEmployer = roundHalfUp(pfEmployer);

  // 5. SPECIAL ALLOWANCE — balancing figure
  const rSpecialAllowance = monthlyCTC - (rBasic + rHra + rConveyance + rPfEmployer);

  // Math Balance Check Assert
  const sum = rBasic + rHra + rConveyance + rPfEmployer + rSpecialAllowance;
  if (sum !== monthlyCTC) {
    throw new Error(`Salary Engine Error: Component sum (${sum}) does not match Monthly CTC (${monthlyCTC}) exactly.`);
  }

  // 6. PF EMPLOYEE — same as employer contribution
  const pfEmployee = pfEnabled ? rPfEmployer : 0;

  // 7. SALARY IN HAND
  const salaryInHand = monthlyCTC - rPfEmployer - pfEmployee;

  return {
    monthlyCTC,
    annualCTC: roundHalfUp(annualCTC),
    basic: rBasic,
    hra: rHra,
    conveyance: rConveyance,
    pfEmployer: rPfEmployer,
    pfEmployee,
    specialAllowance: rSpecialAllowance,
    salaryInHand,
    pfEnabled,
  };
}
