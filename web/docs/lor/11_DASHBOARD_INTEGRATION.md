# 11. Dashboard Integration — LOR Module

This document defines how the LOR module integrates with the main Dashboard page.

## 1. Dashboard Card Addition

The existing dashboard at `/` (root page) displays metric cards for:
- Brand Contracts Generated
- Employee Contracts Generated
- Certificates Generated

A **fourth card** must be added:
- **LOR Generated** — showing the total count of records in `output/lor-history.json`.

## 2. Card Layout

```text
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    Brand     │  │   Employee   │  │ Certificates │  │     LOR      │
│  Contracts   │  │  Contracts   │  │  Generated   │  │  Generated   │
│              │  │              │  │              │  │              │
│     23       │  │     47       │  │      0       │  │      5       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

## 3. API Integration

The dashboard uses the existing `/api/contracts` API route to fetch all document records. This API returns a **single combined array** — NOT separate count fields.

### Current Response (actual):
```json
{
  "contracts": [
    { "contract_no": "ZZ-BRAND-2026-0030", "type": "brand", "party_name": "Nike", ... },
    { "contract_no": "ZZ-EMP-2026-0044", "type": "employee", "party_name": "John Doe", ... },
    { "contract_no": "ZZ-CERT-2026-0001", "type": "certificate", "party_name": "Priya Sharma", ... }
  ]
}
```

### Updated Response (with LOR):
```json
{
  "contracts": [
    { "contract_no": "ZZ-BRAND-2026-0030", "type": "brand", "party_name": "Nike", ... },
    { "contract_no": "ZZ-EMP-2026-0044", "type": "employee", "party_name": "John Doe", ... },
    { "contract_no": "ZZ-CERT-2026-0001", "type": "certificate", "party_name": "Priya Sharma", ... },
    { "contract_no": "ZZ-LOR-2026-0001", "type": "lor", "party_name": "Rahul Kumar Jha", ... }
  ]
}
```

> [!IMPORTANT]
> The dashboard **does NOT receive separate count fields** like `{ brand: 23, lor: 5 }`. Instead, the frontend computes counts client-side by filtering the `contracts` array by `type`. This is how Brand, Employee, and Certificate already work today.

## 4. Implementation Steps

### Backend (`web/app/api/contracts/route.ts`):
1. Import the LOR history reader function (from `web/lib/lorStore.ts`).
2. Read `output/lor-history.json` and normalize each record to match the `ContractRecord` interface:
   ```typescript
   const normalizedLors = lorHistory.map(l => ({
     contract_no: l.id,
     type: 'lor',
     party_name: l.employeeName,
     generated_at: l.generatedAt,
     docx: l.docxPath?.split('/').pop() ?? '',
     pdf: l.pdfPath?.split('/').pop() ?? '',
     folder: 'lors',
   }));
   ```
3. Merge into the existing combined array and sort newest-first.

### Frontend (`web/app/page.tsx`):
1. Add a LOR count computed client-side:
   ```typescript
   const lorCount = contracts.filter((c) => c.type === "lor").length;
   ```
2. Update `totalDocuments` to include `lorCount`.
3. Add a new metric card:
   - Icon: `ScrollText` from `lucide-react`
   - Label: `LOR Generated`
   - Count: `lorCount`
4. Add a LOR badge variant in the activity table for `type === "lor"`.

## 5. Sidebar Integration
The sidebar already has a link to `/lor` (added during the Certificate phase). The icon is `Scroll` from `lucide-react`.

## 6. Safety Rules
- LOR records in `lor-history.json` are **normalized** into the combined `contracts` array in the API response.
- The backend never writes LOR data into `contracts.json` or `certificates.json`.
- If `lor-history.json` does not exist, zero LOR records are included in the response.
- The frontend filters by `type === "lor"` to compute counts — no dedicated count field exists.
