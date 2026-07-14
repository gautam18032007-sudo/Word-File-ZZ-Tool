# 04. LOR Storage Architecture

**Phase**: Implementation Planning  
**Scope**: All file system storage, history, numbering, and download integration  
**Date**: 2026-07-14

---

## 1. Storage Map

```text
output/
├── lors/                                    ← LOR-generated documents
│   ├── ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.docx
│   ├── ZZ-LOR-2026-0001_RAHUL_KUMAR_JHA.pdf
│   ├── ZZ-LOR-2026-0002_PRIYA_SHARMA.docx
│   └── ZZ-LOR-2026-0002_PRIYA_SHARMA.pdf
│
├── lor-history.json                          ← LOR generation history records
│
├── sequence.json                             ← Shared numbering (LOR key added)
│
├── brands/                                   ← [READ-ONLY] Brand output
├── employees/                                ← [READ-ONLY] Employee output
├── certificates/                             ← [READ-ONLY] Certificate output
└── contracts.json                            ← [READ-ONLY] Brand/Employee history
```

---

## 2. Output Directory: `output/lors/`

### Purpose
Stores all generated LOR documents (DOCX and PDF).

### Naming Convention
```text
ZZ-LOR-{YEAR}-{SEQ}_{NAME_SLUG}.{ext}
```

| Component | Source | Example |
|---|---|---|
| `ZZ` | `CONTRACT_PREFIX` env var | `ZZ` |
| `LOR` | Hardcoded type key | `LOR` |
| `{YEAR}` | `new Date().getFullYear()` | `2026` |
| `{SEQ}` | `sequence.json["LOR"]["2026"]` zero-padded to 4 digits | `0001` |
| `{NAME_SLUG}` | `employeeName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')` | `RAHUL_KUMAR_JHA` |
| `{ext}` | File type | `docx` or `pdf` |

### Creation
Directory is created automatically by `lorGenerator.ts` using:
```text
fs.mkdirSync(outputDir, { recursive: true })
```

### Gitignore
Already covered by existing `.gitignore` pattern for `output/`.

### Isolation
| Check | Status |
|---|---|
| LOR files go to `output/lors/` | ✅ |
| Never writes to `output/brands/` | ✅ |
| Never writes to `output/employees/` | ✅ |
| Never writes to `output/certificates/` | ✅ |

---

## 3. History File: `output/lor-history.json`

### Purpose
Flat JSON file storing all LOR generation records. No database. Acts as the complete history log.

### Schema

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
    "aiModelVersion": "gemini-2.0-flash",
    "draftGeneratedByAI": true,
    "aiDraft": "During their tenure at ZenZebra, the candidate demonstrated...",
    "finalDraft": "During their tenure at ZenZebra, the candidate demonstrated (HR-edited)...",
    "edited": true
  }
]
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Sequential LOR number (e.g., `ZZ-LOR-2026-0001`) |
| `employeeName` | `string` | ✅ | Full name of the employee |
| `designation` | `string` | ✅ | Role/title |
| `department` | `string` | ✅ | Department or team |
| `email` | `string` | ❌ | Personal email |
| `joiningDate` | `string` | ✅ | ISO date (YYYY-MM-DD) |
| `lastWorkingDate` | `string` | ✅ | ISO date (YYYY-MM-DD) |
| `employmentType` | `string` | ❌ | "Intern", "Full-Time", etc. |
| `signatoryName` | `string` | ✅ | Signatory name |
| `signatoryRole` | `string` | ✅ | Signatory role |
| `generatedAt` | `string` | ✅ | ISO timestamp |
| `docxPath` | `string` | ✅ | Relative path to DOCX |
| `pdfPath` | `string \| null` | ❌ | Relative path to PDF (null if LibreOffice unavailable) |
| `aiModelVersion` | `string` | ✅ | Gemini model version used |
| `draftGeneratedByAI` | `boolean` | ✅ | `true` if Gemini generated the draft; `false` if HR wrote manually |
| `aiDraft` | `string \| null` | ❌ | The raw draft returned by Gemini (null if AI was skipped/failed) |
| `finalDraft` | `string` | ✅ | The final draft text submitted to DOCX generation (AI-edited or manual) |
| `edited` | `boolean` | ✅ | `true` if HR made any manual edits to the AI draft before generating |

