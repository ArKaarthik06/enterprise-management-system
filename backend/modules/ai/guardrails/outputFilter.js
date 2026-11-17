// Last guardrail: check the model's answer BEFORE the user sees it.
const config = require('../config/ai.config');
const { scrubSensitive } = require('./piiMasker');

const REFUSAL_TEXT = "I'm sorry, I can't share that. Is there something else about orders, products or our policies I can help with?";

// Compare the reply with the system prompt: long shared phrases mean the prompt leaked.
function leaksSystemPrompt(reply, systemPrompt) {
  if (reply.includes(config.canary)) return true;
  const words = systemPrompt.split(/\s+/);
  const replyNorm = reply.replace(/\s+/g, ' ');
  for (let i = 0; i + 14 <= words.length; i += 7) {
    if (replyNorm.includes(words.slice(i, i + 14).join(' '))) return true; // 14 words in a row
  }
  return false;
}

// Citations look like [source: file-name.md]. Remove any the model made up.
function checkCitations(reply, retrievedSources) {
  const known = new Set(retrievedSources);
  let removed = 0;
  const cleaned = reply.replace(/\[source:\s*([^\]]+)\]/gi, (match, name) => {
    if (known.has(name.trim())) return match;
    removed += 1;
    return '';
  }).replace(/[ \t]+\n/g, '\n').trim();
  return { text: cleaned, removed };
}

function filterOutput({ reply, systemPrompt, retrievedSources = [] }) {
  const issues = [];

  if (leaksSystemPrompt(reply, systemPrompt)) {
    return { ok: false, text: REFUSAL_TEXT, issues: ['system_prompt_leak'] };
  }

  let text = reply;

  const scrub = scrubSensitive(text);
  if (scrub.findings.length) {
    text = scrub.text;
    issues.push(`sensitive_data_removed:${scrub.findings.map((f) => f.type).join(',')}`);
  }

  const cites = checkCitations(text, retrievedSources);
  if (cites.removed) issues.push(`fake_citations_removed:${cites.removed}`);
  text = cites.text;

  return { ok: true, text, issues };
}

module.exports = { filterOutput, REFUSAL_TEXT, leaksSystemPrompt };
