# 08. Template Engine — LOR Module

This document defines the DOCX template system used for generating the final Letter of Recommendation document.

## 1. Template Location

```text
web/templates/lor/lor-template.docx
```

This is a standard Microsoft Word `.docx` file containing the company letterhead, static text sections, and placeholder tags.

## 2. Template Library
The system uses the same DOCX templating stack as the Employee Contract module:
- **`pizzip`**: Reads and writes the `.docx` zip container. *(Already in `package.json`)*
- **`docxtemplater`**: Parses `{{PLACEHOLDER}}` tags inside the Word document XML and replaces them with dynamic values.

> [!IMPORTANT]
> `docxtemplater` is **not** currently in the project's `package.json`. It must be installed before DOCX generation can work:
> ```bash
> npm install docxtemplater
> ```
>
> Note: The existing Employee and Brand modules use a different templating approach via `lib/template.ts` (direct XML string replacement with PizZip). The LOR module uses `docxtemplater` for cleaner placeholder handling.

## 3. Placeholder Tags

The following placeholders must exist inside `lor-template.docx`:

| Placeholder | Replaced With | Example Value |
|---|---|---|
| `{{NAME}}` | Employee's full name | `Rahul Kumar Jha` |
| `{{DESIGNATION}}` | Employee's role/title | `Maverick Intern` |
| `{{DEPARTMENT}}` | Employee's department | `Marketing` |
| `{{JOINING_DATE}}` | Formatted joining date | `15th June, 2026` |
| `{{LAST_WORKING_DATE}}` | Formatted exit date | `16th September, 2026` |
| `{{AI_LOR_CONTENT}}` | AI-generated body text | *(multi-paragraph prose)* |
| `{{SIGNATORY_NAME}}` | Authorized signatory name | `Tanmay Jain` |
| `{{SIGNATORY_ROLE}}` | Signatory's designation | `Co-Founder` |

## 4. Template Document Layout

```text
┌──────────────────────────────────────────────┐
│  [ZenZebra Logo — embedded image in header]  │
│                                               │
│  To Whom It May Concern,                      │
│                                               │
│  This is to certify that {{NAME}} was         │
│  associated with Bohemian Curations Private   │
│  Limited (ZenZebra) as a {{DESIGNATION}}      │
│  in the {{DEPARTMENT}} department from        │
│  {{JOINING_DATE}} to {{LAST_WORKING_DATE}}.   │
│                                               │
│  {{AI_LOR_CONTENT}}                           │
│                                               │
│  We highly recommend {{NAME}} for future      │
│  academic and professional opportunities.     │
│                                               │
│  Regards,                                     │
│                                               │
│  {{SIGNATORY_NAME}}                           │
│  {{SIGNATORY_ROLE}}                           │
│  ZenZebra                                    │
└──────────────────────────────────────────────┘
```

## 5. Template Replacement Logic

```typescript
// Pseudocode for DOCX template rendering
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const zip = new PizZip(templateBuffer);
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,   // Converts \n in AI content to Word line breaks
});

doc.render({
  NAME: "Rahul Kumar Jha",
  DESIGNATION: "Maverick Intern",
  DEPARTMENT: "Marketing",
  JOINING_DATE: "15th June, 2026",
  LAST_WORKING_DATE: "16th September, 2026",
  AI_LOR_CONTENT: aiDraftText,
  SIGNATORY_NAME: "Tanmay Jain",
  SIGNATORY_ROLE: "Co-Founder",
});

const outputBuffer = doc.getZip().generate({ type: "nodebuffer" });
```

## 6. Multi-line AI Content Handling
The `{{AI_LOR_CONTENT}}` placeholder contains multiple paragraphs. The `linebreaks: true` option in `docxtemplater` ensures that `\n` characters in the AI draft are converted to proper Word paragraph breaks (`<w:br/>`), preserving the paragraph structure of the AI output.

## 7. Template Maintenance Rules
- The template file is **never** modified by the system at runtime.
- Template updates are manual: edit the `.docx` in Microsoft Word or LibreOffice Writer, save it, and replace the file.
- Always keep a backup of the template before making changes.
