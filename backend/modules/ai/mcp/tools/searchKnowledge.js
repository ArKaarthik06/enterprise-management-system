// RAG exposed as a tool: the model decides when it needs to look something up.
const { z } = require('zod');
const { searchKnowledge } = require('../../rag/retriever');

module.exports = {
  name: 'search_knowledge_base',
  description: 'Search the official policy documents and product guides (returns, shipping, cancellation, payments, privacy, seller rules, warranty, product care). ALWAYS use this before answering any policy or "how does X work" question. Returns text excerpts with their source file names.',
  roles: ['customer', 'product_owner', 'root_admin'],
  kind: 'read',
  input: {
    query: z.string().min(3).max(300).describe('What to look for, written as a short search phrase'),
    category: z.enum(['policy', 'product']).optional().describe('Optional: limit to policy documents or product guides'),
  },
  async run({ query, category }, ctx) {
    // The role comes from the logged-in user (ctx), so access levels are enforced server-side.
    const results = await searchKnowledge({ query, role: ctx.role, category });
    if (!results.length) return { found: false, message: 'No relevant document found. Say you do not know instead of guessing.' };
    return { found: true, excerpts: results.map((r) => ({ source: r.source, title: r.title, text: r.text, relevance: r.score })) };
  },
  extractSources: (data) => (data.excerpts || []).map((e) => e.source),
};
