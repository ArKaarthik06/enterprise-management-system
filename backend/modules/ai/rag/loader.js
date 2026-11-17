// Step 1 of RAG: LOAD documents from the documents/ folder.
// Supports .md / .txt (with an optional front-matter header) and .pdf files.
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'documents');
const VALID_ACCESS = ['public', 'seller', 'admin'];

// Reads the "---" header at the top of a markdown file:
//   ---
//   title: Return Policy
//   access: public
//   ---
function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return { meta, body: match[2] };
}

async function readPdf(filePath) {
  // require the inner file: the package index runs a debug routine on import
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(fs.readFileSync(filePath));
  return data.text;
}

async function loadDocuments(dir = DOCS_DIR) {
  const docs = [];
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(dir, file);

    if (ext === '.md' || ext === '.txt') {
      const { meta, body } = parseFrontMatter(fs.readFileSync(filePath, 'utf8'));
      docs.push({
        source: file,
        title: meta.title || file,
        access: VALID_ACCESS.includes(meta.access) ? meta.access : 'public',
        category: meta.category || 'policy',
        text: body,
      });
    } else if (ext === '.pdf') {
      // PDFs have no header, so they are public product documents by default.
      let text;
      try {
        text = await readPdf(filePath);
      } catch (err) {
        console.warn(`[AI] Skipping unreadable PDF ${file}: ${err.message}`);
        continue; // one bad file must not stop the whole ingest
      }
      docs.push({
        source: file,
        title: file.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        access: 'public',
        category: 'product',
        text,
      });
    }
  }
  return docs;
}

module.exports = { loadDocuments, parseFrontMatter, DOCS_DIR };
