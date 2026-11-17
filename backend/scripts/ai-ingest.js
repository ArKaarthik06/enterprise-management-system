// Index the policy documents for RAG.   Run:  npm run ai:ingest
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { ingestDocuments } = require('../modules/ai/rag/ingest');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/enterprise_marketplace');
    const result = await ingestDocuments();
    console.log('Ingest finished:', result);
  } catch (err) {
    console.error('Ingest failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
})();
