"""Template Engine — pre-processes raw templates and renders {{TAG}} placeholders.

Ported from the original Node/docxtemplater implementation. A .docx is a zip archive;
we read word/document.xml as text, do string-level replacements scoped to <w:t> nodes
(so XML structure is never disturbed), then substitute the final {{TAG}} placeholders
with real data (XML-escaped).
"""
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
TPL_DIR = ROOT / 'templates'

class TemplateError(Exception):
    pass


_PARA_RE = re.compile(r'<w:p\b[^>]*>.*?</w:p>', re.DOTALL)
_RUN_TEXT_RE = re.compile(r'<w:t[^>]*>([^<]*)</w:t>')


def _run_new_text(s: int, e: int, original_text: str, ops: list[tuple[int, int, str]]) -> str:
    """Given one run's original [s, e) span in the paragraph's concatenated text, and a
    list of non-overlapping (match_start, match_end, replacement) ops computed against
    that same concatenated text, build this run's new text: untouched characters outside
    any op survive as-is; a matched span contributes its replacement exactly once, in
    the run where the match *starts* (so a match spanning multiple runs doesn't insert
    its replacement more than once)."""
    buf = []
    pos = s
    for op_s, op_e, to in ops:
        if op_e <= s or op_s >= e:
            continue  # this op doesn't touch this run at all
        if op_s > pos:
            buf.append(original_text[pos - s:op_s - s])
        if op_s >= s:  # this run is where the match starts — emit the replacement here
            buf.append(to)
        pos = min(op_e, e)
    if pos < e:
        buf.append(original_text[pos - s:])
    return ''.join(buf)


def _apply_ops_to_paragraphs(xml: str, ops_for) -> str:
    """Shared core: for each paragraph, compute (match_start, match_end, replacement)
    ops against the paragraph's concatenated <w:t> text via `ops_for(concat) -> ops`,
    then redistribute the result back into the original runs so per-run formatting
    elsewhere in the paragraph survives untouched. `ops_for` must compute its matches
    against the *original* concatenated text in one left-to-right pass — see
    `_literal_ops` / `_pronoun_ops` below for why that matters."""
    def process_paragraph(pmatch: re.Match) -> str:
        para = pmatch.group(0)
        runs = list(_RUN_TEXT_RE.finditer(para))
        if not runs:
            return para

        texts = [m.group(1) for m in runs]
        offsets, pos = [], 0
        for t in texts:
            offsets.append((pos, pos + len(t)))
            pos += len(t)
        concat = ''.join(texts)

        ops = ops_for(concat)
        if not ops:
            return para

        new_texts = [_run_new_text(s, e, t, ops) for (s, e), t in zip(offsets, texts)]

        pieces, last_end = [], 0
        for m, new_text in zip(runs, new_texts):
            pieces.append(para[last_end:m.start(1)])
            pieces.append(new_text)
            last_end = m.end(1)
        pieces.append(para[last_end:])
        return ''.join(pieces)

    return _PARA_RE.sub(process_paragraph, xml)


def _literal_ops(concat: str, replacements: list[tuple[str, str]]) -> list[tuple[int, int, str]]:
    """Single left-to-right scan for literal phrase matches (longest match at each
    position wins). Scanning the *original* text once — rather than looping over
    replacement pairs and re-scanning after each one — matters because some
    replacement values contain their own search phrase as a substring (e.g.
    'ADDRESS' -> '{{EMPLOYEE_ADDRESS}}'); a naive replace-and-rescan approach
    matches its own output and recurses into '{{EMPLOYEE_{{EMPLOYEE_ADDRESS}}}}'
    (or hangs outright, for more self-similar cases)."""
    ops: list[tuple[int, int, str]] = []
    i, n = 0, len(concat)
    while i < n:
        best_len, best_to = 0, None
        for frm, to in replacements:
            if len(frm) > best_len and concat.startswith(frm, i):
                best_len, best_to = len(frm), to
        if best_to is not None:
            ops.append((i, i + best_len, best_to))
            i += best_len
        else:
            i += 1
    return ops


def _replace_across_runs(xml: str, replacements: list[tuple[str, str]]) -> str:
    """Apply literal string replacements, tolerant of a phrase being split across
    multiple adjacent <w:t> runs within one paragraph (Word splits runs at formatting
    boundaries — e.g. "No of SKUs" can land as two separate runs: "No of " + "SKUs for ").
    A same-run-only replace silently misses these."""
    return _apply_ops_to_paragraphs(xml, lambda concat: _literal_ops(concat, replacements))


