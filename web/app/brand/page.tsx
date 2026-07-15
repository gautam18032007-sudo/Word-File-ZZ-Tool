"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrandRow, Location, ContractType, GenerateResult } from "@/lib/types";
import { SheetLoader } from "@/components/shared/SheetLoader";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatINRClient(n: number): string {
  const rounded = Math.round(n);
  if (isNaN(rounded)) return "₹0";
  const s = String(Math.abs(rounded));
  if (s.length <= 3) return `₹${s}`;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return `₹${parts.join(",")},${last3}`;
}

function num(s: string): number { const n = parseFloat(s); return isNaN(n) || n <= 0 ? 0 : n; }

function buildClause(
  location: Location,
  contractType: ContractType,
  amountPerMonth: string, amountPerSku: string,
  amountSwn: string, amountKlj: string,
  noOfMonths: string, noOfSku: string,
  commissionPct: string
): { clause: string; total: number } | null {
  const months = num(noOfMonths);
  const sku = num(noOfSku);

  if (location === "BOTH") {
    const swn = num(amountSwn), klj = num(amountKlj);
    if (!swn || !klj || !months) return null;
    if (contractType === "SKU") {
      if (!sku) return null;
      const total = (swn + klj) * sku * months;
      return {
        total,
        clause: `An advanced fixed fee of ${formatINRClient(swn)} per SKU at SWN and ${formatINRClient(klj)} per SKU at KLJ, for ${sku} SKUs for ${months} months, totalling ${formatINRClient(total)} across both setups.`,
      };
    }
    const total = (swn + klj) * months;
    return {
      total,
      clause: `An advanced fixed fee of ${formatINRClient(swn)} per Month at SWN and ${formatINRClient(klj)} per Month at KLJ, for ${months} months, totalling ${formatINRClient(total)} across both setups.`,
    };
  }

  const locText = location === "SWN" ? "SWN setup" : "KLJ setup";

  if (contractType === "MONTH") {
    const a = num(amountPerMonth);
    if (!a || !months) return null;
    const total = a * months;
    return { total, clause: `An advanced fixed fee of ${formatINRClient(a)} per Month for ${months} months, totalling ${formatINRClient(total)} at our ${locText}.` };
  }

  const a = num(amountPerSku);
  if (!a || !sku || !months) return null;
  const total = a * sku * months;
  return { total, clause: `An advanced fixed fee of ${formatINRClient(a)} per SKU for ${sku} SKUs for ${months} months, totalling ${formatINRClient(total)} at our ${locText}.` };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrandPage() {
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

  // Compute brand column indices dynamically
  const legalNameIdx = findColumnIndex(headers, ['Legal Name ( to be written in contract )', 'Legal Name']);
  const brandCategoryIdx = findColumnIndex(headers, ['Products Category ( to be written in contract )', 'Products Category']);
  const addressIdx = findColumnIndex(headers, ['Address ( to be written in contract )', 'Address']);

  // Compute brands dynamically from rawRows
  const brands: BrandRow[] = rawRows.map((r, i) => ({
    index: i + 2,
    legalName: legalNameIdx >= 0 ? (r[legalNameIdx] ?? '').trim() : '',
    brandCategory: brandCategoryIdx >= 0 ? (r[brandCategoryIdx] ?? '').trim() : '',
    address: addressIdx >= 0 ? (r[addressIdx] ?? '').trim() : '',
    email: '',
    phone: '',
    contactPerson: '',
  })).filter(b => b.legalName);

  const selected = brands[selectedIdx] ?? null;

  // Filter brands based on search query
  const filteredBrands = brands.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return b.legalName.toLowerCase().includes(q) || b.brandCategory.toLowerCase().includes(q);
  });

  // Mandatory fields check for selected brand
  const brandMissingFields: string[] = [];
  if (selected) {
    if (!selected.legalName?.trim()) brandMissingFields.push("Legal Name");
    if (!selected.brandCategory?.trim()) brandMissingFields.push("Products Category");
    if (!selected.address?.trim()) brandMissingFields.push("Address");
  }

  // commercial inputs
  const [location, setLocation] = useState<Location>("SWN");
  const [contractType, setContractType] = useState<ContractType>("MONTH");
  const [amountPerMonth, setAmountPerMonth] = useState("");
  const [amountPerSku, setAmountPerSku] = useState("");
  const [amountSwn, setAmountSwn] = useState("");
  const [amountKlj, setAmountKlj] = useState("");
  const [noOfMonths, setNoOfMonths] = useState("");
  const [noOfSku, setNoOfSku] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [commissionPctSwn, setCommissionPctSwn] = useState("");
  const [commissionPctKlj, setCommissionPctKlj] = useState("");

  // generate state
  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

  // Live clause preview
  const preview = buildClause(location, contractType, amountPerMonth, amountPerSku, amountSwn, amountKlj, noOfMonths, noOfSku, commissionPct);

  async function handleLoadBrands(url: string, loadedHeaders: string[], loadedRows: string[][]) {
    setSelectedIdx(-1);
    setHeaders(loadedHeaders);
    setRawRows(loadedRows);
  }

  async function generate() {
    setGenError("");
    setGenResult(null);

    if (!selected) {
      setGenError("Please select a brand.");
      return;
    }
    if (brandMissingFields.length > 0) {
      setGenError(`Cannot Generate Contract. Missing:\n${brandMissingFields.map(f => `• ${f}`).join("\n")}`);
      return;
    }
    if (!preview) {
      setGenError("Please fill commercial details to preview contract.");
      return;
    }
    if (location === "BOTH") {
      const swnPctNum = parseFloat(commissionPctSwn) || 0;
      const kljPctNum = parseFloat(commissionPctKlj) || 0;
      if (swnPctNum <= 0 || kljPctNum <= 0) {
        setGenError("Commission % must be greater than 0 for both SWN and KLJ.");
        return;
      }
    } else {
      const commPctNum = parseFloat(commissionPct) || 0;
      if (commPctNum <= 0) {
        setGenError("Commission % must be greater than 0.");
        return;
      }
    }

    setGenState("loading");

    const payload = {
      brand: selected,
      location,
      contractType,
      amountPerMonth: parseFloat(amountPerMonth) || 0,
      amountPerSku: parseFloat(amountPerSku) || 0,
      amountSwn: parseFloat(amountSwn) || 0,
      amountKlj: parseFloat(amountKlj) || 0,
      noOfMonths: parseFloat(noOfMonths) || 0,
      noOfSku: parseFloat(noOfSku) || 0,
      commissionPct,
      commissionPctSwn,
      commissionPctKlj,
    };

    try {
      const res = await fetch("/api/generate/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    const url = `/api/download?folder=${folder}&file=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Brand Contract</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Load brand data from Google Form responses, fill commercial details, and generate a signed contract.
        </p>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-5 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Step 1 — Sheet Loader */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">01</span>
                Load Google Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SheetLoader onLoad={handleLoadBrands} loadedCount={brands.length} storageKey="brand_sheet_url" />
              {headers.length > 0 && (
                <div className="border border-[var(--border)] rounded-md p-3 bg-[oklch(0.99_0_0)] text-xs space-y-2 mt-3">
                  <p className="font-semibold text-[var(--foreground)]">Sheet Status</p>
                  <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
                    {[
                      ["Legal Name", legalNameIdx >= 0],
                      ["Products Category", brandCategoryIdx >= 0],
                      ["Address", addressIdx >= 0],
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

          {/* Step 2 — Select Brand */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">02</span>
                Select Brand
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Search brand by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={brands.length === 0}
                />

                {brands.length === 0 && (
                  <p className="p-3 text-center text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-md">
                    0 records loaded. Please paste Google Sheet URL and click load.
                  </p>
                )}

                {brands.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                    {filteredBrands.length === 0 ? (
                      <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No matching brands found.</p>
                    ) : (
                      filteredBrands.map((b) => {
                        const originalIdx = brands.findIndex(x => x.index === b.index);
                        return (
                          <button
                            key={b.index}
                            onClick={() => setSelectedIdx(originalIdx)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex justify-between hover:bg-[var(--muted)] transition-colors",
                              selectedIdx === originalIdx && "bg-[oklch(0.95_0_0)] border-l-2 border-[var(--foreground)]"
                            )}
                          >
                            <div className="pr-2 truncate">
                              <p className="font-semibold text-[var(--foreground)] truncate">{b.legalName}</p>
                              <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {b.brandCategory || "No Category"}
                              </p>
                            </div>
                            <span className="shrink-0 self-center font-mono text-[9px] uppercase tracking-wider bg-[var(--muted)] px-1.5 py-0.5 rounded text-[var(--muted-foreground)] max-w-[100px] truncate" title={b.brandCategory}>
                              {b.brandCategory || "General"}
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
                    ["Legal Name", selected.legalName],
                    ["Products Category", selected.brandCategory],
                    ["Address", selected.address],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-[var(--muted-foreground)] w-32 shrink-0 text-xs pt-0.5">{k}</span>
                      <span className="font-medium text-xs break-all">{v || "—"}</span>
                    </div>
                  ))}

                  {/* Warning banner for missing mandatory fields */}
                  {brandMissingFields.length > 0 && (
                    <div className="flex gap-2 text-xs py-2 px-3 border border-rose-200 bg-rose-50 text-rose-700 rounded-md mt-2">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Cannot Generate Contract</p>
                        <p className="text-[10px]">Missing mandatory fields: {brandMissingFields.join(", ")}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Step 3 — Commercial Details */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">03</span>
                Commercial Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldRow>
                <Field label="Location">
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value as Location)}
                    className="flex h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="SWN">SWN</option>
                    <option value="KLJ">KLJ</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </Field>
                <Field label="Contract Type">
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as ContractType)}
                    className="flex h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="MONTH">MONTH</option>
                    <option value="SKU">SKU</option>
                  </select>
                </Field>
              </FieldRow>

              {/* Dynamic amount inputs */}
              {location === "BOTH" ? (
                <FieldRow>
                  <Field label="Amount — SWN (₹)">
                    <Input type="number" placeholder="0" value={amountSwn} onChange={(e) => setAmountSwn(e.target.value)} />
                  </Field>
                  <Field label="Amount — KLJ (₹)">
                    <Input type="number" placeholder="0" value={amountKlj} onChange={(e) => setAmountKlj(e.target.value)} />
                  </Field>
                </FieldRow>
              ) : contractType === "MONTH" ? (
                <Field label="Amount / Month (₹)">
                  <Input type="number" placeholder="0" value={amountPerMonth} onChange={(e) => setAmountPerMonth(e.target.value)} />
                </Field>
              ) : (
                <FieldRow>
                  <Field label="Amount / SKU (₹)">
                    <Input type="number" placeholder="0" value={amountPerSku} onChange={(e) => setAmountPerSku(e.target.value)} />
                  </Field>
                  <Field label="No. of SKUs">
                    <Input type="number" placeholder="0" value={noOfSku} onChange={(e) => setNoOfSku(e.target.value)} />
                  </Field>
                </FieldRow>
              )}

              <FieldRow>
                {(location === "BOTH" || contractType === "SKU") && (
                  <Field label="No. of SKUs">
                    <Input type="number" placeholder="0" value={noOfSku} onChange={(e) => setNoOfSku(e.target.value)} />
                  </Field>
                )}
                <Field label="No. of Months">
                  <Input type="number" placeholder="0" value={noOfMonths} onChange={(e) => setNoOfMonths(e.target.value)} />
                </Field>
                {location !== "BOTH" && (
                  <Field label="Commission %">
                    <Input type="number" placeholder="0" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
                  </Field>
                )}
              </FieldRow>

              {location === "BOTH" && (
                <FieldRow>
                  <Field label="Commission % — SWN">
                    <Input type="number" placeholder="0" value={commissionPctSwn} onChange={(e) => setCommissionPctSwn(e.target.value)} />
                  </Field>
                  <Field label="Commission % — KLJ">
                    <Input type="number" placeholder="0" value={commissionPctKlj} onChange={(e) => setCommissionPctKlj(e.target.value)} />
                  </Field>
                </FieldRow>
              )}

            </CardContent>
          </Card>

          {/* Step 4 — Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-[var(--muted-foreground)] mr-2 font-mono text-xs">04</span>
                Live Contract Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="preview-card">
                {!selected ? (
                  <span className="text-[var(--muted-foreground)]">Select a brand to see preview.</span>
                ) : !preview ? (
                  <span className="text-[var(--muted-foreground)]">Fill in the amount and month/SKU fields to see preview.</span>
                ) : (
                  <div className="space-y-2">
                    <p>{preview.clause}</p>
                    {location === "BOTH" ? (
                      (commissionPctSwn || commissionPctKlj) && (
                        <p>
                          A commission of {commissionPctSwn || "0"}% on the sale price of each product sold
                          through the SWN setup and {commissionPctKlj || "0"}% on the sale price of each
                          product sold through the KLJ setup.
                        </p>
                      )
                    ) : (
                      commissionPct && (
                        <p>A commission of {commissionPct}% on the sale price of each product sold.</p>
                      )
                    )}
                    <p className="text-[var(--muted-foreground)] text-xs pt-1 border-t border-[var(--border)]">
                      Total: <strong className="text-[var(--foreground)]">{formatINRClient(preview.total)}</strong>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 5 — Generate */}
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
                {genState === "loading" ? "Generating…" : "Generate Brand Contract"}
              </Button>

              <Link href="/ai-workspace/brand" className="block w-full">
                <Button variant="outline" className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                  <Sparkles size={13} />
                  Open AI Suggestion Assistant
                </Button>
              </Link>

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
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(genResult.docxName, "brands")}
                    >
                      <FileText size={13} />
                      DOCX
                    </Button>
                    {genResult.pdfName && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(genResult.pdfName!, "brands")}
                      >
                        <Download size={13} />
                        PDF
                      </Button>
                    )}
                    {!genResult.pdfName && (
                      <span className="text-xs text-[var(--muted-foreground)] self-center">
                        PDF skipped — LibreOffice not found
                      </span>
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
