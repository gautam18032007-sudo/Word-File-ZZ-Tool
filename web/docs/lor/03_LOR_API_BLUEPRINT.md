# 03. LOR API Blueprint

**Phase**: Implementation Planning  
**Scope**: All API endpoints required for the LOR module  
**Date**: 2026-07-14

---

## Endpoint Summary

| # | Method | Path | Purpose | New/Shared |
|---|---|---|---|---|
| 1 | `GET` | `/api/sheets/lor` | Load candidate rows from Google Sheet | NEW |
| 2 | `POST` | `/api/generate/lor/draft` | Generate AI recommendation draft via Gemini | NEW |
| 3 | `POST` | `/api/generate/lor` | Compile DOCX + PDF, save to history | NEW |
| 4 | `GET` | `/api/contracts` | Dashboard — combined document list | SHARED (modify) |
| 5 | `GET` | `/api/download` | Download generated files | SHARED (no change) |
| 6 | `GET` | `/api/lor/history` | Retrieve LOR-specific contract history | NEW |

---

## API 1: GET `/api/sheets/lor`

### Purpose
Load and parse candidate rows from the LOR Google Response Sheet.

### File
`web/app/api/sheets/lor/route.ts` — **NEW** (standalone fetcher, does NOT use `sheets.ts`)

### Request

| Param | Location | Type | Required | Description |
|---|---|---|---|---|
| `sheet` | Query string | `string` | No | Full Google Sheet URL or sheet ID override |
| `refresh` | Query string | `string` | No | If `"true"`, bypass any cache |

### Response — Success (200)

```json
{
  "headers": [
    "Timestamp",
    "Full Name",
    "Personal Email ID",
    "Contact Number",
    "Department / Team",
    "Designation / Role",
    "Date of Joining",
    "Last Working Date",
    "Employment Type",
    "Briefly describe your role...",
    "Key projects/tasks...",
    "What qualities or strengths...",
    "Any additional information...",
    "Employee Declaration"
  ],
  "rows": [
    [
      "2026-07-14 10:00:00",
      "Rahul Kumar Jha",
      "rahul@example.com",
      "9876543210",
      "Marketing",
      "Maverick Intern",
      "2026-06-15",
      "2026-09-16",
      "Intern",
      "Managed social media...",
      "Led brand identity campaign...",
      "Strong analytical thinking...",
      "Part of the founding team",
      "I agree"
    ]
  ]
}
```

### Response — Failure

| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "No Google Sheet URL or ID provided for LOR." }` | No `sheet` param and no `GOOGLE_LOR_SHEET_ID` env var |
| `401` | `{ "error": "Sheet is not publicly accessible. Open the sheet → Share → Anyone with the link (Viewer)." }` | CSV export returned non-200 or non-CSV content type |
| `500` | `{ "error": "Could not reach Google Sheets: <details>" }` | Network failure |

### Validation Rules
- If `sheet` param is present, extract sheet ID from URL
- If `sheet` param is absent, use `GOOGLE_LOR_SHEET_ID` env var
- Append `gid` from URL or `GOOGLE_LOR_SHEET_GID` env var
- Fetch `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}`

---

## API 2: POST `/api/generate/lor/draft`

### Purpose
Generate AI recommendation body paragraphs using Google Gemini.

### File
`web/app/api/generate/lor/draft/route.ts` — **NEW**

### Request Body

```json
{
  "designation": "Maverick Intern",
  "department": "Marketing",
  "employmentType": "Intern",
  "responsibilities": "Managed social media content calendars, coordinated with cross-functional teams...",
  "projects": "Led the brand identity campaign, contributed to the corporate website redesign...",
  "strengths": "Strong analytical thinking, excellent communication skills...",
  "additionalInfo": "Was part of the founding team."
}
```

### Field Validation

| Field | Required | Max Length | Validation Rule |
|---|---|---|---|
| `designation` | ✅ Yes | 200 chars | Trim whitespace. Reject if empty. |
| `department` | ✅ Yes | 200 chars | Trim whitespace. Reject if empty. |
| `employmentType` | ❌ Optional | 100 chars | Trim whitespace. Default to empty string. |
| `responsibilities` | ✅ Yes | 2000 chars | Trim. Truncate if over 2000. Reject if empty. |
| `projects` | ✅ Yes | 2000 chars | Trim. Truncate if over 2000. Reject if empty. |
| `strengths` | ✅ Yes | 2000 chars | Trim. Truncate if over 2000. Reject if empty. |
| `additionalInfo` | ❌ Optional | 2000 chars | Trim. Truncate if over 2000. |

### Response — Success (200)

```json
{
  "draft": "During their tenure at ZenZebra, the candidate demonstrated exceptional dedication to their responsibilities in the Marketing department. They were primarily responsible for managing social media content calendars, coordinating with cross-functional teams, and ensuring timely delivery of marketing campaigns.\n\nThe candidate played a pivotal role in the launch of the company's brand identity campaign and contributed significantly to the redesign of the corporate website. Their attention to detail and ability to manage multiple projects simultaneously resulted in consistently high-quality deliverables.\n\nThey consistently demonstrated strong analytical thinking, excellent communication skills, and a proactive approach to problem-solving. Their collaborative nature and willingness to take initiative made them a valued member of the team.\n\nBased on their performance and professional conduct, we are confident that they will be a valuable asset to any organization they choose to be a part of."
}
```

### Response — Failure

| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "Responsibilities field is required." }` | Missing required field |
| `400` | `{ "error": "Projects field is required." }` | Missing required field |
| `400` | `{ "error": "Strengths field is required." }` | Missing required field |
| `500` | `{ "error": "AI service not configured. Set GEMINI_API_KEY in .env" }` | `GEMINI_API_KEY` missing |
| `500` | `{ "error": "AI generated an empty response. Please try again." }` | Gemini returned empty |
| `500` | `{ "error": "AI response too short. Please try again." }` | Response under 50 words |
| `429` | `{ "error": "AI service temporarily unavailable. Try again in a moment." }` | Gemini rate limit |
| `504` | `{ "error": "AI service timed out. Please try again." }` | 30-second timeout exceeded |