### Operations

| Operation | Function | Behavior |
|---|---|---|
| **Read** | `readLorHistory()` | Read file, parse JSON, return array. Return `[]` if file missing. |
| **Append** | `appendLorHistory(record)` | Read → `unshift(record)` → truncate to 500 → write back. |

### Retention Rules
- Maximum 500 records (newest first)
- Records beyond 500 are silently discarded on next write
- File is never auto-deleted
- Records are never auto-deleted individually

### Isolation
| Check | Status |
|---|---|
| LOR history in `lor-history.json` | ✅ |
| Never writes to `contracts.json` | ✅ |
| Never writes to `certificates.json` | ✅ |
| Never reads from `contracts.json` for LOR data | ✅ |

---

## 4. Sequence Counter: `sequence.json`

### Current State
```json
{
  "EMP": { "2026": 44 },
  "BRAND": { "2026": 30 }
}
```

### After First LOR Generation
```json
{
  "EMP": { "2026": 44 },
  "BRAND": { "2026": 30 },
  "LOR": { "2026": 1 }
}
```

### How It Works
1. `nextContractNumber('LOR')` is called
2. `readSequence()` reads the file
3. If `store['LOR']` doesn't exist → create `{ }`
4. If `store['LOR']['2026']` doesn't exist → create `0`
5. Increment: `store['LOR']['2026'] += 1`
6. Write file back
7. Return: `ZZ-LOR-2026-0001`

### Key Properties
| Property | Value |
|---|---|
| Key format | UPPERCASE `LOR` |
| Schema | Nested `{ TYPE: { YEAR: count } }` |
| Auto-create | ✅ No manual editing needed |
| Shared file | ✅ Same `sequence.json` as Brand/Employee/Certificate |
| Independent counter | ✅ LOR count does not affect BRAND/EMP/CERT |
| Never reset | ✅ Monotonically increasing |
| Atomic write | `writeFileSync()` — safe for single-process |

---

## 5. Download API Integration

### Endpoint
```text
GET /api/download?folder=lors&file=<filename>
```

### How It Works
1. Frontend receives `docxPath` and `pdfPath` from generation response
2. Frontend extracts filename: `docxPath.split('/').pop()`
3. Frontend constructs download URL: `/api/download?folder=lors&file=${filename}`
4. Download route resolves: `path.join(OUTPUT_DIR, 'lors', filename)`
5. Serves file with appropriate `Content-Type` and `Content-Disposition` headers

### Path Traversal Protection
The existing download route already guards against:
- `..` in `folder` parameter
- `..` in `file` parameter
- Empty `folder` or `file` values

### No Changes Required
The download route is generic. It serves any `output/{folder}/{file}`. The `lors` folder works automatically.

---

## 6. Vercel Storage Considerations

### Problem
On Vercel, the `output/` directory resolves to the OS temp dir (via `writableDir()`). Files written there are **ephemeral** — they do not persist across requests or deployments.

### Impact on LOR

| Feature | Local | Vercel |
|---|---|---|
| DOCX generation | ✅ Works | ✅ Works (temp dir) |
| PDF conversion | ✅ Works (LibreOffice) | ❌ No LibreOffice binary |
| Download files | ✅ Works | ⚠️ Only within same request/deployment |
| History persistence | ✅ Persists | ❌ Lost between deployments |
| Sequence numbering | ✅ Persists | ❌ May reset between deployments |

### Mitigation
This is a **known limitation** shared by all modules (Brand, Employee, Certificate). No special LOR mitigation is needed. The project is designed for local deployment as the primary use case.

---

## 7. Storage Isolation Verification Matrix

| Dimension | Brand | Employee | Certificate | LOR |
|---|---|---|---|---|
| **Output dir** | `output/brands/` | `output/employees/` | `output/certificates/` | `output/lors/` |
| **History file** | `contracts.json` | `contracts.json` | `certificates.json` | `lor-history.json` |
| **Seq key** | `BRAND` | `EMP` | `CERT` | `LOR` |
| **Seq file** | `sequence.json` | `sequence.json` | `sequence.json` | `sequence.json` |
| **Download folder** | `brands` | `employees` | `certificates` | `lors` |

**Zero shared output directories. Zero shared history files. Shared sequence file with independent keys.**
