"use client";

import { Download, FileDown, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToCSV, exportToPDF, exportToXLSX } from "@/lib/exportUtils";

interface ExportButtonProps {
  data: any[];
  filename?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function ExportButton({
  data,
  filename = "export",
  variant = "outline",
  size = "sm",
  className,
  label = "Export",
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 p-1">
        <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">Export as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportToPDF(data, filename)} className="cursor-pointer gap-2">
          <FileDown className="h-4 w-4 text-rose-500" />
          <span>PDF (.pdf)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToXLSX(data, filename)} className="cursor-pointer gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(data, filename)} className="cursor-pointer gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span>CSV (.csv)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!data || data.length === 0) return;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          }}
          className="cursor-pointer gap-2"
        >
          <FileJson className="h-4 w-4 text-orange-500" />
          <span>JSON (.json)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
