const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'templates/lor/LOR_Template.DOC');
const dstPath = path.join(__dirname, 'templates/lor/LOR-TEMPLATE.DOC.docx');

if (!fs.existsSync(srcPath)) {
  console.error('File not found:', srcPath);
  process.exit(1);
}

const zip = new PizZip(fs.readFileSync(srcPath));
let xml = zip.file('word/document.xml').asText();

// 1. Replace hardcoded "Aditya Bisht" with {{FULL_NAME}}
xml = xml.replace('Aditya Bisht', '{{FULL_NAME}}');

// 2. Replace hardcoded "1st Feb, 2026" with {{DATE}}
xml = xml.replace('1st Feb, 2026', '{{DATE}}');

// 3. Replace hardcoded "Social Media Intern" in P10 with {{DESIGNATION}}
xml = xml.replace('Social Media Intern', '{{DESIGNATION}}');

// 4. Replace hardcoded body text paragraphs (P15..P21) with {{FINAL_DRAFT}}
const p15Start = xml.indexOf('This is to certify that');
if (p15Start !== -1) {
  const p15StartPara = xml.lastIndexOf('<w:p', p15Start);
  const p21End = xml.indexOf('endeavors.', p15Start);
  const p21EndPara = xml.indexOf('</w:p>', p21End) + 6;

  const templateDraftPara = `<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:spacing w:line="252" w:lineRule="auto" w:before="80" w:after="0"/><w:ind w:left="137" w:right="0"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr><w:t>{{FINAL_DRAFT}}</w:t></w:r></w:p>`;

  xml = xml.slice(0, p15StartPara) + templateDraftPara + xml.slice(p21EndPara);
  console.log('Replaced body paragraphs with {{FINAL_DRAFT}}');
}

// 5. Append Signatory Name and Role after "Best Regards"
const bestRegardsIdx = xml.indexOf('Best');
if (bestRegardsIdx !== -1) {
  const bestRegardsParaEnd = xml.indexOf('</w:p>', bestRegardsIdx) + 6;
  const signatoryParas = `
<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:spacing w:before="0" w:after="0"/><w:ind w:left="137"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{SIGNATORY_NAME}}</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:spacing w:before="0" w:after="0"/><w:ind w:left="137"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="2E2E2E"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">{{SIGNATORY_ROLE}}</w:t></w:r></w:p>
`;
  xml = xml.slice(0, bestRegardsParaEnd) + signatoryParas + xml.slice(bestRegardsParaEnd);
  console.log('Appended {{SIGNATORY_NAME}} and {{SIGNATORY_ROLE}} after Best Regards');
}

// Standardize left indents to 137 and right indent to 0
xml = xml.replace(/<w:ind w:left="360"\s*\/>/g, '<w:ind w:left="137"/>');
xml = xml.replace(/<w:ind w:left="360" w:right="0" w:firstLine="0"\s*\/>/g, '<w:ind w:left="137" w:right="0" w:firstLine="0"/>');
xml = xml.replace(/<w:ind w:left="155"\s*\/>/g, '<w:ind w:left="137"/>');
xml = xml.replace(/w:right="702"/g, 'w:right="0"');

zip.file('word/document.xml', xml);
const outBuffer = zip.generate({ type: 'nodebuffer' });

fs.writeFileSync(dstPath, outBuffer);
console.log('Successfully compiled user template into LOR-TEMPLATE.DOC.docx');
