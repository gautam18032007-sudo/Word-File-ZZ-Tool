"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Users, LayoutDashboard, Award, Scroll, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand", label: "Brand Contract", icon: FileText },
  { href: "/employee", label: "Employee Contract", icon: Users },
  { href: "/certificate", label: "Certificate", icon: Award },
  { href: "/lor", label: "LOR", icon: Scroll },
];

const aiItems = [
  { href: "/ai-workspace/brand", label: "Brand Assistant", icon: Sparkles },
  { href: "/ai-workspace/employee", label: "Employee Assistant", icon: Sparkles },
  { href: "/ai-workspace/certificate", label: "Certificate Assistant", icon: Sparkles },
  { href: "/ai-workspace/lor", label: "LOR Assistant", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2 px-1 mb-5">
        <div className="h-7 w-7 rounded-md bg-black flex items-center justify-center p-0.5">
          <img src="/logo.png" alt="ZenZebra Logo" className="h-5 w-5 object-contain" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">ZenZebra</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Contract Tool</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
          Generate
        </p>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("nav-item", (href === "/" ? pathname === "/" : pathname.startsWith(href)) && "active")}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className="mb-3">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
          AI Workspace
        </p>
        {aiItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("nav-item", pathname.startsWith(href) && "active")}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-[var(--border)]">
        <p className="px-2 text-[10px] text-[var(--muted-foreground)] leading-tight">
          Internal use only.
          <br />No login required.
        </p>
      </div>
    </aside>
  );
}