### AI Configuration

| Parameter | Value |
|---|---|
| Model | `gemini-2.0-flash` |
| Temperature | `0.4` |
| Top P | `0.9` |
| Max Output Tokens | `1024` |
| Timeout | 30 seconds |

### Security Rules
- **Never send PII**: Name, email, phone, dates are NOT included in the prompt
- **Server-side only**: `GEMINI_API_KEY` is never exposed to the browser
- **Strip markdown**: Remove `**`, `#`, `*`, `-` artifacts from AI output

---

## API 3: POST `/api/generate/lor`

### Purpose
Compile final DOCX + PDF documents, assign contract number, save to history.

### File
`web/app/api/generate/lor/route.ts` — **NEW**

### Request Body

```json
{
  "employeeName": "Rahul Kumar Jha",
  "designation": "Maverick Intern",
  "department": "Marketing",
  "email": "rahul@example.com",
  "joiningDate": "2026-06-15",
  "lastWorkingDate": "2026-09-16",
  "employmentType": "Intern",
  "aiDraft": "During their tenure at ZenZebra...",
  "signatoryName": "Tanmay Jain",
  "signatoryRole": "Co-Founder",
  "forceDuplicate": false
}
```

### Field Validation

| Field | Required | Validation |
|---|---|---|
| `employeeName` | ✅ Yes | Trim. Max 200 chars. Reject if empty. |
| `designation` | ✅ Yes | Trim. Max 200 chars. Reject if empty. |
| `department` | ✅ Yes | Trim. Max 200 chars. Reject if empty. |
| `email` | ❌ Optional | Trim. No format validation (stored for records only). |
| `joiningDate` | ✅ Yes | Must be valid ISO date. Must be ≤ `lastWorkingDate`. |
| `lastWorkingDate` | ✅ Yes | Must be valid ISO date. Must be ≥ `joiningDate`. |
| `employmentType` | ❌ Optional | Trim. Default to empty string. |
| `aiDraft` | ✅ Yes | Reject if empty. Strip HTML tags. |
| `signatoryName` | ✅ Yes | Trim. Default to "Tanmay Jain" if empty. |
| `signatoryRole` | ✅ Yes | Trim. Default to "Co-Founder" if empty. |
| `forceDuplicate` | ❌ Optional | Boolean. Default to `false`. |

### Duplicate Detection Flow

```text
1. Read lor-history.json
2. Find records where employeeName === request.employeeName (exact match)
3. If match found AND forceDuplicate === false:
   → Return { existing: true, id, docxPath, pdfPath }
4. If match found AND forceDuplicate === true:
   → Proceed with new generation (new sequential number)
5. If no match:
   → Proceed with generation
```

### Response — Success (200)

```json
{
  "id": "ZZ-LOR-2026-0001",
  "docxPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx",
  "pdfPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf",
  "existing": false
}
```

### Response — Duplicate Found (200)

