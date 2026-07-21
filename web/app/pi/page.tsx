"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, Download, FileText, Loader2, Receipt, Trash2, AlertTriangle, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LineItem {
  description: string;
  billingMode: 'month' | 'sku';
  amount: number;
  sku: number;
  commission: number;
  uom: string;
  quantity: number;
  gstPct: number;
}

interface PiHistoryRecord {
  id: string;
  piNumber: string;
  originalPiNumber?: string;
  status?: 'active' | 'archived';
  buyerName: string;
  date: string;
  grandTotal: number;
  pdfFile: string;
  generatedAt: string;
}

export default function ProformaInvoicePage() {
  // Buyer Details
  const [buyerName, setBuyerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Delhi");
  const [transporter, setTransporter] = useState("");
  const [destination, setDestination] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [proformaDate, setProformaDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  // Line Items (Defaults to 2 initial rows, expandable up to 4)
  const [items, setItems] = useState<LineItem[]>([
    {
      description: "Service Charge for advertisement of Products - KLJ Noida One",
      billingMode: "month",
      amount: 0,
      sku: 1,
      commission: 0,
      uom: "NOS",
      quantity: 1,
      gstPct: 18,
    },
    {
      description: "Service Charge for advertisement of Products - Smartworks Noida",
      billingMode: "month",
      amount: 0,
      sku: 1,
      commission: 0,
      uom: "NOS",
      quantity: 1,
      gstPct: 18,
    },
  ]);

  // PI number states
  const [piSeq, setPiSeq] = useState("");
  const [autoSuggestedSeq, setAutoSuggestedSeq] = useState<number | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ contractNo: string; pdfName: string | null; xlsxName?: string; message?: string; isPreview: boolean; isRegeneration?: boolean } | null>(null);


  // Regeneration Confirmation Modal state
  const [confirmData, setConfirmData] = useState<{
    piNumber: string;
    buyerName: string;
    grandTotal: number;
    date: string;
  } | null>(null);

  // History state & Search
  const [history, setHistory] = useState<PiHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNextNumber = useCallback(async () => {
    try {
      const res = await fetch("/api/pi/next-number");
      if (res.ok) {
        const data = await res.json();
        if (data.nextNumber) {
          setPiSeq(String(data.nextNumber));
          setAutoSuggestedSeq(data.nextNumber);
        }
      }
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/pi/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchNextNumber();
  }, [fetchHistory, fetchNextNumber]);

  // Handlers for Items
  const handleItemChange = (index: number, field: keyof LineItem, val: any) => {
    const next = [...items];
    if (field === "quantity" || field === "amount" || field === "sku" || field === "commission" || field === "gstPct") {
      next[index] = { ...next[index], [field]: Number(val) || 0 };
    } else {
      next[index] = { ...next[index], [field]: val };
    }
    setItems(next);
  };

  const handleAddRow = () => {
    if (items.length >= 4) return;
    setItems([
      ...items,
      {
        description: `Service Charge for advertisement of Products - Location ${items.length + 1}`,
        billingMode: "month",
        amount: 0,
        sku: 1,
        commission: 0,
        uom: "NOS",
        quantity: 1,
        gstPct: 18,
      },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, idx) => idx !== index);
    setItems(next);
  };

  // Live calculations (Option A: GST calculated on Rate only, quantity independent)
  let totalQuantity = 0;
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;

  items.forEach((it) => {
    const qty = Number(it.quantity) || 0;
    const amount = Number(it.amount) || 0;
    const isSkuMode = it.billingMode === "sku";
    const sku = isSkuMode && Number(it.sku) > 0 ? Number(it.sku) : 1;
    const effectiveRate = isSkuMode ? amount * sku : amount;
    const gstPct = Number(it.gstPct) || 0;
    const rowGst = effectiveRate * (gstPct / 100);

    totalQuantity += qty;
    totalTaxableAmount += effectiveRate * qty;
    totalGstAmount += rowGst;
  });

  const grandTotal = totalTaxableAmount + totalGstAmount;


  // Submit Generation Function
  const handleGenerate = async (e?: React.FormEvent, isPreview = false, confirmRegenerate = false) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess(null);
    if (!confirmRegenerate) setConfirmData(null);

    // Validation
    if (!buyerName.trim()) {
      setError("Buyer Name is required.");
      return;
    }
    if (!piSeq || isNaN(Number(piSeq)) || Number(piSeq) <= 0) {
      setError("Proforma Invoice Number must be a positive integer.");
      return;
    }
    if (!proformaDate) {
      setError("Proforma Date is required.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setError(`Item #${i + 1} Description is required.`);
        return;
      }
      if (it.quantity <= 0) {
        setError(`Item #${i + 1} Number of Months must be greater than 0.`);
        return;
      }
      if (it.amount < 0) {
        setError(`Item #${i + 1} Amount cannot be negative.`);
        return;
      }
      if (it.billingMode === "sku" && it.sku <= 0) {
        setError(`Item #${i + 1} SKUs must be greater than 0 in SKU mode.`);
        return;
      }
      if (it.commission < 0) {
        setError(`Item #${i + 1} Commission % cannot be negative.`);
        return;
      }
      if (it.gstPct < 0) {
        setError(`Item #${i + 1} GST Rate % cannot be negative.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate/pi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName,
          deliveryAddress,
          placeOfSupply,
          transporter,
          destination,
          contactPerson,
          contactNumber,
          date: proformaDate,
          items,
          piSeq: Number(piSeq),
          preview: isPreview,
          confirmRegenerate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate Proforma Invoice.");
      }

      if (data.requiresConfirmation && data.existingRecord) {
        setConfirmData(data.existingRecord);
        setLoading(false);
        return;
      }

      setConfirmData(null);
      setSuccess({
        contractNo: data.contractNo,
        pdfName: data.pdfName,
        xlsxName: data.xlsxName,
        message: data.message,
        isPreview,
        isRegeneration: data.isRegeneration,
      });


      if (!isPreview) {
        setBuyerName("");
        setDeliveryAddress("");
        setPlaceOfSupply("Delhi");
        setTransporter("");
        setDestination("");
        setContactPerson("");
        setContactNumber("");
        setItems([
          {
            description: "Service Charge for advertisement of Products - KLJ Noida One",
            billingMode: "month",
            amount: 0,
            sku: 1,
            commission: 0,
            uom: "NOS",
            quantity: 1,
            gstPct: 18,
          },
          {
            description: "Service Charge for advertisement of Products - Smartworks Noida",
            billingMode: "month",
            amount: 0,
            sku: 1,
            commission: 0,
            uom: "NOS",
            quantity: 1,
            gstPct: 18,
          },
        ]);
        fetchHistory();
      }
      fetchNextNumber();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (record: PiHistoryRecord) => {
    if (!confirm(`Delete this Proforma Invoice record (${record.piNumber})? This cannot be undone.`)) {
      return;
    }

    setDeletingId(record.id);
    try {
      const res = await fetch(`/api/pi/history?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete record.");
      }
      fetchHistory();
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/download?folder=pi&file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  };

  const fmtINR = (val: number) => {
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const filteredHistory = history.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.piNumber.toLowerCase().includes(q) ||
      r.buyerName.toLowerCase().includes(q) ||
      (r.originalPiNumber && r.originalPiNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Proforma Invoice (PI)</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Generate professional Proforma Invoices with live Excel formulas and automated calculations.
        </p>
      </div>

      {error && (
        <div className="alert-error flex gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {confirmData && (
        <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg space-y-3">
          <div className="flex gap-2.5">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Regenerate Existing PI Number ({confirmData.piNumber})?
              </p>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                <strong>{confirmData.piNumber}</strong> already exists in history (Buyer: <strong>{confirmData.buyerName}</strong>, Grand Total: <strong>₹{fmtINR(confirmData.grandTotal)}</strong>). Regenerating will archive the old version and replace it as the active {confirmData.piNumber}. The old version's PDF will be safely preserved.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pl-7">
            <Button
              size="sm"
              onClick={() => handleGenerate(undefined, false, true)}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {loading ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              Yes, Regenerate & Archive Old
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmData(null)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="alert-success flex flex-col gap-3">
          <div className="flex gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                {success.isPreview
                  ? "Preview PDF generated successfully!"
                  : success.isRegeneration
                  ? "Invoice regenerated successfully (Old version archived)!"
                  : "Invoice generated successfully!"}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {success.isPreview ? (
                  <span>Temporary preview document ready for review.</span>
                ) : (
                  <span>
                    Saved as contract sequence: <span className="font-mono font-semibold">{success.contractNo}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pl-6 flex-wrap items-center">
            {success.pdfName && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(success.pdfName!)}
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              >
                <Download size={12} />
                Download {success.isPreview ? "Preview" : ""} PDF
              </Button>
            )}
            {success.xlsxName && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(success.xlsxName!)}
                className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
              >
                <Download size={12} />
                Download XLSX
              </Button>
            )}
            {!success.pdfName && (
              <span className="text-xs text-[var(--muted-foreground)]">
                PDF conversion available only in local environment.
              </span>
            )}
          </div>
        </div>
      )}


      <form onSubmit={(e) => handleGenerate(e, false, false)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Entry Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Buyer & Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="buyerName">Buyer (Name) *</Label>
                  <Input
                    id="buyerName"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Elamra Enterprises"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="piSeq">Proforma Invoice Number *</Label>
                  <div className="flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-mono select-none">
                      BCPL/NO/
                    </span>
                    <Input
                      id="piSeq"
                      type="number"
                      min="1"
                      value={piSeq}
                      onChange={(e) => {
                        setPiSeq(e.target.value);
                        setConfirmData(null);
                      }}
                      className="rounded-none rounded-r-md"
                      required
                    />
                  </div>
                  {autoSuggestedSeq !== null && Number(piSeq) <= autoSuggestedSeq - 1 && (
                    <p className="text-[10px] text-amber-500 font-medium leading-normal mt-1">
                      ⚠️ Existing or non-next sequence number — submitting will prompt to regenerate and archive the old version.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proformaDate">Proforma Date *</Label>
                  <Input
                    id="proformaDate"
                    type="date"
                    value={proformaDate}
                    onChange={(e) => setProformaDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deliveryAddress">Delivery Address</Label>
                <Input
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Leave empty or enter specific delivery address details"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="placeOfSupply">Place Of Supply</Label>
                  <Input
                    id="placeOfSupply"
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    placeholder="Delhi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="transporter">Transporter (Optional)</Label>
                  <Input
                    id="transporter"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    placeholder="e.g. By Hand / Courier"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="destination">Destination (Optional)</Label>
                  <Input
                    id="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Noida / New Delhi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPerson">Contact Person (Optional)</Label>
                  <Input
                    id="contactPerson"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Name of recipient contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contactNumber">Contact Number (Optional)</Label>
                  <Input
                    id="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="Mobile number of contact"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Line Items</CardTitle>
              <span className="text-xs text-[var(--muted-foreground)]">
                {items.length} / 4 Rows
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="p-3.5 border border-[var(--border)] rounded-lg space-y-3 bg-[var(--muted)]/20 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Item #{idx + 1} (Row {25 + idx} in Template)
                    </span>
                    <div className="flex items-center gap-3">
                      {/* Billing Mode Select Toggle */}
                      <div className="flex items-center gap-1.5 bg-[var(--muted)] p-1 rounded-md border border-[var(--border)] text-xs">
                        <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] px-1">Mode:</span>
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, "billingMode", "month")}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            item.billingMode === "month"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-[var(--muted-foreground)] hover:text-foreground"
                          }`}
                        >
                          Month
                        </button>
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, "billingMode", "sku")}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            item.billingMode === "sku"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-[var(--muted-foreground)] hover:text-foreground"
                          }`}
                        >
                          SKU
                        </button>
                      </div>

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRow(idx)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 border-red-500/20 hover:bg-red-500/10"
                          title="Remove Row"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description *</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      placeholder="e.g. Service Charge for advertisement of Products"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="space-y-1.5">
                      <Label>Amount *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.amount || ""}
                        onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                        placeholder="e.g. 5000"
                        required
                      />
                    </div>

                    {/* Show SKUs input ONLY when SKU mode is active */}
                    {item.billingMode === "sku" ? (
                      <div className="space-y-1.5">
                        <Label className="text-blue-600 dark:text-blue-400 font-semibold">SKUs *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.sku || ""}
                          onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                          placeholder="e.g. 5"
                          required
                          className="border-blue-500/30 focus-visible:ring-blue-500"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label>Commission % *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.commission || ""}
                        onChange={(e) => handleItemChange(idx, "commission", e.target.value)}
                        placeholder="e.g. 20"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Months *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || ""}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        placeholder="e.g. 3"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>GST (%) *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.gstPct}
                        onChange={(e) => handleItemChange(idx, "gstPct", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddRow}
                disabled={items.length >= 4}
                className="w-full border-dashed flex items-center justify-center gap-1.5 text-xs"
              >
                <Plus size={14} />
                Add Line Item ({items.length}/4)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Calculation Sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Total Qty (Months)</span>
                  <span className="font-mono font-semibold">{totalQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Taxable Amount</span>
                  <span className="font-mono font-semibold">₹{fmtINR(totalTaxableAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">GST Amount (IGST)</span>
                  <span className="font-mono font-semibold">₹{fmtINR(totalGstAmount)}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-2 flex justify-between text-base font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{fmtINR(grandTotal)}</span>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  GST is extra applicable as shown above. By convention, tax calculations are placed entirely under IGST.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={(e) => handleGenerate(e, true, false)}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      Preview PDF
                    </>
                  )}
                </Button>
                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Receipt size={14} />
                      Generate Invoice
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* History Log with Live Search Input (FEATURE C2) */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <CardTitle>Recent Proforma Invoices</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              placeholder="Search by PI# or Buyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loadingHistory && (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              <Loader2 size={16} className="animate-spin inline mr-2" />
              Loading history…
            </div>
          )}
          {!loadingHistory && filteredHistory.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              {searchQuery ? "No matching invoice records found." : "No invoices generated yet."}
            </div>
          )}
          {!loadingHistory && filteredHistory.length > 0 && (
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["PI Number", "Buyer Name", "Proforma Date", "Grand Total", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record) => {
                  const isArchived = record.status === "archived";
                  return (
                    <tr
                      key={record.id}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                        isArchived
                          ? "bg-[var(--muted)]/30 text-[var(--muted-foreground)]"
                          : "hover:bg-[var(--muted)]/50"
                      }`}
                    >
                      <td className="px-4 py-3 pl-5 font-mono text-xs font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          {record.piNumber}
                          {isArchived && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Archived
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${isArchived ? "italic" : "font-semibold"}`}>{record.buyerName}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">{record.date}</td>
                      <td className="px-4 py-3 font-mono text-xs">₹{fmtINR(record.grandTotal)}</td>
                      <td className="px-4 py-3 pr-5">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(record.pdfFile)}
                            className="h-7 px-2 text-xs"
                          >
                            <Download size={11} />
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRecord(record)}
                            disabled={deletingId === record.id}
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 border-red-500/10 hover:bg-red-500/5"
                            title="Delete Invoice Record"
                          >
                            {deletingId === record.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Trash2 size={11} />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
