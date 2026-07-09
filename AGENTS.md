# ZenZebra Contract Generator — repo root

The active app is in [`web/`](web/) (Next.js). Read [`web/AGENTS.md`](web/AGENTS.md) before
working in that directory — it has the full file map and conventions.

**Everything else at this root is either shared data or legacy:**

| Path | What it is |
|---|---|
| `.env` | Shared config (sheet IDs, header mappings, `LIBREOFFICE_PATH`) — read by `web/` |
| `templates/` | Live DOCX/XLSX templates read by `web/` at runtime — **this is the one that matters** |
| `output/` | Generated contracts + `contracts.json` history + `sequence.json` counters (gitignored) |
| `credentials.json` | Google service-account key, only needed for private sheets (not currently present) |
| `.legacy_trash/` | Safe archive folder for legacy/backup files (`Template`, `BACKUP`, `__pycache__`, `legacy-backup.zip`) — gitignored |

**Docs, read in this order:**
1. [`CONTRACT_GENERATOR_LOGIC.md`](CONTRACT_GENERATOR_LOGIC.md) — source-of-truth business
   workflow (what the app *should* do).
2. [`PROJECT_REPORT.md`](PROJECT_REPORT.md) — as-built state of `web/` (what it *actually* does
   today, plus known gaps).
3. [`PROJECT_PLAN.md`](PROJECT_PLAN.md) — architecture/folder-structure reference, superseded for
   business logic by doc #1.

No database, no auth, no login — keep it that way unless the user explicitly asks otherwise.
