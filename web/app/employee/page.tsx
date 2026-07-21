"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeRow, SalaryBreakup, GenerateResult } from "@/lib/types";
import { downloadBase64, MIME } from "@/lib/clientDownload";
import { SheetLoader } from "@/components/shared/SheetLoader";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Client-side salary engine (mirrors lib/salary.ts) ───────────────────────

function roundHalfUp(x: number): number { return Math.floor(x + 0.5); }

function calcSalaryClient(annualCTC: number, pfEnabled: boolean): SalaryBreakup {
  const monthlyCTC = roundHalfUp(annualCTC / 12);
  const g3 = annualCTC / 12;
  const basic = g3 <= 42000 ? Math.min(21500, g3) : g3 / 2;
  const pfEmployer = roundHalfUp(basic > 15000 ? 1800 : basic * 0.12);
  const conveyance = roundHalfUp(g3 < 42000 ? 0 : g3 * 0.10);
  const hra = g3 < 42000 ? g3 - basic - pfEmployer : basic / 2;

  const rBasic = roundHalfUp(basic);
  const rHra = roundHalfUp(hra);
  const rConveyance = roundHalfUp(conveyance);
  const rPfEmployer = roundHalfUp(pfEmployer);
  const rSpecialAllowance = monthlyCTC - (rBasic + rHra + rConveyance + rPfEmployer);

  // Math Balance Check Assert
  const sum = rBasic + rHra + rConveyance + rPfEmployer + rSpecialAllowance;
  if (sum !== monthlyCTC) {
    throw new Error(`Salary Engine Error: Component sum (${sum}) does not match Monthly CTC (${monthlyCTC}) exactly.`);
  }

  const pfEmployee = rPfEmployer;

  const basicAnnual = roundHalfUp(basic * 12);
  const hraAnnual = roundHalfUp(hra * 12);
  const conveyanceAnnual = rConveyance * 12;
  const pfEmployerAnnual = rPfEmployer * 12;
  const specialAllowanceAnnual = annualCTC - (basicAnnual + hraAnnual + conveyanceAnnual + pfEmployerAnnual);
  
  const pfEmployeeAnnual = pfEmployee * 12;
  const salaryInHandAnnual = annualCTC - pfEmployerAnnual - pfEmployeeAnnual;

  return {
    monthlyCTC,
    annualCTC,
    basic: rBasic,
    hra: rHra,
    conveyance: rConveyance,
    pfEmployer: rPfEmployer,
    pfEmployee,
    specialAllowance: rSpecialAllowance,
    salaryInHand: monthlyCTC - rPfEmployer - pfEmployee,
    pfEnabled: true,
    basicAnnual,
    hraAnnual,
    conveyanceAnnual,
    pfEmployerAnnual,
    pfEmployeeAnnual,
    specialAllowanceAnnual,
    salaryInHandAnnual,
  };
}

function fmt(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  if (s.length <= 3) return `₹${s}`;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return `₹${parts.join(",")},${last3}`;
}

