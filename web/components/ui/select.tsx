import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "flex h-9 w-full rounded-md border border-[var(--input)] bg-transparent pl-3 pr-8 py-1 text-sm shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer",
          className
        )}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  )
}

export { Select }
