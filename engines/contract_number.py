"""Contract Number Engine — sequential numbers like ZZ-BRAND-2026-0001.

State persisted in output/sequence.json. Never reused, never reset automatically.
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEQUENCE_FILE = ROOT / 'output' / 'sequence.json'


def _read_sequence() -> dict:
    SEQUENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not SEQUENCE_FILE.exists():
        return {}
    try:
        return json.loads(SEQUENCE_FILE.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_sequence(store: dict) -> None:
    SEQUENCE_FILE.write_text(json.dumps(store, indent=2), encoding='utf-8')


def next_contract_number(contract_type: str) -> str:
    """contract_type: 'BRAND' or 'EMP'. Returns e.g. 'ZZ-BRAND-2026-0001'."""
    year = str(datetime.now().year)
    prefix = os.environ.get('CONTRACT_PREFIX', 'ZZ')

    store = _read_sequence()
    store.setdefault(contract_type, {})
    store[contract_type].setdefault(year, 0)
    store[contract_type][year] += 1
    seq = str(store[contract_type][year]).zfill(4)

    _write_sequence(store)
    return f'{prefix}-{contract_type}-{year}-{seq}'


def build_filename(contract_no: str, party_name: str, ext: str) -> str:
    """e.g. ZZ-BRAND-2026-0001_NIKE_INDIA.docx"""
    slug = re.sub(r'[^A-Z0-9]+', '_', party_name.upper()).strip('_')
    return f'{contract_no}_{slug}.{ext}'
