// Reads the text of a Word file (.docx) for Paste questions, one line per
// paragraph. Word's automatic numbering ("1.", "a.") isn't stored as text, so
// it's rebuilt from numbering.xml; without it questions and choices look alike.
// A choice in bold or highlighted gets a * (the mark for the correct answer).
// shortcut: numbering that comes from a paragraph style (styles.xml) isn't rebuilt; read styles.xml too if specialists hit it.

const decode = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const valueOf = (xml, tag) => new RegExp(`<w:${tag} [^>]*w:val="([^"]*)"`).exec(xml)?.[1];

// numId → list level → number format ("decimal", "lowerLetter", "bullet", …).
function readFormats(numberingXml = '') {
  const abstract = {};
  for (const [, id, body] of numberingXml.matchAll(/<w:abstractNum [^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    abstract[id] = {};
    for (const [, level, levelBody] of body.matchAll(/<w:lvl [^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      abstract[id][level] = valueOf(levelBody, 'numFmt');
    }
  }
  const formats = {};
  for (const [, numId, body] of numberingXml.matchAll(/<w:num [^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    formats[numId] = abstract[valueOf(body, 'abstractNumId')] || {};
  }
  return formats;
}

function markerFor(format, n) {
  if (format === 'decimal') return `${n}.`;
  if (format === 'lowerLetter') return `${String.fromCharCode(96 + n)}.`;
  if (format === 'upperLetter') return `${String.fromCharCode(64 + n)}.`;
  return ''; // bullets and the rest
}

// word/document.xml (+ word/numbering.xml) → plain text.
export function wordXmlToText(documentXml, numberingXml) {
  const formats = readFormats(numberingXml);
  const counters = {}; // numId → the count at each list level
  const lines = [];
  for (const [paragraph] of documentXml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const numId = valueOf(paragraph, 'numId');
    let marker = '';
    if (numId && numId !== '0') {
      const level = Number(valueOf(paragraph, 'ilvl') || 0);
      const levels = (counters[numId] ||= []);
      levels[level] = (levels[level] || 0) + 1;
      levels.length = level + 1; // a new item starts its sub-list over
      marker = markerFor(formats[numId]?.[level], levels[level]);
    }
    // The paragraph's own settings hold tab stops, which aren't text.
    const runs = [...paragraph.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, '').matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map(([run]) => ({
      text: [...run.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:(tab|br)\b[^>]*\/>/g)]
        .map((match) => (match[2] === 'tab' ? '\t' : match[2] ? '\n' : decode(match[1]))).join(''),
      marked: /<w:(b|highlight)(?: w:val="(?!0|false|none)[^"]*")?\s*\/>/.test(run),
    }));
    const text = runs.map((run) => run.text).join('').trim();
    if (!text && !marker) continue;
    const line = marker ? `${marker} ${text}` : text;
    const written = runs.filter((run) => run.text.trim());
    const isChoice = /^\(?[a-h][.)]/i.test(line);
    lines.push(isChoice && written.length && written.every((run) => run.marked) ? `*${line}` : line);
  }
  return lines.join('\n');
}

// The named files inside a zip (a .docx is one), as text.
async function unzip(buffer, wanted) {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22; // the zip's table of contents ends here
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("This doesn't look like a Word file.");
  const decoder = new TextDecoder();
  const files = {};
  let at = view.getUint32(end + 16, true);
  for (let i = view.getUint16(end + 10, true); i > 0; i -= 1) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, at + 46, nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (!wanted.includes(name)) continue;
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const bytes = new Uint8Array(buffer, start, size);
    files[name] = method === 0
      ? decoder.decode(bytes)
      : await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  return files;
}

// A .docx or .txt file the specialist picked → the text for Paste questions.
export async function readQuestionsFile(file) {
  if (/\.txt$/i.test(file.name)) return file.text();
  if (!/\.docx$/i.test(file.name)) throw new Error('Choose a Word file (.docx). If it is an older .doc file, open it in Word and save it as .docx first.');
  const files = await unzip(await file.arrayBuffer(), ['word/document.xml', 'word/numbering.xml']);
  if (!files['word/document.xml']) throw new Error("This doesn't look like a Word file.");
  return wordXmlToText(files['word/document.xml'], files['word/numbering.xml']);
}
