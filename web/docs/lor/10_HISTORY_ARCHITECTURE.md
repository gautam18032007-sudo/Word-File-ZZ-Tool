# 10. History Architecture — LOR Module

This document defines the database-less file storage system for tracking generated LOR records.

## 1. Storage Location

```text
output/lor-history.json
```

- This is a flat JSON file stored in the `output/` directory at the project root.
- It is **completely separate** from `output/contracts.json` (Brand/Employee) and `output/certificates.json`.
- The file is gitignored.

## 2. Schema Definition

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

## 3. Field Definitions

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique sequential LOR number (e.g., `ZZ-LOR-2026-0001`) |
| `employeeName` | `string` | Full name of the employee |
| `designation` | `string` | Role/title at the time of employment |
| `department` | `string` | Department or team |
| `email` | `string` | Personal email of the employee |
| `joiningDate` | `string` | ISO date string (YYYY-MM-DD) |
| `lastWorkingDate` | `string` | ISO date string (YYYY-MM-DD) |
| `employmentType` | `string` | "Intern", "Full-Time", etc. |
| `signatoryName` | `string` | Name of the person who signed the letter |
| `signatoryRole` | `string` | Role of the signatory |
| `generatedAt` | `string` | ISO timestamp of when the LOR was generated |
| `docxPath` | `string` | Relative path to the generated DOCX file |
| `pdfPath` | `string \| null` | Relative path to the generated PDF (null if not available) |
| `aiModelVersion` | `string` | Version/model name of the AI used for draft generation |

## 4. Read/Write Operations

### Reading History
```typescript
function readLorHistory(): LorHistoryRecord[] {
  const historyPath = path.resolve(process.cwd(), "../output/lor-history.json");
  if (!fs.existsSync(historyPath)) return [];
  return JSON.parse(fs.readFileSync(historyPath, "utf-8"));
}
```

### Appending a Record
```typescript
function appendLorHistory(record: LorHistoryRecord): void {
  const history = readLorHistory();
  history.push(record);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}
```

## 5. Duplicate Detection
Before generating a new LOR, the system checks if a record already exists for the same `employeeName`:
- If found, a confirmation modal is shown: *"An LOR has already been generated for {{NAME}} on {{DATE}}. Generate another?"*
- The user can proceed (creating a new sequential number) or cancel.

## 6. Dashboard Count Query
The dashboard reads `lor-history.json` and counts the total entries:
```typescript
const lorCount = readLorHistory().length;
```
