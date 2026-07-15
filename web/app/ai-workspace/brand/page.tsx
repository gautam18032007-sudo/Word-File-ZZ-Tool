"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BrandAssistantPage() {
  const [legalName, setLegalName] = useState("");
  const [brandCategory, setBrandCategory] = useState("");
  const [setupLocation, setSetupLocation] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  // Result fields
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [partnershipSummary, setPartnershipSummary] = useState("");
  const [brandDescription, setBrandDescription] = useState("");

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!legalName.trim() || !brandCategory.trim()) {
      setError("Brand Legal Name and Category are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSource("");

    try {
      const res = await fetch("/api/generate/brand/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName.trim(),
          brandCategory: brandCategory.trim(),
          setupLocation: setupLocation.trim(),
          totalAmount: parseFloat(totalAmount) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate suggestions");

      setSource(data.source);
      const sug = data.suggestions || {};
      setScopeOfWork(sug.scopeOfWork || "");
      setDeliverables(sug.deliverables || "");
      setPartnershipSummary(sug.partnershipSummary || "");
      setBrandDescription(sug.brandDescription || "");
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-600 animate-pulse" />
          Brand Agreement AI Assistant
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Draft Scope of Work, deliverables, and partnership terms using local Qwen-14B models.
        </p>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-5 items-start">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input Parameters</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">Provide brand parameters to configure Qwen suggestions.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Brand Legal Name</Label>
              <Input placeholder="e.g. Acme Corp" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Brand Category</Label>
              <Input placeholder="e.g. Apparels & Footwear" value={brandCategory} onChange={(e) => setBrandCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Setup Location</Label>
              <Input placeholder="e.g. Phoenix Mall, Mumbai" value={setupLocation} onChange={(e) => setSetupLocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total Agreement Amount (₹)</Label>
              <Input placeholder="e.g. 500000" type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 font-medium"
              onClick={handleGenerate}
              disabled={loading || !legalName || !brandCategory}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating suggestions...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Get AI Suggestions
                </>
              )}
            </Button>

            {error && (
              <div className="border border-rose-200 bg-rose-50 rounded-md p-3 text-xs text-rose-700 flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Block */}
        <div className="space-y-4">
          {source && (
            <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-md px-3.5 py-2 text-xs text-indigo-800">
              <span>Source Engine: <strong>{source === "ollama" ? "Ollama Qwen-14B" : "Deterministic Fallback Template"}</strong></span>
            </div>
          )}

          {[
            { id: "scope", label: "Scope of Work", text: scopeOfWork, setter: setScopeOfWork },
            { id: "deliv", label: "Deliverables Description", text: deliverables, setter: setDeliverables },
            { id: "summary", label: "Partnership Summary", text: partnershipSummary, setter: setPartnershipSummary },
            { id: "desc", label: "Brand Profile Description", text: brandDescription, setter: setBrandDescription }
          ].map(({ id, label, text, setter }) => (
            <Card key={id}>
              <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold text-[var(--foreground)]">{label}</CardTitle>
                {text && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-[var(--muted-foreground)]"
                    onClick={() => copyToClipboard(text, id)}
                  >
                    {copiedField === id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                <textarea
                  className="w-full min-h-[70px] p-2.5 text-xs rounded-md border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-ring font-sans leading-relaxed resize-y"
                  placeholder="Generated suggestions will appear here..."
                  value={text}
                  onChange={(e) => setter(e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
