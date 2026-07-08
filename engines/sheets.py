"""Google Sheets Engine — Header-Based Column Mapping.

Reads columns by HEADER NAME, not position. Configure via .env:
    BRAND_HEADER_LEGAL_NAME=Legal Name
    BRAND_HEADER_ADDRESS=Address
Column order in the sheet doesn't matter — headers are matched by name.
Auth: credentials.json (service account key) in the project root.
"""
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
CREDENTIALS_PATH = ROOT / 'credentials.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']


class SheetsError(Exception):
    pass


def extract_sheet_id(url_or_id: str) -> str:
    """Pull the spreadsheet ID out of a pasted Google Sheets URL, or pass an ID through."""
    text = (url_or_id or '').strip()
    if not text:
        return ''
    m = re.search(r'/d/([a-zA-Z0-9-_]+)', text)
    if m:
        return m.group(1)
    if len(text) > 20 and '/' not in text:
        return text
    return ''


def _get_service():
    if not CREDENTIALS_PATH.exists():
        raise SheetsError(
            'Google credentials not found.\n'
            f'Place your service account JSON key as:\n  {CREDENTIALS_PATH}'
        )
    info = json.loads(CREDENTIALS_PATH.read_text(encoding='utf-8'))
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds, cache_discovery=False)


def _get_rows(sheet_id: str) -> list[list[str]]:
    service = _get_service()
    try:
        result = service.spreadsheets().values().get(spreadsheetId=sheet_id, range='A:Z').execute()
    except Exception as e:  # noqa: BLE001 - surface Google API errors as-is to the GUI
        raise SheetsError(f'Could not read sheet: {e}') from e
    return result.get('values', [])


def _find_col(headers: list[str], env_key: str, fallback: str) -> int:
    target = os.environ.get(env_key, fallback).strip().lower()
    for i, h in enumerate(headers):
        if str(h).strip().lower() == target:
            return i
    return -1


def _cell(row: list[str], idx: int) -> str:
    if idx < 0 or idx >= len(row):
        return ''
    return str(row[idx])


@dataclass
class BrandRow:
    index: int
    legal_name: str
    brand_category: str
    address: str
    email: str
    phone: str
    contact_person: str


@dataclass
class EmployeeRow:
    index: int
    name: str
    father_name: str
    address: str
    phone: str
    email: str
    pan: str
    aadhar: str
    designation: str
    department: str
    gender: str


def fetch_brand_rows(sheet_id: str | None = None) -> list[BrandRow]:
    sid = sheet_id or os.environ.get('GOOGLE_BRAND_SHEET_ID')
    if not sid:
        raise SheetsError('No Brand Sheet ID set. Paste a sheet URL, or set GOOGLE_BRAND_SHEET_ID in .env')

    rows = _get_rows(sid)
    if not rows:
        return []
    headers = [str(h) for h in rows[0]]
    c = {
        'legal_name': _find_col(headers, 'BRAND_HEADER_LEGAL_NAME', 'Legal Name'),
        'brand_category': _find_col(headers, 'BRAND_HEADER_BRAND_CATEGORY', 'Brand Category'),
        'address': _find_col(headers, 'BRAND_HEADER_ADDRESS', 'Address'),
        'email': _find_col(headers, 'BRAND_HEADER_EMAIL', 'Email Address'),
        'phone': _find_col(headers, 'BRAND_HEADER_PHONE', 'Phone Number'),
        'contact_person': _find_col(headers, 'BRAND_HEADER_CONTACT_PERSON', 'Contact Person'),
    }
    out = []
    for i, r in enumerate(rows[1:]):
        legal_name = _cell(r, c['legal_name']).strip()
        if not legal_name:
            continue
        out.append(BrandRow(
            index=i + 2,
            legal_name=legal_name,
            brand_category=_cell(r, c['brand_category']),
            address=_cell(r, c['address']),
            email=_cell(r, c['email']),
            phone=_cell(r, c['phone']),
            contact_person=_cell(r, c['contact_person']),
        ))
    return out


def fetch_employee_rows(sheet_id: str | None = None) -> list[EmployeeRow]:
    sid = sheet_id or os.environ.get('GOOGLE_EMPLOYEE_SHEET_ID')
    if not sid:
        raise SheetsError('No Employee Sheet ID set. Paste a sheet URL, or set GOOGLE_EMPLOYEE_SHEET_ID in .env')

    rows = _get_rows(sid)
    if not rows:
        return []
    headers = [str(h) for h in rows[0]]
    c = {
        'name': _find_col(headers, 'EMPLOYEE_HEADER_NAME', 'Full Name'),
        'father_name': _find_col(headers, 'EMPLOYEE_HEADER_FATHER_NAME', "Father's Name"),
        'address': _find_col(headers, 'EMPLOYEE_HEADER_ADDRESS', 'Address'),
        'phone': _find_col(headers, 'EMPLOYEE_HEADER_PHONE', 'Phone Number'),
        'email': _find_col(headers, 'EMPLOYEE_HEADER_EMAIL', 'Email Address'),
        'pan': _find_col(headers, 'EMPLOYEE_HEADER_PAN', 'PAN Number'),
        'aadhar': _find_col(headers, 'EMPLOYEE_HEADER_AADHAR', 'Aadhar Number'),
        'designation': _find_col(headers, 'EMPLOYEE_HEADER_DESIGNATION', 'Designation'),
        'department': _find_col(headers, 'EMPLOYEE_HEADER_DEPARTMENT', 'Department'),
        'gender': _find_col(headers, 'EMPLOYEE_HEADER_GENDER', 'Gender'),
    }
    out = []
    for i, r in enumerate(rows[1:]):
        name = _cell(r, c['name']).strip()
        if not name:
            continue
        out.append(EmployeeRow(
            index=i + 2,
            name=name,
            father_name=_cell(r, c['father_name']),
            address=_cell(r, c['address']),
            phone=_cell(r, c['phone']),
            email=_cell(r, c['email']),
            pan=_cell(r, c['pan']),
            aadhar=_cell(r, c['aadhar']),
            designation=_cell(r, c['designation']),
            department=_cell(r, c['department']),
            gender=_cell(r, c['gender']),
        ))
    return out
