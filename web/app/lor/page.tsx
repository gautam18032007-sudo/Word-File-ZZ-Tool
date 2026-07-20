"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Download, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

interface GenerateResult {
  lorNumber: string;
  docxFile: string;
  pdfFile: string | null;
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);

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
  }, []);

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

  // 3. Track Draft Changes for Audit Trail
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
      setGenError("Joining Date cannot be after Last Working Date");
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
    } catch (err: any) {
      setGenError(err.message || String(err));
      setGenState("error");
    }
  };

  const downloadFile = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/download?folder=lors&file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  };

  // Search filter
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (c.employeeName || "").toLowerCase().includes(q) || (c.designation || "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">LOR Generator Workspace</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Draft recommendation letters using Ollama and compile them into DOCX/PDF formats.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-5 items-start">
        {/* ── LEFT PANEL ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <span className="text-[var(--muted-foreground)] font-mono text-xs">01</span>
                Candidate Registry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loadingCandidates || candidates.length === 0}
              />

              {selectedCandidate && isConsentMissing && (
                <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>This candidate has not confirmed the Employee Declaration — LOR generation is disabled until they do.</span>
                </div>
              )}

              {loadingCandidates ? (
                <div className="flex items-center justify-center py-8 text-xs text-[var(--muted-foreground)]">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Loading response sheets...
                </div>
              ) : loadError ? (
                <div className="alert-error text-xs p-3 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{loadError}</span>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                  {filteredCandidates.length === 0 ? (
                    <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No candidates found.</p>
                  ) : (
                    filteredCandidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectCandidate(i, filteredCandidates)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-xs flex justify-between items-center hover:bg-[var(--muted)] transition-colors",
                          selectedIdx !== -1 && candidates[selectedIdx]?.employeeName === c.employeeName && "bg-[oklch(0.95_0_0)] border-l-2 border-[var(--foreground)]"
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
            </CardContent>
          </Card>
        </div>

        {/* ── CENTER + RIGHT PANELS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* ── CENTER PANEL (FORM & EDITOR) ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">02</span>
                  Candidate Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isConsentMissing && (
                  <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>This candidate has not confirmed the Employee Declaration — LOR generation is disabled until they do.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Rahul Kumar" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Designation</Label>
                    <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Software Engineer" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Backend" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employment Type</Label>
                    <Input value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} placeholder="e.g. Intern" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Personal Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. name@mail.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Pronoun</Label>
                    <select
                      value={pronounMode}
                      onChange={(e) => setPronounMode(e.target.value as any)}
                      className="flex h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="neutral">Neutral Professional</option>
                      <option value="auto">Auto Detect</option>
                      <option value="male">He / Him</option>
                      <option value="female">She / Her</option>
                      <option value="they">They / Them</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Date of Joining</Label>
                    <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Working Date</Label>
                    <Input type="date" value={lastWorkingDate} onChange={(e) => setLastWorkingDate(e.target.value)} />
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">AI drafting context</h4>
                  
                  <div className="space-y-1.5">
                    <Label>Key Responsibilities</Label>
                    <Input value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="e.g. Managed databases, built REST APIs..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Key Projects/Tasks</Label>
                    <Input value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="e.g. Unified payment gateway, resolved concurrency bugs..." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Key Strengths</Label>
                      <Input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="e.g. Quick learner, diligent, problem solver..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Additional Information</Label>
                      <Input value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="e.g. Extended tenure by 2 weeks..." />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                    onClick={handleGenerateDraft}
                    disabled={draftState === "loading" || !fullName || isConsentMissing}
                  >
                    {draftState === "loading" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Drafting with Ollama...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate AI Draft
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-[var(--muted-foreground)] font-mono text-xs">03</span>
                    Recommendation Draft Editor
                  </CardTitle>
                  <div className="flex gap-2">
                    {generatedBy !== "manual" && (
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                        {generatedBy === "ollama" ? "Generated by Qwen" : "Generated by Template"}
                      </Badge>
                    )}
                    {aiDraft && (
                      <Badge variant={edited ? "outline" : "secondary"} className="text-[10px]">
                        {edited ? "Edited Audit Trail" : "AI Original"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {draftState === "error" && draftError && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{draftError}</span>
                  </div>
                )}
                
                <textarea
                  className="w-full min-h-[300px] p-3 text-sm rounded-md border border-[var(--input)] bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-ring font-sans leading-relaxed resize-y"
                  placeholder="Paste or write the recommendation letter body here manually, or generate draft using the AI context form above..."
                  value={finalDraft}
                  onChange={(e) => handleFinalDraftChange(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL (SIGNATORY & ACTIONS) ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">04</span>
                  Authority Block
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label>Signatory Name</Label>
                  <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="e.g. Tanmay Jain" />
                </div>
                <div className="space-y-1.5">
                  <Label>Signatory Role</Label>
                  <Input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} placeholder="e.g. Co-Founder" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">05</span>
                  Document Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-[var(--border)] rounded-md p-3.5 bg-[oklch(0.99_0_0)] text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Recipient:</span>
                    <span className="font-semibold">{fullName || "(Select Candidate)"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Designation:</span>
                    <span className="font-semibold">{designation || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Model:</span>
                    <span className="font-semibold text-indigo-600">
                      {generatedBy === "ollama" ? (usedModel || "Qwen3:32b") : generatedBy === "template" ? "Template" : "Manual"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Status:</span>
                    <Badge variant={genState === "done" ? "success" as any : "secondary"} className="text-[9px] font-mono tracking-wide py-0 px-1">
                      {genState === "done" ? "Generated" : genState === "loading" ? "Compiling" : "Pending"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Button
                    className="w-full bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-[var(--background)] font-medium"
                    onClick={handleGenerateLor}
                    disabled={genState === "loading" || !fullName || !finalDraft.trim() || isConsentMissing}
                  >
                    {genState === "loading" ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-2" />
                        Generating Files...
                      </>
                    ) : (
                      "Generate Recommendation Letter"
                    )}
                  </Button>

                  {genState === "error" && genError && (
                    <div className="alert-error text-xs p-3 flex gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{genError}</span>
                    </div>
                  )}

                  {genState === "done" && genResult && (
                    <div className="alert-success space-y-3.5">
                      <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        <span>{genResult.lorNumber} Created!</span>
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-1">
                        <Button size="sm" variant="outline" className="w-full flex items-center justify-center text-xs" onClick={() => downloadFile(genResult.docxFile)}>
                          <Download size={13} className="mr-1.5" /> Download DOCX
                        </Button>
                        {genResult.pdfFile && (
                          <Button size="sm" variant="outline" className="w-full flex items-center justify-center text-xs" onClick={() => downloadFile(genResult.pdfFile!)}>
                            <Download size={13} className="mr-1.5" /> Download PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
