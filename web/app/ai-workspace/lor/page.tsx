"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LorAssistantPage() {
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Intern");

  const [responsibilities, setResponsibilities] = useState("");
  const [projects, setProjects] = useState("");
  const [strengths, setStrengths] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState("");

  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!fullName.trim() || !designation.trim() || !joiningDate || !lastWorkingDate) {
      setError("Name, Designation, Joining Date, and Last Working Date are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSource("");
    setDraft("");

    try {
      const res = await fetch("/api/generate/lor/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          designation: designation.trim(),
          department: department.trim(),
          joiningDate,
          lastWorkingDate,
          employmentType,
          responsibilities,
          projects,
          strengths,
          additionalInfo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate suggestions");

      setSource(data.source);
      setDraft(data.draft || "");
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-600 animate-pulse" />
          LOR AI Assistant
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Draft complete recommendation letters using local Qwen-14B models.
        </p>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-5 items-start">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Candidate Parameters</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">Provide tenure and context guidelines to generate letters.</p>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="space-y-1">
              <Label>Candidate Name</Label>
              <Input placeholder="e.g. Aditya Bisht" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input placeholder="e.g. Intern" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input placeholder="e.g. Front End" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Joining Date</Label>
                <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Last Working Date</Label>
                <Input type="date" value={lastWorkingDate} onChange={(e) => setLastWorkingDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Employment Type</Label>
              <Input placeholder="e.g. Intern, Full-Time" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsibilities</Label>
              <Input placeholder="e.g. brand partnerships, posting" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Key Projects</Label>
              <Input placeholder="e.g. converted key brands" value={projects} onChange={(e) => setProjects(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Strengths</Label>
              <Input placeholder="e.g. Teamwork, dedication" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Additional Context</Label>
              <Input placeholder="none" value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
            </div>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 font-medium"
              onClick={handleGenerate}
              disabled={loading || !fullName || !designation}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating LOR draft...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Get AI Recommendations
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

          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-[var(--foreground)]">Generated Recommendation Letter</CardTitle>
              {draft && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-[var(--muted-foreground)]"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </Button>
              )}
            </CardHeader>
            <CardContent className="pb-3">
              <textarea
                className="w-full min-h-[440px] p-3 text-xs rounded-md border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-ring font-sans leading-relaxed resize-y"
                placeholder="The recommendation letter draft will appear here..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
