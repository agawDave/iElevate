// Run with: node --test src/lib/wordText.test.js (from frontend/)
import test from 'node:test';
import assert from 'node:assert';
import { wordXmlToText } from './wordText.js';

const numbering = `<w:numbering>
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
const item = (level, text, bold = false) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>`
  + `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

test("rebuilds Word's automatic numbering and marks the bold choice as correct", () => {
  const xml = `<w:document><w:body>${[
    item(0, 'Which key saves a file?'), item(1, 'Ctrl + P'), item(1, 'Ctrl + S', true), item(1, 'Ctrl &amp; Z'),
    '<w:p/>',
    item(0, 'What does CPU stand for?'), item(1, 'Central Processing Unit'), item(1, 'Computer Power Unit'),
    '<w:p><w:r><w:t>Answer: a</w:t></w:r></w:p>',
  ].join('')}</w:body></w:document>`;
  assert.strictEqual(wordXmlToText(xml, numbering), [
    '1. Which key saves a file?', 'a. Ctrl + P', '*b. Ctrl + S', 'c. Ctrl & Z',
    '2. What does CPU stand for?', 'a. Central Processing Unit', 'b. Computer Power Unit',
    'Answer: a',
  ].join('\n'));
});

test('typed numbers and bold questions are left as they are', () => {
  const xml = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>1. Bold question?</w:t></w:r></w:p><w:p><w:r><w:t>a. One</w:t></w:r></w:p>';
  assert.strictEqual(wordXmlToText(xml, ''), '1. Bold question?\na. One');
});
