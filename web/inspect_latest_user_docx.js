const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const tplPath = path.join(__dirname, 'templates/lor/LOR-TEMPLATE.docx');
if (!fs.existsSync(tplPath)) {
  console.error('File not found:', tplPath);
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(tplPath));
const xml = zip.file('word/document.xml').asText();

const pMatches = xml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
const lines = pMatches.map((p, i) => {
  const texts = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
  return `P${i}: "${texts}"`;
}).filter(l => !l.endsWith('""'));

fs.writeFileSync('latest_docx_dump.txt', lines.join('\n'));
console.log('Wrote latest_docx_dump.txt with', lines.length, 'non-empty paragraphs');
