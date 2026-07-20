"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, Download, Award, Loader2, Search, Upload, FileText, Trash2, FileDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SheetLoader } from "@/components/shared/SheetLoader";

interface CertificateCandidate {
  fullName: string;
  designation: string;
  joiningDate: string;
  lastWorkingDate: string;
}

interface CertificateTemplate {
  id: string;
  name: string;
  filename: string;
  type: "PNG" | "JPG" | "JPEG" | "PDF";
  active: boolean;
}

interface CertificateHistoryRecord {
  id: string;
  name: string;
  designation: string;
  certificateType: string;
  template: string;
  generatedAt: string;
  pdf: string;
}

interface GenerateResult {
  contractNo: string;
  pdfName: string;
  existing?: boolean;
}

export default function CertificatePage() {
  const [activeLeftTab, setActiveLeftTab] = useState<"sheet" | "history">("sheet");

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Certificate History
  const [certHistory, setCertHistory] = useState<CertificateHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const findColIndex = (list: string[], possible: string[]) => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    return list.findIndex((h) => possible.some((p) => norm(h) === norm(p)));
  };

  const nameIdx = findColIndex(headers, ["Full Name", "Name", "Employee Name", "Intern Name", "Candidate Name"]);
  const designationIdx = findColIndex(headers, ["Designation / Role", "Designation/Role", "Designation", "Role", "Position", "Intern Role", "Intern Designation", "designation / role", "designation/role"]);
  const joinIdx = findColIndex(headers, ["Date of Joining", "Joining Date", "JoiningDate", "DateofJoining", "Start Date"]);
  const exitIdx = findColIndex(headers, ["Last Working Date", "LWD", "Exit Date", "ExitDate", "End Date"]);

  const candidates: CertificateCandidate[] = rawRows.map((r) => ({
    fullName: nameIdx >= 0 ? (r[nameIdx] ?? "").trim() : "",
    designation: designationIdx >= 0 ? (r[designationIdx] ?? "").trim() : "",
    joiningDate: joinIdx >= 0 ? (r[joinIdx] ?? "").trim() : "",
    lastWorkingDate: exitIdx >= 0 ? (r[exitIdx] ?? "").trim() : "",
  })).filter((c) => c.fullName);

  // Form details
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");

  // Signatory details
  const [signatoryName, setSignatoryName] = useState("Tanmay Jain");
  const [signatoryRole, setSignatoryRole] = useState("Co-Founder");
  const [sigImage, setSigImage] = useState<string | null>(null);

  // Template registry state
  const [templates, setTemplates] = useState<CertificateTemplate[]>([
    { id: "CERT_TEMPLATE_001", name: "Certificate of Appreciation", filename: "certificate-appreciation.png", type: "PNG", active: true },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("CERT_TEMPLATE_001");
  const [customTemplates, setCustomTemplates] = useState<CertificateTemplate[]>([]);

  // Debounced preview fields (300ms debounce)
  const [previewName, setPreviewName] = useState("");
  const [previewDesignation, setPreviewDesignation] = useState("");
  const [previewJoiningDate, setPreviewJoiningDate] = useState("");
  const [previewLastWorkingDate, setPreviewLastWorkingDate] = useState("");
  const [previewSignatoryName, setPreviewSignatoryName] = useState("");
  const [previewSignatoryRole, setPreviewSignatoryRole] = useState("");

  // Action states
  const [genState, setGenState] = useState<"idle" | "loading" | "done" | "error" | "duplicate">("idle");
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState("");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Fetch certificate history
  const fetchCertHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data.contracts) ? data.contracts : [];
        const certsOnly = all
          .filter((c: any) => c.type === "certificate" || c.folder === "certificates")
          .map((c: any) => ({
            id: c.contract_no,
            name: c.party_name,
            designation: c.designation || "",
            certificateType: c.certificateType || "APPRECIATION",
            template: c.template || "Certificate",
            generatedAt: c.generated_at,
            pdf: c.pdf,
          }));
        setCertHistory(certsOnly);
      }
    } catch {}
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchCertHistory();
  }, [fetchCertHistory]);

  async function handleLoadCandidates(url: string, loadedHeaders: string[], loadedRows: string[][]) {
    setSelectedIdx(-1);
    setHeaders(loadedHeaders);
    setRawRows(loadedRows);

    const nameIdxTmp = findColIndex(loadedHeaders, ["Full Name", "Name", "Employee Name", "Intern Name", "Candidate Name"]);
    const designationIdxTmp = findColIndex(loadedHeaders, ["Designation / Role", "Designation/Role", "Designation", "Role", "Position", "Intern Role", "Intern Designation", "designation / role", "designation/role"]);
    const joinIdxTmp = findColIndex(loadedHeaders, ["Date of Joining", "Joining Date", "JoiningDate", "DateofJoining", "Start Date"]);
    const exitIdxTmp = findColIndex(loadedHeaders, ["Last Working Date", "LWD", "Exit Date", "ExitDate", "End Date"]);

    if (loadedHeaders.length > 0 && (nameIdxTmp === -1 || designationIdxTmp === -1 || joinIdxTmp === -1 || exitIdxTmp === -1)) {
      setLoadError("Missing Required Columns in the Google Sheet. Please ensure Full Name, Designation, Date of Joining, and Last Working Date columns are present.");
    } else {
      setLoadError("");
    }
  }

  // Fetch signatory defaults from server environment
  useEffect(() => {
    async function loadSignatoryDefaults() {
      try {
        const res = await fetch("/api/templates/certificate?defaults=true");
        if (res.ok) {
          const data = await res.json();
          if (data.defaultName) setSignatoryName(data.defaultName);
          if (data.defaultRole) setSignatoryRole(data.defaultRole);
        }
      } catch {}
    }
    loadSignatoryDefaults();
  }, []);

  // Fetch custom templates list
  const loadCustomTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates/certificate");
      if (res.ok) {
        const data = await res.json();
        setCustomTemplates(data.templates || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadCustomTemplates();
  }, [loadCustomTemplates]);

  // Debouncing effect (300ms) for live preview updates
  useEffect(() => {
    const handler = setTimeout(() => {
      setPreviewName(fullName);
      setPreviewDesignation(designation);
      setPreviewJoiningDate(joiningDate);
      setPreviewLastWorkingDate(lastWorkingDate);
      setPreviewSignatoryName(signatoryName);
      setPreviewSignatoryRole(signatoryRole);
    }, 300);

    return () => clearTimeout(handler);
  }, [fullName, designation, joiningDate, lastWorkingDate, signatoryName, signatoryRole]);

  // Normalize dates to YYYY-MM-DD
  function normalizeDate(str: string): string {
    const clean = (str ?? "").trim();
    if (!clean) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    
    let m = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      const d = m[1].padStart(2, "0");
      const mon = m[2].padStart(2, "0");
      const y = m[3];
      return `${y}-${mon}-${d}`;
    }

    try {
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const mon = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        return `${y}-${mon}-${d}`;
      }
    } catch {}
    return clean;
  }

  // Handle intern selection
  function handleSelectIntern(idx: number, filteredList: CertificateCandidate[]) {
    const originalIdx = candidates.findIndex(
      (c) => c.fullName === filteredList[idx].fullName && c.joiningDate === filteredList[idx].joiningDate
    );
    setSelectedIdx(originalIdx);
    const intern = candidates[originalIdx];
    if (intern) {
      setFullName(intern.fullName);
      setDesignation(intern.designation);
      setJoiningDate(normalizeDate(intern.joiningDate));
      setLastWorkingDate(normalizeDate(intern.lastWorkingDate));
    }
  }

  // Handle signature upload
  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSigImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Handle template file upload
  async function handleTemplateUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("templateFile", file);
    formData.append("name", file.name.split(".")[0]);

    try {
      const res = await fetch("/api/templates/certificate", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to upload template");
      
      await loadCustomTemplates();
      setSelectedTemplateId(data.template.id);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this custom template?")) return;
    try {
      const res = await fetch(`/api/templates/certificate?id=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete template");
      
      await loadCustomTemplates();
      if (selectedTemplateId === id) {
        setSelectedTemplateId("CERT_TEMPLATE_001");
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  }

  // Format date range string for display
  function formatDateRange(startIso: string, endIso: string): string {
    const ordinal = (n: number) => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const format = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      const day = ordinal(d.getDate());
      const month = d.toLocaleString("en-GB", { month: "long" });
      const year = d.getFullYear();
      return `${day} ${month}, ${year}`;
    };
    const s = format(startIso);
    const e = format(endIso);
    return s && e ? `${s} - ${e}` : "";
  }

  // Run validation checks
  function validateInputs(): string | null {
    if (!fullName.trim()) return "Full Name is required.";
    if (fullName.trim().length < 2) return "Full Name must be at least 2 characters.";
    if (/^\d+$/.test(fullName.trim())) return "Full Name cannot contain numbers only.";
    if (!designation.trim()) return "Designation is required.";
    if (!joiningDate) return "Joining Date is required.";
    if (!lastWorkingDate) return "Last Working Date is required.";
    if (new Date(joiningDate) > new Date(lastWorkingDate)) {
      return "Joining Date cannot be after Last Working Date.";
    }
    if (!selectedTemplateId) return "Please select a certificate template.";
    return null;
  }

  // Generate certificate
  async function handleGenerate(force = false) {
    setGenError("");
    setGenResult(null);

    const validationError = validateInputs();
    if (validationError) {
      setGenError(validationError);
      setGenState("error");
      return;
    }

    setGenState("loading");

    try {
      const activeTemplateObj = [...templates, ...customTemplates].find((t) => t.id === selectedTemplateId);
      const res = await fetch("/api/generate/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          designation: designation.trim(),
          joiningDate,
          lastWorkingDate,
          templateId: selectedTemplateId,
          templateName: activeTemplateObj?.name || "Certificate",
          signatoryName: signatoryName.trim(),
          signatoryRole: signatoryRole.trim(),
          sigImage: sigImage || undefined,
          force
        }),
      });

      const data = await res.json();
      if (res.status === 409) {
        setGenResult(data);
        setGenState("duplicate");
        setShowDuplicateModal(true);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setGenResult(data);
      setGenState("done");
      fetchCertHistory(); // Refresh history list
    } catch (e: any) {
      setGenError(e.message || String(e));
      setGenState("error");
    }
  }

  function downloadFile(filename: string) {
    const a = document.createElement("a");
    a.href = `/api/download?folder=certificates&file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  }

  // Filter candidates list by search query
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.fullName.toLowerCase().includes(q) || c.designation.toLowerCase().includes(q);
  });

  const activeTemplateObj = [...templates, ...customTemplates].find((t) => t.id === selectedTemplateId);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Certificate Module</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            Generate and log vector PDF certificates. Loaded automatically from response sheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-2.5 py-1 text-xs gap-1 font-mono text-emerald-600 border-emerald-300">
            <FileDown size={13} /> Direct PDF Export
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── LEFT PANEL: CANDIDATES & HISTORY ── */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)] font-mono text-xs">01</span>
                  Recipient Selection
                </CardTitle>

                <div className="flex items-center p-0.5 bg-[var(--muted)] rounded-md border border-[var(--border)]">
                  <button
                    onClick={() => setActiveLeftTab("sheet")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-all cursor-pointer",
                      activeLeftTab === "sheet" ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    Sheet ({candidates.length})
                  </button>
                  <button
                    onClick={() => setActiveLeftTab("history")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded transition-all cursor-pointer",
                      activeLeftTab === "history" ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    History ({certHistory.length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3">
              {activeLeftTab === "sheet" ? (
                <>
                  <SheetLoader onLoad={handleLoadCandidates} loadedCount={candidates.length} storageKey="certificate_sheet_url" />
                  
                  {headers.length > 0 && (
                    <div className="border border-[var(--border)] rounded-md p-2.5 bg-[var(--muted)]/30 text-xs space-y-1.5 mt-2">
                      <p className="font-semibold text-[var(--foreground)] text-[11px]">Sheet Mapping Status</p>
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-[var(--border)]">
                        {[
                          ["Full Name", nameIdx >= 0],
                          ["Designation", designationIdx >= 0],
                          ["Joining Date", joinIdx >= 0],
                          ["Exit Date", exitIdx >= 0],
                        ].map(([label, found]) => (
                          <div key={label as string} className="flex items-center justify-between text-[10px]">
                            <span className="text-[var(--muted-foreground)]">{label}</span>
                            <span className={found ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
                              {found ? "✓" : "✗"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {loadError && (
                    <div className="alert-error text-xs p-2.5 space-y-1 mt-2">
                      <div className="flex gap-1.5">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>Column mapping notice</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-red-800 dark:text-red-300">{loadError}</p>
                    </div>
                  )}

                  <Input
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={candidates.length === 0}
                    className="h-9 text-xs"
                  />

                  {candidates.length > 0 && (
                    <div className="max-h-60 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                      {filteredCandidates.length === 0 ? (
                        <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No matching records.</p>
                      ) : (
                        filteredCandidates.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectIntern(i, filteredCandidates)}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex justify-between items-center hover:bg-[var(--muted)] transition-colors cursor-pointer",
                              selectedIdx !== -1 && candidates[selectedIdx]?.fullName === c.fullName && "bg-[var(--muted)] border-l-2 border-[var(--foreground)]"
                            )}
                          >
                            <div className="pr-2 truncate">
                              <p className="font-semibold text-[var(--foreground)] truncate">{c.fullName}</p>
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
                /* History Tab */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
                    <span>Generated PDF Certificates</span>
                    <button onClick={fetchCertHistory} className="hover:text-[var(--foreground)] transition cursor-pointer" title="Refresh">
                      <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {certHistory.length === 0 ? (
                    <p className="p-4 text-center text-xs text-[var(--muted-foreground)] border border-[var(--border)] rounded-md">
                      No certificate records generated yet.
                    </p>
                  ) : (
                    <div className="max-h-[440px] overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--background)]">
                      {certHistory.map((item) => (
                        <div key={item.id} className="p-2.5 space-y-1.5 hover:bg-[var(--muted)]/50 transition">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-xs text-[var(--foreground)] truncate">{item.name}</p>
                              <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{item.id}</p>
                            </div>
                            <Badge variant="secondary" className="text-[9px] shrink-0 font-mono">
                              PDF
                            </Badge>
                          </div>
                          <div className="pt-1">
                            <Button size="sm" variant="outline" className="w-full text-[10px] h-7 gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" onClick={() => downloadFile(item.pdf)}>
                              <FileDown size={12} /> Download PDF
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

          {/* Intern Details Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-[var(--muted-foreground)] font-mono text-xs">02</span>
                Recipient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Palak Kankheria" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Designation *</Label>
                <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Maverick Intern" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Joining Date *</Label>
                  <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Exit Date *</Label>
                  <Input type="date" value={lastWorkingDate} onChange={(e) => setLastWorkingDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT PANEL: TEMPLATES, PREVIEW & EXPORT ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-[var(--muted-foreground)] font-mono text-xs">03</span>
                Template & Signatory Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Certificate Layout</Label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="flex h-11 md:h-9 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <optgroup label="System Templates">
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                    {customTemplates.length > 0 && (
                      <optgroup label="Custom Templates">
                        {customTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Add Custom Background (+)</Label>
                  <label className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-[var(--border)] rounded text-xs cursor-pointer hover:bg-[var(--muted)] transition-colors w-full justify-center">
                    <Upload size={12} />
                    <span>Upload PNG/JPG/PDF</span>
                    <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={handleTemplateUpload} />
                  </label>
                </div>

                {customTemplates.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                    <Label className="text-[11px] text-[var(--muted-foreground)]">Custom Uploads</Label>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {customTemplates.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1 px-2 bg-[var(--muted)] rounded border border-[var(--border)]">
                          <span className="truncate max-w-[120px]" title={t.name}>{t.name}</span>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="text-rose-500 hover:text-rose-700 transition cursor-pointer p-0.5"
                            title="Delete custom template"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Signatory Name</Label>
                  <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Signatory Role</Label>
                  <Input value={signatoryRole} onChange={(e) => setSignatoryRole(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Upload Signature Image</Label>
                  <Input type="file" accept=".png,.jpg,.jpeg" onChange={handleSignatureUpload} className="text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Vector Preview Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-[var(--muted-foreground)] font-mono text-xs">04</span>
                Live PDF Layout Preview
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-[10px]">
                Real-time
              </Badge>
            </CardHeader>
            <CardContent className="flex justify-center bg-[var(--muted)]/50 p-4 rounded-b-md min-h-[280px] border border-[var(--border)] items-center relative overflow-hidden">
              <div 
                className="w-full relative shadow-md bg-white overflow-hidden aspect-[1.414/1] border border-stone-200 text-center text-stone-800 rounded-sm"
                style={{
                  backgroundImage: 
                    selectedTemplateId === "CERT_TEMPLATE_001" 
                      ? "url('/templates/CERTIFICATE-template.png.png')" 
                      : activeTemplateObj && activeTemplateObj.id.startsWith("CERT_TEMPLATE_CUSTOM_") && activeTemplateObj.type !== "PDF"
                        ? `url('/templates/certificates/${activeTemplateObj.filename}')`
                        : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* Fallback layout for empty / PDF templates */}
                {selectedTemplateId !== "CERT_TEMPLATE_001" && (!activeTemplateObj || !activeTemplateObj.id.startsWith("CERT_TEMPLATE_CUSTOM_") || activeTemplateObj.type === "PDF") && (
                  <div className="absolute inset-0 bg-stone-50/90 border-4 border-double border-stone-300 m-3 flex flex-col items-center justify-center pointer-events-none p-5">
                    <p className="text-[9px] uppercase tracking-widest text-stone-400 font-semibold mb-2">
                      Template: {activeTemplateObj?.name}
                    </p>
                  </div>
                )}

                {/* Name Overlay */}
                <h1 className="absolute top-[50.9%] left-[60.8%] -translate-x-1/2 -translate-y-1/2 text-[2.5vw] font-sans font-bold text-[#c5a059] whitespace-nowrap">
                  {previewName || "{{FULL_NAME}}"}
                </h1>

                {/* Designation Overlay */}
                <p className="absolute top-[62.1%] left-[60.8%] -translate-x-1/2 -translate-y-1/2 text-[1.2vw] text-stone-600 whitespace-nowrap">
                  Worked as <strong className="text-stone-800 font-semibold">{previewDesignation || "{{DESIGNATION}}"}</strong> at <strong className="text-stone-800 font-semibold">zenzebra</strong>
                </p>

                {/* Date Range Overlay */}
                <p className="absolute top-[70.6%] left-[60.8%] -translate-x-1/2 -translate-y-1/2 text-[1vw] text-stone-500 font-semibold tracking-wide whitespace-nowrap">
                  {previewJoiningDate && previewLastWorkingDate 
                    ? formatDateRange(previewJoiningDate, previewLastWorkingDate)
                    : "{{JOINING_DATE}} - {{LAST_WORKING_DATE}}"}
                </p>

                {/* Signatory Box Overlay */}
                <div className="absolute top-[88%] left-[77.5%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[15vw]">
                  <div className="w-full border-t border-[#c5a059] pt-[0.5vw] text-center">
                    <p className="text-[0.9vw] font-bold text-stone-800 leading-tight">
                      {previewSignatoryName || "{{SIGNATORY_NAME}}"}
                    </p>
                    <p className="text-[0.75vw] text-stone-500 leading-none mt-[0.2vw]">
                      {previewSignatoryRole || "{{SIGNATORY_ROLE}}"}
                    </p>
                  </div>
                </div>

                {/* Signature Image Overlay */}
                {sigImage && (
                  <img 
                    src={sigImage} 
                    alt="Signature" 
                    className="absolute top-[80%] left-[77.5%] -translate-x-1/2 -translate-y-1/2 h-[4.5vw] object-contain max-w-[10vw]" 
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Action Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-[var(--muted-foreground)] font-mono text-xs">05</span>
                Generate & Export PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button
                className="w-full bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-[var(--background)] font-medium shadow-xs"
                onClick={() => handleGenerate(false)}
                disabled={genState === "loading" || !fullName || !designation}
              >
                {genState === "loading" ? (
                  <>
                    <Loader2 size={15} className="animate-spin mr-2" />
                    Generating Vector PDF...
                  </>
                ) : (
                  "Generate PDF Certificate"
                )}
              </Button>

              {genState === "error" && (
                <div className="alert-error text-xs flex gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {genState === "done" && genResult && (
                <div className="alert-success space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                    {genResult.contractNo} Generated Successfully!
                  </div>
                  <div className="pt-1">
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40" onClick={() => downloadFile(genResult.pdfName)}>
                      <FileDown size={14} /> Download PDF Certificate
                    </Button>
                  </div>
                </div>
              )}

              {/* Duplicate Detection Alert Modal / Banner */}
              {showDuplicateModal && genResult && (
                <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="text-amber-800 dark:text-amber-300 mt-0.5 shrink-0" size={16} />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Certificate Already Exists</h4>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        A certificate record with matching name and dates exists:{" "}
                        <strong className="font-mono text-[11px]">{genResult.contractNo}</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => { downloadFile(genResult.pdfName); setShowDuplicateModal(false); }}>
                      <Download size={12} className="mr-1" /> Download Existing
                    </Button>
                    <Button size="sm" className="bg-amber-800 hover:bg-amber-900 text-white" onClick={() => { handleGenerate(true); setShowDuplicateModal(false); }}>
                      Regenerate
                    </Button>
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
