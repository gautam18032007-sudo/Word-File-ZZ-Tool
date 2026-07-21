"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, FileText, RefreshCw, AlertCircle, LayoutDashboard, FileSpreadsheet, Users, Calendar, Award, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContractRecord } from "@/lib/types";

function fmt(n: number | undefined | null): string {
  if (!n) return "—";
  const s = String(Math.abs(Math.round(n)));
  if (s.length <= 3) return `₹${s}`;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return `₹${parts.join(",")},${last3}`;
}

function shortDate(iso: string): string {
  return iso?.slice(0, 10) ?? "—";
}

export default function DashboardPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [lorCount, setLorCount] = useState<number>(0);
  const [piCount, setPiCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load contracts");
      setContracts(data.contracts || []);

      const lorRes = await fetch("/api/lor/history");
      const lorData = await lorRes.json();
      if (lorRes.ok) {
        setLorCount(Array.isArray(lorData) ? lorData.length : 0);
      }

      const piRes = await fetch("/api/pi/history");
      const piData = await piRes.json();
      if (piRes.ok) {
        setPiCount(Array.isArray(piData) ? piData.length : 0);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Compute metrics in Asia/Kolkata (IST) timezone
  const brandCount = contracts.filter((c) => c.type === "brand").length;
  const employeeCount = contracts.filter((c) => c.type === "employee").length;
  const certificateCount = contracts.filter((c) => c.type === "certificate").length;
  const totalDocuments = brandCount + employeeCount + certificateCount + lorCount + piCount;

  const todayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // MM/DD/YYYY or similar
  
  // Format MM/DD/YYYY to YYYY-MM-DD for comparison
  const [m, d, y] = todayStr.split("/");
  const todayIso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const thisMonthIso = `${y}-${m.padStart(2, "0")}`;

  const todaysCount = contracts.filter(
    (c) => shortDate(c.generated_at) === todayIso
  ).length;

  const certsThisMonth = contracts.filter(
    (c) => c.type === "certificate" && (c.generated_at ?? "").startsWith(thisMonthIso)
  ).length;

  // Breakdown by Type
  const certTypes: Record<string, number> = {};
  contracts.filter((c) => c.type === "certificate").forEach((c) => {
    const t = c.certificateType ?? "UNKNOWN";
    certTypes[t] = (certTypes[t] || 0) + 1;
  });

  // Top templates
  const certTemplates: Record<string, number> = {};
  contracts.filter((c) => c.type === "certificate").forEach((c) => {
    const t = c.template ?? "Unknown Template";
    certTemplates[t] = (certTemplates[t] || 0) + 1;
  });

  function downloadFile(filename: string, folder: string) {
    const a = document.createElement("a");
    a.href = `/api/download?folder=${folder}&file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Overview of contract metrics and recent generation history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="alert-error flex gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Total Documents
            </CardTitle>
            <LayoutDashboard size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : totalDocuments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Brand Contracts
            </CardTitle>
            <FileSpreadsheet size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : brandCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Employee Contracts
            </CardTitle>
            <Users size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : employeeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Certificates
            </CardTitle>
            <Award size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : certificateCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              LOR Generated
            </CardTitle>
            <Award size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : lorCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              PI Generated
            </CardTitle>
            <Receipt size={15} className="text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : piCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading && (
            <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">Loading…</div>
          )}
          {!loading && contracts.length === 0 && (
            <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">
              No contracts generated yet.
            </div>
          )}
          {!loading && contracts.length > 0 && (
            <table className="w-full text-sm data-table">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Contract No.", "Type", "Party Name", "Amount / CTC", "Date", "Files"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-3 pl-5 font-mono text-xs font-semibold">{c.contract_no}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === "brand" ? "default" : c.type === "employee" ? "secondary" : "outline"}>
                        {c.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate" title={c.party_name}>{c.party_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.type === "certificate" ? "—" : c.type === "brand" ? fmt(c.total_amount) : fmt(c.annual_ctc)}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] text-xs">{shortDate(c.generated_at)}</td>
                    <td className="px-4 py-3 pr-5">
                      <div className="flex gap-1.5">
                        {c.docx && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => downloadFile(c.docx, c.folder)}
                          >
                            <FileText size={11} />
                            DOCX
                          </Button>
                        )}
                        {c.pdf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => downloadFile(c.pdf!, c.folder)}
                          >
                            <Download size={11} />
                            PDF
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Additional Certificate Analytics */}
      {!loading && certificateCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Certificates This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{certsThisMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                By Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {Object.entries(certTypes).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="text-[var(--muted-foreground)] uppercase font-semibold">{type}</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Top Templates Used
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {Object.entries(certTemplates).slice(0, 3).map(([tpl, count]) => (
                <div key={tpl} className="flex justify-between">
                  <span className="text-[var(--muted-foreground)] truncate pr-2" title={tpl}>{tpl}</span>
                  <span className="font-mono font-bold shrink-0">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && contracts.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Showing {contracts.length} document{contracts.length !== 1 ? "s" : ""} · Stored in{" "}
          <code className="font-mono">output/contracts.json</code>, <code className="font-mono">output/certificates.json</code>, <code className="font-mono">output/lor-history.json</code>, and <code className="font-mono">output/pi-history.json</code>
        </p>
      )}
    </div>
  );
}
