/**
 * DOCX Template Engine — faithful TypeScript port of engines/template.py
 *
 * A .docx is a zip archive. We read word/document.xml as text,
 * apply string-level replacements scoped to <w:t> nodes (preserving
 * per-run formatting), then substitute final {{TAG}} placeholders.
 *
 * Uses PizZip (pure JS zip library — no native deps).
 */
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { logger } from './logger';

// Templates live inside web/ (not one level up) so they ship as part of the
// deployment bundle on Vercel — a repo-root-relative path wouldn't exist there.
const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

export class TemplateError extends Error {}

function buildReplacements(pairs: [string, string][]): [string, string][] {
  const qL = '\u201c'; // “
  const qR = '\u201d'; // ”
  const list: [string, string][] = [];
  for (const [raw, tag] of pairs) {
    list.push([qL + raw + qR, tag]);
    list.push([`"${raw}"`, tag]);
    list.push([`'${raw}'`, tag]);
    list.push([raw, tag]);
  }
  return list;
}

function stripContentControls(xml: string): string {
  let prevXml;
  const sdtRe = /<w:sdt\b[^>]*>(?:(?!<\/w:sdt>)[\s\S])*?<w:sdtContent\b[^>]*>([\s\S]*?)<\/w:sdtContent>(?:(?!<\/w:sdt>)[\s\S])*?<\/w:sdt>/g;
  let passes = 0;
  do {
    prevXml = xml;
    xml = xml.replace(sdtRe, '$1');
    passes++;
  } while (xml !== prevXml && passes < 10);
  return xml;
}

function stripHighlightAndShading(xml: string): string {
  xml = xml.replace(/<w:highlight\b[^>]*?\/>/g, '')
           .replace(/<w:highlight\b[^>]*?>[\s\S]*?<\/w:highlight>/g, '');

  xml = xml.replace(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/g, (match) => {
    return match
      .replace(/<w:shd\b[^>]*?\/>/g, '')
      .replace(/<w:shd\b[^>]*?>[\s\S]*?<\/w:shd>/g, '');
  });

  return xml;
}

// ─── Paragraph & run extraction ───────────────────────────────────────────────

const PARA_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const RUN_TEXT_RE = /<w:t([^>]*)>([^<]*)<\/w:t>/g;

interface Op {
  start: number;
  end: number;
  replacement: string;
}

/** Compute the new text for one run given a set of replacement ops on the concatenated paragraph text */
function runNewText(runStart: number, runEnd: number, originalText: string, ops: Op[]): string {
  const buf: string[] = [];
  let pos = runStart;

  for (const { start: opS, end: opE, replacement } of ops) {
    if (opE <= runStart || opS >= runEnd) continue; // doesn't touch this run
    if (opS > pos) buf.push(originalText.slice(pos - runStart, opS - runStart));
    if (opS >= runStart) buf.push(replacement); // emit replacement in the run where match starts
    pos = Math.min(opE, runEnd);
  }
  if (pos < runEnd) buf.push(originalText.slice(pos - runStart));
  return buf.join('');
}

type OpsFor = (concat: string) => Op[];

/** Apply ops across all paragraphs, redistributing back into original runs */
function applyOpsToParagraphs(xml: string, opsFor: OpsFor): string {
  return xml.replace(PARA_RE, (para) => {
    // Collect all run matches
    const runMatches: { m: RegExpExecArray; start: number; end: number }[] = [];
    const rre = new RegExp(RUN_TEXT_RE.source, 'g');
    let rm: RegExpExecArray | null;
    while ((rm = rre.exec(para)) !== null) {
      runMatches.push({ m: rm, start: rm.index, end: rm.index + rm[0].length });
    }
    if (!runMatches.length) return para;

    const texts = runMatches.map(r => r.m[2]);
    const offsets: { start: number; end: number }[] = [];
    let pos = 0;
    for (const t of texts) {
      offsets.push({ start: pos, end: pos + t.length });
      pos += t.length;
    }
    const concat = texts.join('');

    const ops = opsFor(concat);
    if (!ops.length) return para;

    const newTexts = texts.map((t, i) =>
      runNewText(offsets[i].start, offsets[i].end, t, ops)
    );

    let result = '';
    let lastEnd = 0;
    for (let i = 0; i < runMatches.length; i++) {
      const { m } = runMatches[i];
      const contentOffset = m[1].length + 5;
      result += para.slice(lastEnd, m.index + contentOffset);
      result += newTexts[i];
      lastEnd = m.index + contentOffset + m[2].length;
    }
    result += para.slice(lastEnd);
    return result;
  });
}

// ─── Literal replacement ops ──────────────────────────────────────────────────

