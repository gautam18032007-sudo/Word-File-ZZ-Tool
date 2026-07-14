# 08. LOR Pre-Coding Checklist

**Phase**: Implementation Planning  
**Purpose**: Everything that must exist and be verified BEFORE any LOR application code is written  
**Date**: 2026-07-14

---

## Gate Rule

> [!CAUTION]
> Do NOT write any LOR application code (TypeScript, React, API routes) until EVERY item on this checklist is marked ✅.
>
> Items marked ❌ are currently incomplete and must be resolved first.

---

## 1. Environment Variables

### `.env` File (Project Root)

| Variable | Required | Current Status | Action |
|---|---|---|---|
| `GOOGLE_LOR_SHEET_ID` | ✅ Yes | ❌ Not present | Add the Google Sheet ID containing LOR form responses |
| `GOOGLE_LOR_SHEET_GID` | ✅ Yes | ❌ Not present | Add the GID (tab number) within the sheet |
| `GEMINI_API_KEY` | ✅ Yes | ❌ Not present | Obtain from [Google AI Studio](https://aistudio.google.com/apikey) and add to `.env` |
| `LIBREOFFICE_PATH` | ❌ Optional | ✅ Already present | `C:\Program Files\LibreOffice\program\soffice.exe` — needed for PDF conversion only |
| `CONTRACT_PREFIX` | ❌ Optional | ✅ Already present | `ZZ` — used by numbering engine |

### Verification
```text
Check: Open .env and confirm these 3 lines exist:
  GOOGLE_LOR_SHEET_ID=<actual-id>
  GOOGLE_LOR_SHEET_GID=<actual-gid>
  GEMINI_API_KEY=<actual-key>

All 3 must have real values, not placeholders.
```

---

## 2. Google Sheet Setup

| Requirement | Current Status | Action |
|---|---|---|
| Google Form created for LOR responses | ❓ Unknown | Create a Google Form with all 14 fields (see doc 04) |
| Google Form linked to a Response Sheet | ❓ Unknown | Verify responses appear in a Google Spreadsheet |
| Sheet shared as "Anyone with the link — Viewer" | ❓ Unknown | Open Sheet → Share → General Access → "Anyone with the link" → Viewer |
| Sheet contains at least 1 test row | ❓ Unknown | Submit a test response through the Google Form |
| Sheet ID matches `GOOGLE_LOR_SHEET_ID` in `.env` | ❓ Unknown | Extract ID from the sheet URL |

### Expected Google Form Fields

| # | Field | Type |
|---|---|---|
| 1 | Full Name | Short answer |
| 2 | Personal Email ID | Short answer |
| 3 | Contact Number | Short answer |
| 4 | Department / Team | Short answer |
| 5 | Designation / Role | Short answer |
| 6 | Date of Joining | Date |
| 7 | Last Working Date | Date |
| 8 | Employment Type | Short answer or dropdown |
| 9 | Briefly describe your role and key responsibilities | Paragraph |
| 10 | Key projects/tasks you handled | Paragraph |
| 11 | What qualities or strengths would you like highlighted? | Paragraph |
| 12 | Any additional information for the recommendation? | Paragraph |
| 13 | Employee Declaration | Checkbox or short answer |

### Verification
```text
Check: Open the Google Sheet URL in a browser.
  - Rows visible? Yes → sheet is shared correctly
  - At least one row with a name? Yes → test data exists
  - Headers match the expected fields above? Yes → mapping will work
```

---

## 3. npm Dependencies

| Package | Required | Current Status | Action |
|---|---|---|---|
| `docxtemplater` | ✅ Yes | ❌ Not in `package.json` | Run `npm install docxtemplater` |
| `@google/generative-ai` | ✅ Yes | ❌ Not in `package.json` | Run `npm install @google/generative-ai` |
| `pizzip` | ✅ Yes | ✅ Already installed | No action |
| `next` | ✅ Yes | ✅ Already installed (16.2.10) | No action |
| `lucide-react` | ✅ Yes | ✅ Already installed | No action |

### Installation Command
```bash
npm install docxtemplater @google/generative-ai
```

### Verification
```text
Check: Run `npm run build`
  - Zero TypeScript errors? Yes → dependencies installed correctly
  - package.json lists both new packages? Yes → confirmed
```

---

## 4. DOCX Template

| Requirement | Current Status | Action |
|---|---|---|
| Directory `web/templates/lor/` exists | ❌ Does not exist | Create the directory |
| File `lor-template.docx` exists | ❌ Does not exist | Create in Microsoft Word or LibreOffice Writer |
| ZenZebra letterhead/logo in header | ❌ Not created | Design the header with company branding |
| All 8 placeholder tags present | ❌ Not created | Insert each tag in the correct location |

### Required Placeholders

| Tag | Location in Document | Example Value |
|---|---|---|
| `{{NAME}}` | Introduction paragraph + closing statement | `Rahul Kumar Jha` |
| `{{DESIGNATION}}` | Introduction paragraph | `Maverick Intern` |
| `{{DEPARTMENT}}` | Introduction paragraph | `Marketing` |
| `{{JOINING_DATE}}` | Introduction paragraph | `15th June, 2026` |
| `{{LAST_WORKING_DATE}}` | Introduction paragraph | `16th September, 2026` |
| `{{AI_LOR_CONTENT}}` | Body section (multi-paragraph) | AI-generated prose |
| `{{SIGNATORY_NAME}}` | Signature block | `Tanmay Jain` |
| `{{SIGNATORY_ROLE}}` | Signature block | `Co-Founder` |

### Template Document Structure
```text
[Company Letterhead]

To Whom It May Concern,

This is to certify that {{NAME}} was associated with Bohemian Curations
Private Limited (ZenZebra) as a {{DESIGNATION}} in the {{DEPARTMENT}}
department from {{JOINING_DATE}} to {{LAST_WORKING_DATE}}.

{{AI_LOR_CONTENT}}

We highly recommend {{NAME}} for future academic and professional opportunities.

Regards,

{{SIGNATORY_NAME}}
{{SIGNATORY_ROLE}}
ZenZebra
```

### Verification
```text
Check: Open lor-template.docx in Microsoft Word or LibreOffice Writer
  - All 8 {{PLACEHOLDER}} tags visible? Yes
  - Professional layout with letterhead? Yes
  - File is valid .docx (not .doc or .odt)? Yes
  - Tags use double braces {{ }} with no spaces inside? Yes
```

---

## 5. History Storage

| Requirement | Current Status | Action |
|---|---|---|
| `output/` directory exists | ✅ Already exists | No action |
| `output/lors/` can be created at runtime | ✅ Auto-created by `mkdirSync` | No action (code creates it) |
| `output/lor-history.json` can be created at runtime | ✅ Auto-created by `writeFileSync` | No action (code creates it) |
| `output/sequence.json` exists | ✅ Already exists | No action (LOR key auto-created) |

### No Manual Action Required
All LOR storage paths are auto-created at runtime. Nothing needs to be manually created.

---

## 6. Output Folders

| Path | Type | Status | Gitignored? |
|---|---|---|---|
| `output/` | Directory | ✅ Exists | ✅ Yes |
| `output/lors/` | Directory | Auto-created | ✅ Yes (covered by `output/` pattern) |
| `output/lor-history.json` | File | Auto-created | ✅ Yes (covered by `output/` pattern) |

---

## 7. Existing Module Verification

Before starting LOR code, verify all existing modules are working:

| Check | Command / Action | Expected Result |
|---|---|---|
| Build passes | `npm run build` | Zero errors |
| Dev server starts | `npm run dev` | Server at http://localhost:3000 |
| Dashboard loads | Navigate to `/` | Shows metric cards |
| Brand page loads | Navigate to `/brand` | No errors |
| Employee page loads | Navigate to `/employee` | No errors |
| Certificate page loads | Navigate to `/certificate` | No errors |
| LOR stub loads | Navigate to `/lor` | Shows "Coming Soon" |

---

## 8. Gemini API Verification

| Check | Action | Expected Result |
|---|---|---|
| API key is valid | Test at [Google AI Studio](https://aistudio.google.com/) | Can generate text |
| Model is available | Check `gemini-2.0-flash` in AI Studio | Model is listed and operational |
| Rate limits are adequate | Check quota in Google Cloud Console | Sufficient for expected usage |

---

## Master Gate Checklist

| # | Item | Status | Blocker? |
|---|---|---|---|
| 1 | `GOOGLE_LOR_SHEET_ID` in `.env` | ❌ | 🔴 Yes |
| 2 | `GOOGLE_LOR_SHEET_GID` in `.env` | ❌ | 🔴 Yes |
| 3 | `GEMINI_API_KEY` in `.env` | ❌ | 🔴 Yes |
| 4 | Google Sheet shared publicly | ❓ | 🔴 Yes |
| 5 | Google Sheet has test data | ❓ | 🔴 Yes |
| 6 | `npm install docxtemplater` done | ❌ | 🔴 Yes |
| 7 | `npm install @google/generative-ai` done | ❌ | 🔴 Yes |
| 8 | `lor-template.docx` created with 8 placeholders | ❌ | 🔴 Yes |
| 9 | `npm run build` passes | ✅ | — |
| 10 | Existing modules verified working | ✅ | — |

**Gate Status: ❌ NOT READY — 8 items require action before coding begins.**
