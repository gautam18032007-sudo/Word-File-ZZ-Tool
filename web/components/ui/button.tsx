import * as React from "react"
import { cn } from "@/lib/utils"

function Button({
  className,
  variant = "default",
  size = "default",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"

  const variants: Record<string, string> = {
    default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    ghost: "hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]",
    secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80",
    destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90",
  }

  const sizes: Record<string, string> = {
    default: "h-11 md:h-9 px-4 py-2",
    sm: "h-10 md:h-8 rounded-md px-3 text-xs",
    lg: "h-12 md:h-10 rounded-md px-8",
    icon: "h-11 w-11 md:h-9 md:w-9",
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    />
  )
}

export { Button }
