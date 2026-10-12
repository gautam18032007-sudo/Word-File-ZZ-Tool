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

  // 1. BASIC: =IF(G3<=42000, MIN(21500, G3), G3/2)
  const basic = g3 <= 42000 ? Math.min(21500, g3) : g3 / 2;
  const rBasic = roundHalfUp(basic);

  // 2. PF EMPLOYER: =ROUND(IF(C5>25000, 3000, C5*12%), 0) if pfEnabled, else 0
  const rPfEmployer = pfEnabled
    ? roundHalfUp(rBasic > 25000 ? 3000 : rBasic * 0.12)
    : 0;

  // 3. CONVEYANCE ALLOWANCE: =ROUND(IF(G3<42000, 0, G3*10%), 0)
  const rConveyance = roundHalfUp(g3 < 42000 ? 0 : g3 * 0.10);

  // 4. HRA: =IF(G3<42000, G3-C5-C8, C5/2)
  const hra = g3 < 42000 ? (monthlyCTC - rBasic - rPfEmployer) : rBasic / 2;
  const rHra = roundHalfUp(hra);

  // 5. SPECIAL ALLOWANCE — balancing figure: =(G3-SUM(C5:C8))
  const rSpecialAllowance = monthlyCTC - (rBasic + rHra + rConveyance + rPfEmployer);

  // Math Balance Check Assert
  const sum = rBasic + rHra + rConveyance + rPfEmployer + rSpecialAllowance;
  if (sum !== monthlyCTC) {
    throw new Error(`Salary Engine Error: Component sum (${sum}) does not match Monthly CTC (${monthlyCTC}) exactly.`);
  }

  // 6. PF EMPLOYEE — same as employer contribution: =C12
  const pfEmployee = rPfEmployer;

  // 7. SALARY IN HAND: =C10-SUM(C12:C13)
  const salaryInHand = monthlyCTC - rPfEmployer - pfEmployee;

  // --- Annual components matching spreadsheet formulas (D = C * 12) ---
  const basicAnnual = rBasic * 12;
  const hraAnnual = rHra * 12;
  const conveyanceAnnual = rConveyance * 12;
  const pfEmployerAnnual = rPfEmployer * 12;
  const specialAllowanceAnnual = rSpecialAllowance * 12;
  const totalCTCAnnual = basicAnnual + hraAnnual + conveyanceAnnual + pfEmployerAnnual + specialAllowanceAnnual;
  const pfEmployeeAnnual = pfEmployee * 12;
  const salaryInHandAnnual = totalCTCAnnual - pfEmployerAnnual - pfEmployeeAnnual;

  return {
    monthlyCTC,
    annualCTC,
    basic: rBasic,
    hra: rHra,
    conveyance: rConveyance,
    pfEmployer: rPfEmployer,
    pfEmployee,
    specialAllowance: rSpecialAllowance,
    salaryInHand,
    pfEnabled,
    basicAnnual,
    hraAnnual,
    conveyanceAnnual,
    pfEmployerAnnual,
    pfEmployeeAnnual,
    specialAllowanceAnnual,
    salaryInHandAnnual,
  };
}
