"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CertificateAssistantPage() {
  const [recipientName, setRecipientName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [certificateType, setCertificateType] = useState("Appreciation");
  const [issueDate, setIssueDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  // Result fields
  const [certificateCitation, setCertificateCitation] = useState("");
  const [achievementSummary, setAchievementSummary] = useState("");
  const [recognitionText, setRecognitionText] = useState("");

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!recipientName.trim() || !designation.trim() || !certificateType.trim()) {
      setError("Recipient Name, Designation, and Type are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSource("");

    try {
      const res = await fetch("/api/generate/certificate/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          designation: designation.trim(),
          department: department.trim(),
          certificateType: certificateType.trim(),
          issueDate: issueDate || new Date().toISOString().split("T")[0],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate suggestions");

      setSource(data.source);
      const sug = data.suggestions || {};
      setCertificateCitation(sug.certificateCitation || "");
      setAchievementSummary(sug.achievementSummary || "");
      setRecognitionText(sug.recognitionText || "");
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
          Certificate AI Assistant
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Draft professional appreciation citations and summaries using local Mistral-7B models.
        </p>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-5 items-start">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Input Parameters</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">Provide certificate parameters to configure Mistral suggestions.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recipient Name</Label>
              <Input placeholder="e.g. Rahul Kumar" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input placeholder="e.g. Software Intern" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Product Engineering" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Certificate Type</Label>
              <Input placeholder="e.g. Appreciation, Completion" value={certificateType} onChange={(e) => setCertificateType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Issue</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 font-medium"
              onClick={handleGenerate}
              disabled={loading || !recipientName || !designation}
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
              <span>Source Engine: <strong>{source === "ollama" ? "Ollama Mistral-7B" : "Deterministic Fallback Template"}</strong></span>
            </div>
          )}

          {[
            { id: "citation", label: "Presentation Citation", text: certificateCitation, setter: setCertificateCitation },
            { id: "achieve", label: "Achievement Description Summary", text: achievementSummary, setter: setAchievementSummary },
            { id: "recog", label: "Recognition & Date Context", text: recognitionText, setter: setRecognitionText }
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
