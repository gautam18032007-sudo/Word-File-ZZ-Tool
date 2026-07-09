"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Users, History, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/brand", label: "Brand Contract", icon: FileText },
  { href: "/employee", label: "Employee Contract", icon: Users },
  { href: "/history", label: "History", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2 px-1 mb-5">
        <div className="h-7 w-7 rounded-md bg-[var(--foreground)] flex items-center justify-center">
          <Zap size={14} className="text-[var(--primary-foreground)]" />
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
