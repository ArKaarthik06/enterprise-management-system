// Step 2 of RAG: CHUNK. Models work best with small focused pieces of text,
// so we cut every document into chunks of roughly `chunkSize` characters.
// Neighbouring chunks overlap a little so a sentence is not cut off from its context.
const config = require('../config/ai.config');

function chunkText(text, title, { chunkSize, chunkOverlap } = config.rag) {
  // 1) split into paragraphs (blank-line separated), ignoring empty ones
  const paragraphs = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
  };

  for (const para of paragraphs) {
    // a paragraph that is itself too long is cut at sentence ends
    const pieces = para.length > chunkSize ? para.split(/(?<=[.!?])\s+/) : [para];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > chunkSize) {
        flush();
        // start the next chunk with the tail of the previous one (the overlap)
        current = current.slice(-chunkOverlap).replace(/^\S*\s/, '') + '\n\n';
      }
      current += (current && !current.endsWith('\n\n') ? '\n\n' : '') + piece;
    }
  }
  flush();

  // Every chunk starts with the document title so it still makes sense on its own.
  return chunks.map((c) => `${title}\n${c}`);
}

module.exports = { chunkText };
