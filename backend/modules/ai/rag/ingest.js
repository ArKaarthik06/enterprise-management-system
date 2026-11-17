// Runs the whole RAG indexing pipeline: load -> chunk -> embed -> store.
const { loadDocuments } = require('./loader');
const { chunkText } = require('./chunker');
const { embed, getProvider } = require('./embedder');
const vectorStore = require('./vectorStore');
const { clearSearchCache } = require('./retriever');

async function ingestDocuments() {
  const provider = await getProvider();
  const docs = await loadDocuments();

  const records = [];
  for (const doc of docs) {
    const pieces = chunkText(doc.text, doc.title);
    for (let i = 0; i < pieces.length; i++) {
      records.push({
        source: doc.source,
        title: doc.title,
        category: doc.category,
        access: doc.access,
        order: i,
        text: pieces[i],
        embedding: await embed(pieces[i]),
        provider,
      });
    }
  }

  await vectorStore.replaceAll(records);
  await clearSearchCache();
  return { documents: docs.length, chunks: records.length, provider };
}

module.exports = { ingestDocuments };
