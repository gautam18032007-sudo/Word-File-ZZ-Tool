# 12. API Contracts — LOR Module

This document specifies every API endpoint required for the LOR module, including request/response schemas.

## 1. API Endpoint Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/sheets/lor` | Load candidate rows from Google Sheet |
| `POST` | `/api/generate/lor/draft` | Generate AI recommendation draft |
| `POST` | `/api/generate/lor` | Compile DOCX + PDF and save history |
| `GET` | `/api/contracts` | Dashboard counts (extended to include LOR) |
| `GET` | `/api/download` | Download generated files (existing, shared) |

---

## 2. GET `/api/sheets/lor`

### Purpose
Load and parse rows from the LOR Google Response Sheet.

### Query Parameters
| Param | Type | Required | Description |
|---|---|---|---|
| `sheet` | `string` | No | Full Google Sheet URL override. Falls back to `GOOGLE_LOR_SHEET_ID` env var. |
| `refresh` | `boolean` | No | If `true`, bypass cache and force re-fetch. |

### Success Response (200)
```json
{
  "headers": ["Timestamp", "Full Name", "Personal Email ID", ...],
  "rows": [
    ["2026-07-14 10:00:00", "Rahul Kumar Jha", "rahul@example.com", ...],
    ["2026-07-14 11:00:00", "Priya Sharma", "priya@example.com", ...]
  ]
}
```

### Error Responses
| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "No Google Sheet URL or ID provided for lor." }` | No sheet URL or env ID |
| `401` | `{ "error": "Sheet is not publicly accessible..." }` | Private sheet, no service account |

---

## 3. POST `/api/generate/lor/draft`

### Purpose
Generate an AI recommendation body draft using Gemini API.

### Request Body
```json
{
  "designation": "Maverick Intern",
  "department": "Marketing",
  "employmentType": "Intern",
  "responsibilities": "Managed social media content calendars...",
  "projects": "Led the brand identity campaign...",
  "strengths": "Strong analytical thinking, excellent communication...",
  "additionalInfo": "Was part of the founding team."
}
```

### Success Response (200)
```json
{
  "draft": "During their tenure at ZenZebra, the candidate demonstrated exceptional..."
}
```

### Error Responses
| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "Responsibilities field is required." }` | Missing required field |
| `500` | `{ "error": "AI service not configured." }` | Missing `GEMINI_API_KEY` |
| `429` | `{ "error": "AI rate limit exceeded." }` | Gemini API throttling |

---

## 4. POST `/api/generate/lor`

### Purpose
Compile the final DOCX + PDF documents and save to history.

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

### Success Response (200)
```json
{
  "id": "ZZ-LOR-2026-0001",
  "docxPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx",
  "pdfPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf",
  "existing": false
}
```

### Duplicate Response (200, `existing: true`)
```json
{
  "id": "ZZ-LOR-2026-0001",
  "docxPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx",
  "pdfPath": "output/lors/ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf",
  "existing": true
}
```

### Error Responses
| Status | Body | Trigger |
|---|---|---|
| `400` | `{ "error": "Employee Name is required." }` | Missing mandatory field |
| `400` | `{ "error": "Joining Date cannot be after Last Working Date." }` | Invalid date range |
| `500` | `{ "error": "LOR template not found." }` | Missing template file |

---

## 5. Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `GOOGLE_LOR_SHEET_ID` | Default Google Sheet ID for LOR responses | `1_T1FNjR07-t03vgo138ZI-QJCEu9vbsqbOZQkkf_tYA` |
| `GOOGLE_LOR_SHEET_GID` | Tab/GID within the sheet | `1843964171` |
| `GEMINI_API_KEY` | Google Gemini API key for AI draft | `AIzaSy...` |
| `LIBREOFFICE_PATH` | Path to LibreOffice binary for PDF conversion | `C:\\Program Files\\LibreOffice\\program\\soffice.exe` |
