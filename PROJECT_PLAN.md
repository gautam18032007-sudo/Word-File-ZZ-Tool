# Google Form Response → Contract Automation System

_Status: superseded by [CONTRACT_GENERATOR_LOGIC.md](CONTRACT_GENERATOR_LOGIC.md), which is now
the source-of-truth business logic doc. Kept here for architecture/folder-structure reference.
Not yet implemented in `web/`; current app still uses raw Google Sheets with manual
Effective/Stamping dates. See [PROJECT_REPORT.md](PROJECT_REPORT.md) for the as-built state._

A simplified architecture for turning Google Form responses into auto-generated employee and brand contracts — no Google API, no credentials, no service accounts required.

---

## 1. Final Business Flow

```
Employee/Brand fills Google Form
            ↓
Google Form Response Sheet
            ↓
Contract Tool
            ↓
Select Record
            ↓
Manual Business Inputs
            ↓
Contract Preview
            ↓
Generate DOCX
            ↓
Generate PDF
            ↓
Save History
```

---

## 2. Recommended Approach — Option A

**No Google API · No Credentials · No Google Cloud · No Service Account**

```
Google Form
    ↓
Google Response Sheet
    ↓
Share → Anyone With Link → Viewer
    ↓
Paste Sheet URL Into Tool
    ↓
Tool Reads Public CSV
```

The Next.js version supports a public CSV export mode, making this the easiest and lowest-maintenance setup.

---

## 3. Step-by-Step Setup (Non-Technical)

### Step 1 — Create Google Forms

Go to [forms.google.com](https://forms.google.com) and create two forms:

**Employee Form fields:**
- Full Name
- Father Name
- Gender
- Address
- Email
- Phone
- PAN
- Aadhar
- Designation
- Department

**Brand Form fields:**
- Brand Name
- Category
- Address
- Email
- Phone
- Contact Person

### Step 2 — Connect Response Sheet

Inside the Google Form:

```
Responses → Create Spreadsheet
```

Google auto-generates `Employee Responses` or `Brand Responses`.

### Step 3 — Make the Sheet Public

Open the sheet:

```
Share → General Access → Anyone With Link → Viewer
```

No API. No credentials. No Google Cloud.

### Step 4 — Paste Sheet URL Into the Tool

Example:

```
https://docs.google.com/spreadsheets/d/xxxxx/edit
```

Paste into **Contract Tool → Load Records**.

### Step 5 — Select a Record

Example: `Gautam Sharma`

The tool auto-loads:
- Name
- Address
- Gender
- PAN
- Designation

### Step 6 — Manual HR Inputs

These fields should **not** come from the Google Form — keep them manual.

**Employee:**
- Annual CTC
- Joining Date
- PF (Yes/No)

**Brand:**
- Location
- Contract Type
- Amount
- Months
- Commission

---

## 4. Important Change — Brand Contracts

Remove entirely:
- Effective Date
- Stamping Date

Replace with:
- **System Date** — auto-use today's date during generation.

---

## 5. Required UI

Simple tool — no CRM, no dashboard, no analytics.

### Sidebar
- Employee Contract
- Brand Contract
- History

### Employee Page

| Card | Contents |
|------|----------|
| 1 | Google Sheet URL + Load Button |
| 2 | Employee Dropdown |
| 3 | Employee Details |
| 4 | Annual CTC, Joining Date, PF Toggle, Gender Override |
| 5 | Salary Preview |
| 6 | Generate Contract |

### Brand Page

| Card | Contents |
|------|----------|
| 1 | Google Sheet URL + Load Button |
| 2 | Brand Dropdown |
| 3 | Brand Details |
| 4 | Location, Contract Type, Amount, Months, Commission |
| 5 | Contract Preview |
| 6 | Generate Contract |

---

## 6. Folder Structure

```
CONTRACT TOOL/
│
├── templates/
│   ├── employee-contract-template.docx
│   ├── brand-contract-template.docx
│   └── PF.xlsx
│
├── output/
│   ├── employees/
│   ├── brands/
│   ├── contracts.json
│   └── sequence.json
│
└── web/
    ├── app/
    ├── components/
    ├── lib/
    └── api/
```

---

## 7. Build Instructions (For Claude / Dev)

```
Build a Next.js 15 + TypeScript + Tailwind + Shadcn UI contract generator.

Data source:
Google Form Response Sheets.

Read sheets using public CSV export URLs.
Do NOT require Google API credentials.
Do NOT require service accounts.

Employee Flow:
- Load employee response sheet.
- Select employee.
- Auto-fill employee details.
- Manually enter: Annual CTC, Joining Date, PF YES/NO.
- Use PF.xlsx logic exactly.
- Apply gender pronoun engine.
- Generate DOCX and PDF.

Brand Flow:
- Load brand response sheet.
- Select brand.
- Auto-fill brand details.
- Manually enter: Location, Contract Type, Amount, Months, Commission.
- Remove Effective Date and Stamping Date completely.
- Use current system date automatically.
- Generate DOCX and PDF.

Store history in contracts.json.
Store numbering in sequence.json.

Use a clean monochrome UI with Shadcn cards, tables, selects, buttons, dialogs and tabs.
```

---

### Why This Architecture

This is the simplest, lowest-maintenance setup — it avoids the entire Google API / service-account flow unless the sheets need to stay private later on.
