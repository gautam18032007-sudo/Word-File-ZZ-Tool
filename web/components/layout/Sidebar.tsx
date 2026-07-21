"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Users, LayoutDashboard, Award, Scroll, Receipt, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "@/components/ui/theme-toggle";

const navItems: { href: string; label: string; icon: any; wip?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand", label: "Brand Contract", icon: FileText },
  { href: "/employee", label: "Employee Contract", icon: Users },
  { href: "/certificate", label: "Certificate", icon: Award },
  { href: "/lor", label: "LOR", icon: Scroll },
  { href: "/pi", label: "Proforma Invoice", icon: Receipt },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 left-4 z-50 md:hidden p-2 rounded-md border border-[var(--border)] bg-[var(--background)] cursor-pointer shadow-sm hover:bg-[var(--accent)] transition-colors flex items-center justify-center h-10 w-10"
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn("sidebar", isOpen && "open")}>
        {/* Logo / Brand */}
        <div className="flex items-center gap-2 px-1 mb-5 mt-10 md:mt-0">
          <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="ZenZebra Logo" className="h-5 w-5 object-contain invert dark:invert-0" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">ZenZebra</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Contract Tool</p>
          </div>
        </div>

        <div className="mb-3 space-y-0.5">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
            Generate
          </p>
          {navItems.map(({ href, label, icon: Icon, wip }) => (
            wip ? (
              <div
                key={label}
                className="nav-item opacity-60 cursor-not-allowed justify-between"
                title="Sunayana di — Work in Progress"
              >
                <div className="flex items-center gap-2">
                  <Icon size={15} />
                  <span>{label}</span>
                </div>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  WIP
                </span>
              </div>
            ) : (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={cn("nav-item", (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "active")}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            )
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-[var(--border)] space-y-3">
          <div>
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Theme
            </p>
            <ThemeToggle />
          </div>
          <p className="px-1 text-[10px] text-[var(--muted-foreground)] leading-tight">
            Internal use only.
            <br />No login required.
          </p>
        </div>
      </aside>
    </>
  );
}
