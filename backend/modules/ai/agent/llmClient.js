// One shared client for the language model.
// It uses the "OpenAI-compatible" API, so it works with OpenRouter (default) and with OpenAI.
// Key lookup order: LLM_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY (and the old ANTHROPIC_API_KEY name).
const OpenAI = require('openai');
const config = require('../config/ai.config');

let client = null;

function getApiKey() {
  return process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
}

function getLlmClient() {
  const apiKey = getApiKey().trim();
  if (!apiKey) {
    const err = new Error('LLM_API_KEY is not set in backend/.env');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: config.llm.baseURL,
      maxRetries: 2,
      timeout: 60000,
      defaultHeaders: { 'X-Title': 'Enterprise Marketplace AI' }, // shown on the OpenRouter dashboard
    });
  }
  return client;
}

module.exports = { getLlmClient, getApiKey };
