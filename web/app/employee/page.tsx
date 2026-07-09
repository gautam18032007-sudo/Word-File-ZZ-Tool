"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeRow, SalaryBreakup, GenerateResult } from "@/lib/types";
import { SheetLoader } from "@/components/shared/SheetLoader";

// ─── Client-side salary engine (mirrors lib/salary.ts) ───────────────────────

function roundHalfUp(x: number): number { return Math.floor(x + 0.5); }

function calcSalaryClient(annualCTC: number, pfEnabled: boolean): SalaryBreakup {
  const monthlyCTC = roundHalfUp(annualCTC / 12);
  const g3 = annualCTC / 12;
  const basic = g3 < 42000 ? Math.min(21500, g3) : g3 / 2;
  let pfEmployer = 0;
  if (pfEnabled) pfEmployer = roundHalfUp(basic > 15000 ? 1800 : basic * 0.12);
  const conveyance = g3 < 42000 ? 0 : roundHalfUp(g3 * 0.1);
  const hra = g3 < 42000 ? g3 - basic - pfEmployer : basic / 2;
  const rBasic = roundHalfUp(basic), rHra = roundHalfUp(hra),
    rConveyance = roundHalfUp(conveyance), rPfEmployer = roundHalfUp(pfEmployer);
  const rSpecialAllowance = monthlyCTC - (rBasic + rHra + rConveyance + rPfEmployer);
  const pfEmployee = pfEnabled ? rPfEmployer : 0;
  return {
    monthlyCTC, annualCTC: roundHalfUp(annualCTC),
    basic: rBasic, hra: rHra, conveyance: rConveyance,
    pfEmployer: rPfEmployer, pfEmployee,
    specialAllowance: rSpecialAllowance,
    salaryInHand: monthlyCTC - rPfEmployer - pfEmployee,
    pfEnabled,
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
          <span className="font-mono font-semibold text-[var(--foreground)]">{fmt(salary.salaryInHand * 12)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeePage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const selected = employees[selectedIdx] ?? null;

  const [annualCTC, setAnnualCTC] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [pfEnabled, setPfEnabled] = useState(true);
  const [gender, setGender] = useState<"Male" | "Female" | "">("");

  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

  const ctcNum = parseFloat(annualCTC) || 0;
  const salary = ctcNum > 0 ? calcSalaryClient(ctcNum, pfEnabled) : null;

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
    }
  }

  async function handleLoadEmployees(url: string) {
    setEmployees([]);
    setSelectedIdx(-1);
    const res = await fetch(`/api/sheets/employee?sheet=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load");
    setEmployees(data.rows);
  }

  async function generate() {
    setGenError("");
    setGenResult(null);

    if (!selected) {
      setGenError("Please select an employee.");
      return;
    }
    if (!gender) {
      setGenError("Please select gender.");
      return;
    }
    if (!ctcNum || ctcNum <= 0) {
      setGenError("Please enter a valid Annual CTC.");
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

  function downloadFile(filename: string, folder: string) {
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

      <div className="grid grid-cols-[340px_1fr] gap-5 items-start">
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
              <SheetLoader onLoad={handleLoadEmployees} loadedCount={employees.length} />
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
              <Select
                value={selectedIdx === -1 ? "" : String(selectedIdx)}
                onChange={(e) => handleSelectEmployee(parseInt(e.target.value))}
                disabled={employees.length === 0}
              >
                <option value="">— choose an employee —</option>
                {employees.map((e, i) => (
                  <option key={i} value={i}>{e.name} — {e.designation}</option>
                ))}
              </Select>

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
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Provident Fund">
                  <div className="flex h-9 items-center gap-4">
                    {[true, false].map((val) => (
                      <label key={String(val)} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input
                          type="radio"
                          className="accent-[var(--foreground)]"
                          checked={pfEnabled === val}
                          onChange={() => setPfEnabled(val)}
                        />
                        PF {val ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Gender">
                  <Select value={gender} onChange={(e) => setGender(e.target.value as "Male" | "Female" | "")}>
                    <option value="">— select gender —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </Field>
              </div>
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
                    <Button size="sm" variant="outline" onClick={() => downloadFile(genResult.docxName, "employees")}>
                      <FileText size={13} /> DOCX
                    </Button>
                    {genResult.pdfName && (
                      <Button size="sm" variant="outline" onClick={() => downloadFile(genResult.pdfName!, "employees")}>
                        <Download size={13} /> PDF
                      </Button>
                    )}
                    {!genResult.pdfName && (
                      <span className="text-xs text-[var(--muted-foreground)] self-center">PDF skipped — LibreOffice not found</span>
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
