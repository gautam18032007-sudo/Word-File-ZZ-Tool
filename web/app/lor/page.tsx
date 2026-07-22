"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Download, Loader2, Search, Sparkles, FileText, FileDown, History, UserCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { downloadBase64, downloadHistoryFile, MIME } from "@/lib/clientDownload";


interface Candidate {
  employeeName: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  email: string;
  employmentType: string;
  responsibilities: string;
  projects: string;
  strengths: string;
  additionalInfo: string;
  pronounPreference?: string;
  declaration?: string;
}

interface LorHistoryItem {
  id: string;
  lorNumber: string;
  fullName: string;
  designation: string;
  department: string;
  joiningDate: string;
  lastWorkingDate: string;
  generatedAt: string;
  docxFile: string;
  pdfFile: string | null;
  generatedBy?: string;
}

interface GenerateResult {
  lorNumber: string;
  docxFile: string;
  pdfFile: string | null;
  docxBase64?: string;
  pdfBase64?: string | null;
}

function normalizeDateToYYYYMMDD(dateStr: string): string {
  const clean = (dateStr ?? "").trim();
  if (!clean) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

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

  m = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, "0");
    const day = m[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

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

export default function LorPage() {
  const [activeTab, setActiveTab] = useState<"sheet" | "history">("sheet");

  // Sheet Candidates
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // LOR History
  const [historyList, setHistoryList] = useState<LorHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [email, setEmail] = useState("");
  const [employmentType, setEmploymentType] = useState("Intern");
  const [pronounMode, setPronounMode] = useState<"auto" | "male" | "female" | "they" | "neutral">("neutral");

  // AI Context fields
  const [responsibilities, setResponsibilities] = useState("");
  const [projects, setProjects] = useState("");
  const [strengths, setStrengths] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Signatory fields
  const [signatoryName, setSignatoryName] = useState("Tanmay Jain");
  const [signatoryRole, setSignatoryRole] = useState("Co-Founder");

  // AI draft tracking
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [finalDraft, setFinalDraft] = useState("");
  const [edited, setEdited] = useState(false);
  const [generatedBy, setGeneratedBy] = useState<"ollama" | "template" | "manual">("manual");
  const [usedModel, setUsedModel] = useState<string>("");

  // Status states
  const [draftState, setDraftState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [draftError, setDraftError] = useState("");
  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);

  // 1. Fetch Candidates on Mount
  useEffect(() => {
    async function fetchCandidates() {
      try {
        const res = await fetch("/api/sheets/lor");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load Google Sheet.");
        setCandidates(data.rows || []);
      } catch (err: any) {
        setLoadError(err.message || String(err));
      } finally {
        setLoadingCandidates(false);
      }
    }
    fetchCandidates();
    fetchHistory();
  }, []);

  // Fetch LOR History
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/lor/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryList(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoadingHistory(false);
  };

  // 2. Select Candidate Auto-Fill
  const handleSelectCandidate = (idx: number, filteredList: Candidate[]) => {
    const originalIdx = candidates.findIndex(
      (c) => c.employeeName === filteredList[idx].employeeName && c.joiningDate === filteredList[idx].joiningDate
    );
    setSelectedIdx(originalIdx);
    const candidate = candidates[originalIdx];
    if (candidate) {
      setFullName(candidate.employeeName || "");
      setDesignation(candidate.designation || "");
      setDepartment(candidate.department || "");
      setJoiningDate(normalizeDateToYYYYMMDD(candidate.joiningDate));
      setLastWorkingDate(normalizeDateToYYYYMMDD(candidate.lastWorkingDate));
      setEmail(candidate.email || "");
      setEmploymentType(candidate.employmentType || "Intern");
      setResponsibilities(candidate.responsibilities || "");
      setProjects(candidate.projects || "");
      setStrengths(candidate.strengths || "");
      setAdditionalInfo(candidate.additionalInfo || "");

      let pref: "auto" | "male" | "female" | "they" | "neutral" = "neutral";
      const rawPref = (candidate.pronounPreference || "").trim().toLowerCase();
      if (rawPref.includes("male") || rawPref === "he") pref = "male";
      else if (rawPref.includes("female") || rawPref === "she") pref = "female";
      else if (rawPref.includes("they") || rawPref.includes("them")) pref = "they";
      else if (rawPref.includes("neutral")) pref = "neutral";
      else if (rawPref.includes("auto")) pref = "auto";
      setPronounMode(pref);

      // Reset AI draft state
      setAiDraft(null);
      setFinalDraft("");
      setEdited(false);
      setGeneratedBy("manual");
      setGenResult(null);
      setGenState("idle");
      setGenError("");
    }
  };

  // Declaration consent evaluation
  const selectedCandidate = selectedIdx >= 0 && selectedIdx < candidates.length ? candidates[selectedIdx] : null;

  const isConsentMissing = (() => {
    if (!selectedCandidate) return false;
    const decl = selectedCandidate.declaration;
    if (decl === undefined || decl === null || decl.trim() === "") return false;
    const clean = decl.trim().toLowerCase();
    const isAgreed = clean === "i agree" || clean === "yes" || clean === "agreed" || clean === "true" || clean.includes("i agree") || clean.includes("i confirm") || clean.includes("accurate");
    return !isAgreed;
  })();

  // 3. Track Draft Changes
  const handleFinalDraftChange = (newVal: string) => {
    setFinalDraft(newVal);
    if (aiDraft !== null) {
      setEdited(newVal.trim() !== aiDraft.trim());
    } else {
      setEdited(false);
    }
  };

  // 4. Generate AI Recommendation Draft
  const handleGenerateDraft = async () => {
    setDraftState("loading");
    setDraftError("");
    try {
      const res = await fetch("/api/generate/lor/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          designation,
          department,
          joiningDate,
          lastWorkingDate,
          responsibilities,
          projects,
          strengths,
          additionalInfo,
          employmentType,
          pronounPreference: pronounMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAiDraft(null);
        setFinalDraft("");
        setGeneratedBy("manual");
        setEdited(false);
        setDraftState("error");
        setDraftError(data.message || "Draft generation failed.");
      } else {
        setAiDraft(data.draft);
        setFinalDraft(data.draft);
        setGeneratedBy(data.source || "manual");
        if (data.metadata?.model) {
          setUsedModel(data.metadata.model);
        }
        setEdited(false);
        setDraftState("done");
      }
    } catch (err: any) {
      setAiDraft(null);
      setFinalDraft("");
      setGeneratedBy("manual");
      setEdited(false);
      setDraftState("error");
      setDraftError(err.message || "Draft generation failed.");
    }
  };

  // 5. Generate LOR Document
  const handleGenerateLor = async () => {
    setGenState("loading");
    setGenError("");
    setGenResult(null);

    // Form validation
    if (!fullName.trim()) {
      setGenError("Full Name is required.");
      setGenState("error");
      return;
    }
    if (!designation.trim()) {
      setGenError("Designation is required.");
      setGenState("error");
      return;
    }
    if (!joiningDate) {
      setGenError("Joining Date is required.");
      setGenState("error");
      return;
    }
    if (!lastWorkingDate) {
      setGenError("Last Working Date is required.");
      setGenState("error");
      return;
    }
    if (!finalDraft.trim()) {
      setGenError("Final Draft body text is required.");
      setGenState("error");
      return;
    }

    const jDate = new Date(joiningDate);
    const lDate = new Date(lastWorkingDate);
    if (jDate > lDate) {
      setGenError("Joining Date cannot be after Last Working Date.");
      setGenState("error");
      return;
    }

    try {
      const res = await fetch("/api/generate/lor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          designation: designation.trim(),
          department: department.trim(),
          joiningDate,
          lastWorkingDate,
          employmentType,
          email,
          signatoryName,
          signatoryRole,
          draftGeneratedByAI: generatedBy === "ollama",
          aiDraft,
          finalDraft: finalDraft.trim(),
          edited,
          generatedBy,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setGenResult(data);
      setGenState("done");
      fetchHistory(); // Refresh history list
    } catch (err: any) {
      setGenError(err.message || String(err));
      setGenState("error");
    }
  };

  const downloadFile = (filename: string, base64?: string, mime?: string, blobUrl?: string) => {
    if (base64) {
      downloadBase64(filename, base64, mime!);
      return;
    }
    downloadHistoryFile('lors', filename, blobUrl);
  };


  // Search filter for candidates
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (c.employeeName || "").toLowerCase().includes(q) || (c.designation || "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">LOR Generator Workspace</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            Draft recommendation letters using Ollama AI and compile into 1-page DOCX & PDF formats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-2.5 py-1 text-xs gap-1 font-mono">
            <FileDown size={13} className="text-emerald-500" />
            PDF Engine Ready
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* ── LEFT SIDEBAR: CANDIDATES & HISTORY TAB SWITCHER ── */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">01</span>
                  Select Candidate
                </CardTitle>

                {/* Tab Switcher */}
                <div className="flex items-center p-0.5 bg-[var(--muted)] rounded-md border border-[var(--border)]">
                  <button
                    onClick={() => setActiveTab("sheet")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-all cursor-pointer",
                      activeTab === "sheet" ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    Registry ({candidates.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-all cursor-pointer",
                      activeTab === "history" ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    History ({historyList.length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3">
              {activeTab === "sheet" ? (
                <>
                  <Input
                    placeholder="Search candidate or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loadingCandidates || candidates.length === 0}
                    className="h-9 text-xs"
                  />

                  {selectedCandidate && isConsentMissing && (
                    <div className="border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 rounded-md p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>Employee Declaration missing — generation is disabled until confirmed.</span>
                    </div>
                  )}

                  {loadingCandidates ? (
                    <div className="flex items-center justify-center py-8 text-xs text-[var(--muted-foreground)]">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Loading form responses...
                    </div>
                  ) : loadError ? (
                    <div className="alert-error text-xs p-3 flex gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{loadError}</span>
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                      {filteredCandidates.length === 0 ? (
                        <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No candidates found.</p>
                      ) : (
                        filteredCandidates.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectCandidate(i, filteredCandidates)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 text-xs flex justify-between items-center hover:bg-[var(--muted)] transition-colors cursor-pointer",
                              selectedIdx !== -1 && candidates[selectedIdx]?.employeeName === c.employeeName && "bg-[var(--muted)] border-l-2 border-[var(--foreground)]"
                            )}
                          >
                            <div className="pr-2 truncate">
                              <p className="font-semibold text-[var(--foreground)] truncate">{c.employeeName}</p>
                              <p className="text-[10px] text-[var(--muted-foreground)] truncate">{c.designation}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[9px] uppercase tracking-wider">
                              Intern
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Generated History List */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
                    <span>Recent Generations</span>
                    <button onClick={fetchHistory} className="hover:text-[var(--foreground)] transition cursor-pointer" title="Refresh">
                      <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {historyList.length === 0 ? (
                    <p className="p-4 text-center text-xs text-[var(--muted-foreground)] border border-[var(--border)] rounded-md">
                      No generated LOR history found.
                    </p>
                  ) : (
                    <div className="max-h-[440px] overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                      {historyList.map((item) => (
                        <div key={item.id} className="p-2.5 space-y-1.5 hover:bg-[var(--muted)]/50 transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-xs text-[var(--foreground)] truncate">{item.fullName}</p>
                              <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{item.lorNumber}</p>
                            </div>
                            <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                              {item.generatedBy || "PDF"}
                            </Badge>
                          </div>
                          
                          <div className="flex gap-1.5 pt-1">
                            <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7 gap-1" onClick={() => downloadFile(item.docxFile)}>
                              <Download size={11} /> DOCX
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" onClick={() => downloadFile(item.pdfFile || item.docxFile.replace(/\.docx$/, ".pdf"))}>
                              <FileDown size={11} /> PDF
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── MAIN WORKSPACE: FORM, AI DRAFT, EDITOR & EXPORT ── */}
        <div className="space-y-6">
          {/* Candidate Information Form */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">02</span>
                  Candidate & Tenure Details
                </div>
                {selectedCandidate && (
                  <Badge variant="outline" className="text-[10px] gap-1 font-mono text-emerald-600 border-emerald-300">
                    <UserCheck size={11} /> From Response Sheet
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Neha Sharma" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Designation / Role *</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Maverick Intern" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Department</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Tech Team" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Employment Type</Label>
                  <Input value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="e.g. Intern" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Personal Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pronoun Preference</Label>
                  <select
                    value={pronounMode}
                    onChange={(e) => setPronounMode(e.target.value as any)}
                    className="flex h-11 md:h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="neutral">Neutral Professional</option>
                    <option value="auto">Auto Detect</option>
                    <option value="female">Female (She / Her)</option>
                    <option value="male">Male (He / Him)</option>
                    <option value="they">Neutral (They / Them)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Joining *</Label>
                  <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Last Working Date *</Label>
                  <Input type="date" value={lastWorkingDate} onChange={(e) => setLastWorkingDate(e.target.value)} />
                </div>
              </div>

              {/* AI Context Fields */}
              <div className="border-t border-[var(--border)] pt-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-500" />
                    AI Drafting Context
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Key Responsibilities</Label>
                  <Input value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="e.g. Managed database schemas, built REST APIs..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Key Projects / Achievements</Label>
                  <Input value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="e.g. Integrated payment gateway, reduced manual effort..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Key Strengths</Label>
                    <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="e.g. Quick learner, problem solver..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Additional Info</Label>
                    <Input value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="e.g. Promoted mid-internship..." />
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs"
                  onClick={handleGenerateDraft}
                  disabled={draftState === "loading" || !fullName || isConsentMissing}
                >
                  {draftState === "loading" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Drafting with Ollama AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      Generate Humanized AI Draft
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Draft Editor */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">03</span>
                  Recommendation Body Editor
                </CardTitle>
                <div className="flex items-center gap-2">
                  {generatedBy !== "manual" && (
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                      {generatedBy === "ollama" ? `AI (${usedModel || "Qwen"})` : "Template Fallback"}
                    </Badge>
                  )}
                  {aiDraft && (
                    <Badge variant={edited ? "outline" : "secondary"} className="text-[10px]">
                      {edited ? "Edited Draft" : "Original Draft"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {draftState === "error" && draftError && (
                <div className="alert-error text-xs flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{draftError}</span>
                </div>
              )}

              <textarea
                className="w-full min-h-[260px] p-3.5 text-xs sm:text-sm rounded-md border border-[var(--input)] bg-[var(--background)] color-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-ring font-sans leading-relaxed resize-y shadow-xs"
                placeholder="Write or edit recommendation letter content here..."
                value={finalDraft}
                onChange={(e) => handleFinalDraftChange(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Authority & Generation Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3 border-b border-[var(--border)]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">04</span>
                  Authority Block
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Signatory Name</Label>
                  <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="e.g. Tanmay Jain" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Signatory Role</Label>
                  <Input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} placeholder="e.g. Co-Founder" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-[var(--border)]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">05</span>
                  Export LOR (DOCX & PDF)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="border border-[var(--border)] rounded-md p-3 bg-[var(--muted)]/30 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Candidate:</span>
                    <span className="font-semibold truncate max-w-[160px]">{fullName || "(Enter Name)"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Layout:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">1-Page Guaranteed</span>
                  </div>
                </div>

                <Button
                  className="w-full bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-[var(--background)] font-medium shadow-xs"
                  onClick={handleGenerateLor}
                  disabled={genState === "loading" || !fullName || !finalDraft.trim() || isConsentMissing}
                >
                  {genState === "loading" ? (
                    <>
                      <Loader2 size={15} className="animate-spin mr-2" />
                      Compiling 1-Page DOCX & PDF...
                    </>
                  ) : (
                    "Compile & Generate LOR"
                  )}
                </Button>

                {genState === "error" && genError && (
                  <div className="alert-error text-xs flex gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{genError}</span>
                  </div>
                )}

                {genState === "done" && genResult && (
                  <div className="alert-success space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{genResult.lorNumber} Created Successfully!</span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-center pt-1">
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer" onClick={() => downloadFile(genResult.docxFile, genResult.docxBase64, MIME.docx)}>
                        <Download size={13} /> DOCX
                      </Button>
                      {genResult.pdfFile ? (
                        <Button size="sm" variant="outline" className="text-xs gap-1.5 cursor-pointer text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40" onClick={() => downloadFile(genResult.pdfFile!, genResult.pdfBase64 ?? undefined, MIME.pdf)}>
                          <FileDown size={13} /> PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)] self-center">
                          PDF conversion available only in local environment.
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
    </div>
  );
}