function literalOps(concat: string, replacements: [string, string][]): Op[] {
  const ops: Op[] = [];
  let i = 0;
  const lowerConcat = concat.toLowerCase();
  while (i < concat.length) {
    let bestLen = 0;
    let bestTo: string | null = null;
    for (const [frm, to] of replacements) {
      const lowerFrm = frm.toLowerCase();
      if (lowerFrm.length > bestLen && lowerConcat.startsWith(lowerFrm, i)) {
        bestLen = lowerFrm.length;
        bestTo = to;
      }
    }
    if (bestTo !== null) {
      ops.push({ start: i, end: i + bestLen, replacement: bestTo });
      i += bestLen;
    } else {
      i++;
    }
  }
  return ops;
}

function replaceAcrossRuns(xml: string, replacements: [string, string][]): string {
  return applyOpsToParagraphs(xml, (concat) => literalOps(concat, replacements));
}

// ─── Pronoun engine ───────────────────────────────────────────────────────────

const PRONOUN_WORDS: [string, string][] = [
  ['His', '{{PRONOUN_POSSESSIVE_CAP}}'],
  ['his', '{{PRONOUN_POSSESSIVE}}'],
  ['Him', '{{PRONOUN_OBJECT_CAP}}'],
  ['him', '{{PRONOUN_OBJECT}}'],
  ['He', '{{PRONOUN_SUBJECT_CAP}}'],
  ['he', '{{PRONOUN_SUBJECT}}'],
];

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /\w/.test(ch);
}

function pronounOps(concat: string): Op[] {
  const ops: Op[] = [];
  let i = 0;
  while (i < concat.length) {
    let matched = false;
    for (const [word, to] of PRONOUN_WORDS) {
      if (concat.startsWith(word, i)) {
        const before = concat[i - 1];
        const after = concat[i + word.length];
        if (!isWordChar(before) && !isWordChar(after)) {
          ops.push({ start: i, end: i + word.length, replacement: to });
          i += word.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) i++;
  }
  return ops;
}

function preprocessPronouns(xml: string): string {
  return applyOpsToParagraphs(xml, pronounOps);
}

// ─── Employee table preprocessing ────────────────────────────────────────────

const ANNEXURE_ROWS: [string, string, string][] = [
  ['BASIC', 'ANN_BASIC', 'ANN_BASIC_ANNUAL'],
  ['HRA', 'ANN_HRA', 'ANN_HRA_ANNUAL'],
  ['CONVEYANCE ALLOWANCE', 'ANN_CONVEYANCE', 'ANN_CONVEYANCE_ANNUAL'],
  ['PF EMPLOYER', 'ANN_PF_EMPLOYER', 'ANN_PF_EMPLOYER_ANNUAL'],
  ['SPECIAL ALLOWANCE', 'ANN_SPECIAL_ALLOWANCE', 'ANN_SPECIAL_ALLOWANCE_ANNUAL'],
  ['Total CTC', 'ANN_TOTAL_CTC', 'ANN_TOTAL_CTC_ANNUAL'],
  ['PF EMPLOYEE', 'ANN_PF_EMPLOYEE', 'ANN_PF_EMPLOYEE_ANNUAL'],
  ['SALARY IN HAND', 'ANN_SALARY_IN_HAND', 'ANN_SALARY_IN_HAND_ANNUAL'],
];

function preprocessEmployeeTable(xml: string): string {
  const tblStart = xml.indexOf('<w:tbl>');
  if (tblStart === -1) return xml;
  const tblEnd = xml.indexOf('</w:tbl>', tblStart);
  if (tblEnd === -1) return xml;

  const before = xml.slice(0, tblStart);
  const tblXml = xml.slice(tblStart, tblEnd + '</w:tbl>'.length);
  const after = xml.slice(tblEnd + '</w:tbl>'.length);

  const tRows = tblXml.split('</w:tr>');
  const processed = tRows.map((row) => {
    if (!row.includes('<w:tr')) return row;
    const texts: string[] = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(row)) !== null) texts.push(m[1]);
    if (!texts.length) return row;
    const firstText = texts[0].trim();
    for (const [label, monthlyTag, annualTag] of ANNEXURE_ROWS) {
      if (firstText === label) {
        let res = row.replace(/<w:t([^>]*)>-<\/w:t>/, `<w:t$1>{{${monthlyTag}}}</w:t>`);
        res = res.replace(/<w:t([^>]*)>-<\/w:t>/, `<w:t$1>{{${annualTag}}}</w:t>`);
        return res;
      }
    }
    return row;
  });
  return before + processed.join('</w:tr>') + after;
}

// ─── Preprocessors ────────────────────────────────────────────────────────────

