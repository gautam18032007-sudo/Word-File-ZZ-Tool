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

const TEMPLATES_DIR = path.resolve(process.cwd(), '..', 'templates');

export class TemplateError extends Error {}

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
      result += para.slice(lastEnd, m.index + m[0].indexOf(m[2]));
      result += newTexts[i];
      lastEnd = m.index + m[0].indexOf(m[2]) + m[2].length;
    }
    result += para.slice(lastEnd);
    return result;
  });
}

// ─── Literal replacement ops ──────────────────────────────────────────────────

function literalOps(concat: string, replacements: [string, string][]): Op[] {
  const ops: Op[] = [];
  let i = 0;
  while (i < concat.length) {
    let bestLen = 0;
    let bestTo: string | null = null;
    for (const [frm, to] of replacements) {
      if (frm.length > bestLen && concat.startsWith(frm, i)) {
        bestLen = frm.length;
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
  const qL = '\u201c'; // "
  const qR = '\u201d'; // "
  const replacements: [string, string][] = [
    [qL + 'Mr./Ms. NAME' + qR, '{{EMPLOYEE_NAME}}'],
    ['Mr./Ms. NAME', '{{EMPLOYEE_NAME}}'],
    [qL + 'ADDRESS' + qR, '{{EMPLOYEE_ADDRESS}}'],
    ['ADDRESS', '{{EMPLOYEE_ADDRESS}}'],
    [qL + 'DESIGNATION' + qR, '{{DESIGNATION}}'],
    ['DESIGNATION', '{{DESIGNATION}}'],
    [qL + 'JOINING DATE' + qR, '{{JOINING_DATE}}'],
    ['JOINING DATE', '{{JOINING_DATE}}'],
    [qL + 'MONTHLY CTC IN WORDS' + qR, '{{MONTHLY_CTC_WORDS}}'],
    ['MONTHLY CTC IN WORDS', '{{MONTHLY_CTC_WORDS}}'],
    [qL + 'MONTHLY CTC' + qR, '{{MONTHLY_CTC}}'],
    ['MONTHLY CTC', '{{MONTHLY_CTC}}'],
    [qL + 'ANNUAL CTC IN WORDS' + qR, '{{ANNUAL_CTC_WORDS}}'],
    ['ANNUAL CTC IN WORDS', '{{ANNUAL_CTC_WORDS}}'],
    [qL + 'ANNUAL CTC' + qR, '{{ANNUAL_CTC}}'],
    ['ANNUAL CTC', '{{ANNUAL_CTC}}'],
  ];
  xml = replaceAcrossRuns(xml, replacements);
  xml = preprocessPronouns(xml);
  xml = preprocessEmployeeTable(xml);
  return xml;
}

function preprocessBrandXml(xml: string): string {
  const replacements: [string, string][] = [
    ['(Stamping Date)', '{{STAMPING_DATE}}'],
    ['(commencement date)', '{{EFFECTIVE_DATE}}'],
    ['Effective Date', '{{EFFECTIVE_DATE}}'],
    ['Le gal Name', '{{LEGAL_NAME}}'],
    ['Legal Name', '{{LEGAL_NAME}}'],
    ['Brands Category', '{{BRAND_CATEGORY}}'],
    ['Brand Category', '{{BRAND_CATEGORY}}'],
    ['Address', '{{ADDRESS}}'],
    ['No of SKUs', '{{NO_OF_SKUS}}'],
    ['No of  months', '{{NO_OF_MONTHS}}'],
    ['Total Amount', '{{TOTAL_AMOUNT}}'],
    ['Amount', '{{AMOUNT}}'],
    ['Location  Setup', '{{LOCATION_TEXT}}'],
    ['Location setup', '{{LOCATION_TEXT}}'],
    ['Comm%', '{{COMMISSION_PCT}}'],
    ['Payment Method', '{{PAYMENT_METHOD}}'],
  ];
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
  return xml.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeXml(data[key] ?? ''));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function renderDocx(templateFile: string, data: Record<string, string>): Buffer {
  const tplPath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(tplPath)) {
    throw new TemplateError(`Template not found: templates/${templateFile}`);
  }

  const content = fs.readFileSync(tplPath);
  const zip = new PizZip(content);

  let xml = zip.file('word/document.xml')!.asText();

  if (templateFile.includes('employee')) {
    xml = preprocessEmployeeXml(xml);
  } else {
    xml = preprocessBrandXml(xml);
  }

  xml = fillTags(xml, data);

  zip.file('word/document.xml', xml);
  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
