"""Contract Store — output/contracts.json index. Appended on every generation."""
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
STORE_FILE = ROOT / 'output' / 'contracts.json'


@dataclass
class ContractRecord:
    contract_no: str
    type: str          # 'brand' | 'employee'
    party_name: str
    generated_at: str  # ISO timestamp
    docx: str
    pdf: Optional[str]
    folder: str         # 'brands' | 'employees'
    location: Optional[str] = None
    total_amount: Optional[float] = None
    annual_ctc: Optional[float] = None
    designation: Optional[str] = None


def _read_store() -> list[dict]:
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not STORE_FILE.exists():
        return []
    try:
        return json.loads(STORE_FILE.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return []


def append_contract(record: ContractRecord) -> None:
    store = _read_store()
    store.insert(0, asdict(record))  # newest first
    store = store[:500]
    STORE_FILE.write_text(json.dumps(store, indent=2), encoding='utf-8')


_LEGACY_KEY_MAP = {
    'contractNo': 'contract_no', 'partyName': 'party_name', 'generatedAt': 'generated_at',
    'totalAmount': 'total_amount', 'annualCTC': 'annual_ctc',
}


def _normalize(rec: dict) -> dict:
    """Tolerate contracts.json entries written by the earlier Node/Next.js version
    of this tool, which used camelCase keys instead of snake_case."""
    if 'contract_no' in rec:
        return rec
    return {_LEGACY_KEY_MAP.get(k, k): v for k, v in rec.items()}


def read_contracts() -> list[dict]:
    return [_normalize(r) for r in _read_store()]
