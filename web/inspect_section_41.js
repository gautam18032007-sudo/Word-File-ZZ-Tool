const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const tplPath = path.join(__dirname, 'templates/brand-contract-template.docx');
const zip = new PizZip(fs.readFileSync(tplPath));
const xml = zip.file('word/document.xml').asText();

const pMatches = xml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
pMatches.forEach((p, i) => {
  const texts = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
  if (texts.includes('4.1') || texts.includes('agrees to pay') || texts.includes('advance fixed fee') || texts.includes('commission of')) {
    console.log(`P${i}: "${texts}"`);
    console.log(`XML: ${p}\n---`);
  }
});
