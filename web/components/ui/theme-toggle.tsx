"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const applyTheme = (mode: Theme) => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else {
      // System mode
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleSelect = (mode: Theme) => {
    setTheme(mode);
    localStorage.setItem("theme", mode);
    applyTheme(mode);
  };

  if (!mounted) {
    return <div className="h-8 w-full bg-[var(--muted)] rounded-md animate-pulse" />;
  }

  return (
    <div className={cn("flex items-center gap-1 p-1 bg-[var(--muted)] border border-[var(--border)] rounded-md text-xs", className)}>
      <button
        type="button"
        onClick={() => handleSelect("light")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded transition-all cursor-pointer font-medium text-[11px]",
          theme === "light"
            ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        title="Light theme"
      >
        <Sun size={13} />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("dark")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded transition-all cursor-pointer font-medium text-[11px]",
          theme === "dark"
            ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        title="Dark theme"
      >
        <Moon size={13} />
        <span>Dark</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect("system")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded transition-all cursor-pointer font-medium text-[11px]",
          theme === "system"
            ? "bg-[var(--background)] text-[var(--foreground)] shadow-xs"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
        title="System default"
      >
        <Monitor size={13} />
        <span>System</span>
      </button>
    </div>
  );
}
