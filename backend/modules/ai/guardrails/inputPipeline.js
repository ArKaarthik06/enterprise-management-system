// Runs ALL input guardrails in order and returns one decision.
//   1. clean + limit the text          (inputFilter)
//   2. mask personal data              (piiMasker)
//   3. fast rule-based injection scan  (injectionDetector)
//   4. if unsure: ask a small classifier model for a second opinion
const config = require('../config/ai.config');
const { filterInput } = require('./inputFilter');
const { maskPII } = require('./piiMasker');
const { detectInjection, classifyWithModel } = require('./injectionDetector');

const SAFE_REPLY = "I can't help with that request. I can answer questions about orders, products and our policies though.";

// `deps.classify(text)` can be replaced in tests.
async function runInputGuards(rawText, deps = {}) {
  // 1. clean
  const cleaned = filterInput(rawText);
  if (!cleaned.ok) return { ok: false, stage: 'input_filter', reason: cleaned.reason, reply: cleaned.reason };

  // 2. mask PII (the model and the logs only ever see the masked text)
  const pii = maskPII(cleaned.text);

  // 3. rules
  const scan = detectInjection(cleaned.text);
  const base = { text: pii.text, piiMap: pii.map, piiFindings: pii.findings, injectionScore: scan.score };

  if (scan.verdict === 'block') {
    return { ok: false, stage: 'injection', reason: scan.matches.map((m) => m.label).join('; '), reply: SAFE_REPLY, ...base };
  }

  // 4. second opinion for borderline messages
  if (scan.verdict === 'suspicious') {
    const reasons = scan.matches.map((m) => m.label).join('; ');
    try {
      const classify = deps.classify || (async (t) => classifyWithModel(t, require('../agent/llmClient').getLlmClient()));
      const verdict = await classify(cleaned.text);
      if (verdict.injection && verdict.confidence >= 0.6) {
        return { ok: false, stage: 'injection', reason: `classifier: ${verdict.reason || reasons}`, reply: SAFE_REPLY, ...base };
      }
    } catch (err) {
      // Classifier unavailable: "fail closed" for the more suspicious messages.
      if (scan.score >= config.guardrails.failClosedScore) {
        return { ok: false, stage: 'injection', reason: `${reasons} (classifier unavailable)`, reply: SAFE_REPLY, ...base };
      }
    }
  }

  return { ok: true, ...base };
}

module.exports = { runInputGuards, SAFE_REPLY };
