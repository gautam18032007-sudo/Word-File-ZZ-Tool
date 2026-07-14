# 04. Google Sheet Mapping — LOR Module

This document defines how the system automatically loads, parses, and maps rows from the Google Response Sheet.

## 1. Auto-Detection Logic
Because Google Form headers can change slightly over time, the system uses a normalized match function to map headers.
- **Normalization**: Trim all whitespace, convert to lowercase, and replace multiple spaces/special characters with a single space.
- **Header Matching**: The headers are scanned against a set of predetermined alias arrays.

## 2. Header Aliases Mapping Table

| Internal Key | Primary Google Form Header | Supported Column Header Aliases |
|---|---|---|
| `employeeName` | **Full Name** | `name`, `full name`, `employee name`, `intern name` |
| `email` | **Personal Email ID** | `email`, `personal email id`, `email address`, `email id` |
| `phone` | **Contact Number** | `phone`, `contact number`, `mobile`, `contact`, `phone number` |
| `department` | **Department / Team** | `department`, `team`, `department / team`, `dept` |
| `designation` | **Designation / Role** | `designation`, `role`, `position`, `designation / role` |
| `joiningDate` | **Date of Joining** | `joining date`, `date of joining`, `start date`, `doj` |
| `lastWorkingDate`| **Last Working Date** | `last working date`, `exit date`, `end date`, `lwd` |
| `employmentType` | **Employment Type** | `employment type`, `type of employment`, `intern/employee` |
| `responsibilities`| **Briefly describe your role...**| `role and key responsibilities`, `responsibilities`, `role description` |
| `projects` | **Key projects/tasks...** | `projects`, `key projects`, `tasks handled`, `projects handled` |
| `strengths` | **What qualities or strengths...**| `strengths`, `qualities`, `strengths to highlight` |
| `additionalInfo` | **Any additional information...**| `additional information`, `additional notes`, `any other info` |
| `declaration` | **Employee Declaration** | `declaration`, `employee declaration`, `i agree`, `accept` |

## 3. Row Parsing Protocol
When a row is read:
1. The column indices are resolved using the mapping table above.
2. The row values are fetched. If a column is missing from the sheet, its value defaults to `""` (empty string).
3. The response payload structure returned by the API is:

```json
{
  "headers": [
    "Timestamp",
    "Full Name",
    "Personal Email ID",
    ...
  ],
  "rows": [
    [
      "2026-07-14 10:00:00",
      "Rahul Kumar Jha",
      "rahul@example.com",
      ...
    ]
  ]
}
```