_WORD_CHAR_RE = re.compile(r'\w')
_PRONOUN_WORDS = [
    ('His', '{{PRONOUN_POSSESSIVE_CAP}}'), ('his', '{{PRONOUN_POSSESSIVE}}'),
    ('Him', '{{PRONOUN_OBJECT_CAP}}'), ('him', '{{PRONOUN_OBJECT}}'),
    ('He', '{{PRONOUN_SUBJECT_CAP}}'), ('he', '{{PRONOUN_SUBJECT}}'),
]


def _pronoun_ops(concat: str) -> list[tuple[int, int, str]]:
    """Word-boundary-aware scan for he/him/his (case-variant aware). Same single-pass
    design as _literal_ops, plus a boundary check on both sides of each candidate so
    "the" or "history" are never partially matched."""
    def is_word_char(ch: str | None) -> bool:
        return ch is not None and _WORD_CHAR_RE.match(ch) is not None

    ops: list[tuple[int, int, str]] = []
    i, n = 0, len(concat)
    while i < n:
        matched = False
        for word, to in _PRONOUN_WORDS:
            length = len(word)
            if concat[i:i + length] == word:
                before = concat[i - 1] if i > 0 else None
                after = concat[i + length] if i + length < n else None
                if not is_word_char(before) and not is_word_char(after):
                    ops.append((i, i + length, to))
                    i += length
                    matched = True
                    break
        if not matched:
            i += 1
    return ops


def _preprocess_pronouns(xml: str) -> str:
    """Swap hardcoded he/him/his (case-variant aware) for gender-neutral tags.
    Cross-run-aware: a template can split a word like "his" mid-word across two
    runs ("...include h" + "is heirs...") at a formatting boundary — a same-run
    regex silently leaves that occurrence as literal, ungendered text."""
    return _apply_ops_to_paragraphs(xml, _pronoun_ops)


_ANNEXURE_ROWS = [
    ('BASIC', 'ANN_BASIC', 'ANN_BASIC_ANNUAL'),
    ('HRA', 'ANN_HRA', 'ANN_HRA_ANNUAL'),
    ('CONVEYANCE ALLOWANCE', 'ANN_CONVEYANCE', 'ANN_CONVEYANCE_ANNUAL'),
    ('PF EMPLOYER', 'ANN_PF_EMPLOYER', 'ANN_PF_EMPLOYER_ANNUAL'),
    ('SPECIAL ALLOWANCE', 'ANN_SPECIAL_ALLOWANCE', 'ANN_SPECIAL_ALLOWANCE_ANNUAL'),
    ('Total CTC', 'ANN_TOTAL_CTC', 'ANN_TOTAL_CTC_ANNUAL'),
    ('PF EMPLOYEE', 'ANN_PF_EMPLOYEE', 'ANN_PF_EMPLOYEE_ANNUAL'),
    ('SALARY IN HAND', 'ANN_SALARY_IN_HAND', 'ANN_SALARY_IN_HAND_ANNUAL'),
]


def _preprocess_employee_table(xml: str) -> str:
    """Find the Annexure-A salary table and replace each row's two '-' placeholder
    cells (Monthly, Annual) with the matching {{TAG}}, keyed off the row's label cell."""
    tbl_start = xml.find('<w:tbl>')
    if tbl_start == -1:
        return xml
    tbl_end = xml.find('</w:tbl>', tbl_start)
    if tbl_end == -1:
        return xml

    tbl_xml = xml[tbl_start:tbl_end + len('</w:tbl>')]
    before, after = xml[:tbl_start], xml[tbl_end + len('</w:tbl>'):]

    rows = tbl_xml.split('</w:tr>')

    def process_row(row: str) -> str:
        if '<w:tr' not in row:
            return row
        texts = [m.group(1) for m in re.finditer(r'<w:t[^>]*>([^<]*)</w:t>', row)]
        if not texts:
            return row
        first_text = texts[0].strip()
        for label, monthly_tag, annual_tag in _ANNEXURE_ROWS:
            if first_text == label:
                res = re.sub(r'<w:t([^>]*)>-</w:t>', f'<w:t\\1>{{{{{monthly_tag}}}}}</w:t>', row, count=1)
                res = re.sub(r'<w:t([^>]*)>-</w:t>', f'<w:t\\1>{{{{{annual_tag}}}}}</w:t>', res, count=1)
                return res
        return row

    processed = [process_row(r) for r in rows]
    return before + '</w:tr>'.join(processed) + after


