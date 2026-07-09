# CONTRACT_GENERATOR_LOGIC.md

_Status: source-of-truth business logic — supersedes [PROJECT_PLAN.md](PROJECT_PLAN.md) as the
authoritative workflow spec. Not yet implemented in `web/`; see [PROJECT_REPORT.md](PROJECT_REPORT.md)
for the as-built state. Core difference from the prior plan: Employee flow now also sources
Designation/Department/Joining Date/CTC/PF as form-fillable-but-editable fields, and both flows
are framed explicitly as "auto-fill then manual verify," not raw sheet lookup._

## 1. Business Goal

HR ya Brand team ko Word contract manually edit nahi karna pade.

Employee ya Brand Google Form fill karega.

System automatically response read karega.

User sirf verify karega aur Generate Contract button dabayega.

Output:

* DOCX
* PDF
* Contract History

---

## 2. Real Workflow

### Employee Flow

#### Step 1

Candidate Google Form fill karta hai.

Fields:

```text
Full Name
Father Name
Gender
Mobile
Email
Address
PAN
Aadhar
Department
Designation
Joining Date
Annual CTC
PF Required (Yes/No)
```

#### Step 2

Google automatically Response Sheet me save karega.

Example:

```text
Employee Responses
```

---

#### Step 3

Contract Tool open karo

```text
http://localhost:3000
```

Employee Tab

---

#### Step 4

Paste Google Response Sheet URL

Example:

```text
https://docs.google.com/spreadsheets/d/xxxxx/edit
```

Click:

```text
Load Responses
```

---

#### Step 5

Tool fetch karega

Display:

```text
John Doe
Rahul Sharma
Priya Gupta
```

Dropdown

---

#### Step 6

Select Employee

Auto Fill:

```text
Name
Address
PAN
Aadhar
Designation
Department
Gender
```

---

#### Step 7

Manual Edit Allowed

User change kar sakta hai:

```text
CTC
Joining Date
Gender
Designation
```

before generation

---

#### Step 8

Salary Engine Run

PF.xlsx Logic

Calculate:

```text
Basic
HRA
Conveyance
PF Employer
PF Employee
Special Allowance
Salary In Hand
```

Live Preview

---

#### Step 9

Pronoun Engine

Male:

```text
He
Him
His
```

Female:

```text
She
Her
Her
```

Template automatically update

---

#### Step 10

Generate Contract

Output:

```text
ZZ-EMP-2026-0015_JOHN_DOE.docx

ZZ-EMP-2026-0015_JOHN_DOE.pdf
```

---

## 3. Brand Contract Flow

### Step 1

Brand Form Fill

Fields:

```text
Brand Name
Contact Person
Address
Phone
Email
```

Google Form

---

### Step 2

Response Sheet Save

---

### Step 3

Paste Response Sheet URL

Load Records

---

### Step 4

Select Brand

Auto Fill:

```text
Brand Name
Address
Contact Person
Email
Phone
```

---

### Step 5

Manual Inputs

```text
Location

SWN
KLJ
BOTH

Contract Type

MONTH
SKU

Amount

Commission %

Months

SKU Count
```

---

### Step 6

Auto Calculate

MONTH

```text
Amount × Months
```

SKU

```text
Amount × SKU × Months
```

BOTH

```text
(SWN + KLJ) × Months
```

---

### IMPORTANT CHANGE

Brand Contract me:

❌ Remove Effective Date

❌ Remove Stamping Date

Automatically use:

```text
Current System Date
```

Example:

```text
09 July 2026
```

User ko ye bharne ki zarurat nahi.

---

### Step 7

Generate

Output:

```text
ZZ-BRAND-2026-0007_NIKE.docx

ZZ-BRAND-2026-0007_NIKE.pdf
```

---

## 4. Google Setup (Non Technical)

Tumhe bas ye karna hai:

### Option A (Recommended)

Google Sheet Public

Sheet Open

```text
Share
```

↓

```text
Anyone with Link
```

↓

```text
Viewer
```

Done.

No API

No Credentials

No Google Cloud

No Service Account

No JSON

---

Tool read karega:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv
```

directly.

---

## 5. UI Layout

### Sidebar

```text
Dashboard

Employee Contracts

Brand Contracts

History
```

---

### Employee Page

Top

```text
Paste Sheet URL
[ Load ]
```

Card

```text
Employee Details
```

Card

```text
Salary Preview
```

Card

```text
Generate Contract
```

---

### Brand Page

Top

```text
Paste Sheet URL
[ Load ]
```

Card

```text
Brand Details
```

Card

```text
Commercial Details
```

Card

```text
Contract Preview
```

Card

```text
Generate Contract
```

---

## 6. Files Required

```text
templates/

employee-contract-template.docx

brand-contract-template.docx

PF.xlsx
```

---

## 7. Final Stack

```text
Next.js 16

TypeScript

Tailwind

Shadcn UI

Google Forms

Google Response Sheets

LibreOffice

DOCX Templates

JSON Storage
```

---

## 8. What Claude/Gemini Should Build

```text
✓ Google Response Sheet Loader

✓ Employee Auto Fill

✓ Brand Auto Fill

✓ Manual Override

✓ PF Calculation Engine

✓ Gender Pronoun Engine

✓ DOCX Generator

✓ PDF Generator

✓ Contract Number Generator

✓ History Module

✓ Download Module

✓ Public Sheet Support

✓ No Database

✓ No Login

✓ No Credentials Required
```
