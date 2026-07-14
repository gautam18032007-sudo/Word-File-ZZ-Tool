# 06. LOR Content Rules — LOR Module

This document defines the exact structure, wording standards, and content sections of the generated Letter of Recommendation.

## 1. Final Document Structure

The generated LOR follows this exact section order:

```text
┌─────────────────────────────────────────────┐
│             [Company Letterhead]             │
│                                              │
│  To Whom It May Concern,                     │  ← Section 1: Static
│                                              │
│  This is to certify that {{NAME}} was        │
│  associated with Bohemian Curations Private  │
│  Limited (ZenZebra) as a {{DESIGNATION}}     │  ← Section 2: Template
│  from {{JOINING_DATE}} to                    │
│  {{LAST_WORKING_DATE}}.                      │
│                                              │
│  [AI Generated Body Paragraphs]              │  ← Sections 3-6: AI
│                                              │
│  We highly recommend {{NAME}} for future     │
│  academic and professional opportunities.    │  ← Section 7: Static
│                                              │
│  Regards,                                    │
│                                              │
│  {{SIGNATORY_NAME}}                          │  ← Section 8: Template
│  {{SIGNATORY_ROLE}}                          │
│  ZenZebra                                   │
└─────────────────────────────────────────────┘
```

## 2. Section Breakdown

### Section 1 — Salutation (Static)
```text
To Whom It May Concern,
```
- Never changes. Baked into the DOCX template.

### Section 2 — Employee Introduction (Template-driven)
```text
This is to certify that {{NAME}} was associated with Bohemian Curations
Private Limited (ZenZebra) as a {{DESIGNATION}} from {{JOINING_DATE}}
to {{LAST_WORKING_DATE}}.
```
- Dynamically populated from form fields.
- Date format: `15th June, 2026` (ordinal day + full month + year).

### Section 3 — Responsibilities Summary (AI-generated)
- Derived from the `responsibilities` field.
- Must summarize the candidate's day-to-day duties in 2-3 sentences.
- Example: *"During their tenure, they were responsible for managing social media content calendars, coordinating with cross-functional teams, and ensuring timely delivery of marketing campaigns."*

### Section 4 — Project Contributions (AI-generated)
- Derived from the `projects` field.
- Must highlight 2-3 key projects or tasks the candidate handled.
- Example: *"They played a pivotal role in the launch of the company's new brand identity campaign and contributed significantly to the redesign of the corporate website."*

### Section 5 — Strengths & Qualities (AI-generated)
- Derived from the `strengths` field.
- Must describe the candidate's professional strengths.
- Example: *"They consistently demonstrated strong analytical thinking, excellent communication skills, and a proactive approach to problem-solving."*

### Section 6 — Recommendation Statement (AI-generated)
- A closing endorsement paragraph synthesized from all inputs.
- Example: *"Based on their performance and professional conduct, we are confident that they will be a valuable asset to any organization they choose to be a part of."*

### Section 7 — Closing Statement (Static)
```text
We highly recommend {{NAME}} for future academic and professional opportunities.
```

### Section 8 — Signature Block (Template-driven)
```text
Regards,

{{SIGNATORY_NAME}}
{{SIGNATORY_ROLE}}
ZenZebra
```
- Default: `Tanmay Jain` / `Co-Founder`
- Editable by HR before generation.

## 3. Writing Style Rules

| Rule | Details |
|---|---|
| **Tone** | Professional, corporate, formal |
| **Person** | Third person ("the candidate", "they") |
| **Tense** | Past tense for tenure details, present for qualities |
| **Format** | Flowing prose paragraphs, no bullet points |
| **Length** | AI body: 150-250 words. Full document: ~350-500 words |
| **Avoid** | Slang, informal language, superlatives without basis |

## 4. Date Formatting Rules

All dates in the final document must use the ordinal format:

| Input | Output |
|---|---|
| `2026-06-15` | `15th June, 2026` |
| `2026-01-01` | `1st January, 2026` |
| `2026-03-23` | `23rd March, 2026` |
| `2026-07-02` | `2nd July, 2026` |

Ordinal suffix rules:
- 1, 21, 31 → `st`
- 2, 22 → `nd`
- 3, 23 → `rd`
- Everything else → `th`
