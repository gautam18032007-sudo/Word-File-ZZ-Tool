"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmployeeAssistantPage() {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [annualCTC, setAnnualCTC] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  // Result fields
  const [responsibilities, setResponsibilities] = useState("");
  const [probationTerms, setProbationTerms] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [professionalSummary, setProfessionalSummary] = useState("");

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!name.trim() || !designation.trim()) {
      setError("Name and Designation are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSource("");

    try {
      const res = await fetch("/api/generate/employee/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          designation: designation.trim(),
          department: department.trim(),
          annualCTC: parseFloat(annualCTC) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate suggestions");

      setSource(data.source);
      const sug = data.suggestions || {};
      setResponsibilities(sug.responsibilities || "");
      setProbationTerms(sug.probationTerms || "");
      setWorkDescription(sug.workDescription || "");
      setProfessionalSummary(sug.professionalSummary || "");
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
          Employee Contract AI Assistant
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Draft customized responsibilities, summaries, and work details using local Qwen-14B models.
        </p>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-5 items-start">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input Parameters</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">Provide core employee details to configure Qwen suggestions.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee Name</Label>
              <Input placeholder="e.g. Rahul Kumar" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input placeholder="e.g. Tech Lead" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Platform Engineering" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Annual CTC (₹)</Label>
              <Input placeholder="e.g. 1500000" type="number" value={annualCTC} onChange={(e) => setAnnualCTC(e.target.value)} />
            </div>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 font-medium"
              onClick={handleGenerate}
              disabled={loading || !name || !designation}
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
            { id: "summary", label: "Professional Summary", text: professionalSummary, setter: setProfessionalSummary },
            { id: "resp", label: "Suggested Responsibilities", text: responsibilities, setter: setResponsibilities },
            { id: "probation", label: "Probation Clause", text: probationTerms, setter: setProbationTerms },
            { id: "desc", label: "Work Description Details", text: workDescription, setter: setWorkDescription }
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
