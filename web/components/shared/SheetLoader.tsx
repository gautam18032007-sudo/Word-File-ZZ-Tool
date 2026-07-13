"use client";

import { useState, useEffect } from "react";
import { Loader2, Search, KeyRound, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SheetLoaderProps {
  placeholder?: string;
  onLoad: (sheetUrl: string, headers: string[], rows: string[][]) => Promise<void>;
  loadedCount?: number;
  storageKey: string;
}

function isAccessError(msg: string): boolean {
  return msg.toLowerCase().includes("not publicly accessible") ||
    msg.toLowerCase().includes("not public");
}

export function SheetLoader({ placeholder, onLoad, loadedCount, storageKey }: SheetLoaderProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const loadSheet = async (targetUrl: string) => {
    setState("loading");
    setError("");
    try {
      const type = 
        storageKey.includes("brand") ? "brand" : 
        storageKey.includes("certificate") ? "certificate" : "employee";
      const res = await fetch(`/api/sheets/${type}?sheet=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      
      const headers = data.headers ?? [];
      const rows = data.rows ?? [];
      await onLoad(targetUrl, headers, rows);
      localStorage.setItem(storageKey, targetUrl);
      setState("done");
    } catch (e: any) {
      setError(e.message || String(e));
      setState("error");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setUrl(saved);
      loadSheet(saved);
    } else {
      // No manual override saved — auto-load using the env-configured sheet
      // ID (GOOGLE_BRAND_SHEET_ID / GOOGLE_EMPLOYEE_SHEET_ID) so the page
      // works with zero user input, per the Google Form → Response Sheet flow.
      loadSheet("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  async function handleLoad() {
    if (!url.trim()) return;
    await loadSheet(url.trim());
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Sheet URL (optional override)</Label>
        <p className="text-xs text-[var(--muted-foreground)]">
          Records load automatically from the configured Response Sheet. Paste a different
          sheet URL here only if you need to load from somewhere else.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={placeholder ?? "https://docs.google.com/spreadsheets/d/…"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          />
          <Button
            onClick={handleLoad}
            disabled={state === "loading" || !url.trim()}
            size="icon"
            className="shrink-0"
          >
            {state === "loading" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}
          </Button>
        </div>
      </div>

      {state === "done" && typeof loadedCount === "number" && (
        <p className="text-xs text-[var(--muted-foreground)]">
          ✓ {loadedCount} record{loadedCount !== 1 ? "s" : ""} loaded
        </p>
      )}

      {state === "error" && (
        <div className="space-y-2">
          {isAccessError(error) ? (
            <div className="border border-[var(--border)] rounded-md overflow-hidden text-xs">
              {/* Header */}
              <div className="px-3 py-2 bg-[oklch(0.97_0.02_27)] border-b border-[var(--border)]">
                <p className="font-semibold text-[oklch(0.4_0.15_27)]">
                  Sheet is not publicly accessible
                </p>
              </div>
              {/* Option A */}
              <div className="px-3 py-2.5 border-b border-[var(--border)]">
                <div className="flex items-start gap-2">
                  <Globe size={13} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Option A — Make the sheet public (easiest)</p>
                    <ol className="mt-1 text-[var(--muted-foreground)] space-y-0.5 list-decimal list-inside">
                      <li>Open the sheet in Google Sheets</li>
                      <li>Click <strong>Share</strong> (top right)</li>
                      <li>Under <em>General access</em>, choose <strong>Anyone with the link</strong></li>
                      <li>Set role to <strong>Viewer</strong> → Done</li>
                    </ol>
                    <p className="mt-1.5 text-[var(--muted-foreground)]">Then paste the URL again and click Load.</p>
                  </div>
                </div>
              </div>
              {/* Option B */}
              <div className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <KeyRound size={13} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Option B — Service account (for private/Workspace sheets)</p>
                    <ol className="mt-1 text-[var(--muted-foreground)] space-y-0.5 list-decimal list-inside">
                      <li>Create a service account in Google Cloud Console</li>
                      <li>Download the JSON key as <code className="font-mono bg-[var(--muted)] px-1 rounded">credentials.json</code></li>
                      <li>Place it at: <code className="font-mono bg-[var(--muted)] px-1 rounded">CONTRACT TOOL\credentials.json</code></li>
                      <li>Share the sheet with the service account email (Viewer)</li>
                    </ol>
                    <p className="mt-1.5 text-[var(--muted-foreground)]">The tool will automatically use it as a fallback.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert-error text-xs whitespace-pre-wrap">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