function preprocessEmployeeXml(xml: string): string {
  const employeePairs: [string, string][] = [
    ['Mr./Ms. NAME', '{{EMPLOYEE_NAME}}'],
    ['EMPLOYEE NAME', '{{EMPLOYEE_NAME}}'],
    ['NAME:', '{{EMPLOYEE_NAME}}'],
    ['NAME', '{{EMPLOYEE_NAME}}'],
    ['ADDRESS:', '{{EMPLOYEE_ADDRESS}}'],
    ['ADDRESS', '{{EMPLOYEE_ADDRESS}}'],
    ['DESIGNATION:', '{{DESIGNATION}}'],
    ['DESIGNATION', '{{DESIGNATION}}'],
    ['JOINING DATE:', '{{JOINING_DATE}}'],
    ['JOINING DATE', '{{JOINING_DATE}}'],
    ['MONTHLY CTC IN WORDS', '{{MONTHLY_CTC_WORDS}}'],
    ['MONTHLY CTC', '{{MONTHLY_CTC}}'],
    ['ANNUAL CTC IN WORDS', '{{ANNUAL_CTC_WORDS}}'],
    ['ANNUAL CTC', '{{ANNUAL_CTC}}'],
  ];
  const replacements = buildReplacements(employeePairs);
  xml = replaceAcrossRuns(xml, replacements);
  xml = preprocessPronouns(xml);
  xml = preprocessEmployeeTable(xml);
  return xml;
}

// ─── Fee / Commission clause collapse ────────────────────────────────────────
//
// The "Rental and Commission Structure" list item text (a numbered-list w:p each)
// is fully dynamic — its wording differs structurally between a single-location
// contract and a BOTH-location contract, so it can't be built from small
// token-level tags like {{AMOUNT}}/{{LOCATION}}. Instead, each of the two list
// paragraphs is collapsed to a single tag ({{FEE_CLAUSE}}, {{COMMISSION_CLAUSE}})
// whose full sentence is composed server-side (see generate/brand/route.ts).
function feeCommissionClauseOps(concat: string): Op[] {
  if (/advanced?\s+fixed\s+fee/i.test(concat)) {
    return [{ start: 0, end: concat.length, replacement: '{{FEE_CLAUSE}}' }];
  }
  if (/commission of/i.test(concat)) {
    return [{ start: 0, end: concat.length, replacement: '{{COMMISSION_CLAUSE}}' }];
  }
  // Stray continuation paragraph (no numPr — a soft line break in the source
  // doc, not its own list item) carrying the tail of the commission sentence
  // ("through our Location Setup as disclosed in the PI."). Its content is
  // already folded into {{COMMISSION_CLAUSE}} above, so it collapses to empty.
  if (/disclosed in the\s+(PI\b|proforma invoice)/i.test(concat)) {
    return [{ start: 0, end: concat.length, replacement: '' }];
  }
  return [];
}

function preprocessBrandXml(xml: string): string {
  xml = applyOpsToParagraphs(xml, feeCommissionClauseOps);
  const brandPairs: [string, string][] = [
    ['(Stamping Date)', '{{STAMPING_DATE}}'],
    ['(commencement date)', '{{EFFECTIVE_DATE}}'],
    ['Effective Date:', '{{EFFECTIVE_DATE}}'],
    ['Effective Date', '{{EFFECTIVE_DATE}}'],
    ['Le gal Name', '{{LEGAL_NAME}}'],
    ['Legal Name:', '{{LEGAL_NAME}}'],
    ['Legal Name', '{{LEGAL_NAME}}'],
    ['Brands Category:', '{{BRAND_CATEGORY}}'],
    ['Brands Category', '{{BRAND_CATEGORY}}'],
    ['Brand Category:', '{{BRAND_CATEGORY}}'],
    ['Brand Category', '{{BRAND_CATEGORY}}'],
    ['Products Category:', '{{BRAND_CATEGORY}}'],
    ['Products Category', '{{BRAND_CATEGORY}}'],
    ['Product Category:', '{{BRAND_CATEGORY}}'],
    ['Product Category', '{{BRAND_CATEGORY}}'],
    ['Address:', '{{ADDRESS}}'],
    ['Address', '{{ADDRESS}}'],
    ['Payment Method:', '{{PAYMENT_METHOD}}'],
    ['Payment Method', '{{PAYMENT_METHOD}}'],
  ];
  const replacements = buildReplacements(brandPairs);
  return replaceAcrossRuns(xml, replacements);
}