function normalizeDateToYYYYMMDD(dateStr: string): string {
  const clean = (dateStr ?? "").trim();
  if (!clean) return "";

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  let m = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3];
    const val1 = parseInt(m[1], 10);
    const val2 = parseInt(m[2], 10);
    if (val1 > 12) {
      return `${year}-${month}-${day}`;
    } else if (val2 > 12) {
      return `${year}-${day}-${month}`;
    } else {
      return `${year}-${month}-${day}`;
    }
  }

  // Handle YYYY/MM/DD
  m = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, "0");
    const day = m[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Let Date parse it as fallback
  try {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {}

  return clean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SalaryPreview({ salary }: { salary: SalaryBreakup }) {
  const rows: [string, number, string?][] = [
    ["Basic", salary.basic],
    ["HRA", salary.hra],
    ["Conveyance", salary.conveyance],
    ["PF Employer", salary.pfEmployer],
    ["Special Allowance", salary.specialAllowance],
  ];
  return (
    <div className="border border-[var(--border)] rounded-md overflow-hidden text-sm">
      <div className="px-4 py-2.5 bg-[oklch(0.975_0_0)] border-b border-[var(--border)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Annexure A — Salary Breakup</p>
      </div>
      <div className="px-4 py-2">
        {rows.map(([label, val]) => (
          <div key={label} className="salary-row">
            <span className="text-[var(--muted-foreground)]">{label}</span>
            <span className="font-mono text-xs">{fmt(val)}</span>
          </div>
        ))}
        <div className="salary-row subtotal">
          <span>Monthly CTC</span>
          <span className="font-mono text-xs">{fmt(salary.monthlyCTC)}</span>
        </div>
        {salary.pfEnabled && (
          <div className="salary-row deduction">
            <span>(−) PF Employee</span>
            <span className="font-mono text-xs">− {fmt(salary.pfEmployee)}</span>
          </div>
        )}
        <div className="salary-row inhand">
          <span>Salary In Hand</span>
          <span className="font-mono">{fmt(salary.salaryInHand)}</span>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-[var(--border)] bg-[oklch(0.975_0_0)]">
        <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>Annual CTC</span>
          <span className="font-mono font-semibold text-[var(--foreground)]">{fmt(salary.annualCTC)}</span>
        </div>
        <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-1">
          <span>Annual In-Hand</span>
          <span className="font-mono font-semibold text-[var(--foreground)]">{fmt(salary.salaryInHandAnnual)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeePage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");

  function findColumnIndex(headersList: string[], possibleNames: string[]): number {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    return headersList.findIndex(h => 
      possibleNames.some(p => norm(h) === norm(p))
    );
  }

  // Compute employee column indices dynamically
  const nameIdx = findColumnIndex(headers, ['Full Name', 'Name']);
  const fatherNameIdx = findColumnIndex(headers, ['Father Name', "Father's Name"]);
  const genderIdx = findColumnIndex(headers, ['Gender']);
  const addressIdx = findColumnIndex(headers, ['Address']);
  const phoneIdx = findColumnIndex(headers, ['Phone', 'Phone Number', 'Mobile Number']);
  const emailIdx = findColumnIndex(headers, ['Email', 'Email Address', 'Email ID']);
  // NOT aliased to the sheet's "PAN Card" / "Aadhaar Card" columns on purpose —
  // those are file-upload links (Drive URLs), not the PAN/Aadhar number text.
  // Mapping them would print a Drive link into the contract instead of the
  // actual number. Left unmapped (blank) until there's a real text source.
  const panIdx = findColumnIndex(headers, ['PAN', 'PAN Number']);
  const aadharIdx = findColumnIndex(headers, ['Aadhar', 'Aadhar Number', 'Aadhaar', 'Aadhaar Number']);
  const departmentIdx = findColumnIndex(headers, ['Department']);
  const designationIdx = findColumnIndex(headers, ['Designation']);
  const joiningDateIdx = findColumnIndex(headers, ['Joining Date', 'JoiningDate', 'Date of Joining']);

  // Compute employees dynamically from rawRows
  const employees: EmployeeRow[] = rawRows.map((r, i) => ({
    index: i + 2,
    name: nameIdx >= 0 ? (r[nameIdx] ?? '').trim() : '',
    fatherName: fatherNameIdx >= 0 ? (r[fatherNameIdx] ?? '').trim() : '',
    gender: genderIdx >= 0 ? (r[genderIdx] ?? '').trim() : '',
    address: addressIdx >= 0 ? (r[addressIdx] ?? '').trim() : '',
    phone: phoneIdx >= 0 ? (r[phoneIdx] ?? '').trim() : '',
    email: emailIdx >= 0 ? (r[emailIdx] ?? '').trim() : '',
    pan: panIdx >= 0 ? (r[panIdx] ?? '').trim() : '',
    aadhar: aadharIdx >= 0 ? (r[aadharIdx] ?? '').trim() : '',
    department: departmentIdx >= 0 ? (r[departmentIdx] ?? '').trim() : '',
    designation: designationIdx >= 0 ? (r[designationIdx] ?? '').trim() : '',
    joiningDate: joiningDateIdx >= 0 ? (r[joiningDateIdx] ?? '').trim() : '',
  })).filter(e => e.name);

  const selected = employees[selectedIdx] ?? null;

  const [annualCTC, setAnnualCTC] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const pfEnabled = true; // PF is fixed to YES
  const [gender, setGender] = useState<"Male" | "Female" | "">("");

  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

  const ctcNum = parseFloat(annualCTC) || 0;
  const salary = ctcNum > 0 ? calcSalaryClient(ctcNum, pfEnabled) : null;

  // Filter employees based on search query
  const filteredEmployees = employees.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.designation.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  // Display duplicate-aware candidate names
  function getEmployeeDisplayName(emp: EmployeeRow): string {
    const duplicates = employees.filter(
      (x) => x.name.trim().toLowerCase() === emp.name.trim().toLowerCase()
    );
    if (duplicates.length > 1) {
      return `${emp.name} (${emp.designation || emp.department || `Row ${emp.index}`})`;
    }
    return emp.name;
  }

  // Mandatory fields check for selected employee
  const employeeMissingFields: string[] = [];
  if (selected) {
    if (!selected.name?.trim()) employeeMissingFields.push("Employee Name");
    if (!selected.designation?.trim()) employeeMissingFields.push("Designation");
    if (!selected.address?.trim()) employeeMissingFields.push("Address");
    if (!gender) employeeMissingFields.push("Gender");
  }

  const isExtremelyHighCTC = ctcNum >= 100000000;

  function handleSelectEmployee(idx: number) {
    setSelectedIdx(idx);
    const e = employees[idx];
    if (e) {
      const g = (e.gender || "").trim().toLowerCase();
      if (g === "f" || g === "female" || g === "woman") {
        setGender("Female");
      } else if (g === "m" || g === "male" || g === "man") {
        setGender("Male");
      } else {
        setGender("");
      }

      if (e.joiningDate) {
        setJoiningDate(normalizeDateToYYYYMMDD(e.joiningDate));
      } else {
        setJoiningDate("");
      }
    }
  }

  async function handleLoadEmployees(url: string, loadedHeaders: string[], loadedRows: string[][]) {
    setSelectedIdx(-1);
    setHeaders(loadedHeaders);
    setRawRows(loadedRows);
  }

  async function generate() {
    setGenError("");
    setGenResult(null);

    if (!selected) {
      setGenError("Please select an employee.");
      return;
    }
    if (employeeMissingFields.length > 0) {
      setGenError(`Cannot generate: Selected employee has missing mandatory fields: ${employeeMissingFields.join(", ")}`);
      return;
    }
    if (!gender) {
      setGenError("Please select gender.");
      return;
    }
    if (!ctcNum || ctcNum <= 0) {
      setGenError("Please enter a valid Annual CTC (must be greater than 0).");
      return;
    }
    if (!joiningDate) {
      setGenError("Please enter a joining date.");
      return;
    }
    if (!salary) {
      setGenError("Salary calculation failed.");
      return;
    }

    setGenState("loading");

    try {
      const res = await fetch("/api/generate/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee: selected, annualCTC: ctcNum, joiningDate, pfEnabled, gender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setGenResult(data);
      setGenState("done");
    } catch (e) {
      setGenError(String(e));
      setGenState("error");
    }
  }

  function downloadFile(filename: string, folder: string, base64?: string, mime?: string) {
    if (base64) {
      downloadBase64(filename, base64, mime!);
      return;
    }
    const a = document.createElement("a");
    a.href = `/api/download?folder=${folder}&file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Employee Contract</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Load employee data from Google Form responses, enter CTC details, and generate a contract with Annexure A.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-5 items-start">
        {/* ── LEFT ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">01</span>
                Load Google Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SheetLoader onLoad={handleLoadEmployees} loadedCount={employees.length} storageKey="employee_sheet_url" />
              {headers.length > 0 && (
                <div className="border border-[var(--border)] rounded-md p-3 bg-[oklch(0.99_0_0)] text-xs space-y-2 mt-3">
                  <p className="font-semibold text-[var(--foreground)]">Sheet Status</p>
                  <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
                    {[
                      ["Full Name", nameIdx >= 0],
                      ["Father Name", fatherNameIdx >= 0],
                      ["Gender", genderIdx >= 0],
                      ["Address", addressIdx >= 0],
                      ["Phone", phoneIdx >= 0],
                      ["Email", emailIdx >= 0],
                      ["PAN", panIdx >= 0],
                      ["Aadhar", aadharIdx >= 0],
                      ["Department", departmentIdx >= 0],
                      ["Designation", designationIdx >= 0],
                    ].map(([label, found]) => (
                      <div key={label as string} className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted-foreground)]">{label}</span>
                        <span className={found ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
                          {found ? "✓ Found" : "✗ Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">02</span>
                Select Employee
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Search employee by name, dept or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={employees.length === 0}
                />

                {employees.length === 0 && (
                  <p className="p-3 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-md">
                    0 records loaded. Please paste Google Sheet URL and click load.
                  </p>
                )}

                {employees.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                    {filteredEmployees.length === 0 ? (
                      <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No matching employees found.</p>
                    ) : (
                      filteredEmployees.map((e) => {
                        const originalIdx = employees.findIndex(x => x.index === e.index);
                        return (
                          <button
                            key={e.index}
                            onClick={() => handleSelectEmployee(originalIdx)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex justify-between items-center hover:bg-[var(--muted)] transition-colors",
                              selectedIdx === originalIdx && "bg-[oklch(0.95_0_0)] border-l-2 border-[var(--foreground)]"
                            )}
                          >
                            <div className="pr-2 truncate">
                              <p className="font-semibold text-[var(--foreground)] truncate">
                                {getEmployeeDisplayName(e)}
                              </p>
                              <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {e.department || "No Department"} · {e.email || "No Email"}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider bg-[var(--muted)] px-1.5 py-0.5 rounded text-[var(--muted-foreground)] max-w-[100px] truncate" title={e.designation}>
                              {e.designation || "Employee"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {selected && (
                <div className="space-y-1 text-sm border border-[var(--border)] rounded-md p-3 bg-[oklch(0.975_0_0)]">
                  {[
                    ["Name", selected.name],
                    ["Father", selected.fatherName],
                    ["Designation", selected.designation],
                    ["Department", selected.department],
                    ["PAN", selected.pan],
                    ["Aadhar", selected.aadhar],
                    ["Phone", selected.phone],
                    ["Email", selected.email],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-[var(--muted-foreground)] w-20 shrink-0 text-xs pt-0.5">{k}</span>
                      <span className="font-medium text-xs break-all">{v || "—"}</span>
                    </div>
                  ))}
                  {selected.address && (
                    <div className="flex gap-2">
                      <span className="text-[var(--muted-foreground)] w-20 shrink-0 text-xs pt-0.5">Address</span>
                      <span className="font-medium text-xs">{selected.address}</span>
                    </div>
                  )}

                  {/* Warning banner for missing mandatory fields */}
                  {employeeMissingFields.length > 0 && (
                    <div className="flex gap-2 text-xs py-2 px-3 border border-rose-200 bg-rose-50 text-rose-700 rounded-md mt-2">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Cannot Generate Contract</p>
                        <p className="text-[10px]">Missing mandatory fields: {employeeMissingFields.join(", ")}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">03</span>
                Contract Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Annual CTC (₹)">
                  <Input
                    type="number"
                    placeholder="e.g. 600000"
                    value={annualCTC}
                    onChange={(e) => setAnnualCTC(e.target.value)}
                  />
                </Field>
                <Field label="Joining Date">
                  <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                </Field>
                <Field label="Gender">
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "Male" | "Female" | "")}
                    className="flex h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— select gender —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>
              </div>

              {isExtremelyHighCTC && (
                <div className="flex gap-2 text-xs py-2 px-3 border border-amber-200 bg-amber-50 text-amber-800 rounded-md mt-2 animate-pulse">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Extremely High CTC Warning</p>
                    <p className="text-[10px]">The entered Annual CTC is ₹10 Crore+. Please double check if this is correct.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Salary Preview */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">04</span>
                Live Salary Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salary ? (
                <SalaryPreview salary={salary} />
              ) : (
                <div className="preview-card">
                  <span className="text-[var(--muted-foreground)]">Enter Annual CTC to see salary breakdown.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">05</span>
                Generate Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={generate}
                disabled={genState === "loading"}
              >
                {genState === "loading" && <Loader2 size={15} className="animate-spin" />}
                {genState === "loading" ? "Generating…" : "Generate Employee Contract"}
              </Button>

              {genState === "error" && (
                <div className="alert-error flex gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {genState === "done" && genResult && (
                <div className="alert-success space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={15} />
                    {genResult.contractNo} generated
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Button size="sm" variant="outline" onClick={() => downloadFile(genResult.docxName, "employees", genResult.docxBase64, MIME.docx)}>
                      <FileText size={13} /> DOCX
                    </Button>
                    {genResult.pdfName && (
                      <Button size="sm" variant="outline" onClick={() => downloadFile(genResult.pdfName!, "employees", genResult.pdfBase64 ?? undefined, MIME.pdf)}>
                        <Download size={13} /> PDF
                      </Button>
                    )}
                    {!genResult.pdfName && (
                      <span className="text-xs text-[var(--muted-foreground)] self-center">PDF conversion available only in local environment.</span>
                    )}

                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
