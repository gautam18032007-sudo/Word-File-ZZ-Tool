"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/**
 * Export array of objects to CSV file with UTF-8 BOM encoding
 * (Ensures special characters like ₹ INR currency symbols open cleanly in Excel).
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0 || typeof window === "undefined") return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          const stringValue = typeof value === "string" ? value : JSON.stringify(value);
          // Escape double quotes and wrap field in double quotes if it contains commas or newlines
          return `"${stringValue.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];

  // Add UTF-8 BOM (\uFEFF) so Excel opens UTF-8 characters properly
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.endsWith(".csv") ? filename : `${filename}.csv`}`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Export array of objects to native Excel (.xlsx) file using SheetJS
 */
export function exportToXLSX(data: any[], filename: string) {
  if (!data || data.length === 0 || typeof window === "undefined") return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  
  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}

/**
 * Export array of objects to styled PDF document with auto-formatted data table
 */
export function exportToPDF(data: any[], filename: string, title?: string) {
  if (!data || data.length === 0 || typeof window === "undefined") return;

  const doc = new jsPDF();
  const headers = Object.keys(data[0]);
  const body = data.map((item) => headers.map((header) => item[header]));

  const documentTitle = title || filename.replace(/[-_]/g, " ").toUpperCase();

  // Add Header Title & Date
  doc.setFontSize(16);
  doc.setTextColor(33, 37, 41);
  doc.text(documentTitle, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(108, 117, 125);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 14, 22);

  autoTable(doc, {
    head: [headers.map((h) => h.toUpperCase())],
    body: body,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(cleanFilename);
}