// ─── Tag filling ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fillTags(xml: string, data: Record<string, string>): string {
  return xml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === '') return '';

    const noBoldKeys = [
      'HE_SHE', 'HIM_HER', 'HIS_HER', 'HE', 'HIM', 'HIS', 'SHE', 'HER',
      'PAYMENT_METHOD', 'FEE_CLAUSE', 'COMMISSION_CLAUSE'
    ];
    if (noBoldKeys.includes(key)) {
      return escapeXml(val);
    }

    return `</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(val)}</w:t></w:r><w:r><w:t xml:space="preserve">`;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderDocx(templateFile: string, data: Record<string, string>): Buffer {
  const tplPath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(tplPath)) {
    throw new TemplateError(`Template not found: templates/${templateFile}`);
  }

  logger.gen(`[renderDocx] Starting contract generation for template "${templateFile}"`);

  const content = fs.readFileSync(tplPath);
  const zip = new PizZip(content);

  let xml = zip.file('word/document.xml')!.asText();

  // First pass: strip content controls completely to simplify XML structure
  xml = stripContentControls(xml);

  if (templateFile.includes('employee')) {
    xml = preprocessEmployeeXml(xml);
  } else {
    xml = preprocessBrandXml(xml);
  }

  xml = fillTags(xml, data);

  // Strip highlights and shadings (from runs)
  xml = stripHighlightAndShading(xml);

  // Second pass: unwrap any content controls that might have been processed or populated
  xml = stripContentControls(xml);

  // --- STRICT AUTOMATED VALIDATION LAYER ---
  logger.gen(`[renderDocx] Running validations on generated document`);

  // 1. Assert no w:highlight remains
  if (xml.includes('w:highlight')) {
    const errMsg = 'Validation failed: w:highlight tags remain in the generated document.';
    logger.error(`[renderDocx] ${errMsg}`);
    throw new TemplateError(errMsg);
  }

  // 2. Assert no w:sdt remains (content controls)
  if (xml.includes('w:sdt') || xml.includes('w:sdtContent')) {
    const errMsg = 'Validation failed: w:sdt content controls remain in the generated document.';
    logger.error(`[renderDocx] ${errMsg}`);
    throw new TemplateError(errMsg);
  }

  // 3. Assert no unreplaced template tag {{TAG}} remains
  const unreplacedTagMatch = xml.match(/\{\{(\w+)\}\}/);
  if (unreplacedTagMatch) {
    const errMsg = `Validation failed: Unreplaced template tag "${unreplacedTagMatch[0]}" remains in the generated document.`;
    logger.error(`[renderDocx] ${errMsg}`);
    throw new TemplateError(errMsg);
  }

  const isEmployee = templateFile.includes('employee');

  // 4. Assert no raw placeholder text remains (case-sensitive to avoid matching lowercase boilerplates/labels)
  const activePlaceholders = isEmployee 
    ? ['Mr./Ms. NAME', 'EMPLOYEE NAME', 'DESIGNATION', 'JOINING DATE', 'ADDRESS']
    : ['(Stamping Date)', '(commencement date)', 'Brands Category', 'Location setup', 'Total Amount', 'Le gal Name'];

  for (const ph of activePlaceholders) {
    if (xml.includes(ph)) {
      const idx = xml.indexOf(ph);
      const snippet = xml.slice(Math.max(0, idx - 100), Math.min(xml.length, idx + ph.length + 100));
      const errMsg = `Validation failed: Raw placeholder text "${ph}" remains in the generated document. Context:\n${snippet}`;
      logger.error(`[renderDocx] ${errMsg}`);
      throw new TemplateError(errMsg);
    }
  }

  // 5. Assert actual party name exists in plain text inside the document
  const primaryNameKey = isEmployee ? 'EMPLOYEE_NAME' : 'LEGAL_NAME';
  const expectedName = data[primaryNameKey];
  if (expectedName) {
    const escapedExpectedName = escapeXml(expectedName);
    if (!xml.includes(escapedExpectedName)) {
      const errMsg = `Validation failed: Expected party name "${expectedName}" was not found in the generated plain text document.`;
      logger.error(`[renderDocx] ${errMsg}`);
      throw new TemplateError(errMsg);
    }
  }

  // 6. DOM parsing syntax verification
  try {
    let hasError = false;
    let errorMsg = '';
    const parser = new DOMParser({
      errorHandler: (level, msg) => {
        if (level === 'error' || level === 'fatalError') {
          hasError = true;
          errorMsg = String(msg);
        }
      }
    });
    parser.parseFromString(xml, 'text/xml');
    if (hasError) {
      throw new Error(errorMsg);
    }
  } catch (e: any) {
    const errMsg = `Validation failed: Invalid DOCX XML generated. Syntax error: ${e.message}`;
    logger.error(`[renderDocx] ${errMsg}`);
    throw new TemplateError(errMsg);
  }

  logger.gen(`[renderDocx] Validation passed successfully!`);

  zip.file('word/document.xml', xml);
  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
