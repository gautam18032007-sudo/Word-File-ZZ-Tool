"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandRow, Location, ContractType, GenerateResult } from "@/lib/types";
import { downloadBase64, downloadHistoryFile, MIME } from "@/lib/clientDownload";
import { ExportButton } from "@/components/export-button";

import { SheetLoader } from "@/components/shared/SheetLoader";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

function isValidCommission(val: string): boolean {
  if (!val || !val.trim()) return false;
  const n = Number(val);
  if (isNaN(n)) return false;
  return n > 0 && n <= 100;
}

const ALL_LOCATIONS = ["SWN", "KLJ", "HQ27"];

function buildClause(
  selectedLocations: string[],
  contractType: ContractType,
  amountsByLoc: Record<string, string>,
  singleAmountMonth: string,
  singleAmountSku: string,
  noOfMonths: string,
  noOfSku: string
): { clause: string; total: number } | null {
  if (contractType === "COMMISSION") {
    return { total: 0, clause: "" };
  }

  const months = num(noOfMonths);
  const sku = num(noOfSku);
  if (!months) return null;
  if (contractType === "SKU" && !sku) return null;

  if (selectedLocations.length === 0) return null;

  const perUnitLabel = contractType === "MONTH" ? "Month" : "SKU";

  if (selectedLocations.length === 1) {
    const loc = selectedLocations[0];
    const unitAmt = contractType === "MONTH" ? num(singleAmountMonth) : num(singleAmountSku);
    if (!unitAmt) return null;
    const total = contractType === "MONTH" ? unitAmt * months : unitAmt * sku * months;
    const locText = `${loc} setup`;

    if (contractType === "MONTH") {
      return {
        total,
        clause: `An advanced fixed fee of ${formatINRClient(unitAmt)} per Month for the ${locText}, payable for a period of ${months} month(s), amounting to a total of ${formatINRClient(total)} (exclusive of GST); and`,
      };
    }
    return {
      total,
      clause: `An advanced fixed fee of ${formatINRClient(unitAmt)} per SKU for ${sku} SKUs for ${months} months, totalling ${formatINRClient(total)} at our ${locText}.`,
    };
  }

  for (const loc of selectedLocations) {
    if (!num(amountsByLoc[loc] || "")) return null;
  }

  const sumPerUnit = selectedLocations.reduce((sum, loc) => sum + num(amountsByLoc[loc] || ""), 0);
  const total = contractType === "MONTH" ? sumPerUnit * months : sumPerUnit * sku * months;

  if (selectedLocations.length === 2) {
    const loc1 = selectedLocations[0], loc2 = selectedLocations[1];
    const a1 = num(amountsByLoc[loc1] || ""), a2 = num(amountsByLoc[loc2] || "");
    const skuClause = contractType === "SKU" ? `, for ${sku} SKUs` : "";
    return {
      total,
      clause: `An advanced fixed fee of ${formatINRClient(a1)} per ${perUnitLabel} at ${loc1} and ${formatINRClient(a2)} per ${perUnitLabel} at ${loc2}${skuClause} for ${months} months, totalling ${formatINRClient(total)} across both setups.`,
    };
  }

  const parts = selectedLocations.map((loc) => `${formatINRClient(num(amountsByLoc[loc] || ""))} per ${perUnitLabel} at ${loc}`);
  const allButLast = parts.slice(0, -1).join(", ");
  const skuClause = contractType === "SKU" ? `, for ${sku} SKUs` : "";
  return {
    total,
    clause: `An advanced fixed fee of ${allButLast}, and ${parts[parts.length - 1]}${skuClause} for ${months} months, totalling ${formatINRClient(total)} across setups.`,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
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
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\(\)\_\-\.]/g, ' ').replace(/\s+/g, ' ');
    
    // Level 1: Exact / cleaned match
    let idx = headersList.findIndex(h => possibleNames.some(p => norm(h) === norm(p)));
    if (idx >= 0) return idx;

    // Level 2: Substring inclusion match
    idx = headersList.findIndex(h => possibleNames.some(p => {
      const nh = norm(h);
      const np = norm(p);
      return nh.length > 2 && np.length > 2 && (nh.includes(np) || np.includes(nh));
    }));
    return idx;
  }

  // Compute brand column indices dynamically
  const legalNameIdx = findColumnIndex(headers, [
    'Legal Name ( to be written in contract )',
    'Legal Name (to be written in contract)',
    'Legal Name',
    'Brand Name',
    'Brand Name / Legal Name',
    'Company Name',
    'Brand',
    'Name of Brand',
    'Name of Company',
    'Legal Company Name',
    'Name'
  ]);
  const brandCategoryIdx = findColumnIndex(headers, [
    'Products Category ( to be written in contract )',
    'Products Category (to be written in contract)',
    'Products Category',
    'Product Category',
    'Brand Category',
    'Category',
    'Type of Product',
    'Product Type',
    'Products'
  ]);
  const addressIdx = findColumnIndex(headers, [
    'Address ( to be written in contract )',
    'Address (to be written in contract)',
    'Address',
    'Registered Address',
    'Office Address',
    'Business Address',
    'Location'
  ]);
  const emailIdx = findColumnIndex(headers, [
    'Email Address',
    'Email ID',
    'Email',
    'Contact Email',
    'Mail'
  ]);
  const phoneIdx = findColumnIndex(headers, [
    'Phone Number',
    'Phone',
    'Contact Number',
    'Contact No',
    'Mobile Number',
    'Mobile',
    'Phone No'
  ]);
  const contactPersonIdx = findColumnIndex(headers, [
    'Contact Person Name',
    'Contact Person',
    'Authorized Signatory',
    'Person Name',
    'Name of Contact Person',
    'Contact Name',
    'Contact'
  ]);

  // Compute brands dynamically from rawRows
  const brands: BrandRow[] = rawRows.map((r, i) => {
    const legalName = legalNameIdx >= 0 ? (r[legalNameIdx] ?? '').trim() : '';
    const brandCategory = brandCategoryIdx >= 0 ? (r[brandCategoryIdx] ?? '').trim() : '';
    const address = addressIdx >= 0 ? (r[addressIdx] ?? '').trim() : '';
    const email = emailIdx >= 0 ? (r[emailIdx] ?? '').trim() : '';
    const phone = phoneIdx >= 0 ? (r[phoneIdx] ?? '').trim() : '';
    const contactPerson = contactPersonIdx >= 0 ? (r[contactPersonIdx] ?? '').trim() : '';

    const fallbackName = legalName || (r[1] ? r[1].trim() : r[0] ? r[0].trim() : '');

    return {
      index: i + 2,
      legalName: fallbackName,
      brandCategory,
      address,
      email,
      phone,
      contactPerson,
    };
  }).filter(b => b.legalName || b.brandCategory || b.address);


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
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["SWN"]);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("MONTH");
  
  const [amountPerMonth, setAmountPerMonth] = useState("");
  const [amountPerSku, setAmountPerSku] = useState("");
  const [amountsByLoc, setAmountsByLoc] = useState<Record<string, string>>({ SWN: "", KLJ: "", HQ27: "" });
  
  const [noOfMonths, setNoOfMonths] = useState("");
  const [noOfSku, setNoOfSku] = useState("");

  const [commissionPct, setCommissionPct] = useState("");
  const [commissionsByLoc, setCommissionsByLoc] = useState<Record<string, string>>({ SWN: "", KLJ: "", HQ27: "" });

  // generate state
  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");

  function toggleLocation(loc: string) {
    if (selectedLocations.includes(loc)) {
      if (selectedLocations.length === 1) return; // Must keep at least 1 selected
      setSelectedLocations(selectedLocations.filter((l) => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  }

  function toggleSelectAll() {
    if (selectedLocations.length === ALL_LOCATIONS.length) {
      setSelectedLocations(["SWN"]);
    } else {
      setSelectedLocations([...ALL_LOCATIONS]);
    }
  }

  // Live clause preview
  const preview = buildClause(
    selectedLocations,
    contractType,
    amountsByLoc,
    amountPerMonth,
    amountPerSku,
    noOfMonths,
    noOfSku
  );

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

    if (selectedLocations.length === 1) {
      const loc = selectedLocations[0];
      const comm = selectedLocations.length === 1 ? commissionPct : commissionsByLoc[loc];
      if (!isValidCommission(comm)) {
        setGenError(`Commission % must be a number between 0 and 100.`);
        return;
      }
    } else {
      for (const loc of selectedLocations) {
        if (!isValidCommission(commissionsByLoc[loc])) {
          setGenError(`Commission % for ${loc} must be a number between 0 and 100.`);
          return;
        }
      }
    }

    setGenState("loading");

    const parsedAmounts: Record<string, number> = {};
    const parsedCommissions: Record<string, string> = {};

    selectedLocations.forEach((loc) => {
      parsedAmounts[loc] = selectedLocations.length === 1
        ? (contractType === "MONTH" ? parseFloat(amountPerMonth) || 0 : parseFloat(amountPerSku) || 0)
        : parseFloat(amountsByLoc[loc]) || 0;
      parsedCommissions[loc] = selectedLocations.length === 1 ? commissionPct : (commissionsByLoc[loc] || "");
    });

    const isBoth = selectedLocations.length === 2 && selectedLocations.includes("SWN") && selectedLocations.includes("KLJ");

    const payload = {
      brand: selected,
      location: (isBoth ? "BOTH" : selectedLocations[0]) as Location,
      locations: selectedLocations,
      amountsByLocation: parsedAmounts,
      commissionsByLocation: parsedCommissions,
      contractType,
      amountPerMonth: parseFloat(amountPerMonth) || 0,
      amountPerSku: parseFloat(amountPerSku) || 0,
      amountSwn: parseFloat(amountsByLoc["SWN"]) || 0,
      amountKlj: parseFloat(amountsByLoc["KLJ"]) || 0,
      noOfMonths: parseFloat(noOfMonths) || 0,
      noOfSku: parseFloat(noOfSku) || 0,
      commissionPct,
      commissionPctSwn: commissionsByLoc["SWN"] || "",
      commissionPctKlj: commissionsByLoc["KLJ"] || "",
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

  function downloadFile(filename: string, folder: string, base64?: string, mime?: string, blobUrl?: string) {
    if (base64) {
      downloadBase64(filename, base64, mime!);
      return;
    }
    downloadHistoryFile(folder, filename, blobUrl);
  }


  return (
    <div className="max-w-7xl mx-auto space-y-6 px-2 sm:px-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Brand Contract</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Load brand data from Google Form responses, fill commercial details, and generate a signed contract.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────────────── */}
        <div className="space-y-5">
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
                <div className="border border-[var(--border)] rounded-md p-3 bg-[var(--muted)]/30 text-xs space-y-2 mt-3">
                  <p className="font-semibold text-[var(--foreground)]">Sheet Status</p>
                  <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
                    {[
                      ["Legal Name", legalNameIdx >= 0],
                      ["Products Category", brandCategoryIdx >= 0],
                      ["Address", addressIdx >= 0],
                    ].map(([label, found]) => (
                      <div key={label as string} className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted-foreground)]">{label}</span>
                        <span className={found ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
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
                <div className="flex gap-2">
                  <Input
                    placeholder="Search brand by name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={brands.length === 0}
                    className="flex-1"
                  />
                  {brands.length > 0 && (
                    <ExportButton
                      data={filteredBrands.map((b) => ({
                        "Legal Name": b.legalName,
                        "Brand Category": b.brandCategory || "N/A",
                        "Address": b.address || "N/A",
                        "Email": b.email || "N/A",
                        "Phone": b.phone || "N/A",
                        "Contact Person": b.contactPerson || "N/A",
                      }))}
                      filename="brand-sheet-data"
                      label="Export"
                    />
                  )}
                </div>


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
                              selectedIdx === originalIdx && "bg-[var(--accent)] border-l-2 border-[var(--primary)] font-semibold text-[var(--foreground)]"
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
                <div className="space-y-1 text-sm border border-[var(--border)] rounded-md p-3 bg-[var(--muted)]/30 text-[var(--foreground)]">
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
                      className="flex h-9 w-full items-center justify-between rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
                    >
                      <span className="font-medium truncate">
                        {selectedLocations.length === ALL_LOCATIONS.length
                          ? "ALL LOCATIONS"
                          : selectedLocations.length === 2 && selectedLocations.includes("SWN") && selectedLocations.includes("KLJ")
                          ? "BOTH (SWN & KLJ)"
                          : selectedLocations.join(", ")}
                      </span>
                      <span className="ml-2 text-xs opacity-60">▼</span>
                    </button>

                    {locationDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setLocationDropdownOpen(false)} />
                        <div className="absolute left-0 top-full mt-1 z-20 w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg space-y-1 text-sm">
                          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--muted)] rounded cursor-pointer font-semibold border-b border-[var(--border)] pb-1.5 mb-1 select-none">
                            <input
                              type="checkbox"
                              checked={selectedLocations.length === ALL_LOCATIONS.length}
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span>Select All Locations</span>
                          </label>

                          {ALL_LOCATIONS.map((loc) => (
                            <label key={loc} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--muted)] rounded cursor-pointer font-medium select-none">
                              <input
                                type="checkbox"
                                checked={selectedLocations.includes(loc)}
                                onChange={() => toggleLocation(loc)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span>{loc}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Field>

                <Field label="Contract Type">
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as ContractType)}
                    className="flex h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="MONTH">MONTH</option>
                    <option value="SKU">SKU</option>
                    <option value="COMMISSION">COMMISSION</option>
                  </select>
                </Field>
              </FieldRow>

              {/* Dynamic inputs based on contractType and selectedLocations */}
              {contractType === "COMMISSION" ? null : (
                <>
                  {selectedLocations.length > 1 ? (
                    <div className="space-y-3">
                      {selectedLocations.map((loc) => (
                        <Field key={loc} label={`Amount — ${loc} (₹)`}>
                          <Input
                            type="number"
                            placeholder="0"
                            value={amountsByLoc[loc] || ""}
                            onChange={(e) => setAmountsByLoc({ ...amountsByLoc, [loc]: e.target.value })}
                          />
                        </Field>
                      ))}
                    </div>
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
                    {selectedLocations.length > 1 && contractType === "SKU" && (
                      <Field label="No. of SKUs">
                        <Input type="number" placeholder="0" value={noOfSku} onChange={(e) => setNoOfSku(e.target.value)} />
                      </Field>
                    )}
                    <Field label="No. of Months">
                      <Input type="number" placeholder="0" value={noOfMonths} onChange={(e) => setNoOfMonths(e.target.value)} />
                    </Field>
                  </FieldRow>
                </>
              )}

              {/* Dynamic Commission Inputs */}
              {selectedLocations.length === 1 ? (
                <Field label="Commission %">
                  <Input type="number" placeholder="e.g. 19" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
                </Field>
              ) : (
                <div className="space-y-3">
                  {selectedLocations.map((loc) => (
                    <Field key={loc} label={`Commission % — ${loc}`}>
                      <Input
                        type="number"
                        placeholder="e.g. 19"
                        value={commissionsByLoc[loc] || ""}
                        onChange={(e) => setCommissionsByLoc({ ...commissionsByLoc, [loc]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
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
                  <span className="text-[var(--muted-foreground)]">Fill in commercial details to see preview.</span>
                ) : (
                  <div className="space-y-2">
                    {preview.clause ? <p>{preview.clause}</p> : null}
                    {selectedLocations.length > 1 ? (
                      selectedLocations.some((loc) => commissionsByLoc[loc]) && (
                        <p>
                          A commission of{" "}
                          {selectedLocations.map((loc) => `${commissionsByLoc[loc] || "0"}% through ${loc}`).join(" and ")}.
                        </p>
                      )
                    ) : (
                      commissionPct && (
                        <p>A commission of {commissionPct}% on the sale price of each product sold.</p>
                      )
                    )}
                    {contractType !== "COMMISSION" && (
                      <p className="text-[var(--muted-foreground)] text-xs pt-1 border-t border-[var(--border)]">
                        Total: <strong className="text-[var(--foreground)]">{formatINRClient(preview.total)}</strong>
                      </p>
                    )}
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
                      onClick={() => downloadFile(genResult.docxName, "brands", genResult.docxBase64, MIME.docx)}
                    >
                      <FileText size={13} />
                      DOCX
                    </Button>
                    {genResult.pdfName && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(genResult.pdfName!, "brands", genResult.pdfBase64 ?? undefined, MIME.pdf)}
                      >
                        <Download size={13} />
                        PDF
                      </Button>
                    )}
                    {!genResult.pdfName && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 self-center font-medium">
                        {genResult.message || "PDF conversion unavailable."}
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