```json
{
  "id": "ZZ-LOR-2026-0001",
  "docxPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx",
  "pdfPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf",
  "existing": true
}
```

### Response — Failure

| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "Employee Name is required." }` | Missing name |
| `400` | `{ "error": "Joining Date is required." }` | Missing date |
| `400` | `{ "error": "Joining Date cannot be after Last Working Date." }` | Invalid date range |
| `400` | `{ "error": "AI Draft content is required." }` | Empty draft |
| `500` | `{ "error": "LOR template not found." }` | Missing `lor-template.docx` |
| `500` | `{ "error": "Failed to generate DOCX: <details>" }` | Template rendering error |
| `500` | `{ "error": "Disk space insufficient." }` | `ENOSPC` error |

### Processing Pipeline

```text
1. Validate all required fields
2. Check for duplicates in lor-history.json
3. Call nextContractNumber('LOR') → "ZZ-LOR-2026-0001"
4. Call buildFilename(id, name, 'docx') → "ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx"
5. Format dates: "2026-06-15" → "15th June, 2026"
6. Load lor-template.docx via PizZip
7. Replace placeholders via Docxtemplater
8. Write DOCX to output/lors/
9. Convert to PDF via LibreOffice (if available)
10. Append record to lor-history.json
11. Return { id, docxPath, pdfPath, existing: false }
```

---

## API 4: GET `/api/contracts` (SHARED — MODIFY)

### Current Behavior
Returns combined array of Brand + Employee + Certificate records.

### Required Change
Add LOR records to the combined array.

### Updated Response Structure

```json
{
  "contracts": [
    { "contract_no": "ZZ-LOR-2026-0001", "type": "lor", "party_name": "Rahul Kumar Jha", "generated_at": "2026-07-14T10:30:00.000Z", "docx": "ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx", "pdf": "ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf", "folder": "lors" },
    { "contract_no": "ZZ-BRAND-2026-0030", "type": "brand", ... },
    { "contract_no": "ZZ-EMP-2026-0044", "type": "employee", ... },
    { "contract_no": "ZZ-CERT-2026-0001", "type": "certificate", ... }
  ]
}
```

### LOR Record Normalization Shape

| Field | Source | Mapping |
|---|---|---|
| `contract_no` | `lor.id` | `"ZZ-LOR-2026-0001"` |
| `type` | Hardcoded | `"lor"` |
| `party_name` | `lor.employeeName` | `"Rahul Kumar Jha"` |
| `generated_at` | `lor.generatedAt` | ISO timestamp |
| `docx` | `lor.docxPath` | Filename only (`.split('/').pop()`) |
| `pdf` | `lor.pdfPath` | Filename only (or `""` if null) |
| `folder` | Hardcoded | `"lors"` |

---

## API 5: GET `/api/download` (SHARED — NO CHANGE)

### Current Behavior
Streams any file from `output/{folder}/{file}`.

### LOR Usage
```text
GET /api/download?folder=lors&file=ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx
GET /api/download?folder=lors&file=ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf
```

### No Changes Required
The download route is generic. It accepts any `folder` + `file` combination and serves from `output/{folder}/{file}`. Path traversal protection is already in place. The `lors` folder works automatically.

---

## API 6: GET `/api/lor/history` (NEW)

### Purpose
Retrieve LOR-specific contract history from the local `lor-history.json` storage file.

### File
`web/app/api/lor/history/route.ts` — **NEW**

### Request Schema
Query parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | No | Max number of history records to return (defaults to 500) |
| `offset` | `number` | No | Number of records to skip for pagination (defaults to 0) |

### Response Schema — Success (200)
Returns a list of LOR history records in reverse chronological order:
```json
[
  {
    "id": "ZZ-LOR-2026-0001",
    "employeeName": "Rahul Kumar Jha",
    "designation": "Maverick Intern",
    "department": "Marketing",
    "email": "rahul@example.com",
    "joiningDate": "2026-06-15",
    "lastWorkingDate": "2026-09-16",
    "employmentType": "Intern",
    "signatoryName": "Tanmay Jain",
    "signatoryRole": "Co-Founder",
    "generatedAt": "2026-07-14T10:30:00.000Z",
    "docxPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx",
    "pdfPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf",
    "aiModelVersion": "gemini-2.0-flash"
  }
]
```

### Validation Schema
- `limit` (if provided) must be a positive integer.
- `offset` (if provided) must be a non-negative integer.

### Failure Schema (500)
Returned if there is an error reading the history file (other than the file missing, which is handled gracefully by returning `[]`).
```json
{
  "error": "Failed to read LOR history database: <error-message>"
}
```
