# 15. Edge Cases — LOR Module

This document lists known edge cases and their mitigation strategies.

## 1. Data Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **Very long name** | Employee name exceeds 80 characters | Truncate display in preview; full name used in DOCX. Auto-scale font if needed. |
| **Special characters in name** | Name contains accents (`é`, `ñ`), apostrophes (`O'Brien`), or hyphens | Pass through as-is. `docxtemplater` handles Unicode natively. |
| **Empty responsibilities** | Employee left the Google Form field blank | Validation blocks AI generation. Error: "Responsibilities field is required." |
| **Empty projects** | Employee left the projects field blank | Validation blocks AI generation. Error: "Projects field is required." |
| **Very long text fields** | Responsibilities or projects field exceeds 2000 characters | Truncate to 2000 characters before sending to AI. Show warning in UI. |
| **Date format variations** | Sheet contains dates like `15/06/2026`, `June 15, 2026`, `2026-06-15` | Normalize all date formats using `new Date()` parsing. If parsing fails, show raw value and let user correct manually. |

## 2. Date Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **Same day join/exit** | Joining Date = Last Working Date | Allow it (valid for single-day engagements). |
| **Future dates** | Last Working Date is in the future | Allow it (LOR can be prepared before the employee's last day). |
| **Joining after exit** | Joining Date > Last Working Date | Block generation. Error: "Joining Date cannot be after Last Working Date." |
| **Missing dates** | Date fields are empty in the sheet | Validation blocks generation. Error: "Joining Date is required." |

## 3. AI Generation Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **AI returns empty** | Gemini API returns an empty string | Return error 500: "AI generated an empty response. Please try again." |
| **AI returns markdown** | Gemini adds `**bold**` or `# heading` formatting | Strip markdown syntax from the response before inserting into the editor. |
| **AI timeout** | Gemini takes longer than 30 seconds | Abort the request after 30 seconds. Return 504: "AI service timed out." |
| **AI returns irrelevant content** | Gemini ignores the prompt structure | The editable draft area allows HR to manually fix or regenerate. |
| **API key expired** | `GEMINI_API_KEY` is invalid or revoked | Return 500: "AI service authentication failed. Check GEMINI_API_KEY." |

## 4. File System Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **Output directory missing** | `output/lors/` does not exist | Create it with `fs.mkdirSync(dir, { recursive: true })` before writing. |
| **Disk full** | No space left to write files | Catch `ENOSPC` error. Return 500: "Disk space insufficient." |
| **File already exists** | Same filename collision (should not happen with sequential numbering) | Overwrite the file. Sequential numbering prevents real collisions. |
| **LibreOffice not installed** | PDF conversion fails | Skip PDF. Return DOCX only with `pdfPath: null`. Show warning in UI. |
| **LibreOffice hangs** | Conversion process does not complete | Kill the process after 60 seconds. Return DOCX only. |

## 5. UI Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **No candidates loaded** | Google Sheet is empty or inaccessible | Show the SheetLoader error panel with sharing instructions. |
| **Rapid double-click on Generate** | User clicks "Generate" button twice quickly | Disable the button immediately on first click. Re-enable after completion. |
| **Browser refresh during generation** | User refreshes the page mid-generation | The server-side generation completes independently. The file is saved. The user can find it in history on reload. |
| **Very long AI draft** | AI generates 500+ words | The textarea scrolls. No hard limit on display. The DOCX template handles multi-page content. |

## 6. Duplicate LOR Edge Cases

| Edge Case | Scenario | Mitigation |
|---|---|---|
| **Same employee, second LOR** | HR generates another LOR for the same person | Show confirmation modal. If confirmed, create with new sequential number. |
| **Name variations** | "Rahul Kumar Jha" vs "Rahul K. Jha" | Duplicate detection uses exact name match. Variations create separate records. |