def _preprocess_employee_xml(xml: str) -> str:
    q_l, q_r = '“', '”'  # smart quotes “ ”
    # Longest-phrase-first: "…IN WORDS" must be matched before the shorter base phrase,
    # otherwise the base-phrase pass eats part of the longer phrase first (verified bug
    # in the original implementation — produced literal '"50,000 IN WORDS"' in output).
    replacements = [
        (q_l + 'Mr./Ms. NAME' + q_r, '{{EMPLOYEE_NAME}}'),
        ('Mr./Ms. NAME', '{{EMPLOYEE_NAME}}'),
        (q_l + 'ADDRESS' + q_r, '{{EMPLOYEE_ADDRESS}}'),
        ('ADDRESS', '{{EMPLOYEE_ADDRESS}}'),
        (q_l + 'DESIGNATION' + q_r, '{{DESIGNATION}}'),
        ('DESIGNATION', '{{DESIGNATION}}'),
        (q_l + 'JOINING DATE' + q_r, '{{JOINING_DATE}}'),
        ('JOINING DATE', '{{JOINING_DATE}}'),
        (q_l + 'MONTHLY CTC IN WORDS' + q_r, '{{MONTHLY_CTC_WORDS}}'),
        ('MONTHLY CTC IN WORDS', '{{MONTHLY_CTC_WORDS}}'),
        (q_l + 'MONTHLY CTC' + q_r, '{{MONTHLY_CTC}}'),
        ('MONTHLY CTC', '{{MONTHLY_CTC}}'),
        (q_l + 'ANNUAL CTC IN WORDS' + q_r, '{{ANNUAL_CTC_WORDS}}'),
        ('ANNUAL CTC IN WORDS', '{{ANNUAL_CTC_WORDS}}'),
        (q_l + 'ANNUAL CTC' + q_r, '{{ANNUAL_CTC}}'),
        ('ANNUAL CTC', '{{ANNUAL_CTC}}'),
    ]
    xml = _replace_across_runs(xml, replacements)
    xml = _preprocess_pronouns(xml)
    xml = _preprocess_employee_table(xml)
    return xml


def _preprocess_brand_xml(xml: str) -> str:
    # Longest-phrase-first: "Total Amount" must be matched before "Amount" (same class
    # of collision as MONTHLY CTC / MONTHLY CTC IN WORDS above). Phrase spacing below is
    # verified against the template's actual run-splits (Word splits runs at formatting
    # boundaries, so e.g. "No of" + " " + " months" is two spaces, not one) — confirmed
    # by dumping concatenated <w:t> text, not assumed.
    replacements = [
        ('(Stamping Date)', '{{STAMPING_DATE}}'),
        ('(commencement date)', '{{EFFECTIVE_DATE}}'),
        ('Effective Date', '{{EFFECTIVE_DATE}}'),
        ('Le gal Name', '{{LEGAL_NAME}}'),
        ('Legal Name', '{{LEGAL_NAME}}'),
        ('Brands Category', '{{BRAND_CATEGORY}}'),
        ('Brand Category', '{{BRAND_CATEGORY}}'),
        ('Address', '{{ADDRESS}}'),
        ('No of SKUs', '{{NO_OF_SKUS}}'),
        ('No of  months', '{{NO_OF_MONTHS}}'),
        ('Total Amount', '{{TOTAL_AMOUNT}}'),
        ('Amount', '{{AMOUNT}}'),
        ('Location  Setup', '{{LOCATION_TEXT}}'),
        ('Location setup', '{{LOCATION_TEXT}}'),
        ('Comm%', '{{COMMISSION_PCT}}'),   # data value must include the trailing '%' itself
        ('Payment Method', '{{PAYMENT_METHOD}}'),
    ]
    return _replace_across_runs(xml, replacements)


_TAG_RE = re.compile(r'\{\{(\w+)\}\}')


def _fill_tags(xml: str, data: dict) -> str:
    """Fill {{TAG}} placeholders. Tags with no data value resolve to '' (matches the
    reference implementation's docxtemplater default nullGetter behavior — e.g. the
    brand template's stray {{PAYMENT_METHOD}} tag, which is intentionally left blank)."""
    def repl(m: re.Match) -> str:
        key = m.group(1)
        return xml_escape(str(data.get(key, '')))
    return _TAG_RE.sub(repl, xml)


def render_docx(template_file: str, data: dict) -> bytes:
    tpl_path = TPL_DIR / template_file
    if not tpl_path.exists():
        raise TemplateError(f'Template not found: templates/{template_file}')

    with zipfile.ZipFile(tpl_path, 'r') as zin:
        xml = zin.read('word/document.xml').decode('utf-8')

        if 'employee' in template_file:
            xml = _preprocess_employee_xml(xml)
        else:
            xml = _preprocess_brand_xml(xml)

        xml = _fill_tags(xml, data)

        import io
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                content = xml.encode('utf-8') if item.filename == 'word/document.xml' else zin.read(item.filename)
                zout.writestr(item, content)
        return buf.getvalue()
