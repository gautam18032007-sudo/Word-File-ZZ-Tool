"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, FileText, RefreshCw, AlertCircle } from "lucide-react";
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

export default function HistoryPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setContracts(data.contracts);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
          <h1 className="text-xl font-semibold tracking-tight">History</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            All generated contracts. Click to download DOCX or PDF.
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

      <Card>
        <CardContent className="p-0">
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
                  {["Contract No.", "Type", "Name", "Amount", "Date", "Files"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors">
                    <td className="px-4 py-3 pl-5 font-mono text-xs font-semibold">{c.contract_no}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.type === "brand" ? "default" : "secondary"}>
                        {c.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate" title={c.party_name}>{c.party_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.type === "brand" ? fmt(c.total_amount) : fmt(c.annual_ctc)}
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

      {contracts.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Showing {contracts.length} contract{contracts.length !== 1 ? "s" : ""} · Stored in{" "}
          <code className="font-mono">output/contracts.json</code>
        </p>
      )}
    </div>
  );
}
