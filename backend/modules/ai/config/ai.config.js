// ============================================================
// AI layer settings - every tunable number lives in this file.
// Beginner tip: change values here instead of hunting through code.
// ============================================================

module.exports = {
  // Master switch. Set AI_ENABLED=false in .env to turn the whole AI layer off.
  enabled: process.env.AI_ENABLED !== 'false',

  // The language model service. We talk to it through the OpenAI-compatible API,
  // which OpenRouter (and OpenAI itself) support. Model names follow the OpenRouter style.
  llm: {
    baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  },

  models: {
    agent: process.env.AI_AGENT_MODEL || 'openai/gpt-4.1-mini', // main assistant (tool use + answers)
    classifier: process.env.AI_CLASSIFIER_MODEL || 'openai/gpt-4o-mini', // cheap, fast injection "second opinion"
  },

  agent: {
    maxTokens: 2048, // max length of one model answer
    maxToolRounds: 6, // safety: the model may call tools at most this many rounds per question
    temperature: 0.2, // low = more predictable answers
    historyMessages: 12, // how many past messages we send back for context
  },

  // Prompt caching: the big, unchanging start of the prompt (system prompt + tools) is cached by the
  // provider, so repeated requests are cheaper and faster. OpenAI models cache automatically
  // (prompts over 1024 tokens). For anthropic/* models on OpenRouter we add an explicit marker.
  caching: {
    explicitMarkerPrefixes: ['anthropic/'],
  },

  rag: {
    topK: 4, // how many chunks we hand to the model
    chunkSize: 700, // characters per chunk (about 150 words)
    chunkOverlap: 100, // characters shared between neighbouring chunks
    minScore: 0.2, // chunks scoring lower than this are thrown away
    vectorWeight: 0.6, // hybrid search: 60% meaning ...
    keywordWeight: 0.4, // ... and 40% exact words
    embeddingModel: 'Xenova/all-MiniLM-L6-v2', // small local model, 384 numbers per text
    embeddingProvider: process.env.EMBEDDINGS_PROVIDER || 'auto', // auto | local | hash
    cacheSeconds: 600, // Redis cache for repeated searches
  },

  guardrails: {
    maxInputChars: 2000,
    rateLimitPerMinute: 20,
    injectionBlockScore: 0.7, // rules alone block at or above this score
    injectionReviewScore: 0.25, // between review and block we ask the classifier model
    failClosedScore: 0.5, // if the classifier is unavailable, block at or above this
    maxOrderQuantityPerLine: 10,
    maxOrderValue: 5000,
    maxStockValue: 100000,
    pendingActionMinutes: 10, // a "Confirm" button stays valid for 10 minutes
  },

  // Output filter: if a reply contains this marker, the system prompt leaked.
  canary: 'EMP-CANARY-7f3a91',
};
