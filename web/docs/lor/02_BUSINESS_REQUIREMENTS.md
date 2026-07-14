# 02. Business Requirements — LOR Module

This document outlines the core business criteria and operational parameters for the LOR generation system.

## 1. Business Objective
To streamline and unify the processing of employee recommendation requests. HR should be able to load responses submitted by candidates via Google Forms, verify them, use AI to generate highly contextual drafts matching the candidate's actual responsibilities and accomplishments, and compile them into formal signed PDF letters.

## 2. Dynamic Workflows & Rules
- **Google Form Submission**: Former employees/interns declare their details (tenure, role, key projects, and qualities they'd like highlighted) via a standardized Google Form.
- **Verification Gate**: LORs cannot be generated without an administrative review. HR acts as the validation authority.
- **Double-Signed Isolation**: The generated letter must align with legal, corporate, and HR-approved templates. It must never reference internal codes or share numbering sequences with other contracts.

## 3. Operations & Role Matrix

| Action | Allowed Roles | System Rule / Boundary |
|---|---|---|
| Load Google Response Sheet | HR Administrator | Sourced from custom URL parameter or fallback environment sheet ID. |
| Edit Employee Details | HR Administrator | All loaded details (Name, Dates, Role) can be modified directly before AI draft compilation. |
| Generate AI Draft | HR Administrator / System | Generates body text using Gemini AI based on loaded/edited fields. |
| Manual Draft Override | HR Administrator | Can overwrite the AI's generated draft content inside a rich text area. |
| File Compilation | HR Administrator | Compiles final DOCX + PDF files, assigns numbering, and saves history. |

## 4. Declaration Requirement
The Google Form response sheet includes an "Employee Declaration" column.
- **Acceptance Rule**: The declaration text check must be verified. If a record has declaration empty or false, the system UI must alert the HR administrator and flag the record as unverified.
- **Bypass Rule**: The administrator can manually check an "Accept Declaration Override" checkbox in the UI to proceed with draft generation if required.
